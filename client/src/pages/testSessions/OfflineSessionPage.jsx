import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { discardOfflineSession, discardQueuedObservation, getDraftObservations, getDraftPendingItems, getDraftSession, getDraftSyncIssues, replayOutbox, saveDraftObservation } from '../../services/offlineSync.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { ANNEX_REFS } from '../../config/constants.js';

export default function OfflineSessionPage() {
  const { clientId } = useParams();
  const token = useAuthStore((state) => state.token);
  const addToast = useNotificationStore((state) => state.addToast);
  const [session, setSession] = useState(null);
  const [observations, setObservations] = useState([]);
  const [annexRef, setAnnexRef] = useState('A4_accuracy');
  const [referenceLoad, setReferenceLoad] = useState('');
  const [indicatedValue, setIndicatedValue] = useState('');
  const [checklistPassed, setChecklistPassed] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [readings, setReadings] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncConflicts, setSyncConflicts] = useState([]);
  const [syncIssues, setSyncIssues] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);

  const refresh = async () => {
    const [draft, rows] = await Promise.all([getDraftSession(clientId), getDraftObservations(clientId)]);
    setSession(draft || null);
    setObservations(rows);
    setSyncIssues(await getDraftSyncIssues(clientId, draft?.serverSessionId));
    setPendingItems(await getDraftPendingItems(clientId, draft?.serverSessionId));
  };

  useEffect(() => {
    refresh().catch(() => {});
    const onNetworkChange = () => setOnline(navigator.onLine);
    const onOutboxReplayed = (event) => {
      setSyncConflicts(event.detail?.conflicts || []);
      refresh().catch(() => {});
    };
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);
    window.addEventListener('nawi:outbox-replayed', onOutboxReplayed);
    return () => {
      window.removeEventListener('online', onNetworkChange);
      window.removeEventListener('offline', onNetworkChange);
      window.removeEventListener('nawi:outbox-replayed', onOutboxReplayed);
    };
  }, [clientId]);

  if (!session) return <div className="gov-card gov-card-body">Loading offline draft…</div>;

  const method = ANNEX_REFS.find((item) => item.value === annexRef)?.method || 'manual_checklist';
  
  const structuredFields = {
    A4_eccentricity: [
      { name: 'position', label: 'Position', type: 'string' },
      { name: 'reference', label: 'Load', type: 'number' },
      { name: 'indicated', label: 'Indication', type: 'number' },
      { name: 'deltaL', label: 'Delta L (Round. Corr.)', type: 'number' }
    ],
    A4_repeatability: [
      { name: 'reference', label: 'Load', type: 'number' },
      { name: 'indicated', label: 'Indication', type: 'number' },
      { name: 'deltaL', label: 'Delta L (Round. Corr.)', type: 'number' }
    ]
  };

  const addObservation = async () => {
    let observation;
    if (method === 'structured') {
      const parsedReadings = readings.map(r => {
        const p = { ...r };
        const fields = structuredFields[annexRef] || structuredFields['A4_repeatability'];
        fields.forEach(f => {
          if (f.type === 'number' && p[f.name] !== '' && p[f.name] != null) {
            p[f.name] = Number(p[f.name]);
          }
        });
        return p;
      });
      observation = { annexRef, evaluationMethod: method, readings: parsedReadings };
    } else if (method === 'mpe_band') {
      if (referenceLoad === '' || indicatedValue === '' || !Number.isFinite(Number(referenceLoad)) || !Number.isFinite(Number(indicatedValue))) {
        addToast({ type: 'error', message: 'Enter valid reference load and indication values.' });
        return;
      }
      observation = { annexRef, evaluationMethod: method, referenceLoad: Number(referenceLoad), indicatedValue: Number(indicatedValue) };
    } else {
      if (checklistPassed === '' || !reviewerNotes.trim()) {
        addToast({ type: 'error', message: 'Choose a checklist result and record supporting notes.' });
        return;
      }
      observation = { annexRef, evaluationMethod: method, checklistPassed: checklistPassed === 'true', reviewerNotes: reviewerNotes.trim() };
    }
    await saveDraftObservation(clientId, observation);
    setReferenceLoad('');
    setIndicatedValue('');
    setChecklistPassed('');
    setReviewerNotes('');
    setReadings([]);
    await refresh();
  };

  const synchronize = async () => {
    if (!online || !token) return;
    setSyncing(true);
    const result = await replayOutbox(token);
    setSyncing(false);
    setSyncConflicts(result.conflicts || []);
    await refresh();
    addToast({ type: result.failed ? 'warning' : 'success', message: `Synced ${result.synced}; ${result.failed} item(s) still need attention.` });
  };

  const removeIssue = async (issue) => {
    if (issue.type === 'CREATE_SESSION') {
      if (!window.confirm('Discard this local session and all of its unsynchronized observations?')) return;
      await discardOfflineSession(clientId, session.serverSessionId);
      window.location.assign('/test-sessions');
      return;
    }
    await discardQueuedObservation(issue.clientId);
    await refresh();
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>Offline Test Session</h1>
          <p className="page-header-subtitle">{session.modelName || session.instrumentModelId} · Serial {session.serialNumber}</p>
        </div>
        <Link className="gov-btn gov-btn-outline" to="/test-sessions">Back to sessions</Link>
      </div>
      <div className="gov-card mb-24"><div className="gov-card-body">
        <p><strong>Sync status:</strong> {pendingItems.length ? `${session.syncedAt ? 'Session created; ' : ''}${pendingItems.length} item(s) waiting to sync` : session.syncedAt ? `All changes synced ${new Date(session.syncedAt).toLocaleString()}` : online ? 'Waiting to sync' : 'Saved on this device'}</p>
        {pendingItems.length > 0 && <button className="gov-btn gov-btn-primary" disabled={!online || syncing} onClick={synchronize}>{syncing ? 'Syncing…' : session.syncedAt ? 'Retry pending sync' : 'Sync when online'}</button>}
        {syncConflicts.length > 0 && <div role="alert" style={{ marginTop: 12 }}><strong>Sync needs attention</strong><ul>{syncConflicts.map((conflict) => <li key={conflict.clientId}>{conflict.reason}</li>)}</ul></div>}
        {syncIssues.length > 0 && <div role="alert" style={{ marginTop: 12 }}><strong>Items needing attention</strong>{syncIssues.map((issue) => <div key={issue.clientId} style={{ marginTop: 8 }}>{issue.type === 'CREATE_SESSION' ? 'Session' : 'Observation'}: {issue.lastError}{issue.type !== 'CREATE_SESSION' && <button className="gov-btn gov-btn-outline" style={{ marginLeft: 8 }} onClick={() => removeIssue(issue)}>Remove item so it can be re-entered</button>}{issue.type === 'CREATE_SESSION' && <button className="gov-btn gov-btn-outline" style={{ marginLeft: 8 }} onClick={() => removeIssue(issue)}>Discard local session</button>}</div>)}</div>}
        <p className="text-muted" style={{ marginTop: 12 }}>Offline observations are stored locally. Compliance evaluation, review, and report generation become available after synchronization.</p>
      </div></div>
      {!session.syncedAt && <div className="gov-card mb-24"><div className="gov-card-header"><h4>Add observation</h4></div><div className="gov-card-body">
        <div className="gov-form-group"><label className="gov-label">Selected procedure</label><select className="gov-select" value={annexRef} onChange={(event) => setAnnexRef(event.target.value)}>{session.selectedAnnexes.map((ref) => <option key={ref} value={ref}>{ANNEX_REFS.find((item) => item.value === ref)?.label || ref}</option>)}</select></div>
        
        {method === 'structured' && (
          <div style={{ marginBottom: 16 }}>
            <label className="gov-label">Readings</label>
            {readings.map((r, rIdx) => {
              const fields = structuredFields[annexRef] || structuredFields['A4_repeatability'];
              return (
                <div key={rIdx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {fields.map(f => (
                    <div key={f.name} className="gov-form-group" style={{ marginBottom: 0 }}>
                      <label className="gov-label" style={{ fontSize: 12 }}>{f.label}</label>
                      <input 
                        className="gov-input" 
                        type={f.type === 'number' ? 'number' : 'text'}
                        step={f.type === 'number' ? 'any' : undefined}
                        value={r[f.name] || ''} 
                        onChange={(e) => {
                          const newReadings = [...readings];
                          newReadings[rIdx][f.name] = e.target.value;
                          setReadings(newReadings);
                        }} 
                        style={{ padding: '6px' }}
                      />
                    </div>
                  ))}
                  <button className="gov-btn gov-btn-outline" type="button" onClick={() => {
                    const newReadings = readings.filter((_, i) => i !== rIdx);
                    setReadings(newReadings);
                  }} style={{ padding: '6px', color: 'var(--gov-red)', borderColor: 'var(--gov-red)' }}>Remove</button>
                </div>
              );
            })}
            <button className="gov-btn gov-btn-outline" type="button" onClick={() => {
              const fields = structuredFields[annexRef] || structuredFields['A4_repeatability'];
              const newReading = Object.fromEntries(fields.map(f => [f.name, '']));
              setReadings([...readings, newReading]);
            }}>Add Reading</button>
          </div>
        )}

        {method === 'mpe_band' && <div className="responsive-form-grid offline-observation-grid">
          <div className="gov-form-group"><label className="gov-label">Reference load</label><input className="gov-input" type="number" step="any" value={referenceLoad} onChange={(event) => setReferenceLoad(event.target.value)} /></div>
          <div className="gov-form-group"><label className="gov-label">Instrument indication</label><input className="gov-input" type="number" step="any" value={indicatedValue} onChange={(event) => setIndicatedValue(event.target.value)} /></div>
        </div>}
        
        {method === 'manual_checklist' && <>
          <div className="gov-form-group"><label className="gov-label">Checklist result</label><select className="gov-select" value={checklistPassed} onChange={(event) => setChecklistPassed(event.target.value)}><option value="">Select result</option><option value="true">Pass</option><option value="false">Fail</option></select></div>
          <div className="gov-form-group"><label className="gov-label">Evidence / notes</label><textarea className="gov-input" value={reviewerNotes} onChange={(event) => setReviewerNotes(event.target.value)} /></div>
        </>}
        <button className="gov-btn gov-btn-primary" onClick={addObservation}>Save observation locally</button>
      </div></div>}
      <div className="gov-card"><div className="gov-card-header"><h4>Recorded observations ({observations.length})</h4></div><div className="gov-card-body">
        {observations.length ? observations.map((item) => <div key={item.clientId} style={{ padding: '10px 0', borderBottom: '1px solid var(--gov-border-subtle)' }}><strong>{item.annexRef}</strong> · {item.evaluationMethod === 'structured' ? `${item.readings?.length || 0} readings` : item.evaluationMethod === 'mpe_band' ? `Reference ${item.referenceLoad}; indication ${item.indicatedValue}` : `${item.checklistPassed ? 'Pass' : 'Fail'} — ${item.reviewerNotes}`}</div>) : <p className="text-muted">No observations have been entered.</p>}
      </div></div>
    </div>
  );
}
