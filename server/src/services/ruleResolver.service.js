import { RuleConfig } from '../models/RuleConfig.js';
import { AppError } from '../utils/AppError.js';

export async function resolveRuleConfig(accuracyClass, testDate) {
  const dateObj = new Date(testDate);
  if (isNaN(dateObj.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid evaluation test date: '${testDate}'`);
  }
  const config = await RuleConfig.findOne({
    accuracyClass,
    effectiveDate: { $lte: dateObj },
    $or: [
      { effectiveUntil: null },
      { effectiveUntil: { $exists: false } },
      { effectiveUntil: { $gt: dateObj } },
    ],
    status: { $in: ['active', 'scheduled', 'archived'] },
    sourceReference: { $type: 'string', $ne: '' },
    validationNote: { $type: 'string', $ne: '' },
    createdBy: { $ne: null },
    approvedBy: { $ne: null },
    approvedAt: { $ne: null },
  }).sort({ effectiveDate: -1, createdAt: -1 });

  if (!config) {
    throw new AppError(
      422,
      'NO_RULE_CONFIG_FOUND',
      `No rule configuration for class ${accuracyClass} effective on or before ${testDate}`
    );
  }
  return config;
}
