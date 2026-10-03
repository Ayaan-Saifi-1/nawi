import mongoose from 'mongoose';

const exportJobSchema = new mongoose.Schema({
  format: { type: String, enum: ['json', 'csv'], required: true },
  count: { type: Number, required: true },
  data: { type: [mongoose.Schema.Types.Mixed], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const ExportJob = mongoose.model('ExportJob', exportJobSchema);
