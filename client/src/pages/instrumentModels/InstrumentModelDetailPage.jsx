import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getInstrumentModelById } from '../../services/instrumentModel.service.js';
import { getTestSessions } from '../../services/testSession.service.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { Scale, ArrowLeft, FlaskConical, CheckCircle2, XCircle, FileCheck, History } from 'lucide-react';

export default function InstrumentModelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: model, isLoading: modelLoading, isError: modelError, error: modelQueryError } = useQuery({
    queryKey: ['instrument-model', id],
    queryFn: () => getInstrumentModelById(id),
    select: (r) => r?.data || r,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['instrument-sessions-history', id],
    queryFn: () => getTestSessions({ instrumentModelId: id, limit: 100 }),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.sessions || r?.data?.docs || []),
  });

  const historySessions = Array.isArray(sessionsData) ? sessionsData : [];
  const passedCount = historySessions.filter((s) => s.overallResult === 'pass' || s.status === 'published' || s.status === 'passed').length;
  const failedCount = historySessions.filter((s) => s.overallResult === 'fail' || s.status === 'failed').length;
  const complianceRate = historySessions.length > 0 ? Math.round((passedCount / historySessions.length) * 100) : 100;

  if (modelLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading model details…</div>;
  if (modelError && modelQueryError?.response?.status === 404) return <div style={{ padding: 40, textAlign: 'center' }}><p style={{ marginBottom: 12 }}>This record is not available.</p><button className="gov-btn gov-btn-outline" onClick={() => navigate('/instrument-models')}><ArrowLeft size={14} /> Back to Instrument Models</button></div>;
  if (modelError) return <div style={{ padding: 40, textAlign: 'center' }}>Unable to load this instrument model.</div>;
  if (!model) return <div style={{ padding: 40, textAlign: 'center' }}>Instrument model not found</div>;

  return (
    <div style={{ maxWidth: 1000 }}>
      <button className="gov-btn gov-btn-outline mb-16" onClick={() => navigate('/instrument-models')}>
        <ArrowLeft size={14} /> Back to Instrument Models
      </button>

      {/* Model Header */}
      <div className="gov-card mb-24">
        <div className="gov-card-header">
          <div className="flex-gap-8">
            <Scale size={20} />
            <h3>{model.modelName}</h3>
          </div>
          <span className="gov-badge gov-badge-submitted" style={{ fontSize: 13 }}>Class {model.accuracyClass}</span>
        </div>
        <div className="gov-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, fontSize: 14 }}>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Manufacturer</span><br /><strong>{model.manufacturerId?.name || model.manufacturer?.name || '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Accuracy Class</span><br /><strong>Class {model.accuracyClass}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Maximum Capacity (Max)</span><br /><strong className="text-mono">{model.maxCapacity} kg</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Minimum Capacity (Min)</span><br /><strong className="text-mono">{model.minCapacity} kg</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Verification Scale Interval (e)</span><br /><strong className="text-mono">{model.e || model.scaleInterval} kg</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Verification Intervals (n)</span><br /><strong className="text-mono">{model.n || Math.round(model.maxCapacity / (model.e || 1))}</strong></div>
          </div>
        </div>
      </div>

      {/* Instrument-Wise Metrological History Metrics (FR-12) */}
      <div className="metric-grid mb-24">
        <div className="metric-card">
          <div className="metric-card-label">Evaluations Conducted</div>
          <div className="metric-card-value">{historySessions.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Pass Compliance Rate</div>
          <div className="metric-card-value" style={{ color: 'var(--gov-green)' }}>{complianceRate}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Passed Evaluations</div>
          <div className="metric-card-value" style={{ color: 'var(--gov-green)' }}>{passedCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Failed Non-Conformances</div>
          <div className="metric-card-value" style={{ color: 'var(--gov-red)' }}>{failedCount}</div>
        </div>
      </div>

      {/* Embedded Test History Table */}
      <div className="gov-card">
        <div className="gov-card-header flex-between">
          <h4><History size={16} style={{ marginRight: 8, verticalAlign: -2 }} />Instrument-Wise Type Evaluation History (FR-12)</h4>
          <span style={{ fontSize: 12, color: 'var(--gov-text-muted)' }}>Showing evaluation history for this model</span>
        </div>
        <div className="gov-card-body" style={{ padding: 0, overflowX: 'auto' }}>
          {sessionsLoading ? (
            <div style={{ padding: 30, textAlign: 'center' }}>Loading evaluation history…</div>
          ) : historySessions.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--gov-text-muted)' }}>No evaluation history recorded for this model yet</div>
          ) : (
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Session ID</th>
                  <th scope="col">Serial No.</th>
                  <th scope="col">Laboratory</th>
                  <th scope="col">Test Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Overall Verdict</th>
                </tr>
              </thead>
              <tbody>
                {historySessions.map((s) => (
                  <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/test-sessions/${s._id}`)}>
                    <td className="text-mono">{s._id?.slice(-8)}</td>
                    <td className="text-mono">{s.serialNumber || '—'}</td>
                    <td>{s.laboratoryName || s.labId || '—'}</td>
                    <td>{new Date(s.testDate || s.createdAt).toLocaleDateString('en-IN')}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {s.overallResult === 'pass' || s.status === 'published' ? (
                        <span className="flex-gap-8 text-pass" style={{ fontWeight: 600, fontSize: 12 }}>
                          <CheckCircle2 size={14} /> PASS
                        </span>
                      ) : s.overallResult === 'fail' || s.status === 'failed' ? (
                        <span className="flex-gap-8 text-fail" style={{ fontWeight: 600, fontSize: 12 }}>
                          <XCircle size={14} /> FAIL
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }}>PENDING</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
