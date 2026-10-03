import { AuditLog } from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sha256 } from '../utils/hash.js';
import { TestSession } from '../models/TestSession.js';
import { Observation } from '../models/Observation.js';
import { Attachment } from '../models/Attachment.js';
import { Report } from '../models/Report.js';

export const getAuditLogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.entityType) query.entityType = req.query.entityType;
  if (req.query.entityId) query.entityId = req.query.entityId;

  if (['lab_admin', 'reviewer', 'lab_technician'].includes(req.user.role)) {
    const sessions = await TestSession.find({ labId: req.user.labId || null }).select('_id');
    const sessionIds = sessions.map((session) => session._id);
    const [observationIds, attachmentIds, reportIds] = await Promise.all([
      Observation.find({ testSessionId: { $in: sessionIds } }).distinct('_id'),
      Attachment.find({ testSessionId: { $in: sessionIds } }).distinct('_id'),
      Report.find({ testSessionId: { $in: sessionIds } }).distinct('_id'),
    ]);
    query.$or = [
      { entityType: 'TestSession', entityId: { $in: sessionIds } },
      { entityType: 'Observation', entityId: { $in: observationIds } },
      { entityType: 'Attachment', entityId: { $in: attachmentIds } },
      { entityType: 'Report', entityId: { $in: reportIds } },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('userId', 'name email role')
      .skip(skip)
      .limit(limit)
      .sort({ timestamp: -1 }),
    AuditLog.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    data: logs,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

export const verifyAuditChain = asyncHandler(async (_req, res) => {
  const logs = await AuditLog.find().lean();
  const byPreviousHash = new Map();
  for (const log of logs) {
    const children = byPreviousHash.get(log.prevHash) || [];
    children.push(log);
    byPreviousHash.set(log.prevHash, children);
  }
  let expectedPreviousHash = '0'.repeat(64);
  let valid = true;
  let invalidEntryId = null;
  let checkedEntries = 0;
  const visited = new Set();
  while (checkedEntries < logs.length) {
    const children = byPreviousHash.get(expectedPreviousHash) || [];
    if (children.length !== 1) {
      valid = false;
      invalidEntryId = children[0]?._id || null;
      break;
    }
    const [log] = children;
    if (visited.has(log._id.toString())) {
      valid = false;
      invalidEntryId = log._id;
      break;
    }
    visited.add(log._id.toString());
    const payload = JSON.stringify({
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      userId: log.userId,
      timestamp: log.timestamp,
      ...(log.details === undefined ? {} : { details: log.details }),
    });
    const expectedHash = sha256(expectedPreviousHash + payload);
    if (log.prevHash !== expectedPreviousHash || log.currentHash !== expectedHash) {
      valid = false;
      invalidEntryId = log._id;
      break;
    }
    expectedPreviousHash = log.currentHash;
    checkedEntries += 1;
  }
  if (checkedEntries !== logs.length) valid = false;
  res.status(200).json({ success: true, data: { valid, checkedEntries, totalEntries: logs.length, invalidEntryId } });
});
