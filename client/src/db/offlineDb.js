import Dexie from 'dexie';

/**
 * NAWI Metrology Offline Database
 *
 * Stores draft test sessions, observations, and a sync outbox
 * for offline-capable data entry using IndexedDB via Dexie.
 */
const db = new Dexie('NawiMetrologyDB');

db.version(1).stores({
  // Draft test sessions created offline
  draftSessions: '++id, clientId, instrumentModelId, serialNumber, status, createdAt',

  // Draft observations tied to a draft session
  draftObservations: '++id, clientId, sessionClientId, annexRef, evaluationMethod, createdAt',

  // Sync outbox: queued mutations to replay when back online
  outbox: '++id, clientId, type, sessionId, status, createdAt, retryCount',

  // Cached reference data for offline form population
  cachedInstrumentModels: 'id, modelName, accuracyClass, maxCapacity',
  cachedRuleConfigs: 'id, accuracyClass, oimlEdition, status',
});

db.version(2).stores({
  cachedLaboratories: 'id, labId, labName, isActive',
});

export default db;
