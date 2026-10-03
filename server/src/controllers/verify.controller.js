import { Report } from '../models/Report.js';
import { TestSession } from '../models/TestSession.js';
import { sha256 } from '../utils/hash.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyReportArtifact } from '../services/digitalSignature.service.js';
import { readStoredFile } from '../services/fileStorage.service.js';

const PUBLICLY_VERIFIABLE_STATUSES = ['published', 'archived', 'revoked'];
const MAX_SERIAL_LOOKUP_RESULTS = 25;
const MAX_DETAILS_LOOKUP_RESULTS = 25;

export const lookupPublicReportsByInstrumentDetails = asyncHandler(async (req, res) => {
  const searchTerm = String(req.query.searchTerm || '').trim();
  const testYear = String(req.query.testYear || '').trim();
  if (searchTerm.length < 2 || searchTerm.length > 120) {
    throw new AppError(400, 'INVALID_SEARCH_TERM', 'Enter at least 2 characters to search instrument details');
  }
  if (testYear && (!/^\d{4}$/.test(testYear) || Number(testYear) < 1900 || Number(testYear) > 2100)) {
    throw new AppError(400, 'INVALID_TEST_YEAR', 'Enter a valid four-digit test year');
  }

  const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = {
    $or: ['manufacturerName', 'modelName', 'laboratoryName'].map((field) => ({
      [field]: { $regex: escapedSearchTerm, $options: 'i' },
    })),
  };
  if (testYear) {
    const yearStart = new Date(Date.UTC(Number(testYear), 0, 1));
    const yearEnd = new Date(Date.UTC(Number(testYear) + 1, 0, 1));
    match.testDate = { $gte: yearStart, $lt: yearEnd };
  }

  const matchingReports = await TestSession.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Report.collection.name,
        localField: '_id',
        foreignField: 'testSessionId',
        as: 'reports',
      },
    },
    { $unwind: '$reports' },
    { $match: { 'reports.status': { $in: PUBLICLY_VERIFIABLE_STATUSES } } },
    { $sort: { 'reports.publishedAt': -1, testDate: -1 } },
    { $limit: MAX_DETAILS_LOOKUP_RESULTS + 1 },
    {
      $project: {
        _id: 0,
        reportNumber: '$reports.reportNumber',
        status: '$reports.status',
        generatedAt: '$reports.generatedAt',
        publishedAt: '$reports.publishedAt',
        isSuperseded: { $ne: [{ $ifNull: ['$reports.supersededByReportId', null] }, null] },
        manufacturerName: 1,
        instrumentModelName: '$modelName',
        accuracyClass: 1,
        overallResult: 1,
        laboratoryName: 1,
        testDate: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      reports: matchingReports.slice(0, MAX_DETAILS_LOOKUP_RESULTS),
      hasMore: matchingReports.length > MAX_DETAILS_LOOKUP_RESULTS,
    },
  });
});

export const lookupReportsBySerialNumber = asyncHandler(async (req, res) => {
  const serialNumber = String(req.query.serialNumber || '').trim();
  if (!serialNumber || serialNumber.length > 120) {
    throw new AppError(400, 'INVALID_SERIAL_NUMBER', 'Enter a valid instrument serial number');
  }

  const escapedSerialNumber = serialNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sessions = await TestSession.find({
    serialNumber: { $regex: `^${escapedSerialNumber}$`, $options: 'i' },
  }).select('_id');
  const reports = await Report.find({
    status: { $in: PUBLICLY_VERIFIABLE_STATUSES },
    testSessionId: { $in: sessions.map((session) => session._id) },
  })
    .select('reportNumber status generatedAt publishedAt supersededByReportId testSessionId')
    .sort({ generatedAt: -1 })
    .limit(MAX_SERIAL_LOOKUP_RESULTS + 1)
    .populate({
      path: 'testSessionId',
      select: 'serialNumber overallResult instrumentModelId manufacturerName laboratoryName testDate',
      populate: { path: 'instrumentModelId', select: 'modelName accuracyClass' },
    });

  const matchingRecords = reports.filter((report) => report.testSessionId);
  const matchingReports = matchingRecords.slice(0, MAX_SERIAL_LOOKUP_RESULTS).map((report) => ({
      reportNumber: report.reportNumber,
      status: report.status,
      generatedAt: report.generatedAt,
      publishedAt: report.publishedAt,
      isSuperseded: Boolean(report.supersededByReportId),
      serialNumber: report.testSessionId.serialNumber,
      manufacturerName: report.testSessionId.manufacturerName,
      overallResult: report.testSessionId.overallResult,
      instrumentModelName: report.testSessionId.instrumentModelId?.modelName || 'Unknown',
      accuracyClass: report.testSessionId.instrumentModelId?.accuracyClass || 'Unknown',
      laboratoryName: report.testSessionId.laboratoryName,
      testDate: report.testSessionId.testDate,
    }));

  res.status(200).json({
    success: true,
    data: {
      reports: matchingReports,
      hasMore: matchingRecords.length > MAX_SERIAL_LOOKUP_RESULTS,
    },
  });
});

export const verifyReport = asyncHandler(async (req, res) => {
  const { reportNumberOrHash } = req.params;

  let report = await Report.findOne({ reportNumber: reportNumberOrHash }).populate({
    path: 'testSessionId',
    populate: { path: 'instrumentModelId' },
  }).populate('supersededByReportId', 'reportNumber');

  if (!report) {
    report = await Report.findOne({ contentHash: reportNumberOrHash }).populate({
      path: 'testSessionId',
      populate: { path: 'instrumentModelId' },
    }).populate('supersededByReportId', 'reportNumber');
  }

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'No report matches this number or hash');
  }

  // WP6 §12.4: Only published/archived/revoked/superseded reports are publicly verifiable.
  // integrity_tagged reports have not yet been published; treat as not found.
  const isSupersededReport = Boolean(report.supersededByReportId);
  if (!PUBLICLY_VERIFIABLE_STATUSES.includes(report.status) && !isSupersededReport) {
    throw new AppError(404, 'NOT_FOUND', 'No report matches this number or hash');
  }

  const session = report.testSessionId;
  const model = session?.instrumentModelId;

  let actualPdfHash = null;
  try {
    actualPdfHash = sha256(await readStoredFile({
      storageFileId: report.pdfStorageFileId,
      filePath: report.pdfPath,
    }));
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  const isIntegrityVerified = Boolean(
    actualPdfHash && actualPdfHash === report.contentHash &&
    verifyReportArtifact(actualPdfHash, report, 'PDF')
  );

  const isRevoked = report.status === 'revoked';

  res.status(200).json({
    success: true,
    data: {
      reportNumber: report.reportNumber,
      status: report.status,
      isRevoked,
      isPublished: report.status === 'published',
      isSuperseded: isSupersededReport,
      supersededByReportNumber: report.supersededByReportId?.reportNumber || null,
      revocationReason: report.revocationReason || null,
      publishedAt: report.publishedAt || null,
      revocationNotice: isRevoked ? 'WARNING: This report has been REVOKED by the Legal Metrology Authority' : null,
      generatedAt: report.generatedAt,
      contentHash: report.contentHash,
      signatureAlgorithm: report.signatureAlgorithm || 'HMAC-SHA256',
      isIntegrityVerified,
      isDigitalSignatureVerified: Boolean(isIntegrityVerified && report.pdfSignature),
      certificateFingerprint: report.certificateFingerprint || null,
      signerKeyId: report.signerKeyId || null,
      signatureType: report.pdfSignature ? 'PKI certificate-backed detached signature' : 'legacy server HMAC integrity tag; report is not PKI-signed',
      instrumentModelName: model?.modelName || 'Unknown',
      accuracyClass: model?.accuracyClass || 'Unknown',
      serialNumber: session?.serialNumber || null,
      overallResult: session?.overallResult || 'Unknown',
      overallVerdict: session?.overallResult || 'Unknown',
    },
  });
});
