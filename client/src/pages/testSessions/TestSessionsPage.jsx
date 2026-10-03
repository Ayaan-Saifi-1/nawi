import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTestSessions } from '../../services/testSession.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore.js';
import { getDraftSessions } from '../../services/offlineSync.js';
import { useTranslation } from '../../config/i18n.js';
import './TestSessionsPage.css';

export default function TestSessionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canCreate = ['admin', 'lab_technician', 'lab_admin'].includes(user?.role);
  const limit = 15;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['test-sessions', page, search, statusFilter],
    queryFn: () =>
      getTestSessions({ page, limit, search, status: statusFilter || undefined }),
    select: (res) => res?.data || res,
    keepPreviousData: true,
  });
  const { data: offlineDrafts = [] } = useQuery({
    queryKey: ['offline-test-session-drafts'],
    queryFn: getDraftSessions,
  });

  const sessions = Array.isArray(data) ? data : (data?.sessions || data?.docs || []);
  const total = data?.meta?.total || data?.pagination?.total || data?.total || sessions.length;
  const totalPages = data?.meta?.totalPages || Math.ceil(total / limit) || 1;

  const filteredSessions = search
    ? sessions.filter((s) => {
        const q = search.toLowerCase();
        const modelName = s.instrumentModelId?.modelName?.toLowerCase() || '';
        const serialNo = s.serialNumber?.toLowerCase() || '';
        const accClass = s.accuracyClass?.toLowerCase() || s.instrumentModelId?.accuracyClass?.toLowerCase() || '';
        const idStr = s._id?.toLowerCase() || '';
        return modelName.includes(q) || serialNo.includes(q) || accClass.includes(q) || idStr.includes(q);
      })
    : sessions;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('nav_test_sessions')}</h1>
          <p className="page-header-subtitle">{t('page_subtitle_sessions')}</p>
        </div>
        {canCreate && (
          <button data-testid="new-session" className="gov-btn gov-btn-accent" onClick={() => navigate('/test-sessions/new')}>
            + {t('new_test_session')}
          </button>
        )}
      </div>

      {offlineDrafts.length > 0 && (
        <div className="gov-card mb-24">
          <div className="gov-card-header">
            <h4>On-device drafts ({offlineDrafts.length})</h4>
          </div>
          <div className="gov-card-body" style={{ padding: 0 }}>
            <div className="gov-table-wrapper" style={{ margin: 0, border: 'none' }}>
              <table className="gov-table">
                <thead>
                  <tr>
                    <th scope="col">{t('instrument_model')}</th>
                    <th scope="col">{t('serial_number')}</th>
                    <th scope="col">Sync Status</th>
                    <th scope="col">{t('created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {offlineDrafts.map((draft) => (
                    <tr
                      key={draft.clientId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/test-sessions/offline/${draft.clientId}`)}
                    >
                      <td>{draft.modelName || draft.instrumentModelId}</td>
                      <td className="text-mono">{draft.serialNumber}</td>
                      <td>
                        <StatusBadge status={draft.syncedAt ? 'passed' : 'draft'} />
                        {draft.syncedAt ? ' Synced' : ' On this device'}
                      </td>
                      <td>{new Date(draft.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="gov-card mb-24">
        <div className="gov-card-body flex-gap-8" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              className="gov-input"
              style={{ width: '100%' }}
              placeholder={t('search_sessions')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="gov-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('all_statuses')}</option>
            <option value="draft">Draft</option>
            <option value="under_review">Under Review</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="report_generated">Report Generated</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0 }}>
          <div className="gov-table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table className="gov-table test-sessions-table">
              <thead>
                <tr>
                  <th scope="col">{t('session_id')}</th>
                  <th scope="col">{t('instrument_model')}</th>
                  <th scope="col">{t('serial_number')}</th>
                  <th scope="col">{t('accuracy_class')}</th>
                  <th scope="col">{t('status')}</th>
                  <th scope="col">{t('created')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                      Loading…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Unable to load test sessions.</td></tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>
                      {user?.role === 'manufacturer' ? t('no_approved_results') : t('no_sessions')}
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr
                      key={s._id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/test-sessions/${s._id}`)}
                    >
                      <td className="text-mono" data-label={t('session_id')}>{s._id?.slice(-8) || '—'}</td>
                      <td data-label={t('instrument_model')}>{s.instrumentModelId?.modelName || s.instrumentModel?.modelName || '—'}</td>
                      <td className="text-mono" data-label={t('serial_number')}>{s.serialNumber || '—'}</td>
                      <td data-label={t('accuracy_class')}>Class {s.accuracyClass || s.instrumentModelId?.accuracyClass || 'III'}</td>
                      <td data-label={t('status')}>
                        <StatusBadge status={s.status} />
                      </td>
                      <td data-label={t('created')}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '—'}</td>
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
              Page {page} of {totalPages} ({total} records)
            </span>
            <div className="gov-pagination-buttons">
              <button
                className="gov-btn gov-btn-outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                className="gov-btn gov-btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
