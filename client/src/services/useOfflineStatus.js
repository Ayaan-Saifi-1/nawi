import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore.js';
import {
  getPendingOutbox,
  replayOutbox,
  getDraftSessions,
  discardOfflineSession,
  clearSyncedOutbox
} from './offlineSync.js';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState([]);
  const [draftSessions, setDraftSessions] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const { token } = useAuthStore();

  const refreshStatus = useCallback(async () => {
    try {
      const items = await getPendingOutbox();
      setPendingItems(items || []);
      const drafts = await getDraftSessions();
      setDraftSessions(drafts || []);
    } catch {
      // IndexedDB query fallback
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshStatus();
      if (token) {
        syncNow();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshStatus();
    const interval = setInterval(refreshStatus, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshStatus, token]);

  const syncNow = async () => {
    if (!token || isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const result = await replayOutbox(token);
      setLastSyncResult(result);
      await clearSyncedOutbox();
      await refreshStatus();
      return result;
    } catch (err) {
      setLastSyncResult({ error: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const discardDraft = async (clientId, serverSessionId) => {
    await discardOfflineSession(clientId, serverSessionId);
    await refreshStatus();
  };

  return {
    isOnline,
    pendingCount: pendingItems.length,
    pendingItems,
    draftSessions,
    isSyncing,
    lastSyncResult,
    syncNow,
    discardDraft,
    refreshStatus,
  };
}
