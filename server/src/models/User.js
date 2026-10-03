import mongoose from 'mongoose';

export const ROLES = [
  'admin',            // Rule / System Administrator
  'metrology_expert', // Domain expert who validates rule sets
  'reviewer',         // Reviewing / Approving Officer
  'lab_technician',   // Lab Technician
  'lab_admin',        // Laboratory Administrator
  'doca_officer',     // Legal Metrology Officer / Controller (DoCA)
  'manufacturer',     // Manufacturer / Applicant
  'auditor',          // Auditor
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    labId: { type: String, default: null },
    laboratoryRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratory', default: null },
    manufacturerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer', default: null },
    active: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
