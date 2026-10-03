import { TestSession } from '../models/TestSession.js';
import { Observation } from '../models/Observation.js';
import { InstrumentModel } from '../models/InstrumentModel.js';
import { Laboratory } from '../models/Laboratory.js';
import { TestType } from '../models/TestType.js';
import { resolveRuleConfig } from '../services/ruleResolver.service.js';
import { evaluateObservation, evaluateSession } from '../services/complianceEngine.service.js';
import { detectObservationAnomalies } from '../services/anomalyDetector.service.js';
import { appendAuditLog } from '../services/auditLogger.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertSessionAccess, getManufacturerForUser, manufacturerModelIds, sessionScopeForUser } from '../utils/tenantAccess.js';
import { createTestSessionSchema } from '../validators/testSession.schema.js';
import { verifyGeofence } from '../utils/geofence.js';
import { mergeEnvironmentalConditions } from '../utils/environmentalConditions.js';


async function createSessionRecord(req, body) {
  const {
    instrumentModelId,
    serialNumber,
    testDate,
    verificationStage,
    environmentalConditions,
    selectedAnnexes,
    clientLocation,
  } = body;

  const isLabBoundUser = ['lab_technician', 'lab_admin'].includes(req.user.role);
  const labId = isLabBoundUser ? req.user.labId : body.labId;
  if (!labId) throw new AppError(400, 'VALIDATION_ERROR', 'A registered laboratory is required');
  const laboratory = await Laboratory.findOne({ labId, isActive: true });
  if (!laboratory) throw new AppError(422, 'INVALID_LABORATORY', 'The selected laboratory is not registered or is inactive');
  const locationEvidence = verifyGeofence(laboratory, clientLocation);

  const model = await InstrumentModel.findById(instrumentModelId).populate('manufacturerId');
  if (!model || !model.manufacturerId) {
    throw new AppError(404, 'NOT_FOUND', 'Instrument model not found');
  }

  const session = await TestSession.create({
    instrumentModelId,
    manufacturerName: model.manufacturerId.name,
    modelName: model.modelName,
    serialNumber,
    accuracyClass: model.accuracyClass,
    maxCapacity: model.maxCapacity,
    minCapacity: model.minCapacity,
    scaleInterval: model.e,
    selectedAnnexes,
    labId,
    laboratoryRef: laboratory._id,
    laboratoryName: laboratory.labName,
    createdBy: req.user.sub,
    testDate,
    verificationStage: verificationStage || 'initial',
    status: 'draft',
    clientSyncId: body.clientSyncId || null,
    environmentalConditions,
    locationEvidence: {
      ...locationEvidence,
      latitude: clientLocation?.latitude ?? null,
      longitude: clientLocation?.longitude ?? null,
      accuracyM: clientLocation?.accuracyM ?? null,
      verifiedAt: locationEvidence.status === 'verified' ? new Date() : null,
    },
  });

  await appendAuditLog({
    entityType: 'TestSession',
    entityId: session._id,
    action: 'create',
    userId: req.user.sub,
  });

  return session;
}

import { addObservationsSchema, createObservationValidator, createSingleObservationValidator } from '../validators/observation.schema.js';

export const createTestSession = asyncHandler(async (req, res) => {
  const session = await createSessionRecord(req, req.body);
  res.status(201).json({
    success: true,
    data: session,
  });
});

export const addObservations = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id).populate('instrumentModelId');
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  if (session.status !== 'draft') {
    throw new AppError(
      409,
      'SESSION_LOCKED',
      'Cannot add observations to a session that is already submitted or processed'
    );
  }
  await assertSessionAccess(req, session);

  let model = session.instrumentModelId;
  if (!model || !model.accuracyClass) {
    model = await InstrumentModel.findById(session.instrumentModelId);
  }
  const accuracyClass = session.accuracyClass || model?.accuracyClass;
  if (!accuracyClass) throw new AppError(422, 'INVALID_INSTRUMENT', 'Accuracy class is required');

  const ruleConfig = await resolveRuleConfig(accuracyClass, session.testDate);
  const validator = createObservationValidator(ruleConfig);

  const validationResult = validator.safeParse({ observations: Array.isArray(req.body.observations) ? req.body.observations : [req.body] });
  if (!validationResult.success) {
    throw new AppError(400, 'VALIDATION_ERROR', validationResult.error.issues.map(i => i.message).join('; '));
  }

  const rawObservations = validationResult.data.observations;
  const unselected = rawObservations.find((obs) => !(session.selectedAnnexes || []).includes(obs.annexRef));
  if (unselected) {
    throw new AppError(422, 'UNSELECTED_PROCEDURE', `${unselected.annexRef} was not selected for this test session`);
  }

  const docsToInsert = rawObservations.map((obs) => ({
    testSessionId: session._id,
    ...obs,
  }));

  const inserted = await Observation.insertMany(docsToInsert);

  for (const observation of inserted) {
    await appendAuditLog({ entityType: 'Observation', entityId: observation._id, action: 'create', userId: req.user.sub });
  }

  res.status(201).json({
    success: true,
    data: inserted,
  });
});

export const submitTestSession = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id).populate('instrumentModelId');
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  if (session.status !== 'draft') {
    throw new AppError(
      409,
      'INVALID_STATE',
      `Session status is '${session.status}'. Only 'draft' sessions can be submitted`
    );
  }
  await assertSessionAccess(req, session);

  const observations = await Observation.find({ testSessionId: session._id, deletedAt: null });
  if (observations.length === 0) {
    throw new AppError(
      409,
      'INVALID_STATE',
      'Cannot submit a test session with zero observations'
    );
  }

  async function checkMandatoryTests(session, observations, accuracyClass) {
    const stage = session.verificationStage || 'initial';
    const mandatoryTypes = await TestType.find({
      status: 'approved',
      isActive: true,
      'mandatoryFor.accuracyClass': accuracyClass,
      'mandatoryFor.verificationStage': { $in: ['all', stage] }
    });

    const observedAnnexes = new Set(observations.map(o => o.annexRef));
    const missingMandatory = mandatoryTypes.filter(t => !observedAnnexes.has(t.oimlAnnexRef));

    if (missingMandatory.length > 0) {
      throw new AppError(422, 'MANDATORY_TEST_MISSING', `Missing mandatory test types for class ${accuracyClass} stage ${stage}: ${missingMandatory.map(t => t.testName).join(', ')}`);
    }
  }

  const selected = new Set(session.selectedAnnexes || []);
  const observed = new Set(observations.map((observation) => observation.annexRef));
  const missingAnnexes = [...selected].filter((annex) => !observed.has(annex));
  const unexpectedAnnexes = [...observed].filter((annex) => !selected.has(annex));
  if (missingAnnexes.length || unexpectedAnnexes.length) {
    throw new AppError(422, 'INCOMPLETE_TEST_COVERAGE', `Missing selected procedures: ${missingAnnexes.join(', ') || 'none'}; unselected procedures with observations: ${unexpectedAnnexes.join(', ') || 'none'}`);
  }

  let model = session.instrumentModelId;
  if (!model || !model.accuracyClass) {
    model = await InstrumentModel.findById(session.instrumentModelId);
  }
  const accuracyClass = session.accuracyClass || model?.accuracyClass;
  const maxCapacity = session.maxCapacity ?? model?.maxCapacity;
  const scaleInterval = session.scaleInterval ?? model?.e;
  if (!accuracyClass || !Number.isFinite(maxCapacity) || !Number.isFinite(scaleInterval) || scaleInterval <= 0) {
    throw new AppError(422, 'INVALID_INSTRUMENT_PARAMETERS', 'A complete registered instrument specification is required to evaluate this session');
  }

  await checkMandatoryTests(session, observations, accuracyClass);

  const instrumentModel = {
    accuracyClass,
    maxCapacity,
    e: scaleInterval,
  };
  const ruleConfig = await resolveRuleConfig(accuracyClass, session.testDate);

  const bulkOps = [];
  const auditLogsToAppend = [];
  for (const obs of observations) {
    const evalResult = evaluateObservation(obs, instrumentModel, ruleConfig, session.verificationStage || 'initial');
    const updateObj = {
      outcome: evalResult.outcome,
    };
    if (obs.evaluationMethod === 'mpe_band') {
      updateObj.computedError = evalResult.computedError;
      updateObj.appliedMpe = evalResult.appliedMpe;
      updateObj.marginToMpe = evalResult.marginToMpe;
      updateObj.errorRatioE = evalResult.errorRatioE;
      updateObj.ruleConfigId = evalResult.ruleConfigId;
    } else if (obs.evaluationMethod === 'structured') {
      updateObj.computedErrors = evalResult.computedErrors;
      updateObj.worstMargin = evalResult.worstMargin;
      updateObj.range = evalResult.range;
      updateObj.errorRatioE = evalResult.errorRatioE;
      updateObj.ruleConfigId = evalResult.ruleConfigId;
    } else if (obs.evaluationMethod === 'manual_checklist') {
      updateObj.ruleConfigId = evalResult.ruleConfigId;
    }
    obs.set(updateObj);
    await detectObservationAnomalies(obs, session);
    updateObj.advisoryFlags = obs.advisoryFlags;

    bulkOps.push({
      updateOne: {
        filter: { _id: obs._id },
        update: { $set: updateObj },
      },
    });

    auditLogsToAppend.push({
      entityType: 'Observation',
      entityId: obs._id,
      action: `evaluate:${ruleConfig._id}:${evalResult.outcome}`,
      userId: req.user.sub,
    });
  }

  const overall = evaluateSession(observations);

  session.status = 'under_review';
  session.overallResult = overall;
  session.submittedBy = req.user.sub;
  session.submittedAt = new Date();

  if (bulkOps.length > 0) {
    await Observation.bulkWrite(bulkOps);
  }
  await session.save();

  for (const log of auditLogsToAppend) {
    await appendAuditLog(log);
  }
  await appendAuditLog({
    entityType: 'TestSession',
    entityId: session._id,
    action: 'submit',
    userId: req.user.sub,
  });

  res.status(200).json({
    success: true,
    data: {
      session,
      observations,
    },
  });
});

export const approveTestSession = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }
  await assertSessionAccess(req, session);

  if (session.submittedBy && session.submittedBy.toString() === req.user.sub && process.env.ALLOW_SELF_APPROVAL !== 'true') {
    throw new AppError(403, 'SEPARATION_OF_DUTIES', 'The reviewing officer cannot approve a test session they submitted themselves');
  }

  if (session.status !== 'under_review' || !['pass', 'fail'].includes(session.overallResult)) {
    throw new AppError(
      409,
      'INVALID_STATE',
      `Session status is '${session.status}' with result '${session.overallResult}'. Only evaluated sessions under review can be approved`
    );
  }

  session.status = session.overallResult === 'fail' ? 'failed' : 'passed';
  await session.save();

  await appendAuditLog({
    entityType: 'TestSession',
    entityId: session._id,
    action: 'approve',
    userId: req.user.sub,
  });

  res.status(200).json({
    success: true,
    message: 'Session review approved',
    data: session,
  });
});

export const rejectTestSession = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }
  await assertSessionAccess(req, session);

  if (session.submittedBy && session.submittedBy.toString() === req.user.sub && process.env.ALLOW_SELF_APPROVAL !== 'true') {
    throw new AppError(403, 'SEPARATION_OF_DUTIES', 'The reviewing officer cannot reject a test session they submitted themselves');
  }

  if (session.status !== 'under_review' || !['pass', 'fail'].includes(session.overallResult)) {
    throw new AppError(
      409,
      'INVALID_STATE',
      `Session status is '${session.status}'. Only sessions in 'under_review' state can be rejected`
    );
  }

  const { reason, reviewerNotes } = req.body;
  const rejectionReason = reason || reviewerNotes;
  if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A non-empty rejection reason or reviewer note is required when rejecting a session');
  }

  session.status = 'draft';
  session.reviewerNotes = rejectionReason.trim();
  session.rejectedAt = new Date();
  await session.save();

  await appendAuditLog({
    entityType: 'TestSession',
    entityId: session._id,
    action: `reject: ${rejectionReason.trim()}`,
    userId: req.user.sub,
  });

  res.status(200).json({
    success: true,
    message: 'Session rejected and returned to draft for re-evaluation',
    data: session,
  });
});

export const getTestSessions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;

  const query = await sessionScopeForUser(req.user, req.query.labId);

  if (req.query.status) query.status = req.query.status;
  if (req.query.instrumentModelId) query.instrumentModelId = req.query.instrumentModelId;

  const [sessions, total] = await Promise.all([
    TestSession.find(query)
      .populate('instrumentModelId')
      .populate('createdBy', 'name email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    TestSession.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    success: true,
    data: sessions,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

export const getTestSessionById = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id)
    .populate('instrumentModelId')
    .populate('createdBy', 'name email role');

  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  await assertSessionAccess(req, session);

  const observations = await Observation.find({ testSessionId: session._id, deletedAt: null });

  let ruleConfig = null;
  try {
    let model = session.instrumentModelId;
    if (!model || !model.accuracyClass) {
      model = await InstrumentModel.findById(session.instrumentModelId);
    }
    const accuracyClass = session.accuracyClass || model?.accuracyClass;
    if (accuracyClass) {
      ruleConfig = await resolveRuleConfig(accuracyClass, session.testDate);
    }
  } catch (err) {
    // ignore if rule config doesn't exist
  }

  res.status(200).json({
    success: true,
    data: {
      ...session.toObject(),
      observations,
      ruleConfig,
    },
  });
});

export const updateObservation = asyncHandler(async (req, res) => {
  const observation = await Observation.findById(req.params.obsId);
  if (!observation) {
    throw new AppError(404, 'NOT_FOUND', 'Observation not found');
  }
  if (observation.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Observation not found');

  if (req.params.id && observation.testSessionId.toString() !== req.params.id) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Observation does not belong to the specified test session');
  }

  const session = await TestSession.findById(observation.testSessionId).populate('instrumentModelId');
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Parent test session not found');
  }

  if (session.status !== 'draft') {
    throw new AppError(
      409,
      'SESSION_LOCKED',
      'Observations can only be edited while the session is in draft status'
    );
  }
  await assertSessionAccess(req, session);

  const allowedFields = ['annexRef', 'evaluationMethod', 'referenceLoad', 'indicatedValue', 'zeroCorrection', 'checklistPassed', 'reviewerNotes', 'readings'];
  const before = Object.fromEntries(allowedFields.map((field) => [field, observation[field] ?? null]));

  if (req.body.annexRef && !(session.selectedAnnexes || []).includes(req.body.annexRef)) {
    throw new AppError(422, 'UNSELECTED_PROCEDURE', `${req.body.annexRef} was not selected for this test session`);
  }

  // Create merged object to validate
  const mergedObs = { ...observation.toObject() };
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      mergedObs[field] = req.body[field];
    }
  }

  let model = session.instrumentModelId;
  if (!model || !model.accuracyClass) {
    model = await InstrumentModel.findById(session.instrumentModelId);
  }
  const accuracyClass = session.accuracyClass || model?.accuracyClass;
  if (!accuracyClass) throw new AppError(422, 'INVALID_INSTRUMENT', 'Accuracy class is required');

  const ruleConfig = await resolveRuleConfig(accuracyClass, session.testDate);
  const validator = createSingleObservationValidator(ruleConfig);

  const validationResult = validator.safeParse(mergedObs);
  if (!validationResult.success) {
    throw new AppError(400, 'VALIDATION_ERROR', validationResult.error.issues.map(i => i.message).join('; '));
  }

  // Only allow updating data fields, not computed fields
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      observation[field] = req.body[field];
    }
  }

  // Clear computed fields — they'll be recalculated on next submit
  observation.computedError = undefined;
  observation.appliedMpe = undefined;
  observation.marginToMpe = undefined;
  observation.errorRatioE = undefined;
  observation.ruleConfigId = undefined;
  observation.outcome = null;
  observation.computedErrors = undefined;
  observation.range = undefined;
  observation.worstMargin = undefined;

  await observation.save();

  await appendAuditLog({
    entityType: 'Observation',
    entityId: observation._id,
    action: 'update',
    userId: req.user.sub,
    details: { before, after: Object.fromEntries(allowedFields.map((field) => [field, observation[field] ?? null])) },
  });

  res.status(200).json({
    success: true,
    data: observation,
  });
});

export const deleteObservation = asyncHandler(async (req, res) => {
  const observation = await Observation.findById(req.params.obsId);
  if (!observation) {
    throw new AppError(404, 'NOT_FOUND', 'Observation not found');
  }
  if (observation.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Observation not found');

  const session = await TestSession.findById(observation.testSessionId);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Parent test session not found');
  }

  if (session.status !== 'draft') {
    throw new AppError(
      409,
      'SESSION_LOCKED',
      'Observations can only be deleted while the session is in draft status'
    );
  }
  await assertSessionAccess(req, session);

  const snapshot = observation.toObject();
  observation.deletedAt = new Date();
  observation.deletedBy = req.user.sub;
  await observation.save();

  await appendAuditLog({
    entityType: 'Observation',
    entityId: observation._id,
    action: 'delete',
    userId: req.user.sub,
    details: { snapshot },
  });

  res.status(200).json({
    success: true,
    message: 'Observation deleted successfully',
  });
});

const processedSyncClientIds = new Set();

export const batchSyncTestSessions = asyncHandler(async (req, res) => {
  const { batch } = req.body;
  if (!Array.isArray(batch)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Batch array is required');
  }

  const processed = [];
  const conflicts = [];
  const sessionIdsByClientId = new Map();
  const ruleConfigBySessionId = new Map(); // Cache rule configs for sync loop

  for (const item of batch) {
    const { clientId, type, sessionId, obsId, data, updatedAt } = item;
    if (!clientId) continue;
    const syncKey = `${req.user.sub}:${clientId}`;

    if (processedSyncClientIds.has(syncKey)) {
      if (type === 'CREATE_SESSION') {
        const existing = await TestSession.findOne({ createdBy: req.user.sub, clientSyncId: clientId });
        if (existing) {
          sessionIdsByClientId.set(clientId, existing._id);
          processed.push({ clientId, sessionId: existing._id.toString() });
        } else {
          processed.push(clientId);
        }
      } else {
        processed.push(clientId);
      }
      continue;
    }

    try {
      if (type === 'CREATE_SESSION') {
        const validation = createTestSessionSchema.safeParse(data);
        if (!validation.success) {
          conflicts.push({
            clientId,
            reason: validation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
          });
          continue;
        }
        const session = await TestSession.findOne({ createdBy: req.user.sub, clientSyncId: clientId })
          || await createSessionRecord(req, { ...validation.data, clientSyncId: clientId });
        sessionIdsByClientId.set(clientId, session._id);
        processedSyncClientIds.add(syncKey);
        processed.push({ clientId, sessionId: session._id.toString() });
      } else if (type === 'ADD_OBSERVATION') {
        const resolvedSessionId = sessionIdsByClientId.get(sessionId) || sessionId;
        const session = await TestSession.findById(resolvedSessionId).populate('instrumentModelId');
        if (!session) {
          conflicts.push({ clientId, reason: 'Test session not found' });
          continue;
        }
        await assertSessionAccess(req, session);

        if (session.status !== 'draft') {
          conflicts.push({ clientId, reason: 'Session is locked', currentStatus: session.status });
          continue;
        }

        let ruleConfig = ruleConfigBySessionId.get(session._id.toString());
        if (!ruleConfig) {
          let model = session.instrumentModelId;
          if (!model || !model.accuracyClass) {
            model = await InstrumentModel.findById(session.instrumentModelId);
          }
          const accuracyClass = session.accuracyClass || model?.accuracyClass;
          if (!accuracyClass) throw new AppError(422, 'INVALID_INSTRUMENT', 'Accuracy class is required');
          ruleConfig = await resolveRuleConfig(accuracyClass, session.testDate);
          ruleConfigBySessionId.set(session._id.toString(), ruleConfig);
        }

        const singleObservationValidator = createSingleObservationValidator(ruleConfig);
        const validation = singleObservationValidator.safeParse(data);
        if (!validation.success) {
          conflicts.push({
            clientId,
            reason: validation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
          });
          continue;
        }

        if (!(session.selectedAnnexes || []).includes(validation.data.annexRef)) {
          conflicts.push({ clientId, reason: `${validation.data.annexRef} was not selected for this session` });
          continue;
        }

        const existingObservation = await Observation.findOne({ testSessionId: session._id, clientSyncId: clientId });
        if (!existingObservation) {
          const obsDoc = await Observation.create({
            testSessionId: session._id,
            ...validation.data,
            clientSyncId: clientId,
          });
          await appendAuditLog({ entityType: 'Observation', entityId: obsDoc._id, action: 'create:sync', userId: req.user.sub });
        }
        processedSyncClientIds.add(syncKey);
        processed.push(clientId);
      } else if (type === 'UPDATE_OBSERVATION') {
        const observation = await Observation.findOne({ _id: obsId, deletedAt: null });
        if (!observation) {
          conflicts.push({ clientId, reason: 'Observation not found' });
          continue;
        }
        const session = await TestSession.findById(observation.testSessionId).populate('instrumentModelId');
        if (!session || session.status !== 'draft') {
          conflicts.push({ clientId, reason: 'Session locked or not found' });
          continue;
        }
        await assertSessionAccess(req, session);

        if (updatedAt && observation.updatedAt && new Date(observation.updatedAt).getTime() > new Date(updatedAt).getTime()) {
          conflicts.push({ clientId, reason: 'Server observation has newer edits', serverUpdatedAt: observation.updatedAt });
          continue;
        }

        const allowedFields = ['annexRef', 'evaluationMethod', 'referenceLoad', 'indicatedValue', 'zeroCorrection', 'checklistPassed', 'reviewerNotes', 'readings'];

        const mergedObs = { ...observation.toObject() };
        for (const field of allowedFields) {
          if (data && data[field] !== undefined) {
            mergedObs[field] = data[field];
          }
        }

        let ruleConfig = ruleConfigBySessionId.get(session._id.toString());
        if (!ruleConfig) {
          let model = session.instrumentModelId;
          if (!model || !model.accuracyClass) {
            model = await InstrumentModel.findById(session.instrumentModelId);
          }
          const accuracyClass = session.accuracyClass || model?.accuracyClass;
          if (!accuracyClass) throw new AppError(422, 'INVALID_INSTRUMENT', 'Accuracy class is required');
          ruleConfig = await resolveRuleConfig(accuracyClass, session.testDate);
          ruleConfigBySessionId.set(session._id.toString(), ruleConfig);
        }

        const singleObservationValidator = createSingleObservationValidator(ruleConfig);
        const validationResult = singleObservationValidator.safeParse(mergedObs);
        if (!validationResult.success) {
          conflicts.push({
            clientId,
            reason: validationResult.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
          });
          continue;
        }

        for (const field of allowedFields) {
          if (data && data[field] !== undefined) observation[field] = data[field];
        }
        observation.computedError = undefined;
        observation.appliedMpe = undefined;
        observation.marginToMpe = undefined;
        observation.errorRatioE = undefined;
        observation.ruleConfigId = undefined;
        observation.outcome = null;
        observation.computedErrors = undefined;
        observation.range = undefined;
        observation.worstMargin = undefined;

        await observation.save();
        await appendAuditLog({ entityType: 'Observation', entityId: observation._id, action: 'update:sync', userId: req.user.sub });
        processedSyncClientIds.add(syncKey);
        processed.push(clientId);
      } else {
        conflicts.push({ clientId, reason: 'Unsupported sync action type' });
      }
    } catch (err) {
      conflicts.push({ clientId, reason: err.message });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      processed,
      conflicts,
    },
  });
});

export const updateTestSession = asyncHandler(async (req, res) => {
  const session = await TestSession.findById(req.params.id);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  }

  if (session.status !== 'draft') {
    throw new AppError(
      409,
      'SESSION_LOCKED',
      'Only test sessions in draft status can be modified'
    );
  }

  await assertSessionAccess(req, session);

  const allowedFields = ['environmentalConditions', 'serialNumber', 'testDate', 'verificationStage', 'selectedAnnexes'];
  const before = {};
  const after = {};
  let modified = false;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (field === 'environmentalConditions') {
        // Merge instead of replace so a partial edit cannot drop required stored fields such as notes.
        const current = session.environmentalConditions?.toObject?.() ?? { ...(session.environmentalConditions || {}) };
        const merged = mergeEnvironmentalConditions(current, req.body[field]);
        before[field] = current;
        session.environmentalConditions = merged;
        after[field] = merged;
      } else {
        before[field] = session[field];
        session[field] = req.body[field];
        after[field] = req.body[field];
      }
      modified = true;
    }
  }

  if (!modified) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No valid editable fields provided');
  }

  await session.save();

  await appendAuditLog({
    entityType: 'TestSession',
    entityId: session._id,
    action: 'update',
    userId: req.user.sub,
    details: { before, after },
  });

  res.status(200).json({
    success: true,
    data: session,
  });
});

export const acknowledgeObservationFlag = asyncHandler(async (req, res) => {
  const { flagId, comment } = req.body || {};
  const ackComment = (typeof comment === 'string' && comment.trim()) ? comment.trim() : 'Acknowledged by reviewing officer';

  const observation = await Observation.findOne({ _id: req.params.obsId, deletedAt: null });
  if (!observation) throw new AppError(404, 'NOT_FOUND', 'Observation not found');

  const session = await TestSession.findById(observation.testSessionId);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'Test session not found');
  await assertSessionAccess(req, session);

  let targetFlag = null;
  if (flagId && observation.advisoryFlags) {
    targetFlag = observation.advisoryFlags.id(flagId) || observation.advisoryFlags.find(f => f._id.toString() === flagId.toString());
  }
  if (!targetFlag && observation.advisoryFlags && observation.advisoryFlags.length > 0) {
    targetFlag = observation.advisoryFlags.find(f => !f.acknowledged) || observation.advisoryFlags[0];
  }

  if (!targetFlag) {
    throw new AppError(404, 'NOT_FOUND', 'Advisory flag not found on observation');
  }

  targetFlag.acknowledged = true;
  targetFlag.acknowledgedBy = req.user.sub;
  targetFlag.acknowledgedAt = new Date();
  targetFlag.comment = ackComment;

  await observation.save();

  await appendAuditLog({
    entityType: 'Observation',
    entityId: observation._id,
    action: 'acknowledge_advisory_flag',
    userId: req.user.sub,
    details: { flagId: targetFlag._id, comment: ackComment },
  });

  res.status(200).json({
    success: true,
    data: observation,
  });
});
