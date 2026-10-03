import mongoose from 'mongoose';

const laboratorySchema = new mongoose.Schema(
  {
    labId: { type: String, required: true, unique: true, trim: true },
    labName: { type: String, required: true, trim: true },
    accreditationNo: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    contactEmail: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    geofence: {
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
      radiusM: { type: Number, min: 10, max: 10000, default: null },
    },
  },
  { timestamps: true }
);

export const Laboratory = mongoose.model('Laboratory', laboratorySchema);
