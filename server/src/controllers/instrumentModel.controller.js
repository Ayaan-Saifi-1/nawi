import { InstrumentModel } from '../models/InstrumentModel.js';
import { User } from '../models/User.js';
import { Manufacturer } from '../models/Manufacturer.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getManufacturerForUser, PUBLIC_ONLY_ROLES, publicSessionScope } from '../utils/tenantAccess.js';
import { appendAuditLog } from '../services/auditLogger.service.js';
import { TestSession } from '../models/TestSession.js';
import { Report } from '../models/Report.js';

export const createInstrumentModel = asyncHandler(async (req, res) => {
  const { manufacturerId, modelName, accuracyClass, maxCapacity, e, minCapacity } = req.body;

  const manufacturer = await Manufacturer.findById(manufacturerId);
  if (!manufacturer) {
    throw new AppError(404, 'NOT_FOUND', 'Manufacturer not found');
  }
  if (req.user.role === 'manufacturer') {
    const ownManufacturer = await getManufacturerForUser(req.user.sub);
    if (!ownManufacturer || ownManufacturer._id.toString() !== manufacturer._id.toString()) {
      throw new AppError(403, 'FORBIDDEN', 'Manufacturers may only register their own instrument models');
    }
  }

  if (!Number.isFinite(maxCapacity / e) || e <= 0 || maxCapacity <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'maxCapacity and verification interval must be positive finite values');
  }
  const n = maxCapacity / e;
  if (Math.abs(n - Math.round(n)) > 1e-9) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Max capacity must be an integer multiple of verification interval e');
  }

  const instrumentModel = await InstrumentModel.create({
    manufacturerId,
    modelName,
    accuracyClass,
    maxCapacity,
    e,
    minCapacity,
    n,
  });
  await appendAuditLog({ entityType: 'InstrumentModel', entityId: instrumentModel._id, action: 'create', userId: req.user.sub });

  res.status(201).json({
    success: true,
    data: instrumentModel,
  });
});

export const getInstrumentModels = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;

  const query = {};

  if (req.query.accuracyClass) {
    query.accuracyClass = req.query.accuracyClass;
  }
  if (req.query.manufacturerId) {
    query.manufacturerId = req.query.manufacturerId;
  }

  // If manufacturer user, auto-filter to their manufacturer
  if (req.user.role === 'manufacturer') {
    const mfg = await getManufacturerForUser(req.user.sub);
    if (mfg) {
      query.manufacturerId = mfg._id;
    } else {
      query.manufacturerId = null; // No matching manufacturer found
    }
  }

  const [models, total] = await Promise.all([
    InstrumentModel.find(query)
      .populate('manufacturerId', 'name contactEmail')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    InstrumentModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    data: models,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

export const getInstrumentModelById = asyncHandler(async (req, res) => {
  const model = await InstrumentModel.findById(req.params.id).populate('manufacturerId');
  if (!model) {
    throw new AppError(404, 'NOT_FOUND', 'Instrument model not found');
  }

  if (req.user.role === 'manufacturer') {
    const mfg = await getManufacturerForUser(req.user.sub);
    if (!mfg || model.manufacturerId._id.toString() !== mfg._id.toString()) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot access models of another manufacturer');
    }
  }

  res.status(200).json({
    success: true,
    data: model,
  });
});

export const updateInstrumentModel = asyncHandler(async (req, res) => {
  const model = await InstrumentModel.findById(req.params.id);
  if (!model) {
    throw new AppError(404, 'NOT_FOUND', 'Instrument model not found');
  }

  if (req.user.role === 'manufacturer') {
    const ownManufacturer = await getManufacturerForUser(req.user.sub);
    if (!ownManufacturer || ownManufacturer._id.toString() !== model.manufacturerId.toString()) {
      throw new AppError(403, 'FORBIDDEN', 'Manufacturers may only modify their own instrument models');
    }
  }

  const { modelName, accuracyClass, maxCapacity, e, minCapacity } = req.body;
  const isChangingSpec = (accuracyClass && accuracyClass !== model.accuracyClass) ||
    (maxCapacity !== undefined && maxCapacity !== model.maxCapacity) ||
    (e !== undefined && e !== model.e) ||
    (minCapacity !== undefined && minCapacity !== model.minCapacity);

  if (isChangingSpec && (await TestSession.exists({ instrumentModelId: model._id }))) {
    throw new AppError(409, 'MODEL_IN_USE', 'Metrological parameters (accuracy class, capacity, scale interval) cannot be modified once test sessions exist for this model');
  }

  if (modelName) model.modelName = modelName;
  if (accuracyClass) model.accuracyClass = accuracyClass;
  if (maxCapacity !== undefined) model.maxCapacity = maxCapacity;
  if (e !== undefined) model.e = e;
  if (minCapacity !== undefined) model.minCapacity = minCapacity;
  if (!Number.isFinite(model.maxCapacity / model.e) || model.e <= 0 || model.maxCapacity <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'maxCapacity and verification interval must be positive finite values');
  }
  const computedN = model.maxCapacity / model.e;
  if (Math.abs(computedN - Math.round(computedN)) > 1e-9) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Max capacity must be an integer multiple of verification interval e');
  }
  const CLASS_BOUNDS = {
    I: { nMin: 50000, nMax: null },
    II: { nMin: 100, nMax: 100000 },
    III: { nMin: 100, nMax: 10000 },
    IIII: { nMin: 100, nMax: 1000 },
  };
  const bounds = CLASS_BOUNDS[model.accuracyClass];
  if (bounds) {
    if (computedN < bounds.nMin) {
      throw new AppError(422, 'INVALID_CLASS_PARAMETERS', `Computed n (${computedN}) is less than minimum allowed (${bounds.nMin}) for Class ${model.accuracyClass}`);
    }
    if (bounds.nMax !== null && computedN > bounds.nMax) {
      throw new AppError(422, 'INVALID_CLASS_PARAMETERS', `Computed n (${computedN}) is greater than maximum allowed (${bounds.nMax}) for Class ${model.accuracyClass}`);
    }
  }

  model.n = Math.round(computedN);

  await model.save();
  await appendAuditLog({ entityType: 'InstrumentModel', entityId: model._id, action: 'update', userId: req.user.sub });
  res.status(200).json({ success: true, data: model });
});

export const deleteInstrumentModel = asyncHandler(async (req, res) => {
  const model = await InstrumentModel.findById(req.params.id);
  if (!model) {
    throw new AppError(404, 'NOT_FOUND', 'Instrument model not found');
  }

  if (req.user.role === 'manufacturer') {
    const ownManufacturer = await getManufacturerForUser(req.user.sub);
    if (!ownManufacturer || ownManufacturer._id.toString() !== model.manufacturerId.toString()) {
      throw new AppError(403, 'FORBIDDEN', 'Manufacturers may only delete their own instrument models');
    }
  }

  if (await TestSession.exists({ instrumentModelId: model._id })) {
    throw new AppError(409, 'MODEL_IN_USE', 'Instrument models with test history cannot be deleted');
  }
  await model.deleteOne();
  await appendAuditLog({ entityType: 'InstrumentModel', entityId: model._id, action: 'delete', userId: req.user.sub });
  res.status(200).json({ success: true, message: 'Instrument model deleted successfully' });
});

export const getInstrumentModelHistory = asyncHandler(async (req, res) => {
  const model = await InstrumentModel.findById(req.params.id);
  if (!model) {
    throw new AppError(404, 'NOT_FOUND', 'Instrument model not found');
  }

  if (req.user.role === 'manufacturer') {
    const ownManufacturer = await getManufacturerForUser(req.user.sub);
    if (!ownManufacturer || ownManufacturer._id.toString() !== model.manufacturerId.toString()) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot access models of another manufacturer');
    }
  }

  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;

  const query = { instrumentModelId: model._id };
  if (['lab_technician', 'lab_admin', 'reviewer'].includes(req.user.role)) {
    query.labId = req.user.labId || null;
  }
  if (PUBLIC_ONLY_ROLES.includes(req.user.role)) {
    Object.assign(query, await publicSessionScope());
  }

  const [sessions, total] = await Promise.all([
    TestSession.find(query)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    TestSession.countDocuments(query),
  ]);

  const sessionIds = sessions.map((s) => s._id);
  const reports = await Report.find({
    testSessionId: { $in: sessionIds },
    status: { $ne: 'revoked' },
  }).sort({ revisionNumber: -1, createdAt: -1 });
  const reportsBySession = new Map();
  for (const r of reports) {
    const key = r.testSessionId.toString();
    if (!reportsBySession.has(key)) {
      reportsBySession.set(key, r);
    }
  }

  const history = sessions.map((s) => ({
    session: s,
    report: reportsBySession.get(s._id.toString()) || null,
  }));

  res.status(200).json({
    success: true,
    data: history,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});