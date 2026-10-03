import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activateRuleConfig, getRuleConfigs, createRuleConfig, sandboxRuleConfig, submitRuleReview, recordTechnicalReview, retireRuleConfig } from '../../services/ruleConfig.service.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { ACCURACY_CLASSES } from '../../config/constants.js';
import { useTranslation } from '../../config/i18n.js';
import { BookOpen, Plus, X, Trash2 } from 'lucide-react';
import { useModalA11y } from '../../utils/useModalA11y.js';

const CRITERION_LABELS = {
  max_abs_error_le_mpe_factor: 'Maximum absolute error (at most MPE factor)',
  range_le_mpe_factor: 'Repeatability range (at most MPE factor)',
  change_ge_factor_of_e: 'Discrimination change (at least factor × e)',
  change_le_factor_of_e: 'Discrimination change (at most factor × e)',
  manual: 'Manual checklist',
};

export default function RuleConfigsPage() {
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [reviewRule, setReviewRule] = useState(null);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [reviewForm, setReviewForm] = useState({ sourceReference: '', validationNote: '' });
  const [form, setForm] = useState({
    accuracyClass: 'III',
    oimlEdition: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    bands: [{ uptoMultipleOfE: '', mpeFactor: '' }],
    copyCriteriaFrom: '',
  });
  const [retireRule, setRetireRule] = useState(null);
  const [retireReason, setRetireReason] = useState('');
  const retireModalRef = useModalA11y(!!retireRule, () => setRetireRule(null));
  const createModalRef = useModalA11y(showModal, () => setShowModal(false));
  const reviewModalRef = useModalA11y(!!reviewRule, () => setReviewRule(null));

  const { data, isLoading } = useQuery({
    queryKey: ['rule-configs'],
    queryFn: () => getRuleConfigs({ limit: 100 }),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.rules || r?.data?.docs || []),
  });

  const createMut = useMutation({
    mutationFn: createRuleConfig,
    onSuccess: () => {
      queryClient.invalidateQueries(['rule-configs']);
      addToast({ type: 'success', message: 'Rule configuration saved as draft for expert review' });
      setShowModal(false);
    },
    onError: (error) => addToast({ type: 'error', message: error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Unable to save rule configuration' }),
  });

  const activateMut = useMutation({
    mutationFn: ({ id, sourceReference, validationNote }) => activateRuleConfig(id, { sourceReference, validationNote }),
    onSuccess: () => {
      queryClient.invalidateQueries(['rule-configs']);
      addToast({ type: 'success', message: 'Rule configuration activated with expert review recorded' });
      setReviewRule(null);
      setSandboxResult(null);
      setReviewForm({ sourceReference: '', validationNote: '' });
    },
    onError: (error) => addToast({ type: 'error', message: error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Unable to activate rule configuration' }),
  });

  const sandboxMut = useMutation({
    mutationFn: sandboxRuleConfig,
    onSuccess: (response) => {
      setSandboxResult(response?.data?.data || response?.data || null);
      queryClient.invalidateQueries(['rule-configs']);
      addToast({ type: 'success', message: 'Historical regression comparison completed. Review all changed outcomes before activation.' });
    },
    onError: (error) => addToast({ type: 'error', message: error.response?.data?.error?.message || 'Could not run rule regression comparison' }),
  });

  const errMsg = (error, fallback) => error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rule-configs'] });

  const submitMut = useMutation({
    mutationFn: submitRuleReview,
    onSuccess: () => { refresh(); addToast({ type: 'success', message: 'Rule submitted for technical review' }); },
    onError: (error) => addToast({ type: 'error', message: errMsg(error, 'Unable to submit rule for review') }),
  });
  const techReviewMut = useMutation({
    mutationFn: recordTechnicalReview,
    onSuccess: () => { refresh(); addToast({ type: 'success', message: 'Technical review recorded. A different metrology expert must now approve activation.' }); },
    onError: (error) => addToast({ type: 'error', message: errMsg(error, 'Unable to record technical review') }),
  });
  const retireMut = useMutation({
    mutationFn: ({ id, reason }) => retireRuleConfig(id, reason),
    onSuccess: () => { refresh(); addToast({ type: 'success', message: 'Rule configuration retired' }); setRetireRule(null); setRetireReason(''); },
    onError: (error) => addToast({ type: 'error', message: errMsg(error, 'Unable to retire rule configuration') }),
  });

  const handleCreate = () => {
    const source = (Array.isArray(data) ? data : []).find((r) => r._id === form.copyCriteriaFrom);
    const criteriaPayload = source?.testCriteria?.length
      ? {
          useRoundingCorrection: Boolean(source.useRoundingCorrection),
          testCriteria: source.testCriteria.map((c) => ({
            annexRef: c.annexRef,
            fields: (c.fields || []).map(({ name, labelEn, labelHi, type, unit, min, max, required }) => ({
              name, labelEn: labelEn || name, ...(labelHi ? { labelHi } : {}), type,
              ...(unit ? { unit } : {}), ...(min != null ? { min } : {}), ...(max != null ? { max } : {}),
              ...(required != null ? { required } : {}),
            })),
            criterion: { type: c.criterion?.type, params: c.criterion?.params || {} },
          })),
        }
      : {};
    createMut.mutate({
      ...criteriaPayload,
      oimlEdition: form.oimlEdition,
      accuracyClass: form.accuracyClass,
      effectiveDate: new Date(form.effectiveDate),
      bands: form.bands.map((band) => ({ uptoMultipleOfE: Number(band.uptoMultipleOfE), mpeFactor: Number(band.mpeFactor) })),
    });
  };

  const canSaveDraft = Boolean(form.oimlEdition.trim() && form.effectiveDate && form.bands.length && form.bands.every((band, index) => {
    const limit = Number(band.uptoMultipleOfE);
    const factor = Number(band.mpeFactor);
    return Number.isSafeInteger(limit) && limit > 0 && Number.isFinite(factor) && factor > 0 &&
      (index === 0 || limit > Number(form.bands[index - 1].uptoMultipleOfE));
  }));

  const updateBand = (index, field, value) => {
    setForm((f) => {
      const nextBands = [...f.bands];
      nextBands[index] = { ...nextBands[index], [field]: value };
      return { ...f, bands: nextBands };
    });
  };

  const rulesList = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="page-header">
        <div>
            <h1><BookOpen size={22} style={{ marginRight: 8, verticalAlign: -3 }} />{t('rule_configurations')}</h1>
          <p className="page-header-subtitle">{t('page_subtitle_rules')}</p>
        </div>
        {user?.role === 'admin' && <button className="gov-btn gov-btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={16} /> {t('new_rule_draft')}
        </button>}
      </div>

      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th scope="col">Accuracy Class</th>
                <th scope="col">OIML Edition</th>
                <th scope="col">Effective Date</th>
                <th scope="col">Tolerance Bands (upto m, MPE factor)</th>
                <th scope="col">Status / source</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>Loading…</td></tr>
              ) : rulesList.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>No rule configurations defined</td></tr>
              ) : (
                rulesList.map((r) => (
                  <tr key={r._id}>
                    <td><strong className="text-mono">Class {r.accuracyClass}</strong></td>
                    <td>{r.oimlEdition || 'OIML R-76-1:2006'}</td>
                    <td className="text-mono">{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : 'Active'}</td>
                    <td className="text-mono">
                      {(r.bands || []).map((b) => `≤${b.uptoMultipleOfE}e (${b.mpeFactor}x)`).join(' | ') || 'Standard OIML Bands'}
                    </td>
                    <td>
                      {r.status === 'active' && r.sourceReference?.includes('DEV SEED') ? (
                        <span className="rule-status-badges"><span className="gov-badge rule-active-badge">ACTIVE</span><span className="gov-badge rule-demo-badge">DEMO</span></span>
                      ) : (
                        <span className={`gov-badge ${r.status === 'active' ? 'gov-badge-passed' : r.status === 'retired' ? 'gov-badge-failed' : 'gov-badge-info'}`}>{(r.status || 'draft').replace('_', ' ')}</span>
                      )}
                      {r.status === 'active' && <div className="rule-source-note">{r.sourceReference || 'Source not recorded'}{r.sourceReference?.includes('DEV SEED') ? ' · not expert approved' : r.approvedAt ? ` · reviewed ${new Date(r.approvedAt).toLocaleDateString()}` : ''}</div>}
                      {r.sandboxedAt && <div className="rule-sandbox-note">
                        Regression check: {r.sandboxSummary?.compared || 0} compared, {r.sandboxSummary?.changed || 0} changed, {r.sandboxSummary?.uncomparable || 0} unresolved
                      </div>}
                      {(() => {
                        const authorId = r.createdBy?._id || r.createdBy || null;
                        const reviewerId = r.technicalReviewedBy?._id || r.technicalReviewedBy || null;
                        const isExpert = user?.role === 'metrology_expert';
                        const isAdmin = user?.role === 'admin';
                        const isAuthor = authorId && authorId === user?._id;
                        const isTechReviewer = reviewerId && reviewerId === user?._id;
                        const actions = [];
                        if (r.status === 'draft' && r.createdBy) {
                          if (isExpert) actions.push(<button key="sb" className="gov-btn gov-btn-outline" onClick={() => { setReviewRule(r); setSandboxResult(null); }}>Run regression check</button>);
                          if ((isAdmin || isExpert) && r.sandboxedAt) actions.push(<button key="sr" className="gov-btn gov-btn-primary" disabled={submitMut.isPending} onClick={() => submitMut.mutate(r._id)}>Submit for technical review</button>);
                          if ((isAdmin || isExpert) && !r.sandboxedAt) actions.push(<div key="sh" className="text-muted" style={{ fontSize: 11 }}>A metrology expert must run the regression check before this draft can be submitted.</div>);
                        }
                        if (r.status === 'in_review') {
                          if (isExpert && !r.technicalReviewedBy && !isAuthor) actions.push(<button key="tr" className="gov-btn gov-btn-primary" disabled={techReviewMut.isPending} onClick={() => techReviewMut.mutate(r._id)}>Record technical review</button>);
                          if (isExpert && r.technicalReviewedBy && !isAuthor && !isTechReviewer) actions.push(<button key="ap" className="gov-btn gov-btn-primary" onClick={() => { setReviewRule(r); setSandboxResult(null); }}>Approve and activate…</button>);
                          if (r.technicalReviewedBy) actions.push(<div key="tb" className="text-muted" style={{ fontSize: 11 }}>Technical review recorded{r.technicalReviewedAt ? ` ${new Date(r.technicalReviewedAt).toLocaleDateString()}` : ''}. Activation needs a different expert from the author and the technical reviewer.</div>);
                        }
                        if (['active', 'scheduled'].includes(r.status) && (isExpert || isAdmin)) actions.push(<button key="rt" className="gov-btn gov-btn-outline btn-retire" onClick={() => { setRetireRule(r); setRetireReason(''); }}>Retire</button>);
                        return actions.length ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>{actions}</div> : null;
                      })()}
                      {r.testCriteria?.length > 0 && <div className="rule-test-criteria">
                        <strong className="rule-test-criteria-title">Test criteria</strong>
                        {r.testCriteria.map((criterion) => <div className="rule-criterion" key={criterion.annexRef}>
                          <span className="text-mono rule-criterion-name">{criterion.annexRef}</span>: <span className="rule-criterion-description">{criterion.criterion ? (CRITERION_LABELS[criterion.criterion.type] || criterion.criterion.type) : 'Manual checklist'}
                          {criterion.criterion?.params?.factor != null && ` — factor ${criterion.criterion.params.factor}`}
                          </span><div className="rule-criterion-fields">{(criterion.fields || []).map((field) => `${field.labelEn || field.name}${field.unit ? ` (${field.unit})` : ''}`).join(', ') || '-'}</div>
                        </div>)}
                      </div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div ref={createModalRef} className="modal-content" role="dialog" aria-modal="true" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Create OIML Rule Configuration Version</h3>
              <button aria-label="Close rule draft form" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="responsive-form-grid rule-form-grid">
                <div className="gov-form-group">
                  <label className="gov-label">Accuracy Class</label>
                  <select className="gov-select" value={form.accuracyClass} onChange={(e) => setForm((f) => ({ ...f, accuracyClass: e.target.value }))}>
                    {ACCURACY_CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                <div className="gov-form-group">
                  <label className="gov-label">OIML Edition Standard</label>
                  <input className="gov-input" value={form.oimlEdition} onChange={(e) => setForm((f) => ({ ...f, oimlEdition: e.target.value }))} placeholder="Exact edition and amendment" required />
                </div>
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Effective Date</label>
                <input className="gov-input" type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label" htmlFor="rule-copy-criteria">Copy test criteria from (optional)</label>
                <select id="rule-copy-criteria" className="gov-select" value={form.copyCriteriaFrom} onChange={(e) => setForm((f) => ({ ...f, copyCriteriaFrom: e.target.value }))}>
                  <option value="">None — bands only (structured tests will not evaluate)</option>
                  {rulesList.filter((r) => r.testCriteria?.length > 0).map((r) => <option key={r._id} value={r._id}>Class {r.accuracyClass} · {r.oimlEdition} · {r.status}</option>)}
                </select>
              </div>

              <h4 style={{ marginTop: 16, marginBottom: 10 }}>MPE tolerance bands</h4>
              <p>Enter values transcribed from the governing OIML edition and applicable Indian Gazette amendments. The form starts blank to prevent indicative examples being mistaken for approved rules. A saved draft does not affect compliance calculations.</p>
              {form.bands.map((band, idx) => (
                <div key={idx} className="rule-band-row">
                  <div className="gov-form-group">
                    <label className="gov-label" style={{ fontSize: 11 }}>Upper band limit (m/e)</label>
                    <input className="gov-input" aria-label={`Band ${idx + 1} upper limit in e`} type="number" min="1" step="1" value={band.uptoMultipleOfE} onChange={(e) => updateBand(idx, 'uptoMultipleOfE', e.target.value)} required />
                  </div>
                  <div className="gov-form-group">
                    <label className="gov-label" style={{ fontSize: 11 }}>MPE factor</label>
                    <input className="gov-input" aria-label={`Band ${idx + 1} MPE factor`} type="number" min="0" step="any" value={band.mpeFactor} onChange={(e) => updateBand(idx, 'mpeFactor', e.target.value)} required />
                  </div>
                  <button type="button" className="gov-btn gov-btn-outline" aria-label={`Remove band ${idx + 1}`} disabled={form.bands.length === 1} onClick={() => setForm((current) => ({ ...current, bands: current.bands.filter((_, bandIndex) => bandIndex !== idx) }))}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="gov-btn gov-btn-outline" onClick={() => setForm((current) => ({ ...current, bands: [...current.bands, { uptoMultipleOfE: '', mpeFactor: '' }] }))}><Plus size={14} /> Add band</button>
            </div>
            <div className="modal-footer">
              <button className="gov-btn gov-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="gov-btn gov-btn-primary" onClick={handleCreate} disabled={!canSaveDraft || createMut.isPending}>
                {createMut.isPending ? 'Saving...' : 'Save rule draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewRule && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setReviewRule(null)}>
          <div ref={reviewModalRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="rule-review-title" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div><h3 id="rule-review-title">{reviewRule.status === 'in_review' ? 'Approve and activate rule' : 'Regression check'}</h3><p className="text-muted" style={{ marginTop: 4 }}>Class {reviewRule.accuracyClass} · {reviewRule.oimlEdition} · effective {new Date(reviewRule.effectiveDate).toLocaleDateString()}</p></div>
              <button onClick={() => setReviewRule(null)} aria-label="Close review" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="gov-card mb-16"><div className="gov-card-body">
                <strong>Draft tolerance bands</strong>
                {(reviewRule.bands || []).map((band, index) => <div key={index} className="text-mono" style={{ marginTop: 4 }}>≤ {band.uptoMultipleOfE}e — {band.mpeFactor} × MPE</div>)}
                <p className="text-muted" style={{ marginTop: 10, fontSize: 12 }}>The comparison shows how this draft changes saved A4 accuracy outcomes from its effective date onward. It does not establish that the draft is legally correct.</p>
              </div></div>
              {reviewRule.status === 'draft' && <button className="gov-btn gov-btn-outline mb-16" onClick={() => sandboxMut.mutate(reviewRule._id)} disabled={sandboxMut.isPending}>
                {sandboxMut.isPending ? 'Comparing historical observations…' : 'Run / refresh regression comparison'}
              </button>}
              {reviewRule.status === 'in_review' && reviewRule.sandboxSummary && <div className="gov-card mb-16" role="status"><div className="gov-card-body">
                <strong>Stored regression result</strong>
                <div style={{ margin: '8px 0' }}>{reviewRule.sandboxSummary.compared || 0} compared · {reviewRule.sandboxSummary.changed || 0} changed · {reviewRule.sandboxSummary.uncomparable || 0} unresolved</div>
              </div></div>}
              {sandboxResult && <div className="gov-card mb-16" role="status"><div className="gov-card-body">
                <strong>Comparison result</strong>
                <div className="rule-stats-grid" style={{ margin: '10px 0' }}>
                  <span>{sandboxResult.compared} compared</span><span>{sandboxResult.unchanged} unchanged</span><span>{sandboxResult.changed} changed</span><span>{sandboxResult.uncomparable} unresolved</span>
                </div>
                {sandboxResult.changes?.filter((item) => item.previousOutcome || item.proposedOutcome || item.error).length > 0 && <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 12 }}>
                  {sandboxResult.changes.filter((item) => item.previousOutcome || item.proposedOutcome || item.error).map((item) => <div key={`${item.observationId}-${item.sessionId}`} style={{ padding: '5px 0', borderTop: '1px solid var(--gov-border-subtle)' }}>
                    {item.observationId}: {item.error || `${item.previousOutcome} → ${item.proposedOutcome}`}
                  </div>)}
                </div>}
                <code className="text-mono" style={{ display: 'block', marginTop: 8, fontSize: 10, overflowWrap: 'anywhere' }}>Result digest: {sandboxResult.resultHash}</code>
              </div></div>}
              {reviewRule.status === 'in_review' && <><div className="gov-form-group"><label className="gov-label" htmlFor="rule-source-reference">Authoritative source reference</label><input id="rule-source-reference" className="gov-input" value={reviewForm.sourceReference} onChange={(event) => setReviewForm((formState) => ({ ...formState, sourceReference: event.target.value }))} placeholder="Gazette rule / amendment / OIML clause and edition" /></div>
              <div className="gov-form-group"><label className="gov-label" htmlFor="rule-validation-note">Technical review note</label><textarea id="rule-validation-note" className="gov-input" rows={4} value={reviewForm.validationNote} onChange={(event) => setReviewForm((formState) => ({ ...formState, validationNote: event.target.value }))} placeholder="Record the source clauses checked, known-answer cases, changed outcomes and rationale" /></div></>}
            </div>
            <div className="modal-footer">
              <button className="gov-btn gov-btn-outline" onClick={() => setReviewRule(null)}>Close</button>
              {reviewRule.status === 'in_review' && <button className="gov-btn gov-btn-primary" onClick={() => activateMut.mutate({ id: reviewRule._id, ...reviewForm })} disabled={(reviewRule.sandboxSummary?.uncomparable ?? 1) > 0 || !reviewForm.sourceReference.trim() || !reviewForm.validationNote.trim() || activateMut.isPending}>
                {activateMut.isPending ? 'Activating…' : 'Approve and activate rule'}
              </button>}
            </div>
          </div>
        </div>
      )}
      {retireRule && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRetireRule(null)}>
          <div ref={retireModalRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="rule-retire-title" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 id="rule-retire-title">Retire rule configuration</h3>
              <button aria-label="Close" onClick={() => setRetireRule(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>This retires Class {retireRule.accuracyClass} · {retireRule.oimlEdition} and takes it out of use. Reports already issued remain reproducible against this version.</p>
              <div className="gov-form-group"><label className="gov-label" htmlFor="rule-retire-reason">Reason (mandatory)</label>
                <textarea id="rule-retire-reason" className="gov-input" rows={3} value={retireReason} onChange={(e) => setRetireReason(e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="gov-btn gov-btn-outline" onClick={() => setRetireRule(null)}>Cancel</button>
              <button className="gov-btn btn-retire-confirm" disabled={!retireReason.trim() || retireMut.isPending} onClick={() => retireMut.mutate({ id: retireRule._id, reason: retireReason })}>{retireMut.isPending ? 'Retiring…' : 'Retire rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
