import mongoose from 'mongoose';

const bandSchema = new mongoose.Schema(
  {
    uptoMultipleOfE: { type: Number, required: true },
    mpeFactor: { type: Number, required: true },
  },
  { _id: false }
);

const criterionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['max_abs_error_le_mpe_factor', 'range_le_mpe_factor', 'change_le_factor_of_e', 'manual'],
    required: true
  },
  params: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  labelEn: { type: String, required: true },
  labelHi: { type: String },
  type: { type: String, enum: ['number', 'boolean', 'string'], required: true },
  unit: { type: String },
  min: { type: Number },
  max: { type: Number },
  required: { type: Boolean, default: true }
}, { _id: false });

const testCriteriaSchema = new mongoose.Schema({
  annexRef: { type: String, required: true },
  fields: [fieldSchema],
  criterion: criterionSchema
}, { _id: false });

const ruleConfigSchema = new mongoose.Schema(
  {
    oimlEdition: { type: String, required: true, trim: true },
    accuracyClass: {
      type: String,
      enum: ['I', 'II', 'III', 'IIII'],
      required: true,
    },
    effectiveDate: { type: Date, required: true },
    effectiveUntil: { type: Date, default: null },
    supersededByRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RuleConfig', default: null },
    sourceReference: { type: String, trim: true, default: null },
    validationNote: { type: String, trim: true, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    technicalReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    technicalReviewedAt: { type: Date, default: null },
    retiredReason: { type: String, trim: true, default: null },
    formVersion: { type: String, trim: true, default: '1.0' },
    sandboxedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sandboxedAt: { type: Date, default: null },
    sandboxResultHash: { type: String, default: null },
    sandboxSummary: {
      compared: { type: Number, default: 0 },
      unchanged: { type: Number, default: 0 },
      changed: { type: Number, default: 0 },
      uncomparable: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['draft', 'in_review', 'approved', 'scheduled', 'active', 'retired', 'archived'],
      default: 'draft',
    },
    subsequentMpeMultiplier: { type: Number, default: 2.0 },
    bands: { type: [bandSchema], required: true },
    testCriteria: { type: [testCriteriaSchema], default: [] },
    useRoundingCorrection: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ruleConfigSchema.index({ accuracyClass: 1, effectiveDate: -1 });
ruleConfigSchema.index(
  { accuracyClass: 1, effectiveDate: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export const RuleConfig = mongoose.model('RuleConfig', ruleConfigSchema);
