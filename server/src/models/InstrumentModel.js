import mongoose from 'mongoose';

const instrumentModelSchema = new mongoose.Schema(
  {
    manufacturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Manufacturer',
      required: true,
    },
    modelName: { type: String, required: true, trim: true },
    accuracyClass: {
      type: String,
      enum: ['I', 'II', 'III', 'IIII'],
      required: true,
    },
    maxCapacity: { type: Number, required: true, min: 0.000000001 },
    e: { type: Number, required: true, min: 0.000000001 },
    minCapacity: { type: Number, required: true, min: 0 },
    n: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

export const InstrumentModel = mongoose.model('InstrumentModel', instrumentModelSchema);
