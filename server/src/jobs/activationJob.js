import cron from 'node-cron';
import { RuleConfig } from '../models/RuleConfig.js';
import { appendAuditLog } from '../services/auditLogger.service.js';

export async function processScheduledActivations() {
  const now = new Date();
  const scheduledConfigs = await RuleConfig.find({
    status: 'scheduled',
    effectiveDate: { $lte: now }
  });

  for (const config of scheduledConfigs) {
    config.status = 'active';
    await config.save();
    console.log(`Activated scheduled rule config: ${config._id}`);
    
    await appendAuditLog({
      entityType: 'RuleConfig',
      entityId: config._id,
      action: 'scheduled_activation',
      userId: config.approvedBy || config.createdBy, // fallback
      details: {
        effectiveDate: config.effectiveDate
      }
    });
  }
}

export function startActivationJob() {
  // Run every hour
  cron.schedule('0 * * * *', () => {
    processScheduledActivations().catch(err => {
      console.error('Error processing scheduled activations:', err);
    });
  });
  
  // Also run immediately on startup
  processScheduledActivations().catch(err => {
    console.error('Error processing scheduled activations on startup:', err);
  });
}
