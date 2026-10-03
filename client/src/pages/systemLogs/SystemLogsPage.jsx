import React, { useState } from 'react';
import { useLogStore } from '../../store/useLogStore.js';
import { Terminal, ShieldAlert, Trash2, Pause, Play, Download, Search, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import './SystemLogsPage.css';

export default function SystemLogsPage() {
  const { logs, clearLogs, isPaused, togglePause, filterLevel, setFilterLevel } = useLogStore();
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'errors' && log.status < 400) return false;
    if (filterLevel === 'requests' && log.type !== 'http') return false;
    if (filterLevel === 'auth' && log.type !== 'auth' && log.status !== 401 && log.status !== 403) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchUrl = log.url.toLowerCase().includes(q);
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchMethod = log.method.toLowerCase().includes(q);
      const matchStatus = String(log.status).includes(q);
      return matchUrl || matchMsg || matchMethod || matchStatus;
    }
    return true;
  });

  const exportLogsJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nawi_system_logs_${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status) => {
    if (status >= 200 && status < 300) return <span className="log-badge log-badge-2xx"><CheckCircle2 size={12} /> {status} OK</span>;
    if (status >= 400 && status < 500) return <span className="log-badge log-badge-4xx"><AlertTriangle size={12} /> {status} DENIED / BAD</span>;
    return <span className="log-badge log-badge-5xx"><XCircle size={12} /> {status} ERROR</span>;
  };

  return (
    <div className="system-logs-page">
      <div className="page-header">
        <div>
          <h1><Terminal size={24} style={{ marginRight: 8, verticalAlign: -4 }} />System Log Inspector & Terminal Console</h1>
          <p className="page-header-subtitle">Real-time HTTP request trace, RBAC security denials, and console exceptions</p>
        </div>
        <div className="flex-gap-8">
          <button className="gov-btn gov-btn-outline" onClick={togglePause}>
            {isPaused ? <><Play size={14} /> Resume Live</> : <><Pause size={14} /> Pause Stream</>}
          </button>
          <button className="gov-btn gov-btn-outline" onClick={exportLogsJson}>
            <Download size={14} /> Export JSON
          </button>
          <button className="gov-btn gov-btn-danger" onClick={clearLogs}>
            <Trash2 size={14} /> Clear Console
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="gov-card mb-24 system-log-filter-card">
        <div className="gov-card-body system-log-filter-row">
          <div className="gov-tabs system-log-filter-tabs">
            <button className={`gov-tab ${filterLevel === 'all' ? 'active' : ''}`} onClick={() => setFilterLevel('all')}>
              All Logs ({logs.length})
            </button>
            <button className={`gov-tab ${filterLevel === 'errors' ? 'active' : ''}`} onClick={() => setFilterLevel('errors')}>
              Errors & Denials ({logs.filter(l => l.status >= 400).length})
            </button>
            <button className={`gov-tab ${filterLevel === 'auth' ? 'active' : ''}`} onClick={() => setFilterLevel('auth')}>
              Auth & RBAC ({logs.filter(l => l.status === 401 || l.status === 403).length})
            </button>
          </div>

          <div className="system-log-search">
            <Search className="system-log-search-icon" size={15} />
            <input
              className="gov-input system-log-search-input"
              placeholder="Search by endpoint, status, message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Logs Inspector Table */}
      <div className="gov-card">
        <div className="gov-card-header flex-between">
          <h4>Live Terminal Output {isPaused && <span style={{ color: 'var(--gov-saffron)', fontSize: 12 }}>(PAUSED)</span>}</h4>
          <span style={{ fontSize: 12, color: 'var(--gov-text-muted)' }}>Showing {filteredLogs.length} events</span>
        </div>
        <div className="gov-card-body" style={{ padding: 0, overflowX: 'auto' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gov-text-muted)' }}>
              No console logs captured yet. Perform actions across the site to view HTTP traces in real-time.
            </div>
          ) : (
            <table className="gov-table log-table">
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Method</th>
                  <th scope="col">Endpoint / Action</th>
                  <th scope="col">Status</th>
                  <th scope="col">Latency</th>
                  <th scope="col">Message / Trace</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr
                    key={l.id}
                    className={`log-row log-row-${l.level} ${selectedLog?.id === l.id ? 'selected' : ''}`}
                    onClick={() => setSelectedLog(selectedLog?.id === l.id ? null : l)}
                  >
                    <td className="text-mono" style={{ fontSize: 12 }}>{new Date(l.timestamp).toLocaleTimeString()}</td>
                    <td><span className={`method-tag method-${l.method.toLowerCase()}`}>{l.method}</span></td>
                    <td className="text-mono" style={{ fontWeight: 600 }}>{l.url || '/api/session'}</td>
                    <td>{statusBadge(l.status)}</td>
                    <td className="text-mono" style={{ fontSize: 12 }}>{l.durationMs} ms</td>
                    <td className="text-mono" style={{ fontSize: 12, color: l.status >= 400 ? 'var(--gov-red)' : 'inherit' }}>
                      {l.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Inspector Drawer */}
      {selectedLog && (
        <div className="gov-card" style={{ marginTop: 20, borderColor: 'var(--gov-saffron)' }}>
          <div className="gov-card-header flex-between">
            <h4>Log Detail Inspector #{selectedLog.id}</h4>
            <button className="gov-btn gov-btn-outline" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setSelectedLog(null)}>Close</button>
          </div>
          <div className="gov-card-body" style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
            <p><strong>Timestamp:</strong> {selectedLog.timestamp}</p>
            <p><strong>Request:</strong> {selectedLog.method} {selectedLog.url}</p>
            <p><strong>Status:</strong> {selectedLog.status} | <strong>Latency:</strong> {selectedLog.durationMs}ms</p>
            <p><strong>Message:</strong> {selectedLog.message}</p>
            {selectedLog.details && (
              <div style={{ marginTop: 10 }}>
                <strong>Payload / Response Error Details:</strong>
                <pre style={{ background: 'var(--gov-bg-page)', padding: 12, borderRadius: 6, overflowX: 'auto', marginTop: 4, fontSize: 12 }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
