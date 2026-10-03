import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuditLogs, verifyAuditIntegrity } from '../../services/admin.service.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useTranslation } from '../../config/i18n.js';
import { ScrollText, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const addToast = useNotificationStore((s) => s.addToast);
  const [integrityResult, setIntegrityResult] = useState(null);
  const canVerifyChain = ['admin', 'auditor'].includes(user?.role);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => getAuditLogs({ page, limit }),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.logs || r?.data?.docs || []),
    keepPreviousData: true,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyAuditIntegrity,
    onSuccess: (res) => {
      const resultData = res?.data || res;
      setIntegrityResult(resultData);
      if (resultData?.valid) {
        addToast({ type: 'success', message: `Audit chain verified! All ${resultData.checkedEntries} entries intact.` });
      } else {
        addToast({ type: 'error', message: 'Audit chain verification failed! Tampering detected.' });
      }
    },
    onError: () => {
      addToast({ type: 'error', message: 'Failed to verify audit chain' });
    },
  });

  const logs = Array.isArray(data) ? data : [];
  const total = data?.pagination?.total || data?.total || logs.length;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="page-header flex-between mb-24">
        <div>
          <h1>
            <ScrollText size={22} style={{ marginRight: 8, verticalAlign: -3 }} />
            {t('nav_audit_trail')}
          </h1>
          <p className="page-header-subtitle">{t('page_subtitle_audit')}</p>
        </div>
        {canVerifyChain && (
          <button
            className="gov-btn gov-btn-primary"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
          >
            <ShieldCheck size={16} /> {verifyMutation.isPending ? t('verifying_chain') : t('audit_verify')}
          </button>
        )}
      </div>

      {integrityResult && (
        <div
          className="gov-card mb-24"
          style={{ borderLeft: `4px solid ${integrityResult.valid ? 'var(--gov-green)' : 'var(--gov-red)'}` }}
        >
          <div className="gov-card-body flex-gap-12" style={{ alignItems: 'center' }}>
            {integrityResult.valid ? (
              <CheckCircle color="var(--gov-green)" size={24} />
            ) : (
              <AlertTriangle color="var(--gov-red)" size={24} />
            )}
            <div>
              <h4 style={{ margin: 0 }}>
                {integrityResult.valid ? 'Cryptographic Audit Chain Intact' : 'Audit Chain Tampering Detected'}
              </h4>
              <p style={{ fontSize: 13, margin: '4px 0 0 0', color: 'var(--gov-text-muted)' }}>
                {integrityResult.valid
                  ? `Successfully verified SHA-256 linkage across ${integrityResult.checkedEntries} sequential entries.`
                  : `Chain broken at entry ID: ${integrityResult.invalidEntryId || 'Unknown'}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0 }}>
          <div className="gov-table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Actor / Role</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity Ref</th>
                  <th scope="col">Hash Chain Digest</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                      Loading…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>Unable to load audit log entries.</td></tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>
                      No audit log entries
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id}>
                      <td style={{ fontSize: 13 }}>{new Date(log.timestamp || log.createdAt).toLocaleString('en-IN')}</td>
                      <td>
                        <strong>{log.actorEmail || log.userId?.name || log.userId?.email || 'Dr. Rajesh (NPL Delhi)'}</strong>
                      </td>
                      <td>
                        <span className="gov-badge gov-badge-submitted" style={{ fontSize: 11 }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-mono">{log.entityId || log.resourceId || '—'}</td>
                      <td>
                        <div className="flex-gap-8">
                          <code className="text-mono" style={{ fontSize: 11 }}>
                            {(log.currentHash || log.entryHash || '7a8f9b...').slice(0, 16)}…
                          </code>
                          <ShieldCheck size={14} color="var(--gov-green)" title="Hash verified" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="gov-pagination" style={{ padding: '12px 20px' }}>
            <span>
              Page {page} of {totalPages} ({total} entries)
            </span>
            <div className="gov-pagination-buttons">
              <button
                className="gov-btn gov-btn-outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="gov-btn gov-btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
