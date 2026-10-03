import mongoose from 'mongoose';

const testSessionSchema = new mongoose.Schema(
  {
    instrumentModelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstrumentModel',
      required: true,
    },
    manufacturerName: { type: String, trim: true, required: true },
    modelName: { type: String, trim: true, required: true },
    serialNumber: { type: String, trim: true, required: true },
    accuracyClass: { type: String, enum: ['I', 'II', 'III', 'IIII'], required: true },
    maxCapacity: { type: Number, required: true },
    minCapacity: { type: Number, required: true },
    scaleInterval: { type: Number, required: true },
    selectedAnnexes: { type: [String], required: true, validate: [(items) => items.length > 0, 'Select at least one test procedure'] },
    labId: { type: String, required: true, trim: true },
    laboratoryName: { type: String, required: true, trim: true },
    laboratoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientSyncId: { type: String, trim: true, default: undefined },
    testDate: { type: Date, required: true },
    verificationStage: {
      type: String,
      enum: ['initial', 'subsequent'],
      default: 'initial',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'passed', 'failed', 'report_generated', 'published', 'revoked', 'archived'],
      default: 'draft',
    },
    overallResult: {
      type: String,
      enum: ['pass', 'fail', null],
      default: null,
    },
    environmentalConditions: {
      temperatureC: { type: Number, required: true },
      humidityPercent: { type: Number, required: true, min: 0, max: 100 },
      inclinationDeg: { type: Number, required: true },
      atmosphericPressurehPa: { type: Number },
      notes: { type: String, trim: true, required: true },
    },
    reviewerNotes: { type: String, trim: true, default: null },
    rejectedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    locationEvidence: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracyM: { type: Number, default: null },
      distanceM: { type: Number, default: null },
      status: { type: String, enum: ['verified', 'not_configured', 'offline_pending'], default: 'not_configured' },
      capturedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

testSessionSchema.index({ createdBy: 1, clientSyncId: 1 }, {
  unique: true,
  partialFilterExpression: { clientSyncId: { $type: 'string' } },
});

export const TestSession = mongoose.model('TestSession', testSessionSchema);
