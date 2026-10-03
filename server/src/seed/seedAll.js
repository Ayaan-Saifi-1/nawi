import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { seedUsers } from './seedUsers.js';
import { seedRuleConfigs } from './seedRuleConfigs.js';
import { seedTestTypes } from './seedTestTypes.js';
import { activateDevRules } from './activateRules.js';
import { seedDemoData } from './seedDemoData.js';

export async function seedAll() {
  console.log('Connecting to database for full seeding...');
  await mongoose.connect(env.MONGO_URI);
  await seedUsers();
  await seedRuleConfigs();
  await seedTestTypes();
  if (env.NODE_ENV !== 'production') {
    await activateDevRules();
  }
  await seedDemoData();
  await mongoose.disconnect();
  console.log('All seed data inserted successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seedAll.js')) {
  seedAll().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}
