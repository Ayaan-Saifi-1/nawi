import apiClient from './apiClient.js';

const STORAGE_KEY = 'nawi_offline_queue';

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineAction(action) {
  const queue = getOfflineQueue();
  queue.push({
    ...action,
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function processOfflineQueue(addToast) {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  try {
    const batch = queue.map(item => ({
      clientId: item.id,
      type: item.type,
      sessionId: item.sessionId,
      data: item.data
    }));

    const response = await apiClient.post('/test-sessions/sync/batch', { batch });
    
    // Server returns { data: { processed: [...], conflicts: [...] } }
    const processedIds = new Set(response.data?.data?.processed || []);
    
    // Keep items that were NOT processed (conflicts or failed)
    const remaining = queue.filter(item => !processedIds.has(item.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));

    const successCount = processedIds.size;
    if (successCount > 0 && addToast) {
      addToast({ type: 'success', message: `Synchronized ${successCount} offline action(s) with server in batch` });
    }
    return successCount;
  } catch (err) {
    console.error('Failed to sync offline batch:', err);
    return 0;
  }
}

export function initOfflineSync(addToast) {
  window.addEventListener('online', () => {
    processOfflineQueue(addToast);
  });
}
