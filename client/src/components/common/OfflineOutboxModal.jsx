import React from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useTranslation } from '../../config/i18n.js';
import { useModalA11y } from '../../utils/useModalA11y.js';

export default function OfflineOutboxModal({
  isOpen,
  onClose,
  isOnline,
  pendingItems,
  draftSessions,
  isSyncing,
  lastSyncResult,
  onSyncNow,
  onDiscardDraft,
}) {
  const { t } = useTranslation();
  const modalRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal-content" role="dialog" aria-modal="true" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isOnline ? <Wifi size={20} color="#138808" /> : <WifiOff size={20} color="#DC2626" />}
            <h3>{t('offline_outbox_title')}</h3>
          </div>
          <button aria-label="Close offline outbox" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gov-text-muted)', fontSize: 18 }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--gov-radius)',
              background: isOnline ? 'var(--gov-green-light)' : 'var(--gov-saffron-light)',
              border: `1px solid ${isOnline ? '#BBF7D0' : '#FDE68A'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: isOnline ? 'var(--gov-green)' : 'var(--gov-saffron)' }}>
                {isOnline ? `● ${t('online_mode')}` : `● ${t('offline_mode')}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gov-text-muted)', marginTop: 2 }}>
                {pendingItems.length === 0
                  ? 'All local offline observations and sessions are synced.'
                  : `${pendingItems.length} mutation item(s) waiting in local IndexedDB outbox queue.`}
              </div>
            </div>

            {isOnline && pendingItems.length > 0 && (
              <button
                className="gov-btn gov-btn-primary"
                onClick={onSyncNow}
                disabled={isSyncing}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
                <span>{isSyncing ? t('syncing') : t('sync_now')}</span>
              </button>
            )}
          </div>

          {/* Sync Result notification */}
          {lastSyncResult && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--gov-radius)',
                fontSize: 13,
                background: lastSyncResult.error || lastSyncResult.failed > 0 ? 'var(--gov-red-light)' : 'var(--gov-blue-light)',
                borderLeft: `4px solid ${lastSyncResult.error || lastSyncResult.failed > 0 ? 'var(--gov-red)' : 'var(--gov-navy-imperial)'}`,
              }}
            >
              {lastSyncResult.error ? (
                <div><strong>Sync Error:</strong> {lastSyncResult.error}</div>
              ) : (
                <div>
                  <strong>Sync Complete:</strong> {lastSyncResult.synced} synced successfully, {lastSyncResult.failed} failed/pending.
                </div>
              )}
            </div>
          )}

          {/* Draft Sessions list */}
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 10 }}>Local Offline Draft Sessions ({draftSessions.length})</h4>
            {draftSessions.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gov-text-muted)', fontStyle: 'italic' }}>
                No offline drafts saved on this device.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftSessions.map((draft) => (
                  <div
                    key={draft.clientId}
                    style={{
                      padding: 12,
                      border: '1px solid var(--gov-border-subtle)',
                      borderRadius: 'var(--gov-radius)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--gov-bg-surface)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {draft.modelName || 'Draft Session'} — SN: {draft.serialNumber || 'N/A'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gov-text-muted)' }}>
                        Client ID: <span className="text-mono">{draft.clientId?.slice(0, 16)}...</span> | Class {draft.accuracyClass || 'III'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <a
                        href={`/test-sessions/offline/${draft.clientId}`}
                        className="gov-btn gov-btn-outline"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Edit Draft
                      </a>
                      <button
                        className="gov-btn gov-btn-danger"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => onDiscardDraft(draft.clientId, draft.serverSessionId)}
                        title="Discard Draft"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outbox Queue details */}
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 10 }}>Pending Mutation Outbox ({pendingItems.length})</h4>
            {pendingItems.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gov-text-muted)', fontStyle: 'italic' }}>
                Outbox is clean.
              </div>
            ) : (
              <div className="gov-table-wrapper" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table className="gov-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Client ID</th>
                      <th scope="col">Created At</th>
                      <th scope="col">Status / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItems.map((item) => (
                      <tr key={item.clientId}>
                        <td>
                          <span className="gov-badge gov-badge-submitted">{item.type}</span>
                        </td>
                        <td className="text-mono">{item.clientId?.slice(0, 14)}...</td>
                        <td>{new Date(item.createdAt).toLocaleTimeString()}</td>
                        <td>
                          {item.lastError ? (
                            <span style={{ color: 'var(--gov-red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={12} /> {item.lastError}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--gov-saffron)' }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="gov-btn gov-btn-outline" onClick={onClose}>
            {t('btn_close')}
          </button>
        </div>
      </div>
    </div>
  );
}
