import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveReport, publishReport, revokeReport } from '../../services/report.service.js';
import apiClient from '../../services/apiClient.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useTranslation } from '../../config/i18n.js';
import { FileCheck, Download, AlertTriangle, ShieldCheck, Search } from 'lucide-react';
import { useModalA11y } from '../../utils/useModalA11y.js';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canRevoke = ['admin', 'reviewer'].includes(role);
  const [revokeId, setRevokeId] = useState(null);
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ modelName: '', serialNumber: '', overallResult: '', status: '' });
  const modalRef = useModalA11y(!!revokeId, () => setRevokeId(null));
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-list', searchTerm, filters],
    queryFn: () => apiClient.get('/reports', { params: { search: searchTerm, ...filters } }),
    select: (r) => r?.data?.reports || r?.data?.docs || [],
  });

  const revokeMut = useMutation({
    mutationFn: ({ id, reason }) => revokeReport(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['reports-list']);
      addToast({ type: 'success', message: 'Report revoked successfully' });
      setRevokeId(null);
      setReason('');
    },
  });

  const publishMut = useMutation({
    mutationFn: publishReport,
    onSuccess: () => {
      queryClient.invalidateQueries(['reports-list']);
      addToast({ type: 'success', message: 'Report published after both generated files passed integrity checks.' });
    },
  });

  const archiveMut = useMutation({
    mutationFn: ({ id, reason }) => archiveReport(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['reports-list']);
      addToast({ type: 'success', message: 'Report archived. Its files and integrity metadata remain immutable.' });
    },
  });

  const handleDownload = async (reportId, format = 'pdf') => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`/api/reports/${reportId}/download/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportId.slice(-8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Download failed' });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            <FileCheck size={22} style={{ marginRight: 8, verticalAlign: -3 }} />
            {t('nav_test_reports')}
          </h1>
          <p className="page-header-subtitle">{t('page_subtitle_reports')}</p>
          <p className="text-muted" style={{ fontSize: 12 }}>
            These files carry SHA-256 and server HMAC integrity tags. They are not PKI-signed approvals or certificates.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="gov-card mb-16">
        <div className="gov-card-body" style={{ padding: '12px 16px' }}>
          <div className="flex-gap-8" style={{ alignItems: 'center' }}>
            <Search size={16} color="var(--gov-text-muted)" />
            <input
              className="gov-input"
              style={{ flex: 1, border: 'none', background: 'transparent' }}
              placeholder="Search report number or SHA-256 hash"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="gov-btn gov-btn-outline"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setSearchTerm('')}
              >
                Clear
              </button>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 8,
              marginTop: 12,
            }}
          >
            <input
              className="gov-input"
              aria-label="Filter by model name"
              placeholder="Model name"
              value={filters.modelName}
              onChange={(event) => updateFilter('modelName', event.target.value)}
            />
            <input
              className="gov-input"
              aria-label="Filter by serial number"
              placeholder="Serial number"
              value={filters.serialNumber}
              onChange={(event) => updateFilter('serialNumber', event.target.value)}
            />
            <select
              className="gov-select"
              aria-label="Filter by verdict"
              value={filters.overallResult}
              onChange={(event) => updateFilter('overallResult', event.target.value)}
            >
              <option value="">All verdicts</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
            <select
              className="gov-select"
              aria-label="Filter by report state"
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              <option value="">All report states</option>
              <option value="integrity_tagged">Awaiting publication</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
      </div>

      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0 }}>
          <div className="gov-table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Report Number</th>
                  <th scope="col">Session ID</th>
                  <th scope="col">Evaluation Verdict</th>
                  <th scope="col">Report State</th>
                  <th scope="col">Hash Digest</th>
                  <th scope="col">Generated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                      Loading…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Unable to load reports.</td></tr>
                ) : (data || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>
                      {role === 'manufacturer' ? t('no_approved_results') : 'No reports generated yet'}
                    </td>
                  </tr>
                ) : (
                  (data || []).map((rep) => (
                    <tr key={rep._id}>
                      <td>
                        <strong className="text-mono">{rep.reportNumber || rep._id?.slice(-8)}</strong>
                      </td>
                      <td className="text-mono">{rep.testSessionId?._id?.slice(-8) || rep.testSessionId || '—'}</td>
                      <td>
                        <StatusBadge status={rep.testSessionId?.overallResult || 'unknown'} />
                      </td>
                      <td>
                        {rep.supersededByReportId ? (
                          <>
                            <StatusBadge status="archived" />
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                              Superseded by {rep.supersededByReportId.reportNumber}
                            </div>
                          </>
                        ) : (
                          <StatusBadge status={rep.status} />
                        )}
                      </td>
                      <td>
                        <code className="text-mono" style={{ fontSize: 11 }}>
                          {rep.contentHash ? `${rep.contentHash.slice(0, 12)}…` : '—'}
                        </code>
                      </td>
                      <td>{rep.createdAt ? new Date(rep.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td>
                        <div className="flex-gap-8 flex-wrap">
                          {canRevoke && rep.status === 'integrity_tagged' && (
                            <button
                              className="gov-btn gov-btn-primary"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => publishMut.mutate(rep._id)}
                              disabled={publishMut.isPending}
                            >
                              <ShieldCheck size={12} /> Publish
                            </button>
                          )}
                          {canRevoke && rep.status === 'published' && (
                            <button
                              className="gov-btn gov-btn-outline"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => {
                                const archiveReason = window.prompt('Reason for archiving this report');
                                if (archiveReason?.trim())
                                  archiveMut.mutate({ id: rep._id, reason: archiveReason.trim() });
                              }}
                              disabled={archiveMut.isPending}
                            >
                              Archive
                            </button>
                          )}
                          <button
                            onClick={() => handleDownload(rep._id, 'pdf')}
                            className="gov-btn gov-btn-outline"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            <Download size={12} /> {t('btn_download_pdf')}
                          </button>
                          <button
                            onClick={() => handleDownload(rep._id, 'docx')}
                            className="gov-btn gov-btn-outline"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            <Download size={12} /> {t('btn_download_docx')}
                          </button>
                          {canRevoke && rep.status !== 'revoked' && (
                            <button
                              className="gov-btn gov-btn-danger"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => setRevokeId(rep._id)}
                            >
                              <AlertTriangle size={12} /> {t('btn_revoke')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Revoke Modal */}
      {revokeId && (
        <div className="modal-overlay" onClick={() => setRevokeId(null)}>
          <div ref={modalRef} className="modal-content" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Revoke Test Report</h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, fontSize: 14 }}>
                Are you sure you want to revoke report <strong className="text-mono">{revokeId.slice(-8)}</strong>?
                This operation is permanent and recorded in the audit trail.
              </p>
              <div className="gov-form-group">
                <label className="gov-label">Reason for Revocation</label>
                <textarea
                  className="gov-input"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State justification for revoking..."
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="gov-btn gov-btn-outline" onClick={() => setRevokeId(null)}>
                {t('btn_cancel')}
              </button>
              <button
                className="gov-btn gov-btn-danger"
                onClick={() => revokeMut.mutate({ id: revokeId, reason })}
                disabled={!reason.trim() || revokeMut.isPending}
              >
                {revokeMut.isPending ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
