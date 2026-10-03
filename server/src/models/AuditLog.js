import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: undefined },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    prevHash: { type: String, required: true },
    currentHash: { type: String, required: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ prevHash: 1 }, { unique: true });

auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany'], function () {
  throw new Error('AuditLog records are strictly immutable and cannot be updated or deleted.');
});

auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('AuditLog records are strictly immutable and cannot be modified after creation.');
  }
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
