import { AuditLog } from '../models/AuditLog.js';
import { sha256 } from '../utils/hash.js';

async function writeAuditLog({ entityType, entityId, action, userId, details }) {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const last = await AuditLog.findOne().sort({ timestamp: -1, _id: -1 });
    const prevHash = last ? last.currentHash : '0'.repeat(64);
    const timestamp = new Date();
    const payload = JSON.stringify({ entityType, entityId, action, userId, timestamp, ...(details === undefined ? {} : { details }) });
    const currentHash = sha256(prevHash + payload);

    try {
      return await AuditLog.create({
        entityType,
        entityId,
        action,
        ...(details === undefined ? {} : { details }),
        userId,
        timestamp,
        prevHash,
        currentHash,
      });
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.prevHash && attempt < maxRetries - 1) {
        // Concurrent write occurred, retry with updated tail
        continue;
      }
      throw err;
    }
  }
}

// Serialize appends inside this process so concurrent requests cannot fork the chain.
// A distributed deployment still needs a database-level append lock or transactional writer.
let appendQueue = Promise.resolve();

export function appendAuditLog(entry) {
  const pendingWrite = appendQueue.then(() => writeAuditLog(entry));
  appendQueue = pendingWrite.then(() => undefined, () => undefined);
  return pendingWrite;
}
