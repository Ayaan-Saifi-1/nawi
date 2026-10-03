import { Report } from '../models/Report.js';
import { TestSession } from '../models/TestSession.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { appendAuditLog } from '../services/auditLogger.service.js';
import { sessionScopeForUser } from '../utils/tenantAccess.js';
import { ExportJob } from '../models/ExportJob.js';
import mongoose from 'mongoose';

async function findExportJob(jobId) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  return ExportJob.findById(jobId);
}

async function generateExportData(req, startDate, endDate) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = startDate ? new Date(startDate) : defaultFrom;
  const to = endDate ? new Date(endDate) : now;

  const query = {
    status: 'published',
    generatedAt: { $gte: from, $lte: to },
  };

  const sessionQuery = await sessionScopeForUser(req.user);
  if (Object.keys(sessionQuery).length > 0) {
    const sessionIds = await TestSession.find(sessionQuery).distinct('_id');
    query.testSessionId = { $in: sessionIds };
  }

  const reports = await Report.find(query).populate({
    path: 'testSessionId',
    populate: {
      path: 'instrumentModelId',
      populate: { path: 'manufacturerId' },
    },
  });

  return reports.map((report) => {
    const session = report.testSessionId;
    const model = session?.instrumentModelId;
    const manufacturer = model?.manufacturerId;

    return {
      reportNumber: report.reportNumber,
      instrumentModelName: model?.modelName || 'Unknown',
      manufacturerName: manufacturer?.name || 'Unknown',
      accuracyClass: model?.accuracyClass || 'Unknown',
      overallResult: session?.overallResult || 'Unknown',
      generatedAt: report.generatedAt,
    };
  });
}

export const exportLegalMetrologyData = asyncHandler(async (req, res) => {
  const exportData = await generateExportData(req, req.query.from || req.query.startDate, req.query.to || req.query.endDate);
  res.status(200).json({
    success: true,
    data: exportData,
    meta: {
      count: exportData.length,
    },
  });
});

export const createExportJob = asyncHandler(async (req, res) => {
  const { format = 'json', startDate, endDate } = req.body;
  if (!['json', 'csv'].includes(format)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Format must be json or csv');
  }

  const exportData = await generateExportData(req, startDate, endDate);

  const job = await ExportJob.create({
    format,
    count: exportData.length,
    data: exportData,
    createdBy: req.user.sub,
  });

  await appendAuditLog({
    entityType: 'ExportJob',
    entityId: job._id,
    action: `create_export_job:${format}`,
    userId: req.user.sub,
  });

  res.status(201).json({
    success: true,
    data: {
      jobId: job._id,
      status: 'completed',
      format: job.format,
      count: job.count,
      createdAt: job.createdAt.toISOString(),
    },
  });
});

export const getExportJobStatus = asyncHandler(async (req, res) => {
  const job = await findExportJob(req.params.jobId);
  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Export job not found');
  }

  if (job.createdBy.toString() !== req.user.sub && !['admin', 'auditor'].includes(req.user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot access export job created by another user');
  }

  res.status(200).json({
    success: true,
    data: {
      jobId: job._id,
      status: 'completed',
      format: job.format,
      count: job.count,
      createdAt: job.createdAt.toISOString(),
    },
  });
});

export const downloadExportJob = asyncHandler(async (req, res) => {
  const job = await findExportJob(req.params.jobId);
  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Export job not found');
  }

  if (job.createdBy.toString() !== req.user.sub && !['admin', 'auditor'].includes(req.user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot download export job created by another user');
  }

  await appendAuditLog({
    entityType: 'ExportJob',
    entityId: job._id,
    action: `download_export:${job.format}`,
    userId: req.user.sub,
  });

  if (job.format === 'csv') {
    const rows = job.data || [];
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${job._id}.csv"`);
      return res.status(200).send('reportNumber,instrumentModelName,manufacturerName,accuracyClass,overallResult,generatedAt\n');
    }

    const headers = Object.keys(rows[0]);
    const sanitizeCsvCell = (val) => {
      let str = String(val ?? '');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => sanitizeCsvCell(row[h])).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${job._id}.csv"`);
    return res.status(200).send(csvLines.join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${job._id}.json"`);
  res.status(200).json(job.data);
});
