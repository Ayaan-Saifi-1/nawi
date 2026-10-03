import db from '../db/offlineDb.js';
import axios from 'axios';

/**
 * Offline Sync Service
 *
 * Manages the outbox queue for offline-created draft sessions and observations.
 * Replays queued mutations to the server batch sync endpoint when connectivity resumes.
 */

/**
 * Generate a client-side UUID for idempotent sync.
 */
export function generateClientId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Save a draft session to IndexedDB and queue it in the outbox.
 */
export async function saveDraftSession(sessionData) {
  const clientId = generateClientId();
  const now = new Date().toISOString();

  const draft = {
    clientId,
    ...sessionData,
    status: 'draft',
    createdAt: now,
  };

  await db.transaction('rw', db.draftSessions, db.outbox, async () => {
    await db.draftSessions.add(draft);
    await db.outbox.add({
      clientId,
      type: 'CREATE_SESSION',
      sessionId: null,
      data: sessionData,
      status: 'pending',
      createdAt: now,
      retryCount: 0,
    });
  });

  return { clientId, draft };
}

/**
 * Save a draft observation to IndexedDB and queue it in the outbox.
 */
export async function saveDraftObservation(sessionClientId, observationData) {
  const clientId = generateClientId();
  const now = new Date().toISOString();

  const draft = {
    clientId,
    sessionClientId,
    ...observationData,
    createdAt: now,
  };

  await db.transaction('rw', db.draftObservations, db.outbox, async () => {
    await db.draftObservations.add(draft);
    await db.outbox.add({
      clientId,
      type: 'ADD_OBSERVATION',
      sessionId: sessionClientId,
      data: observationData,
      status: 'pending',
      createdAt: now,
      retryCount: 0,
    });
  });

  return { clientId, draft };
}

export async function getDraftSession(clientId) {
  return db.draftSessions.where('clientId').equals(clientId).first();
}

export async function getDraftObservations(sessionClientId) {
  return db.draftObservations.where('sessionClientId').equals(sessionClientId).sortBy('createdAt');
}

export async function getDraftSyncIssues(clientId, serverSessionId) {
  const items = await db.outbox.filter((item) => (
    item.clientId === clientId || item.sessionId === clientId ||
    (serverSessionId && item.sessionId === serverSessionId)
  )).toArray();
  return items.filter((item) => item.status === 'pending' && item.lastError);
}

export async function getDraftPendingItems(clientId, serverSessionId) {
  const items = await db.outbox.filter((item) => (
    item.clientId === clientId || item.sessionId === clientId ||
    (serverSessionId && item.sessionId === serverSessionId)
  )).toArray();
  return items.filter((item) => item.status === 'pending');
}

export async function discardQueuedObservation(clientId) {
  return db.transaction('rw', db.outbox, db.draftObservations, async () => {
    await db.outbox.where('clientId').equals(clientId).delete();
    await db.draftObservations.where('clientId').equals(clientId).delete();
  });
}

export async function discardOfflineSession(clientId, serverSessionId) {
  return db.transaction('rw', db.draftSessions, db.draftObservations, db.outbox, async () => {
    await db.draftSessions.where('clientId').equals(clientId).delete();
    await db.draftObservations.where('sessionClientId').equals(clientId).delete();
    await db.outbox.where('clientId').equals(clientId).delete();
    await db.outbox.where('sessionId').equals(clientId).delete();
    if (serverSessionId) await db.outbox.where('sessionId').equals(serverSessionId).delete();
  });
}

export async function updateDraftSession(clientId, changes) {
  const draft = await getDraftSession(clientId);
  if (!draft) return false;
  await db.draftSessions.update(draft.id, changes);
  return true;
}

/**
 * Get all pending items from the outbox.
 */
export async function getPendingOutbox() {
  return db.outbox.where('status').equals('pending').sortBy('createdAt');
}

/**
 * Get all draft sessions.
 */
export async function getDraftSessions() {
  return db.draftSessions.toArray();
}

/**
 * Replay the entire outbox to the server in a single batch request.
 * Uses the POST /api/test-sessions/sync/batch endpoint.
 * Marks successfully processed items as 'synced'.
 */
let replayInFlight = null;

export function replayOutbox(token) {
  if (replayInFlight) return replayInFlight;
  replayInFlight = replayOutboxNow(token).finally(() => {
    replayInFlight = null;
  });
  return replayInFlight;
}

async function replayOutboxNow(token) {
  const pending = await getPendingOutbox();
  pending.sort((a, b) => {
    if (a.type === 'CREATE_SESSION' && b.type !== 'CREATE_SESSION') return -1;
    if (b.type === 'CREATE_SESSION' && a.type !== 'CREATE_SESSION') return 1;
    return a.createdAt.localeCompare(b.createdAt) || a.id - b.id;
  });

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const batch = pending.map((item) => ({
    clientId: item.clientId,
    type: item.type,
    sessionId: item.sessionId,
    data: item.data,
  }));

  try {
    const response = await axios.post(
      '/api/test-sessions/sync/batch',
      { batch },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const processedItems = response.data.data?.processed || [];
    const processed = new Set(processedItems.map((item) => typeof item === 'string' ? item : item.clientId));
    const sessionIds = new Map(processedItems
      .filter((item) => typeof item === 'object' && item.sessionId)
      .map((item) => [item.clientId, item.sessionId]));
    const conflicts = response.data.data?.conflicts || [];
    const conflictByClientId = new Map(conflicts.map((item) => [item.clientId, item.reason]));
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      if (processed.has(item.clientId)) {
        await db.outbox.update(item.id, { status: 'synced' });
        synced++;
      } else {
        await db.outbox.update(item.id, {
          status: 'pending',
          retryCount: (item.retryCount || 0) + 1,
          lastError: conflictByClientId.get(item.clientId) || 'Not acknowledged by server',
        });
        failed++;
      }
    }

    for (const [clientId, serverSessionId] of sessionIds) {
      await updateDraftSession(clientId, { serverSessionId, syncedAt: new Date().toISOString() });
      await db.outbox.where('sessionId').equals(clientId).modify({ sessionId: serverSessionId });
    }

    return { synced, failed, conflicts };
  } catch (error) {
    // Network error — leave items as pending for next retry
    console.warn('[OfflineSync] Replay failed, items remain in outbox:', error.message);
    return { synced: 0, failed: pending.length, error: error.message };
  }
}

/**
 * Cache instrument models for offline form population.
 */
export async function cacheInstrumentModels(models) {
  const records = models.map((m) => ({
    id: m._id || m.id,
    _id: m._id || m.id,
    modelName: m.modelName,
    accuracyClass: m.accuracyClass,
    maxCapacity: m.maxCapacity,
    e: m.e,
    minCapacity: m.minCapacity,
    n: m.n,
    manufacturerName: m.manufacturerName || m.manufacturerId?.name,
  }));
  if (records.some((record) => !record.id)) {
    throw new Error('Cannot cache an instrument model without an ID.');
  }
  await db.transaction('rw', db.cachedInstrumentModels, async () => {
    await db.cachedInstrumentModels.clear();
    await db.cachedInstrumentModels.bulkPut(records);
  });
}

/**
 * Cache active rule config summaries for offline form population.
 */
export async function cacheRuleConfigs(configs) {
  const records = configs.map((c) => ({
    id: c._id,
    accuracyClass: c.accuracyClass,
    oimlEdition: c.oimlEdition,
    effectiveDate: c.effectiveDate,
    status: c.status,
    bands: c.bands,
  }));
  if (records.some((record) => !record.id)) {
    throw new Error('Cannot cache a rule configuration without an ID.');
  }
  await db.transaction('rw', db.cachedRuleConfigs, async () => {
    await db.cachedRuleConfigs.clear();
    await db.cachedRuleConfigs.bulkPut(records);
  });
}

export async function cacheLaboratories(laboratories) {
  const records = laboratories.map((lab) => ({
    id: lab._id || lab.id,
    labId: lab.labId,
    labName: lab.labName,
    location: lab.location,
    isActive: lab.isActive,
  }));
  if (records.some((record) => !record.id)) {
    throw new Error('Cannot cache a laboratory without an ID.');
  }
  await db.transaction('rw', db.cachedLaboratories, async () => {
    await db.cachedLaboratories.clear();
    await db.cachedLaboratories.bulkPut(records);
  });
}

export async function getCachedLaboratories() {
  return db.cachedLaboratories.toArray();
}

/**
 * Get cached instrument models from IndexedDB.
 */
export async function getCachedInstrumentModels() {
  return db.cachedInstrumentModels.toArray();
}

/**
 * Get cached rule configs from IndexedDB.
 */
export async function getCachedRuleConfigs() {
  return db.cachedRuleConfigs.toArray();
}

/**
 * Check if there are pending outbox items.
 */
export async function hasUnsyncedItems() {
  const count = await db.outbox.where('status').equals('pending').count();
  return count > 0;
}

/**
 * Clear all synced items from the outbox.
 */
export async function clearSyncedOutbox() {
  return db.outbox.where('status').equals('synced').delete();
}
