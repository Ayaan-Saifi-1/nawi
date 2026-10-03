import mongoose from 'mongoose';

export const ANNEX_REFS = [
  'A1_administrative',
  'A2_construction',
  'A3_initial_examination',
  'A4_discrimination',
  'A4_repeatability',
  'A4_eccentricity',
  'A4_accuracy',
  'A5_temperature',
  'A5_humidity',
  'A5_inclination',
  'A6_endurance',
  'B_electronic_additional',
];

const observationSchema = new mongoose.Schema(
  {
    testSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestSession',
      required: true,
    },
    clientSyncId: { type: String, trim: true, default: undefined },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    annexRef: {
      type: String,
      enum: ANNEX_REFS,
      required: true,
    },
    evaluationMethod: {
      type: String,
      enum: ['mpe_band', 'manual_checklist', 'structured'],
      required: true,
    },
    // mpe_band fields
    referenceLoad: { type: Number },
    indicatedValue: { type: Number },
    zeroCorrection: { type: Number, default: 0 },
    computedError: { type: Number },
    appliedMpe: { type: Number },
    marginToMpe: { type: Number },
    errorRatioE: { type: Number },
    ruleConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'RuleConfig' },

    // structured test criteria fields
    readings: [
      {
        position: { type: mongoose.Schema.Types.Mixed },
        load: { type: Number },
        condition: { type: mongoose.Schema.Types.Mixed },
        indicated: { type: Number },
        reference: { type: Number },
        timestamp: { type: Date }
      }
    ],
    computedErrors: [
      {
        load: { type: Number },
        error: { type: Number },
        mpe: { type: Number },
        margin: { type: Number }
      }
    ],
    range: { type: Number },
    worstMargin: { type: Number },

    // manual_checklist fields
    checklistPassed: { type: Boolean },
    reviewerNotes: { type: String },

    outcome: {
      type: String,
      enum: ['pass', 'fail', null],
      default: null,
    },
    advisoryFlags: [
      {
        flagType: { type: String, default: 'ANOMALY_ERROR_RATIO' },
        zScore: { type: Number },
        message: { type: String },
        acknowledged: { type: Boolean, default: false },
        acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        acknowledgedAt: { type: Date, default: null },
        comment: { type: String, trim: true, default: null },
      },
    ],
  },
  { timestamps: true }
);

observationSchema.index({ testSessionId: 1, clientSyncId: 1 }, {
  unique: true,
  partialFilterExpression: { clientSyncId: { $type: 'string' } },
});

export const Observation = mongoose.model('Observation', observationSchema);
