import { Report } from '../models/Report.js';
import { TestSession } from '../models/TestSession.js';
import { InstrumentModel } from '../models/InstrumentModel.js';
import { generateReport } from '../services/reportGenerator.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertSessionAccess, assertReportAccess, getManufacturerForUser, manufacturerModelIds, PUBLIC_ONLY_ROLES, PUBLIC_REPORT_STATUSES } from '../utils/tenantAccess.js';
import { sha256 } from '../utils/hash.js';
import { verifyReportArtifact } from '../services/digitalSignature.service.js';
import { appendAuditLog } from '../services/auditLogger.service.js';
import { readStoredFile } from '../services/fileStorage.service.js';

export const listReports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, labId, manufacturerId, accuracyClass, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let query = {};
  if (status) query.status = status;
  if (PUBLIC_ONLY_ROLES.includes(req.user.role)) {
    // Only published, archived or revoked reports are visible outside the issuing laboratory.
    query.status = !status ? { $in: PUBLIC_REPORT_STATUSES } : (PUBLIC_REPORT_STATUSES.includes(status) ? status : { $in: [] });
  }

  if (startDate || endDate) {
    query.generatedAt = {};
    if (startDate) query.generatedAt.$gte = new Date(startDate);
    if (endDate) query.generatedAt.$lte = new Date(endDate);
  }

  if (search) {
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { reportNumber: { $regex: escapedSearch, $options: 'i' } },
      { contentHash: { $regex: escapedSearch, $options: 'i' } },
      { docxContentHash: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  const sessionQuery = {};
  const labScoped = ['lab_technician', 'lab_admin', 'reviewer'].includes(req.user.role);
  if (labScoped) sessionQuery.labId = req.user.labId || null;
  else if (labId) sessionQuery.labId = labId;
  if (accuracyClass) sessionQuery.accuracyClass = accuracyClass;

  if (req.query.serialNumber) {
    const escapedSerial = String(req.query.serialNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sessionQuery.serialNumber = { $regex: escapedSerial, $options: 'i' };
  }
  if (req.query.modelName) {
    const escapedModel = String(req.query.modelName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sessionQuery.modelName = { $regex: escapedModel, $options: 'i' };
  }
  if (req.query.overallResult || req.query.result) {
    sessionQuery.overallResult = req.query.overallResult || req.query.result;
  }

  if (req.user.role === 'manufacturer') {
    const ownManufacturer = await getManufacturerForUser(req.user.sub);
    sessionQuery.instrumentModelId = { $in: await manufacturerModelIds(ownManufacturer?._id) };
  } else if (manufacturerId) {
    const models = await InstrumentModel.find({ manufacturerId }).select('_id');
    sessionQuery.instrumentModelId = { $in: models.map((model) => model._id) };
  }

  const matchingSessions = await TestSession.find(sessionQuery).select('_id');
  query.testSessionId = { $in: matchingSessions.map((session) => session._id) };

  const [reports, total] = await Promise.all([
    Report.find(query)
      .populate({
        path: 'testSessionId',
        populate: {
          path: 'instrumentModelId',
          populate: { path: 'manufacturerId' },
        },
      })
      .populate('supersededByReportId', 'reportNumber')
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Report.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      reports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      },
    },
  });
});

export const createReport = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await TestSession.findById(sessionId).populate('instrumentModelId');
  if (!session) throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  await assertSessionAccess(req, session);
  const { remarks, officerRemarks } = req.body || {};
  const report = await generateReport({
    testSessionId: sessionId,
    userId: req.user.sub,
    remarks: remarks || officerRemarks,
  });

  res.status(201).json({
    success: true,
    data: report,
  });
});

export const getReportById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate({
      path: 'testSessionId',
      populate: {
        path: 'instrumentModelId',
        populate: { path: 'manufacturerId' },
      },
    })
    .populate('generatedBy', 'name email role');

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }
  await assertReportAccess(req, report);

  res.status(200).json({
    success: true,
    data: report,
  });
});

export const downloadReportFile = asyncHandler(async (req, res) => {
  const { id, format } = req.params; // format: 'pdf' or 'docx'
  const report = await Report.findById(id).populate({ path: 'testSessionId', populate: { path: 'instrumentModelId' } });

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }

  await assertReportAccess(req, report);

  if (!['pdf', 'docx'].includes(format)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'format must be pdf or docx');
  }

  const filePath = format === 'docx' ? report.docxPath : report.pdfPath;
  const storageFileId = format === 'docx' ? report.docxStorageFileId : report.pdfStorageFileId;
  const contents = await readStoredFile({ storageFileId, filePath });
  const fileHash = sha256(contents);
  const expectedHash = format === 'pdf' ? report.contentHash : report.docxContentHash;
  if (!expectedHash || fileHash !== expectedHash || !verifyReportArtifact(fileHash, report, format)) {
    throw new AppError(409, 'REPORT_INTEGRITY_FAILED', 'Report integrity verification failed');
  }

  const contentType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  res.type(contentType).attachment(`${report.reportNumber}.${format}`).send(contents);
});

async function assertStoredReportIntegrity(report) {
  const artifacts = [
    { path: report.pdfPath, storageFileId: report.pdfStorageFileId, hash: report.contentHash, format: 'PDF' },
    { path: report.docxPath, storageFileId: report.docxStorageFileId, hash: report.docxContentHash, format: 'DOCX' },
  ];
  for (const artifact of artifacts) {
    if (!artifact.hash) {
      throw new AppError(409, 'REPORT_INTEGRITY_FAILED', `${artifact.format} file or integrity metadata is missing`);
    }
    let contents;
    try {
      contents = await readStoredFile({ storageFileId: artifact.storageFileId, filePath: artifact.path });
    } catch (error) {
      if (error.statusCode === 404) {
        throw new AppError(409, 'REPORT_INTEGRITY_FAILED', `${artifact.format} file or integrity metadata is missing`);
      }
      throw error;
    }
    const actualHash = sha256(contents);
    if (actualHash !== artifact.hash || !verifyReportArtifact(actualHash, report, artifact.format)) {
      throw new AppError(409, 'REPORT_INTEGRITY_FAILED', `${artifact.format} integrity verification failed`);
    }
  }
}

export const publishReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id).populate('testSessionId');
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found');
  await assertReportAccess(req, report);
  if (report.status !== 'integrity_tagged') {
    throw new AppError(409, 'INVALID_STATE', 'Only an integrity-tagged report can be published');
  }
  await assertStoredReportIntegrity(report);

  report.status = 'published';
  report.publishedAt = new Date();
  report.publishedBy = req.user.sub;
  await report.save();

  const session = report.testSessionId;
  session.status = 'published';
  await session.save();
  await appendAuditLog({ entityType: 'Report', entityId: report._id, action: 'publish', userId: req.user.sub });

  res.status(200).json({ success: true, data: report });
});

export const archiveReport = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid archival reason is required');
  }
  const report = await Report.findById(req.params.id).populate('testSessionId');
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found');
  await assertReportAccess(req, report);
  if (report.status !== 'published') {
    throw new AppError(409, 'INVALID_STATE', 'Only a published report can be archived');
  }

  report.status = 'archived';
  report.archivedAt = new Date();
  report.archivedBy = req.user.sub;
  await report.save();

  const session = report.testSessionId;
  session.status = session.overallResult === 'pass' ? 'passed' : 'failed';
  await session.save();
  await appendAuditLog({
    entityType: 'Report',
    entityId: report._id,
    action: `archive: ${reason.trim()}`,
    userId: req.user.sub,
  });

  res.status(200).json({ success: true, data: report });
});

export const revokeReport = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid revocation reason is required');
  }

  const report = await Report.findById(req.params.id).populate('testSessionId');
  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }
  await assertReportAccess(req, report);

  if (report.status === 'revoked') {
    throw new AppError(409, 'INVALID_STATE', 'Report is already revoked');
  }

  report.status = 'revoked';
  report.revokedAt = new Date();
  report.revokedBy = req.user.sub;
  report.revocationReason = reason.trim();
  await report.save();

  const [session, newerReport] = await Promise.all([
    TestSession.findById(report.testSessionId),
    Report.findOne({ supersedesReportId: report._id }),
  ]);
  if (!newerReport && ['report_generated', 'published'].includes(session?.status)) {
    session.status = session.overallResult === 'pass' ? 'passed' : 'failed';
    await session.save();
  }

  await appendAuditLog({
    entityType: 'Report',
    entityId: report._id,
    action: `revoke: ${reason.trim()}`,
    userId: req.user.sub,
  });

  res.status(200).json({
    success: true,
    data: report,
  });
});