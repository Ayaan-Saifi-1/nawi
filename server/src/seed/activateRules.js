import mongoose from 'mongoose';
import { RuleConfig } from '../models/RuleConfig.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export async function activateDevRules() {
  if (env.NODE_ENV === 'production') {
    throw new Error('DEV SEED ERROR: activateDevRules must not run in production mode');
  }

  console.log('Activating Dev Seed RuleConfigs via Metrology Expert...');
  const expert = await User.findOne({ email: 'metrology@nawi.gov.in' });
  if (!expert) {
    throw new Error('DEV SEED ERROR: Metrology Expert user (metrology@nawi.gov.in) not found');
  }

  const draftRules = await RuleConfig.find({ status: 'draft' });
  for (const rule of draftRules) {
    if (rule.createdBy && rule.createdBy.toString() === expert._id.toString()) {
      console.warn(`Skipping rule ${rule._id}: author cannot approve their own rule`);
      continue;
    }

    rule.sourceReference = 'OIML R76-1:2006 Table 6 — DEV SEED, NOT EXPERT VALIDATED';
    rule.validationNote = 'Auto-activated dev seed rules for testing and evaluation';
    rule.approvedBy = expert._id;
    rule.approvedAt = new Date();
    rule.status = 'active';
    await rule.save();
  }

  console.log(`Activated ${draftRules.length} dev RuleConfigs successfully.`);
}

if (process.argv[1] && process.argv[1].endsWith('activateRules.js')) {
  mongoose.connect(env.MONGO_URI).then(async () => {
    await activateDevRules();
    await mongoose.disconnect();
  });
}
