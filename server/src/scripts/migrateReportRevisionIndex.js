import mongoose from 'mongoose';
import { env } from '../config/env.js';

// Safe, idempotent index migration for installations that used the original
// one-report-per-session unique index before report revisions were introduced.
try {
  await mongoose.connect(env.MONGO_URI);
  const collection = mongoose.connection.collection('reports');
  const indexes = await collection.indexes();
  const oldUniqueSessionIndex = indexes.find((index) =>
    index.unique && Object.keys(index.key || {}).length === 1 && index.key.testSessionId === 1
  );

  if (oldUniqueSessionIndex) {
    await collection.dropIndex(oldUniqueSessionIndex.name);
    console.log(`Dropped legacy unique index ${oldUniqueSessionIndex.name}`);
  }

  await collection.createIndex(
    { testSessionId: 1, revisionNumber: 1 },
    { unique: true, name: 'testSessionId_1_revisionNumber_1' }
  );
  console.log('Report revision index is ready.');
} finally {
  await mongoose.disconnect();
}
