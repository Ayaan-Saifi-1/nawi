import path from 'path';
import fs from 'fs';
import os from 'node:os';
import puppeteer from 'puppeteer';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
} from 'docx';
import { TestSession } from '../models/TestSession.js';
import { Observation } from '../models/Observation.js';
import { InstrumentModel } from '../models/InstrumentModel.js';
import { Manufacturer } from '../models/Manufacturer.js';
import { Attachment } from '../models/Attachment.js';
import { Report, Counter } from '../models/Report.js';
import { sha256, signData } from '../utils/hash.js';
import { signReportDigest } from './digitalSignature.service.js';
import { appendAuditLog } from './auditLogger.service.js';
import { AppError } from '../utils/AppError.js';
import { generateQrSvg } from '../utils/qrGenerator.js';
import { env } from '../config/env.js';
import { removeStoredFile, storeFile } from './fileStorage.service.js';

const reportsDir = env.isVercel
  ? path.join(os.tmpdir(), 'nawi-reports')
  : path.join(process.cwd(), 'uploads', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function getBrowserExecutablePath() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function launchBrowser() {
  if (env.isVercel) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    headless: true,
    executablePath: getBrowserExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function getNextReportNumber() {
  const year = new Date().getFullYear();
  const counterName = `report_seq_${year}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(6, '0');
  return `NAWI-${year}-${seqStr}`;
}

import { generateHtmlTemplate, buildDocxDocument } from '../utils/reportBuilders.js';

async function renderPdf({ html, pdfPath }) {
  let browser;
  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      printBackground: true,
    });
  } catch (error) {
    console.error('Puppeteer PDF generation error:', error);
    throw new AppError(500, 'PDF_RENDER_FAILED', 'PDF document rendering failed: ' + error.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function renderDocx(params) {
  try {
    const doc = buildDocxDocument(params);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(params.docxPath, buffer);
  } catch (err) {
    console.error('DOCX generation error:', err);
    throw new AppError(500, 'DOCX_RENDER_FAILED', 'DOCX document rendering failed: ' + err.message);
  }
}

export async function generateReport({ testSessionId, userId, remarks }) {
  const session = await TestSession.findById(testSessionId).populate({
    path: 'instrumentModelId',
    populate: { path: 'manufacturerId' },
  });

  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  if (!['passed', 'failed'].includes(session.status) || !['pass', 'fail'].includes(session.overallResult)) {
    throw new AppError(
      409,
      'INVALID_STATE',
      'Cannot generate a report unless the session has been reviewed and approved (passed or failed)'
    );
  }

  const latestReport = await Report.findOne({ testSessionId: session._id }).sort({ revisionNumber: -1 });
  if (latestReport && !['archived', 'revoked'].includes(latestReport.status)) {
    throw new AppError(
      409,
      'REPORT_EXISTS',
      `Report ${latestReport.reportNumber} must be archived or revoked before generating a replacement`
    );
  }
  const revisionNumber = (latestReport?.revisionNumber || 0) + 1;

  const observations = await Observation.find({ testSessionId: session._id, deletedAt: null }).populate('ruleConfigId');
  const attachments = await Attachment.find({ testSessionId: session._id });
  const registeredModel = session.instrumentModelId;
  const model = {
    modelName: session.modelName || registeredModel.modelName,
    accuracyClass: session.accuracyClass || registeredModel.accuracyClass,
    maxCapacity: session.maxCapacity ?? registeredModel.maxCapacity,
    minCapacity: session.minCapacity ?? registeredModel.minCapacity,
    e: session.scaleInterval ?? registeredModel.e,
    n: Math.round((session.maxCapacity ?? registeredModel.maxCapacity) / (session.scaleInterval ?? registeredModel.e)),
  };
  const manufacturer = { name: session.manufacturerName || registeredModel.manufacturerId.name };

  const reportNumber = await getNextReportNumber();
  const generatedAt = new Date();

  const pdfFilename = `${reportNumber}.pdf`;
  const docxFilename = `${reportNumber}.docx`;
  const pdfPathRel = path.join('uploads', 'reports', pdfFilename);
  const docxPathRel = path.join('uploads', 'reports', docxFilename);
  const pdfPathAbs = path.join(reportsDir, pdfFilename);
  const docxPathAbs = path.join(reportsDir, docxFilename);

  const html = generateHtmlTemplate({
    reportNumber,
    session,
    model,
    manufacturer,
    observations,
    attachments,
    generatedAt,
    remarks,
  });

  await renderPdf({ html, pdfPath: pdfPathAbs });
  await renderDocx({ reportNumber, session, model, manufacturer, observations, attachments, docxPath: docxPathAbs, remarks });

  // Keep the server HMAC for storage-integrity checks and add an external PKI signature when configured.
  const pdfBuffer = fs.readFileSync(pdfPathAbs);
  const contentHash = sha256(pdfBuffer);
  const hmacTag = signData(contentHash);
  const docxBuffer = fs.readFileSync(docxPathAbs);
  const docxContentHash = sha256(docxBuffer);
  const docxHmacTag = signData(docxContentHash);
  let pdfSigning;
  let docxSigning;
  try {
    [pdfSigning, docxSigning] = await Promise.all([
      signReportDigest(contentHash),
      signReportDigest(docxContentHash),
    ]);
  } catch (error) {
    fs.rmSync(pdfPathAbs, { force: true });
    fs.rmSync(docxPathAbs, { force: true });
    throw error;
  }

  let pdfStoredFile;
  let docxStoredFile;
  try {
    pdfStoredFile = await storeFile(pdfPathRel, pdfBuffer);
    docxStoredFile = await storeFile(docxPathRel, docxBuffer);
  } catch (error) {
    if (pdfStoredFile) await removeStoredFile({ storageFileId: pdfStoredFile.storageFileId, filePath: pdfPathRel });
    if (docxStoredFile) await removeStoredFile({ storageFileId: docxStoredFile.storageFileId, filePath: docxPathRel });
    if (env.isVercel) {
      fs.rmSync(pdfPathAbs, { force: true });
      fs.rmSync(docxPathAbs, { force: true });
    }
    throw error;
  }

  let report;
  try {
    report = await Report.create({
      testSessionId: session._id,
      revisionNumber,
      supersedesReportId: latestReport?._id || null,
      reportNumber,
      contentHash,
      docxContentHash,
      hmacTag,
      docxHmacTag,
      signatureAlgorithm: pdfSigning ? pdfSigning.algorithm : 'HMAC-SHA256',
      pdfSignature: pdfSigning?.signature || null,
      docxSignature: docxSigning?.signature || null,
      signatureCertificate: pdfSigning?.certificatePem || null,
      certificateFingerprint: pdfSigning?.certificateFingerprint || null,
      signerKeyId: pdfSigning?.keyId || null,
      pdfSignedAt: pdfSigning?.signedAt || null,
      docxSignedAt: docxSigning?.signedAt || null,
      pdfPath: pdfPathRel.replace(/\\/g, '/'),
      docxPath: docxPathRel.replace(/\\/g, '/'),
      pdfStorageFileId: pdfStoredFile.storageFileId,
      docxStorageFileId: docxStoredFile.storageFileId,
      status: 'integrity_tagged',
      officerRemarks: remarks ? remarks.trim() : null,
      generatedBy: userId,
      generatedAt,
    });
  } catch (error) {
    await Promise.all([
      removeStoredFile({ storageFileId: pdfStoredFile.storageFileId, filePath: pdfPathRel }),
      removeStoredFile({ storageFileId: docxStoredFile.storageFileId, filePath: docxPathRel }),
    ]);
    throw error;
  } finally {
    if (env.isVercel) {
      fs.rmSync(pdfPathAbs, { force: true });
      fs.rmSync(docxPathAbs, { force: true });
    }
  }

  if (latestReport) {
    latestReport.supersededByReportId = report._id;
    await latestReport.save();
    await appendAuditLog({
      entityType: 'Report',
      entityId: latestReport._id,
      action: `superseded_by:${report.reportNumber}`,
      userId,
    });
  }

  session.status = 'report_generated';
  await session.save();

  await appendAuditLog({
    entityType: 'Report',
    entityId: report._id,
    action: 'generate_report',
    userId,
  });

  return report;
}
