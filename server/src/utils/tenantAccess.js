import { InstrumentModel } from '../models/InstrumentModel.js';
import { Manufacturer } from '../models/Manufacturer.js';
import { User } from '../models/User.js';
import { Report } from '../models/Report.js';
import { AppError } from './AppError.js';

export async function getManufacturerForUser(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  if (user.manufacturerRef) {
    const mfg = await Manufacturer.findById(user.manufacturerRef);
    if (mfg) return mfg;
  }
  return Manufacturer.findOne({ contactEmail: user.email });
}

export async function manufacturerModelIds(manufacturerId) {
  if (!manufacturerId) return [];
  const models = await InstrumentModel.find({ manufacturerId }).select('_id');
  return models.map((model) => model._id);
}

// §11.1: manufacturers, DoCA officers and auditors only see published (signed) records.
// Draft / under_review / passed / failed sessions are internal lab work and are never disclosed to them.
export const PUBLIC_REPORT_STATUSES = ['published', 'archived', 'revoked'];
export const PUBLIC_ONLY_ROLES = ['manufacturer', 'doca_officer', 'auditor'];
const PUBLIC_SESSION_STATUSES = new Set(PUBLIC_REPORT_STATUSES);

async function publicSessionIds() {
  return Report.distinct('testSessionId', { status: { $in: PUBLIC_REPORT_STATUSES } });
}

export async function publicSessionScope() {
  return {
    $or: [
      { status: { $in: PUBLIC_REPORT_STATUSES } },
      { _id: { $in: await publicSessionIds() } },
    ],
  };
}

async function sessionIsPublic(session) {
  if (PUBLIC_SESSION_STATUSES.has(session.status)) return true;
  // Archived/revoked reports return their session to passed/failed, so also look at the reports themselves.
  return Boolean(await Report.exists({ testSessionId: session._id, status: { $in: PUBLIC_REPORT_STATUSES } }));
}

export async function assertSessionAccess(req, session) {
  if (['lab_technician', 'lab_admin', 'reviewer'].includes(req.user.role)) {
    if (!req.user.labId || session.labId !== req.user.labId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to a session outside your laboratory');
    }
  }
  if (req.user.role === 'manufacturer') {
    const manufacturer = await getManufacturerForUser(req.user.sub);
    const modelIds = await manufacturerModelIds(manufacturer?._id);
    const sessionModelId = session.instrumentModelId?._id || session.instrumentModelId;
    if (!modelIds.some((id) => id.toString() === sessionModelId?.toString())) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to a model outside your manufacturer account');
    }
  }
  if (PUBLIC_ONLY_ROLES.includes(req.user.role) && !(await sessionIsPublic(session))) {
    throw new AppError(403, 'FORBIDDEN', 'This session is not yet available for viewing');
  }
}

export async function assertReportAccess(req, report) {
  if (PUBLIC_ONLY_ROLES.includes(req.user.role) && !PUBLIC_REPORT_STATUSES.includes(report.status)) {
    throw new AppError(403, 'FORBIDDEN', 'This report has not been published');
  }
  if (!report.testSessionId) return;
  // If the session is already populated
  if (report.testSessionId.labId) {
    return assertSessionAccess(req, report.testSessionId);
  }
  // Otherwise find the session
  const mongoose = await import('mongoose');
  const TestSession = mongoose.model('TestSession');
  const session = await TestSession.findById(report.testSessionId);
  if (session) {
    return assertSessionAccess(req, session);
  }
}

export async function sessionScopeForUser(user, requestedLabId) {
  const query = {};
  if (['lab_technician', 'lab_admin', 'reviewer'].includes(user.role)) {
    query.labId = user.labId || null;
  } else if (requestedLabId) {
    query.labId = requestedLabId;
  }
  if (user.role === 'manufacturer') {
    const manufacturer = await getManufacturerForUser(user.sub);
    query.instrumentModelId = { $in: await manufacturerModelIds(manufacturer?._id) };
  }
  if (PUBLIC_ONLY_ROLES.includes(user.role)) {
    Object.assign(query, await publicSessionScope());
  }
  return query;
}