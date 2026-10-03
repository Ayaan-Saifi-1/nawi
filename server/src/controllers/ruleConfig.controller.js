import { RuleConfig } from '../models/RuleConfig.js';
import { appendAuditLog } from '../services/auditLogger.service.js';
import { resolveRuleConfig } from '../services/ruleResolver.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { compareRuleConfigToHistory } from '../services/ruleSandbox.service.js';
import { TestType } from '../models/TestType.js';

export const createRuleConfig = asyncHandler(async (req, res) => {
  const ruleConfig = await RuleConfig.create({ ...req.body, status: 'draft', createdBy: req.user.sub });

  await appendAuditLog({
    entityType: 'RuleConfig',
    entityId: ruleConfig._id,
    action: 'create',
    userId: req.user.sub,
  });

  res.status(201).json({
    success: true,
    data: ruleConfig,
  });
});

export const activateRuleConfig = asyncHandler(async (req, res) => {
  const { sourceReference, validationNote } = req.body;
  const ruleConfig = await RuleConfig.findById(req.params.id);
  if (!ruleConfig) {
    throw new AppError(404, 'NOT_FOUND', 'Rule configuration not found');
  }
  if (ruleConfig.status !== 'in_review') {
    throw new AppError(409, 'INVALID_STATE', 'Only rules that are in review can be approved and activated');
  }
  if (!ruleConfig.technicalReviewedBy) {
    throw new AppError(409, 'REVIEW_REQUIRED', 'Rule must be technically reviewed before activation');
  }
  if (!ruleConfig.createdBy) {
    throw new AppError(422, 'RULE_REVIEW_REQUIRED', 'Seeded or unowned example rules cannot be activated; create a reviewed rule configuration first');
  }
  const mandatoryTestTypes = await TestType.find({
    status: 'approved',
    isActive: true,
    'mandatoryFor.accuracyClass': ruleConfig.accuracyClass
  });

  for (const tt of mandatoryTestTypes) {
    const hasCriterion = ruleConfig.testCriteria?.some(c => c.annexRef === tt.oimlAnnexRef && c.criterion);
    if (!hasCriterion) {
      throw new AppError(422, 'MISSING_MANDATORY_CRITERION', `Rule configuration is missing a criterion for mandatory test type: ${tt.oimlAnnexRef}`);
    }
  }

  if (!ruleConfig.sandboxedAt || !ruleConfig.sandboxResultHash) {
    throw new AppError(409, 'SANDBOX_REQUIRED', 'Run the historical regression comparison before activating this rule');
  }
  const currentSandbox = await compareRuleConfigToHistory(ruleConfig);
  if (currentSandbox.resultHash !== ruleConfig.sandboxResultHash) {
    throw new AppError(409, 'SANDBOX_STALE', 'Relevant historical results changed after sandboxing; run the comparison again before activating');
  }
  if (ruleConfig.sandboxSummary?.uncomparable > 0) {
    throw new AppError(409, 'SANDBOX_INCOMPLETE', 'Resolve observations that could not be compared before activating this rule');
  }
  if (ruleConfig.createdBy.toString() === req.user.sub) {
    throw new AppError(403, 'SEPARATION_OF_DUTIES', 'The rule author cannot provide the metrology expert approval');
  }
  if (ruleConfig.technicalReviewedBy.toString() === req.user.sub) {
    throw new AppError(403, 'SEPARATION_OF_DUTIES', 'The technical reviewer cannot provide the metrology expert approval');
  }
  const conflictingRule = await RuleConfig.findOne({
    _id: { $ne: ruleConfig._id },
    accuracyClass: ruleConfig.accuracyClass,
    effectiveDate: ruleConfig.effectiveDate,
    status: { $in: ['active', 'scheduled'] },
  });
  if (conflictingRule) {
    throw new AppError(409, 'RULE_VERSION_CONFLICT', 'An active or scheduled rule already exists for this accuracy class and effective date');
  }

  const predecessor = await RuleConfig.findOne({
    accuracyClass: ruleConfig.accuracyClass,
    effectiveDate: { $lt: ruleConfig.effectiveDate },
    effectiveUntil: null,
    status: { $in: ['active', 'scheduled'] },
  }).sort({ effectiveDate: -1 });
  if (predecessor?._id.equals(ruleConfig._id)) {
    throw new AppError(409, 'RULE_VERSION_CONFLICT', 'A rule cannot supersede itself');
  }

  ruleConfig.sourceReference = sourceReference.trim();
  ruleConfig.validationNote = validationNote.trim();
  ruleConfig.approvedBy = req.user.sub;
  ruleConfig.approvedAt = new Date();
  const isFutureEffective = ruleConfig.effectiveDate > new Date();
  ruleConfig.status = isFutureEffective ? 'scheduled' : 'active';
  await ruleConfig.save();

  if (predecessor) {
    predecessor.effectiveUntil = ruleConfig.effectiveDate;
    predecessor.supersededByRuleId = ruleConfig._id;
    predecessor.status = 'archived';
    await predecessor.save();
    await appendAuditLog({
      entityType: 'RuleConfig',
      entityId: predecessor._id,
      action: 'supersede',
      userId: req.user.sub,
      details: {
        supersededByRuleId: ruleConfig._id,
        effectiveUntil: ruleConfig.effectiveDate,
      },
    });
  }
  await appendAuditLog({
    entityType: 'RuleConfig',
    entityId: ruleConfig._id,
    action: `${isFutureEffective ? 'schedule' : 'activate'}: ${sourceReference.trim()}`,
    userId: req.user.sub,
    details: {
      sandboxResultHash: ruleConfig.sandboxResultHash,
      sandboxSummary: ruleConfig.sandboxSummary,
      status: ruleConfig.status,
      effectiveDate: ruleConfig.effectiveDate,
      predecessorRuleId: predecessor?._id || null,
    },
  });
  res.status(200).json({ success: true, data: ruleConfig });
});

export const sandboxRuleConfig = asyncHandler(async (req, res) => {
  const ruleConfig = await RuleConfig.findById(req.params.id);
  if (!ruleConfig) throw new AppError(404, 'NOT_FOUND', 'Rule configuration not found');
  if (ruleConfig.status !== 'draft') {
    throw new AppError(409, 'INVALID_STATE', 'Only a draft rule configuration can be sandboxed');
  }

  const result = await compareRuleConfigToHistory(ruleConfig);
  ruleConfig.sandboxedBy = req.user.sub;
  ruleConfig.sandboxedAt = new Date();
  ruleConfig.sandboxResultHash = result.resultHash;
  ruleConfig.sandboxSummary = {
    compared: result.compared,
    unchanged: result.unchanged,
    changed: result.changed,
    uncomparable: result.uncomparable,
  };
  await ruleConfig.save();

  await appendAuditLog({
    entityType: 'RuleConfig',
    entityId: ruleConfig._id,
    action: 'sandbox_regression_comparison',
    userId: req.user.sub,
    details: { resultHash: result.resultHash, summary: ruleConfig.sandboxSummary },
  });

  res.status(200).json({ success: true, data: result });
});

export const getRuleConfigs = asyncHandler(async (req, res) => {
  const { accuracyClass, effectiveDate } = req.query;

  if (effectiveDate && accuracyClass) {
    const resolved = await resolveRuleConfig(accuracyClass, new Date(effectiveDate));
    return res.status(200).json({
      success: true,
      data: [resolved],
    });
  }

  const query = {};
  if (accuracyClass) {
    query.accuracyClass = accuracyClass;
  }

  const configs = await RuleConfig.find(query)
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .sort({ effectiveDate: -1 });

  res.status(200).json({
    success: true,
    data: configs,
  });
});

export const getRuleConfigById = asyncHandler(async (req, res) => {
  const ruleConfig = await RuleConfig.findById(req.params.id)
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .populate('technicalReviewedBy', 'name email role');
  if (!ruleConfig) {
    throw new AppError(404, 'NOT_FOUND', 'Rule configuration not found');
  }
  res.status(200).json({ success: true, data: ruleConfig });
});

export const submitReview = asyncHandler(async (req, res) => {
  const ruleConfig = await RuleConfig.findById(req.params.id);
  if (!ruleConfig) throw new AppError(404, 'NOT_FOUND', 'Rule config not found');
  
  if (ruleConfig.status !== 'draft') {
    throw new AppError(409, 'INVALID_STATE', 'Only draft rules can be submitted for review');
  }

  ruleConfig.status = 'in_review';
  await ruleConfig.save();

  await appendAuditLog({
    entityType: 'RuleConfig',
    entityId: ruleConfig._id,
    action: 'submit_review',
    userId: req.user.sub
  });

  res.status(200).json({ success: true, data: ruleConfig });
});

export const technicalReview = asyncHandler(async (req, res) => {
  const ruleConfig = await RuleConfig.findById(req.params.id);
  if (!ruleConfig) throw new AppError(404, 'NOT_FOUND', 'Rule config not found');
  
  if (ruleConfig.status !== 'in_review') {
    throw new AppError(409, 'INVALID_STATE', 'Only rules in review can be technically reviewed');
  }

  if (ruleConfig.createdBy?.toString() === req.user.sub) {
    throw new AppError(403, 'SEPARATION_OF_DUTIES', 'The technical reviewer cannot be the rule author');
  }

  ruleConfig.technicalReviewedBy = req.user.sub;
  ruleConfig.technicalReviewedAt = new Date();
  await ruleConfig.save();

  await appendAuditLog({
    entityType: 'RuleConfig',
    entityId: ruleConfig._id,
    action: 'technical_review',
    userId: req.user.sub
  });

  res.status(200).json({ success: true, data: ruleConfig });
});

export const retireRuleConfig = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    throw new AppError(400, 'BAD_REQUEST', 'Retirement reason is mandatory');
  }

  const ruleConfig = await RuleConfig.findById(req.params.id);
  if (!ruleConfig) throw new AppError(404, 'NOT_FOUND', 'Rule config not found');
  
  if (!['active', 'scheduled'].includes(ruleConfig.status)) {
    throw new AppError(409, 'INVALID_STATE', 'Only active or scheduled rules can be retired');
  }

  ruleConfig.status = 'retired';
  ruleConfig.effectiveUntil = new Date();
  ruleConfig.retiredReason = reason.trim();
  await ruleConfig.save();

  await appendAuditLog({
    entityType: 'RuleConfig',
    entityId: ruleConfig._id,
    action: 'retire',
    userId: req.user.sub,
    details: { reason }
  });

  res.status(200).json({ success: true, data: ruleConfig });
});