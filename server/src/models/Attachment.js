import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    testSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestSession',
      required: true,
    },
    fileType: {
      type: String,
      enum: ['photo', 'document'],
      required: true,
    },
    filePath: { type: String, required: true },
    storageFileId: { type: String, default: null },
    originalFilename: { type: String, required: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sha256Hash: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Attachment = mongoose.model('Attachment', attachmentSchema);
