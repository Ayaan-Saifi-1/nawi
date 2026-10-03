import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    testSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestSession',
      required: true,
      immutable: true,
    },
    revisionNumber: { type: Number, required: true, default: 1, min: 1, immutable: true },
    supersedesReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null, immutable: true },
    supersededByReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
    reportNumber: { type: String, required: true, unique: true, immutable: true },
    contentHash: { type: String, required: true, immutable: true },
    docxContentHash: { type: String, default: null, immutable: true },
    hmacTag: { type: String, required: true, immutable: true },
    docxHmacTag: { type: String, default: null, immutable: true },
    signatureAlgorithm: { type: String, default: 'HMAC-SHA256', immutable: true },
    pdfSignature: { type: String, default: null, immutable: true },
    docxSignature: { type: String, default: null, immutable: true },
    signatureCertificate: { type: String, default: null, immutable: true },
    certificateFingerprint: { type: String, default: null, immutable: true },
    signerKeyId: { type: String, default: null, immutable: true },
    pdfSignedAt: { type: Date, default: null, immutable: true },
    docxSignedAt: { type: Date, default: null, immutable: true },
    pdfPath: { type: String, required: true, immutable: true },
    docxPath: { type: String, required: true, immutable: true },
    pdfStorageFileId: { type: String, default: null, immutable: true },
    docxStorageFileId: { type: String, default: null, immutable: true },
    status: {
      type: String,
      enum: ['integrity_tagged', 'published', 'archived', 'revoked'],
      default: 'integrity_tagged',
    },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    revocationReason: { type: String, trim: true, default: null },
    officerRemarks: { type: String, trim: true, default: null, immutable: true },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    generatedAt: { type: Date, required: true, immutable: true },
  },
  { timestamps: true }
);

reportSchema.index({ testSessionId: 1, revisionNumber: 1 }, { unique: true });

export const Report = mongoose.model('Report', reportSchema);

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);
