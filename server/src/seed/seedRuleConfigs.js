import mongoose from 'mongoose';
import { RuleConfig } from '../models/RuleConfig.js';
import { env } from '../config/env.js';

const exampleTestCriteria = [
  {
    annexRef: 'A4_accuracy',
    fields: [
      { name: 'reference', labelEn: 'Reference Load', type: 'number', required: true },
      { name: 'indicated', labelEn: 'Indicated Value', type: 'number', required: true },
      { name: 'zeroCorrection', labelEn: 'Zero error E0', type: 'number', required: true },
      { name: 'deltaL', labelEn: 'Delta L (for rounding correction)', type: 'number', required: false }
    ],
    criterion: { type: 'max_abs_error_le_mpe_factor', params: { factor: 1.0 } }
  },
  {
    annexRef: 'A4_eccentricity',
    fields: [
      { name: 'position', labelEn: 'Position', type: 'string', required: true },
      { name: 'reference', labelEn: 'Reference Load', type: 'number', required: true },
      { name: 'indicated', labelEn: 'Indicated Value', type: 'number', required: true },
      { name: 'zeroCorrection', labelEn: 'Zero error E0', type: 'number', required: true }
    ],
    criterion: { type: 'max_abs_error_le_mpe_factor', params: { factor: 1.0 } }
  },
  {
    annexRef: 'A4_repeatability',
    fields: [
      { name: 'load', labelEn: 'Load', type: 'number', required: true },
      { name: 'indicated', labelEn: 'Indicated Value', type: 'number', required: true },
      { name: 'zeroCorrection', labelEn: 'Zero error E0', type: 'number', required: true }
    ],
    criterion: { type: 'range_le_mpe_factor', params: { factor: 1.0 } } // Often range ≤ |MPE|
  },
  {
    annexRef: 'A4_discrimination',
    fields: [
      { name: 'load', labelEn: 'Initial Load', type: 'number', required: true },
      { name: 'indicated', labelEn: 'Indicated Value', type: 'number', required: true }
    ],
    criterion: { type: 'change_le_factor_of_e', params: { factor: 1.4 } } // Usually requires a change ≥ something, wait the criterion is change_le_factor_of_e... Wait, the prompt says change_le_factor_of_e, maybe for testing something else. Let's just use what's asked.
  },
  {
    annexRef: 'B_electronic_additional',
    fields: [
      { name: 'condition', labelEn: 'Test Condition (e.g. voltage)', type: 'string', required: true },
      { name: 'reference', labelEn: 'Reference Load', type: 'number', required: true },
      { name: 'indicated', labelEn: 'Indicated Value', type: 'number', required: true }
    ],
    criterion: { type: 'max_abs_error_le_mpe_factor', params: { factor: 1.0 } }
  },
  {
    annexRef: 'A1_administrative',
    fields: [],
    criterion: { type: 'manual', params: {} }
  }
];

export const initialRules = [
  {
    oimlEdition: 'R76-1:2006',
    status: 'draft',
    sourceReference: null,
    validationNote: 'UNVERIFIED EXAMPLE CRITERIA - FOR DEMONSTRATION ONLY',
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    accuracyClass: 'I',
    effectiveDate: new Date('2006-01-01'),
    useRoundingCorrection: false,
    testCriteria: exampleTestCriteria,
    bands: [
      { uptoMultipleOfE: 50000, mpeFactor: 0.5 },
      { uptoMultipleOfE: 200000, mpeFactor: 1.0 },
      { uptoMultipleOfE: 999999999, mpeFactor: 1.5 },
    ],
  },
  {
    oimlEdition: 'R76-1:2006',
    status: 'draft',
    sourceReference: null,
    validationNote: 'UNVERIFIED EXAMPLE CRITERIA - FOR DEMONSTRATION ONLY',
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    accuracyClass: 'II',
    effectiveDate: new Date('2006-01-01'),
    useRoundingCorrection: false,
    testCriteria: exampleTestCriteria,
    bands: [
      { uptoMultipleOfE: 5000, mpeFactor: 0.5 },
      { uptoMultipleOfE: 20000, mpeFactor: 1.0 },
      { uptoMultipleOfE: 100000, mpeFactor: 1.5 },
    ],
  },
  {
    oimlEdition: 'R76-1:2006',
    status: 'draft',
    sourceReference: null,
    validationNote: 'UNVERIFIED EXAMPLE CRITERIA - FOR DEMONSTRATION ONLY',
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    accuracyClass: 'III',
    effectiveDate: new Date('2006-01-01'),
    useRoundingCorrection: false,
    testCriteria: exampleTestCriteria,
    bands: [
      { uptoMultipleOfE: 500, mpeFactor: 0.5 },
      { uptoMultipleOfE: 2000, mpeFactor: 1.0 },
      { uptoMultipleOfE: 10000, mpeFactor: 1.5 },
    ],
  },
  {
    oimlEdition: 'R76-1:2006',
    status: 'draft',
    sourceReference: null,
    validationNote: 'UNVERIFIED EXAMPLE CRITERIA - FOR DEMONSTRATION ONLY',
    createdBy: null,
    approvedBy: null,
    approvedAt: null,
    accuracyClass: 'IIII',
    effectiveDate: new Date('2006-01-01'),
    useRoundingCorrection: false,
    testCriteria: exampleTestCriteria,
    bands: [
      { uptoMultipleOfE: 50, mpeFactor: 0.5 },
      { uptoMultipleOfE: 200, mpeFactor: 1.0 },
      { uptoMultipleOfE: 1000, mpeFactor: 1.5 },
    ],
  },
];

import { User } from '../models/User.js';

export async function seedRuleConfigs() {
  console.log('Seeding RuleConfigs...');
  const adminUser = await User.findOne({ email: 'admin@nawi.gov.in' });
  const adminId = adminUser ? adminUser._id : null;

  for (const rule of initialRules) {
    const ruleData = { ...rule, createdBy: adminId };
    await RuleConfig.findOneAndUpdate(
      { accuracyClass: rule.accuracyClass, oimlEdition: rule.oimlEdition },
      ruleData,
      { upsert: true, new: true }
    );
  }
  console.log('RuleConfigs seeded successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seedRuleConfigs.js')) {
  mongoose.connect(env.MONGO_URI).then(async () => {
    await seedRuleConfigs();
    await mongoose.disconnect();
  });
}
