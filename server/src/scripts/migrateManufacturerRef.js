import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Manufacturer } from '../models/Manufacturer.js';

try {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB for manufacturerRef migration...');

  const manufacturers = await Manufacturer.find({});
  let updatedCount = 0;

  for (const mfr of manufacturers) {
    if (!mfr.contactEmail) continue;
    const matchEmail = mfr.contactEmail.trim().toLowerCase();

    const result = await User.updateMany(
      {
        email: { $regex: new RegExp(`^${matchEmail}$`, 'i') },
        manufacturerRef: { $exists: false },
      },
      {
        $set: { manufacturerRef: mfr._id },
      }
    );

    // Also update matching null/undefined manufacturerRef
    const nullResult = await User.updateMany(
      {
        email: { $regex: new RegExp(`^${matchEmail}$`, 'i') },
        manufacturerRef: null,
      },
      {
        $set: { manufacturerRef: mfr._id },
      }
    );

    updatedCount += (result.modifiedCount || 0) + (nullResult.modifiedCount || 0);
  }

  console.log(`ManufacturerRef migration completed. Updated ${updatedCount} user record(s).`);
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
