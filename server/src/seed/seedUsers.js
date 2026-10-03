import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Manufacturer } from '../models/Manufacturer.js';
import { InstrumentModel } from '../models/InstrumentModel.js';
import { Laboratory } from '../models/Laboratory.js';
import { env } from '../config/env.js';

export async function seedUsers() {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Seed users cannot be created in production mode!');
    throw new Error('Seed users creation is forbidden in production environment');
  }
  console.log('Seeding Users & Demo Manufacturer...');

  // Create default Laboratory
  let lab = await Laboratory.findOne({ labId: 'LAB-DELHI-01' });
  if (!lab) {
    lab = await Laboratory.create({
      code: 'LAB-DELHI-01',
      labId: 'LAB-DELHI-01',
      name: 'National Physical Laboratory (Delhi)',
      labName: 'National Physical Laboratory (Delhi)',
      accreditationNo: 'NABL-2026-DELHI-01',
      location: 'New Delhi, India',
      contactEmail: 'lab@npl.res.in',
      isActive: true,
    });
  } else if (!lab.isActive) {
    lab.isActive = true;
    await lab.save();
  }

  // Create a default Manufacturer
  let manufacturer = await Manufacturer.findOne({ name: 'Avery India Ltd' });
  if (!manufacturer) {
    manufacturer = await Manufacturer.create({
      name: 'Avery India Ltd',
      contactEmail: 'contact@averyindia.com',
      address: 'Plot 5, Sector 24, Faridabad, Haryana 121005',
    });
  }

  // Create a default Instrument Model (Class III, Max=1500kg, e=0.5kg, n=3000)
  let instrumentModel = await InstrumentModel.findOne({ modelName: 'E1205-1500' });
  if (!instrumentModel) {
    instrumentModel = await InstrumentModel.create({
      manufacturerId: manufacturer._id,
      modelName: 'E1205-1500',
      accuracyClass: 'III',
      maxCapacity: 1500,
      e: 0.5,
      minCapacity: 10,
      n: 3000,
    });
  }

  const saltRounds = env.BCRYPT_SALT_ROUNDS || 10;
  const passwordHash = await bcrypt.hash('Password123!', saltRounds);

  const usersData = [
    {
      name: 'System Admin',
      email: 'admin@nawi.gov.in',
      passwordHash,
      role: 'admin',
      labId: null,
      failedLoginAttempts: 0,
      lockUntil: null,
    },
    {
      name: 'Lab Tech (NPL Delhi)',
      email: 'tech@npl.res.in',
      passwordHash,
      role: 'lab_technician',
      labId: 'LAB-DELHI-01',
    },
    {
      name: 'Reviewer Officer',
      email: 'reviewer@doca.gov.in',
      passwordHash,
      role: 'reviewer',
      labId: 'LAB-DELHI-01',
    },
    {
      name: 'Lab Admin (NPL)',
      email: 'labadmin@npl.res.in',
      passwordHash,
      role: 'lab_admin',
      labId: 'LAB-DELHI-01',
    },
    {
      name: 'Legal Metrology Officer',
      email: 'officer@doca.gov.in',
      passwordHash,
      role: 'doca_officer',
      labId: null,
    },
    {
      name: 'Metrology Expert',
      email: 'metrology@nawi.gov.in',
      passwordHash,
      role: 'metrology_expert',
      labId: null,
    },
    {
      name: 'Avery Rep',
      email: 'rep@averyindia.com',
      passwordHash,
      role: 'manufacturer',
      labId: null,
      manufacturerRef: manufacturer._id,
    },
    {
      name: 'Metrology Auditor',
      email: 'auditor@nawi.gov.in',
      passwordHash,
      role: 'auditor',
      labId: null,
    },
  ];

  for (const u of usersData) {
    await User.findOneAndUpdate(
      { email: u.email },
      u,
      { upsert: true, new: true }
    );
  }

  console.log('Users & Manufacturer seeded successfully.');
  return { manufacturer, instrumentModel };
}

if (process.argv[1] && process.argv[1].endsWith('seedUsers.js')) {
  mongoose.connect(env.MONGO_URI).then(async () => {
    await seedUsers();
    await mongoose.disconnect();
  });
}
