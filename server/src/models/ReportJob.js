import mongoose from 'mongoose';

const reportJobSchema = new mongoose.Schema({
  testSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSession', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  format: { type: String, enum: ['pdf', 'docx'], required: true },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  remarks: { type: String },
  status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  error: { type: String },
  retryCount: { type: Number, default: 0 },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' }, // Populated when done
  startedAt: { type: Date },
  completedAt: { type: Date }
}, { timestamps: true });

export const ReportJob = mongoose.model('ReportJob', reportJobSchema);
