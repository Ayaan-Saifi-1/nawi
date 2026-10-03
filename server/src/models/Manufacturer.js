import mongoose from 'mongoose';

const manufacturerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Manufacturer = mongoose.model('Manufacturer', manufacturerSchema);
