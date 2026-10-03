import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { RuleConfig } from '../models/RuleConfig.js';
import { compareRuleConfigToHistory } from '../services/ruleSandbox.service.js';

async function runRegression() {
  await mongoose.connect(env.MONGO_URI);
  
  // Find all drafts
  const draftRules = await RuleConfig.find({ status: 'draft' });
  if (draftRules.length === 0) {
    console.log('No draft rules to run regression on.');
    await mongoose.disconnect();
    return;
  }

  for (const draft of draftRules) {
    console.log(`\n=== Running regression for draft RuleConfig (${draft.accuracyClass}, ${draft.effectiveDate.toISOString()}) ===`);
    try {
      const result = await compareRuleConfigToHistory(draft);
      console.log(`Summary:`);
      console.log(`  Compared: ${result.compared}`);
      console.log(`  Unchanged: ${result.unchanged}`);
      console.log(`  Changed: ${result.changed}`);
      console.log(`  Uncomparable: ${result.uncomparable}`);
      
      if (result.changed > 0) {
        console.log(`\nChanges:`);
        for (const change of result.changes) {
          console.log(`  Observation ${change.observationId} in Session ${change.sessionId}: ${change.previousOutcome} -> ${change.proposedOutcome}`);
        }
      }
    } catch (err) {
      console.error(`Error running regression for rule ${draft._id}:`, err);
    }
  }

  await mongoose.disconnect();
}

runRegression().catch(err => {
  console.error(err);
  process.exit(1);
});
