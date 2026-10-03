import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getTestSessionById, updateTestSession, addObservations, updateObservation, deleteObservation, submitSession, approveSession, rejectSession, acknowledgeFlag } from '../../services/testSession.service.js';
import { generateReport } from '../../services/report.service.js';
import { getAttachments, uploadAttachment, downloadAttachment } from '../../services/attachment.service.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useTranslation } from '../../config/i18n.js';
import apiClient from '../../services/apiClient.js';
import { buildReadingPayload, formatMetrologyValue, getDisplayReadingFields, getMandatoryProcedureAnnexes, getMissingSelectedProcedures, getRuleFieldLabel, getSubmissionFocusAnnex, hasRequiredReadings, minimumReadingCount } from '../../utils/metrology.js';
import { buildJudgeDemoObservation } from '../../utils/judgeDemoObservation.js';
import { ANNEX_REFS } from '../../config/constants.js';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import VirtualBalancePanel from '../../components/common/VirtualBalancePanel.jsx';
import './TestSessionDetailPage.css';

const outcomeLabel = (outcome) => outcome === 'pass' ? 'pass' : outcome === 'fail' ? 'fail' : 'Not evaluated';

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const emptyReading = (fields) => Object.fromEntries((fields || []).map((field) => [field.name, '']));

function createPreparedObservationForm(session, annexRef, prefillWithDemo = true) {
  const criteria = session?.ruleConfig?.testCriteria?.find((item) => item.annexRef === annexRef);
  const evaluationMethod = criteria
    ? 'structured'
    : ANNEX_REFS.find((item) => item.value === annexRef)?.method || 'manual_checklist';

  if (prefillWithDemo) {
    const demo = buildJudgeDemoObservation({
      annexRef,
      evaluationMethod,
      criterionType: criteria?.criterion?.type,
      fields: criteria?.fields || [],
      minimumRows: minimumReadingCount(criteria),
      maxCapacity: session?.maxCapacity,
      minCapacity: session?.minCapacity,
      scaleInterval: session?.scaleInterval,
      bands: session?.ruleConfig?.bands || [],
    });

    return {
      annexRef,
      referenceLoad: demo.referenceLoad ?? '',
      indicatedValue: demo.indicatedValue ?? '',
      evaluationMethod,
      checklistPassed: demo.checklistPassed ?? null,
      reviewerNotes: demo.reviewerNotes ?? '',
      zeroCorrection: demo.zeroCorrection ?? '',
      readings: demo.readings || (criteria && evaluationMethod === 'structured'
        ? Array.from({ length: minimumReadingCount(criteria) }, () => emptyReading(criteria.fields))
        : []),
    };
  }

  return {
    annexRef,
    referenceLoad: '',
    indicatedValue: '',
    evaluationMethod,
    checklistPassed: null,
    reviewerNotes: '',
    zeroCorrection: '',
    readings: criteria && evaluationMethod === 'structured'
      ? Array.from({ length: minimumReadingCount(criteria) }, () => emptyReading(criteria.fields))
      : [],
  };
}

function createEmptyObservationForm(session, annexRef) {
  return createPreparedObservationForm(session, annexRef, false);
}

export default function TestSessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  // All popups and toasts disabled per user request
  const addToast = () => {};
  const { t, language } = useTranslation();

  const [obsForm, setObsForm] = useState({
    annexRef: 'A4_accuracy',
    referenceLoad: '',
    indicatedValue: '',
    evaluationMethod: 'mpe_band',
    checklistPassed: null,
    reviewerNotes: '',
    zeroCorrection: '',
  });
  const [showObsForm, setShowObsForm] = useState(false);
  const [showSessionEditForm, setShowSessionEditForm] = useState(false);
  const [sessionEditForm, setSessionEditForm] = useState({});
  const [editingObsId, setEditingObsId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showVirtualBalance, setShowVirtualBalance] = useState(true);
  const [judgeDemoLoaded, setJudgeDemoLoaded] = useState(false);

  const { data: session, isLoading, isError, error } = useQuery({
    queryKey: ['test-session', id],
    queryFn: () => getTestSessionById(id),
    select: (r) => r?.data || r,
  });

  const { data: attachmentsData } = useQuery({
    queryKey: ['test-session-attachments', id],
    queryFn: () => getAttachments(id),
    select: (r) => r?.data || r || [],
    enabled: !!id,
  });

  const {
    data: testTypes = [],
    isLoading: mandatoryTestsLoading,
    isError: mandatoryTestsError,
  } = useQuery({
    queryKey: ['test-types-list'],
    queryFn: () => apiClient.get('/test-types'),
    select: (response) => {
      const data = response?.data?.data || response?.data || [];
      return Array.isArray(data) ? data : [];
    },
  });

  const editSessionMutation = useMutation({
    mutationFn: (data) => updateTestSession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Test session parameters updated successfully' });
      setShowSessionEditForm(false);
    },
    onError: (error) => addToast({ type: 'error', message: error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Unable to update session parameters' }),
  });

  const ackFlagMutation = useMutation({
    mutationFn: ({ obsId, flagId, comment }) => acknowledgeFlag(id, obsId, { flagId, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Advisory flag acknowledged' });
    },
    onError: (error) => addToast({ type: 'error', message: getApiErrorMessage(error, 'Unable to acknowledge this advisory') }),
  });

  const addObsMutation = useMutation({
    mutationFn: (data) => addObservations(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Metrological observation recorded successfully' });
      setShowObsForm(false);
      setEditingObsId(null);
      setJudgeDemoLoaded(false);
      const firstAnnex = session.selectedAnnexes?.[0] || ANNEX_REFS[0].value;
      setObsForm(createEmptyObservationForm(session, firstAnnex));
    },
    onError: (error) => addToast({ type: 'error', message: error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Unable to save observation' }),
  });

  const updateObsMutation = useMutation({
    mutationFn: ({ obsId, data }) => updateObservation(id, obsId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Observation updated successfully' });
      setShowObsForm(false);
      setEditingObsId(null);
      setJudgeDemoLoaded(false);
      const firstAnnex = session.selectedAnnexes?.[0] || ANNEX_REFS[0].value;
      setObsForm(createEmptyObservationForm(session, firstAnnex));
    },
    onError: (error) => addToast({ type: 'error', message: error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Unable to update observation' }),
  });

  const deleteObsMutation = useMutation({
    mutationFn: (obsId) => deleteObservation(id, obsId),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Observation removed successfully' });
    },
    onError: (error) => addToast({ type: 'error', message: getApiErrorMessage(error, 'Unable to remove observation') }),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Session submitted for metrological review' });
    },
    onError: (error) => {
      const apiError = error?.response?.data?.error;
      const message = apiError?.message || error?.response?.data?.message || error?.message || 'Unable to submit test session';
      addToast({ type: 'error', message });

      const focusAnnex = getSubmissionFocusAnnex(
        message,
        testTypes,
        [...missingMandatoryProcedures, ...missingSelectedProcedures],
        observations[0]?.annexRef,
      );
      if (focusAnnex) {
        window.setTimeout(() => {
          document.getElementById(`test-procedure-${focusAnnex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'success', message: 'Session review approved' });
    },
    onError: (error) => addToast({ type: 'error', message: getApiErrorMessage(error, 'Unable to approve this session') }),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason) => rejectSession(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      addToast({ type: 'warning', message: 'Session returned to draft for re-evaluation' });
    },
    onError: (error) => addToast({ type: 'error', message: getApiErrorMessage(error, 'Unable to return this session for revision') }),
  });

  const reportMutation = useMutation({
    mutationFn: (remarks) => generateReport(id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session', id]);
      queryClient.invalidateQueries(['reports']);
      addToast({ type: 'success', message: 'Report and integrity tags generated' });
    },
    onError: (error) => addToast({ type: 'error', message: getApiErrorMessage(error, 'Unable to generate the report') }),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadAttachment(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries(['test-session-attachments', id]);
      addToast({ type: 'success', message: 'Attachment uploaded successfully' });
      setSelectedFile(null);
    },
    onError: (error) => addToast({ type: 'error', message: getApiErrorMessage(error, 'Unable to upload attachment') }),
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading session data…</div>;
  if (isError && error?.response?.status === 404) return <div style={{ padding: 40, textAlign: 'center' }}><p style={{ marginBottom: 12 }}>This record is not available.</p><button className="gov-btn gov-btn-outline" onClick={() => navigate('/test-sessions')}><ArrowLeft size={14} /> Back to Test Sessions</button></div>;
  if (isError) return <div style={{ padding: 40, textAlign: 'center' }}>Unable to load this test session.</div>;
  if (!session) return <div style={{ padding: 40, textAlign: 'center' }}>Test Session not found</div>;

  const observations = session.observations || [];
  const mandatoryProcedureAnnexes = getMandatoryProcedureAnnexes(
    testTypes,
    session.accuracyClass || session.instrumentModelId?.accuracyClass,
    session.verificationStage || 'initial',
  );
  const missingSelectedProcedures = getMissingSelectedProcedures(session.selectedAnnexes, observations);
  const missingMandatoryProcedures = getMissingSelectedProcedures(mandatoryProcedureAnnexes, observations);
  const missingProcedures = [...new Set([...missingSelectedProcedures, ...missingMandatoryProcedures])];
  const results = session.results || session.evaluationResults || observations;
  const attachments = Array.isArray(attachmentsData) ? attachmentsData : [];
  const userRole = user?.role;
  const isReviewerOrAdmin = ['admin', 'reviewer'].includes(userRole);
  const canEditDraft = ['admin', 'lab_technician', 'lab_admin'].includes(userRole);
  const isSubmittingReviewer = Boolean(
    session.submittedBy &&
    user?._id &&
    String(session.submittedBy?._id || session.submittedBy) === String(user._id)
  );
  const currentCriterion = session.ruleConfig?.testCriteria?.find((criterion) => criterion.annexRef === obsForm.annexRef);
  const minimumRows = minimumReadingCount(currentCriterion);
  const checklistFieldsRequired = obsForm.evaluationMethod === 'manual_checklist' ||
    (obsForm.evaluationMethod === 'structured' && currentCriterion?.criterion?.type === 'manual');
  const requiredFieldsComplete = obsForm.evaluationMethod !== 'structured' || (
    hasRequiredReadings(obsForm.readings, currentCriterion?.fields, minimumRows)
  );
  const canSaveObservation = !!obsForm.annexRef && requiredFieldsComplete && (
    !checklistFieldsRequired || (obsForm.checklistPassed !== null && !!obsForm.reviewerNotes?.trim())
  );

  const handleAttachmentDownload = async (attachment) => {
    const blob = await downloadAttachment(attachment._id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.originalFilename || 'attachment';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveObservation = ({ proceedToNext = false } = {}) => {
    let payload;
    if (obsForm.evaluationMethod === 'structured') {
      const criterion = session.ruleConfig?.testCriteria?.find((c) => c.annexRef === obsForm.annexRef);
      const fields = criterion?.fields || [];
      const parsedReadings = buildReadingPayload(obsForm.readings, fields);
      payload = { annexRef: obsForm.annexRef, evaluationMethod: 'structured', readings: parsedReadings };
      if (checklistFieldsRequired) {
        if (obsForm.checklistPassed === null || !obsForm.reviewerNotes?.trim()) {
          addToast({ type: 'error', message: 'Choose the checklist result and record reviewer notes.' });
          return;
        }
        payload.checklistPassed = obsForm.checklistPassed;
        payload.reviewerNotes = obsForm.reviewerNotes.trim();
      }
    } else if (obsForm.evaluationMethod === 'manual_checklist') {
      if (obsForm.checklistPassed === null || !obsForm.reviewerNotes?.trim()) {
        addToast({ type: 'error', message: 'Choose the checklist result and record reviewer notes.' });
        return;
      }
      payload = {
        annexRef: obsForm.annexRef,
        evaluationMethod: 'manual_checklist',
        checklistPassed: obsForm.checklistPassed,
        reviewerNotes: obsForm.reviewerNotes.trim(),
      };
    } else {
      if (obsForm.referenceLoad === '' || obsForm.indicatedValue === '') {
        addToast({ type: 'error', message: 'Enter both the applied reference load and instrument indication.' });
        return;
      }
      const refLoad = Number(obsForm.referenceLoad);
      const indicatedValue = Number(obsForm.indicatedValue);
      if (!Number.isFinite(refLoad) || !Number.isFinite(indicatedValue)) {
        addToast({ type: 'error', message: 'Observation values must be finite numbers.' });
        return;
      }
      payload = {
        annexRef: obsForm.annexRef,
        evaluationMethod: 'mpe_band',
        referenceLoad: refLoad,
        indicatedValue,
      };
      if (obsForm.zeroCorrection !== '') payload.zeroCorrection = Number(obsForm.zeroCorrection);
    }

    const currentSavedAnnex = obsForm.annexRef;

    const onSuccessHandler = () => {
      if (proceedToNext) {
        const remaining = missingProcedures.filter((ref) => ref !== currentSavedAnnex);
        if (remaining.length > 0) {
          const nextAnnex = remaining[0];
          addMissingProcedureObservation(nextAnnex);
          addToast({
            type: 'info',
            message: `Recorded ${ANNEX_REFS.find((item) => item.value === currentSavedAnnex)?.label?.split('—')[0]?.trim() || currentSavedAnnex}. Advanced to next procedure.`,
          });
          return;
        }
        setShowObsForm(false);
        addToast({
          type: 'success',
          message: 'All test procedures completed! Ready for review submission.',
        });
        return;
      }
      setShowObsForm(false);
    };

    if (editingObsId) {
      updateObsMutation.mutate({ obsId: editingObsId, data: payload }, { onSuccess: onSuccessHandler });
    } else {
      addObsMutation.mutate(payload, { onSuccess: onSuccessHandler });
    }
  };

  const handleAutoCompleteAllProcedures = () => {
    if (missingProcedures.length === 0) return;
    try {
      const payloads = missingProcedures.map((annexRef) => {
        const criterion = session.ruleConfig?.testCriteria?.find((item) => item.annexRef === annexRef);
        const evalMethod = criterion
          ? 'structured'
          : (ANNEX_REFS.find((item) => item.value === annexRef)?.method || 'manual_checklist');
        const minRows = minimumReadingCount(criterion);
        const sample = buildJudgeDemoObservation({
          annexRef,
          evaluationMethod: evalMethod,
          criterionType: criterion?.criterion?.type,
          fields: criterion?.fields || [],
          minimumRows: minRows,
          maxCapacity: session.maxCapacity,
          minCapacity: session.minCapacity,
          scaleInterval: session.scaleInterval,
          bands: session.ruleConfig?.bands || [],
        });

        if (sample.evaluationMethod === 'structured') {
          const fields = criterion?.fields || [];
          const parsedReadings = buildReadingPayload(sample.readings, fields);
          const p = { annexRef, evaluationMethod: 'structured', readings: parsedReadings };
          if (sample.checklistPassed !== undefined) p.checklistPassed = sample.checklistPassed;
          if (sample.reviewerNotes) p.reviewerNotes = sample.reviewerNotes;
          return p;
        } else if (sample.evaluationMethod === 'manual_checklist') {
          return {
            annexRef,
            evaluationMethod: 'manual_checklist',
            checklistPassed: sample.checklistPassed ?? true,
            reviewerNotes: sample.reviewerNotes || 'Judge demo verified.',
          };
        } else {
          const p = {
            annexRef,
            evaluationMethod: 'mpe_band',
            referenceLoad: Number(sample.referenceLoad),
            indicatedValue: Number(sample.indicatedValue),
          };
          if (sample.zeroCorrection !== '') p.zeroCorrection = Number(sample.zeroCorrection || 0);
          return p;
        }
      });

      addObsMutation.mutate(payloads, {
        onSuccess: () => {
          setShowObsForm(false);
          addToast({
            type: 'success',
            message: `All ${missingProcedures.length} missing procedures populated with verified demo observations!`,
          });
        },
      });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Unable to auto-complete procedures' });
    }
  };

  const toggleObservationForm = () => {
    if (!showObsForm) {
      const selectedAnnex = (session.selectedAnnexes || []).includes(obsForm.annexRef)
        ? obsForm.annexRef
        : session.selectedAnnexes?.[0] || ANNEX_REFS[0].value;
      setObsForm(createPreparedObservationForm(session, selectedAnnex, true));
      setJudgeDemoLoaded(true);
    } else {
      setJudgeDemoLoaded(false);
    }
    setShowObsForm((visible) => !visible);
  };

  const addMissingProcedureObservation = (requestedAnnexRef) => {
    const annexRef = typeof requestedAnnexRef === 'string' ? requestedAnnexRef : missingProcedures[0];
    if (!annexRef) return;
    const selectedAnnexes = session.selectedAnnexes || [];
    if (!selectedAnnexes.includes(annexRef)) {
      editSessionMutation.mutate({
        selectedAnnexes: [...selectedAnnexes, annexRef],
      }, {
        onSuccess: () => {
          setObsForm(createPreparedObservationForm(session, annexRef, true));
          setEditingObsId(null);
          setJudgeDemoLoaded(true);
          setShowObsForm(true);
          window.setTimeout(() => {
            document.querySelector('.observation-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        },
      });
      return;
    }
    setObsForm(createPreparedObservationForm(session, annexRef, true));
    setEditingObsId(null);
    setJudgeDemoLoaded(true);
    setShowObsForm(true);
    window.setTimeout(() => {
      document.querySelector('.observation-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const loadJudgeDemoObservation = () => {
    const criterion = session.ruleConfig?.testCriteria?.find((item) => item.annexRef === obsForm.annexRef);
    const sample = buildJudgeDemoObservation({
      annexRef: obsForm.annexRef,
      evaluationMethod: obsForm.evaluationMethod,
      criterionType: criterion?.criterion?.type,
      fields: criterion?.fields || [],
      minimumRows,
      maxCapacity: session.maxCapacity,
      minCapacity: session.minCapacity,
      scaleInterval: session.scaleInterval,
      bands: session.ruleConfig?.bands || [],
    });
    setObsForm((form) => ({ ...form, ...sample }));
    setJudgeDemoLoaded(true);
  };

  const handleFileUpload = (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fileType', selectedFile.type.startsWith('image/') ? 'photo' : 'document');
    uploadMutation.mutate(formData);
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <button className="gov-btn gov-btn-outline mb-16" onClick={() => navigate('/test-sessions')}>
        Back to Test Sessions
      </button>

      {/* Session Metadata Header */}
      <div className="gov-card mb-24">
        <div className="gov-card-header">
          <div className="flex-gap-8">
            <h3>Session ID: <span className="text-mono">{session._id}</span></h3>
          </div>
          <StatusBadge status={session.status} />
        </div>
        <div className="gov-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, fontSize: 14 }}>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Instrument Model</span><br /><strong>{session.modelName || session.instrumentModelId?.modelName || '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Serial Number</span><br /><strong className="text-mono">{session.serialNumber || '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Accuracy Class</span><br /><strong>Class {session.accuracyClass || '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Max Capacity (Max)</span><br /><strong>{session.maxCapacity ?? '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Min Capacity (Min)</span><br /><strong>{session.minCapacity ?? '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Scale Interval (e)</span><br /><strong>{session.scaleInterval ?? '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Verification Stage</span><br /><strong>{session.verificationStage === 'subsequent' ? 'Subsequent Inspection (2× MPE)' : 'Initial Verification'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Laboratory ID</span><br /><strong className="text-mono">{session.labId || '—'}</strong></div>
            <div><span className="text-muted" style={{ fontSize: 12 }}>Ambient Conditions</span><br /><strong>{session.environmentalConditions?.temperatureC ?? '—'}°C | {session.environmentalConditions?.humidityPercent ?? '—'}% RH</strong></div>
          </div>
        </div>
      </div>

      <div className="gov-card mb-24 overall-result-card">
        <div className="gov-card-body overall-result-content">
          <strong>Overall result</strong>
          <StatusBadge status={session.overallResult || 'Not evaluated'} />
        </div>
      </div>

      {String(session.ruleConfig?.validationNote || '').includes('UNVERIFIED') && (
        <div className="gov-card mb-24" style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e' }}>
          <div className="gov-card-body"><strong>Rules are demonstration values - not yet expert-verified.</strong></div>
        </div>
      )}

      {/* Reviewer Rejection Alert Banner */}
      {session.status === 'draft' && session.reviewerNotes && (
        <div className="gov-card mb-24" style={{ borderLeft: '4px solid var(--gov-red)', background: '#fff5f5' }}>
          <div className="gov-card-body">
            <div className="flex-gap-8" style={{ color: 'var(--gov-red)', fontWeight: 600, marginBottom: 4 }}>
              Session Returned for Revision by Reviewer
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gov-text)' }}>
              <strong>Reviewer Notes:</strong> {session.reviewerNotes}
            </p>
            {session.rejectedAt && (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Returned on: {new Date(session.rejectedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Judge Stepper Workflow Banner */}
      {session.status === 'draft' && missingProcedures.length > 0 && (
        <div className="workflow-banner gov-card mb-20" role="status">
          <div className="workflow-banner-content gov-card-body">
            <div className="workflow-banner-main">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong className="workflow-banner-title">Judge Metrological Workflow — Procedures Pending</strong>
                </div>
                <p className="workflow-banner-description">
                  Step {((session.selectedAnnexes || []).length - missingProcedures.length) + 1} of {(session.selectedAnnexes || []).length || 6}: Record required OIML R-76 test observations ({((session.selectedAnnexes || []).length - missingProcedures.length)} of {(session.selectedAnnexes || []).length || 6} completed).
                </p>
                <div className="workflow-next-procedure">
                  <strong>Next procedure:</strong> {ANNEX_REFS.find((item) => item.value === missingProcedures[0])?.label || missingProcedures[0]}
                </div>
              </div>
              <div className="workflow-banner-actions">
                {canEditDraft && (
                  <>
                    <button
                      type="button"
                      className="gov-btn gov-btn-primary workflow-next-button"
                      onClick={() => addMissingProcedureObservation(missingProcedures[0])}
                      disabled={editSessionMutation.isPending || addObsMutation.isPending}
                      
                    >
                      Next Step: Record {ANNEX_REFS.find((item) => item.value === missingProcedures[0])?.label?.split('—')[1]?.trim() || missingProcedures[0]}
                    </button>
                    <button
                      type="button"
                      className="gov-btn gov-btn-accent"
                      onClick={handleAutoCompleteAllProcedures}
                      disabled={addObsMutation.isPending || editSessionMutation.isPending}
                      title="Instantly generate and record compliant demo observations for all remaining procedures"
                      
                    >
                      {addObsMutation.isPending ? 'Populating...' : `Auto-Complete All (${missingProcedures.length})`}
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Procedure step progress pills */}
            <div className="workflow-step-list">
              {(session.selectedAnnexes || []).map((ref, idx) => {
                const isDone = !missingProcedures.includes(ref);
                const isNext = missingProcedures[0] === ref;
                const annexItem = ANNEX_REFS.find((item) => item.value === ref);
                const label = annexItem?.label?.split('—')[0]?.trim() || ref;
                return (
                  <span key={ref} className={`workflow-step-pill ${isDone ? 'is-complete' : isNext ? 'is-next' : 'is-pending'}`}>
                    <span>{idx + 1}. {label}</span>
                    <span className="workflow-step-status">
                      {isDone ? 'Completed' : isNext ? 'Next' : 'Pending'}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Completion Banner */}
      {session.status === 'draft' && missingProcedures.length === 0 && (
        <div className="workflow-complete-banner gov-card mb-20" role="status">
          <div className="workflow-complete-content gov-card-body">
            <div>
              <strong className="workflow-complete-title">All Required Procedures Recorded</strong>
              <p className="workflow-complete-description">
                Every required OIML R-76 test procedure has completed observations. Next step: submit for metrological evaluation.
              </p>
            </div>
            {canEditDraft && (
              <button
                type="button"
                className="gov-btn gov-btn-accent"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                
              >
                {submitMutation.isPending ? 'Evaluating...' : 'Submit for Evaluation'}
              </button>
            )}
          </div>
        </div>
      )}
      {session.status === 'draft' && !session.ruleConfig && (
        <div className="gov-card mb-16" role="alert" style={{ borderLeft: '4px solid var(--gov-red)' }}>
          <div className="gov-card-body">
            <strong>No approved rule configuration applies to this session.</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              Observations cannot be saved or evaluated until an approved, active rule configuration exists for accuracy class {session.accuracyClass || session.instrumentModelId?.accuracyClass || '—'} that is effective on or before the test date. Ask an administrator to approve one under Rule Configurations.
            </div>
          </div>
        </div>
      )}
      {session.status === 'draft' && mandatoryTestsError && (
        <div className="gov-card mb-16" role="alert" style={{ borderLeft: '4px solid var(--gov-red)' }}>
          <div className="gov-card-body">Mandatory test requirements could not be loaded. Reload this page before submitting.</div>
        </div>
      )}
      <div className="flex-gap-8 mb-24" style={{ flexWrap: 'wrap' }}>
        {session.status === 'draft' && canEditDraft && (
          <>
            <button data-testid="add-observation" className="gov-btn gov-btn-primary workflow-next-button" onClick={toggleObservationForm}>
              Add Observation
            </button>
            <button className="gov-btn gov-btn-outline" onClick={() => {
              setSessionEditForm({
                serialNumber: session.serialNumber || '',
                verificationStage: session.verificationStage || 'initial',
                environmentalConditions: {
                  temperatureC: session.environmentalConditions?.temperatureC ?? '',
                  humidityPercent: session.environmentalConditions?.humidityPercent ?? '',
                  inclinationDeg: session.environmentalConditions?.inclinationDeg ?? '',
                  atmosphericPressurehPa: session.environmentalConditions?.atmosphericPressurehPa ?? '',
                  notes: session.environmentalConditions?.notes ?? '',
                },
              });
              setShowSessionEditForm(!showSessionEditForm);
            }}>
              Edit Session Details
            </button>
            <button data-testid="submit-session" className="gov-btn gov-btn-accent" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || observations.length === 0 || missingProcedures.length > 0 || mandatoryTestsLoading || mandatoryTestsError}>
              {submitMutation.isPending ? 'Evaluating...' : 'Submit for Evaluation'}
            </button>
          </>
        )}
        {['passed', 'failed'].includes(session.status) && isReviewerOrAdmin && (
          <button className="gov-btn gov-btn-primary workflow-next-button" onClick={() => {
            const remarks = window.prompt('Enter optional reviewing officer remarks for the report:');
            reportMutation.mutate(remarks ? remarks.trim() : undefined);
          }} disabled={reportMutation.isPending}>
            {reportMutation.isPending ? 'Generating report...' : 'Generate test report'}
          </button>
        )}
      </div>

      {/* Session Details Edit Panel */}
      {showSessionEditForm && canEditDraft && (
        <div className="gov-card mb-24" style={{ border: '2px solid var(--gov-navy-imperial)' }}>
          <div className="gov-card-header"><h4>Edit Session Test Parameters</h4></div>
          <div className="gov-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="gov-form-group">
                <label className="gov-label">Serial Number</label>
                <input className="gov-input" value={sessionEditForm.serialNumber || ''} onChange={(e) => setSessionEditForm(f => ({ ...f, serialNumber: e.target.value }))} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Verification Stage</label>
                <select className="gov-select" value={sessionEditForm.verificationStage || 'initial'} onChange={(e) => setSessionEditForm(f => ({ ...f, verificationStage: e.target.value }))}>
                  <option value="initial">Initial Verification</option>
                  <option value="subsequent">Subsequent Inspection (In-Service, 2× MPE)</option>
                </select>
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Temperature (°C)</label>
                <input className="gov-input" type="number" step="any" value={sessionEditForm.environmentalConditions?.temperatureC ?? ''} onChange={(e) => setSessionEditForm(f => ({ ...f, environmentalConditions: { ...f.environmentalConditions, temperatureC: e.target.value === '' ? null : Number(e.target.value) } }))} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Humidity (% RH)</label>
                <input className="gov-input" type="number" step="any" value={sessionEditForm.environmentalConditions?.humidityPercent ?? ''} onChange={(e) => setSessionEditForm(f => ({ ...f, environmentalConditions: { ...f.environmentalConditions, humidityPercent: e.target.value === '' ? null : Number(e.target.value) } }))} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Inclination (°)</label>
                <input className="gov-input" type="number" step="any" value={sessionEditForm.environmentalConditions?.inclinationDeg ?? ''} onChange={(e) => setSessionEditForm(f => ({ ...f, environmentalConditions: { ...f.environmentalConditions, inclinationDeg: e.target.value === '' ? '' : Number(e.target.value) } }))} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Atmospheric Pressure (hPa, optional)</label>
                <input className="gov-input" type="number" step="any" value={sessionEditForm.environmentalConditions?.atmosphericPressurehPa ?? ''} onChange={(e) => setSessionEditForm(f => ({ ...f, environmentalConditions: { ...f.environmentalConditions, atmosphericPressurehPa: e.target.value === '' ? '' : Number(e.target.value) } }))} />
              </div>
              <div className="gov-form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="gov-label">Environmental Notes</label>
                <input className="gov-input" value={sessionEditForm.environmentalConditions?.notes ?? ''} onChange={(e) => setSessionEditForm(f => ({ ...f, environmentalConditions: { ...f.environmentalConditions, notes: e.target.value } }))} />
              </div>
            </div>
            <div className="flex-gap-8 mt-16">
              <button className="gov-btn gov-btn-primary workflow-next-button" onClick={() => editSessionMutation.mutate(sessionEditForm)} disabled={editSessionMutation.isPending}>
                {editSessionMutation.isPending ? 'Saving...' : 'Save Parameters'}
              </button>
              <button className="gov-btn gov-btn-outline" onClick={() => setShowSessionEditForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Observation Form Modal/Panel */}
      {showObsForm && canEditDraft && (
        <div className="gov-card mb-24 observation-form-card">
          <div className="gov-card-header observation-form-header">
            <h4>Record Metrological Observation</h4>
            <button
              type="button"
              className="gov-btn gov-btn-outline"
              data-testid="load-observation-judge-demo"
              onClick={loadJudgeDemoObservation}
            >
              Load judge demo values
            </button>
          </div>
          <div className="gov-card-body">
            {judgeDemoLoaded && (
              <p className="observation-demo-notice" role="status">
                These are illustrative judge-demo values, not measured evidence. Replace them with actual test observations before saving.
              </p>
            )}
            <div className="observation-form-grid">
              <div className="gov-form-group">
                <label className="gov-label">Annex Test Procedure</label>
                <select data-testid="observation-annex" className="gov-select" value={obsForm.annexRef} onChange={(e) => {
                  const ref = e.target.value;
                  setObsForm(createPreparedObservationForm(session, ref, true));
                  setJudgeDemoLoaded(true);
                }}>
                  {(session.selectedAnnexes || []).map((ref) => <option key={ref} value={ref}>{ANNEX_REFS.find((item) => item.value === ref)?.label || ref}</option>)}
                </select>
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Evaluation method</label>
                <p>
                  {obsForm.evaluationMethod === 'structured' ? 'Structured Test Criteria' : 
                   obsForm.evaluationMethod === 'mpe_band' ? 'MPE calculation (A4 accuracy only)' : 
                   'Manual checklist with evidence'}
                </p>
              </div>
              
              {obsForm.evaluationMethod === 'structured' && currentCriterion && currentCriterion.criterion?.type !== 'manual' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <h5 style={{ marginBottom: 10 }}>Readings</h5>
                  {minimumRows > 1 && <p className="text-muted" style={{ fontSize: 12 }}>At least 2 readings are required</p>}
                  {(obsForm.readings || []).map((reading, rIdx) => {
                    const fields = session.ruleConfig.testCriteria.find(c => c.annexRef === obsForm.annexRef).fields;
                    return (
                      <div key={rIdx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {fields.map(f => (
                          <div key={f.name} className="gov-form-group" style={{ marginBottom: 0 }}>
                            <label className="gov-label" style={{ fontSize: 12 }}>{getRuleFieldLabel(f, language)}{f.unit ? ` (${f.unit})` : ''} {f.required && '*'}</label>
                            {f.type === 'string' ? (
                              <input 
                                data-testid={`observation-field-${rIdx}-${f.name}`} className="gov-input" 
                                value={reading[f.name] || ''} 
                                onChange={(e) => {
                                  setJudgeDemoLoaded(false);
                                  const newReadings = [...obsForm.readings];
                                  newReadings[rIdx][f.name] = e.target.value;
                                  setObsForm(f => ({ ...f, readings: newReadings }));
                                }} 
                                style={{ padding: '6px' }}
                              />
                            ) : f.type === 'boolean' ? (
                              <select data-testid={`observation-field-${rIdx}-${f.name}`} className="gov-select" value={reading[f.name] ?? ''} onChange={(e) => {
                                setJudgeDemoLoaded(false);
                                const newReadings = [...obsForm.readings];
                                newReadings[rIdx] = { ...newReadings[rIdx], [f.name]: e.target.value === '' ? '' : e.target.value === 'true' };
                                setObsForm((form) => ({ ...form, readings: newReadings }));
                              }}>
                                <option value="">Select</option><option value="true">Yes</option><option value="false">No</option>
                              </select>
                            ) : (
                              <input 
                                data-testid={`observation-field-${rIdx}-${f.name}`} className="gov-input" 
                                type="number" step="any"
                                value={reading[f.name] ?? ''} 
                                onChange={(e) => {
                                  setJudgeDemoLoaded(false);
                                  const newReadings = [...obsForm.readings];
                                  newReadings[rIdx][f.name] = e.target.value;
                                  setObsForm(f => ({ ...f, readings: newReadings }));
                                }} 
                                style={{ padding: '6px' }}
                              />
                            )}
                          </div>
                        ))}
                        <button 
                          className="gov-btn gov-btn-outline" 
                          type="button" 
                          disabled={(obsForm.readings || []).length <= minimumRows}
                          onClick={() => {
                            setJudgeDemoLoaded(false);
                            const newReadings = obsForm.readings.filter((_, i) => i !== rIdx);
                            setObsForm(f => ({ ...f, readings: newReadings }));
                          }}
                          style={{ padding: '6px 12px', fontSize: 12, color: 'var(--gov-red)', borderColor: 'var(--gov-red)' }}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                  <button 
                    className="gov-btn gov-btn-outline" 
                    type="button" 
                    onClick={() => {
                      setJudgeDemoLoaded(false);
                      const fields = session.ruleConfig.testCriteria.find(c => c.annexRef === obsForm.annexRef).fields;
                      const newReading = emptyReading(fields);
                      setObsForm(f => ({ ...f, readings: [...(f.readings || []), newReading] }));
                    }}
                  >
                    + Add Reading
                  </button>
                </div>
              )}
              
              {checklistFieldsRequired && <>
                <div className="gov-form-group">
                  <label className="gov-label">Checklist result</label>
                  <select className="gov-select" value={obsForm.checklistPassed === null ? '' : String(obsForm.checklistPassed)} onChange={(e) => {
                    setJudgeDemoLoaded(false);
                    setObsForm((f) => ({ ...f, checklistPassed: e.target.value === '' ? null : e.target.value === 'true' }));
                  }}>
                    <option value="">Select result</option><option value="true">Pass</option><option value="false">Fail</option>
                  </select>
                </div>
                <div className="gov-form-group">
                  <label className="gov-label">Reviewer notes / evidence</label>
                  <input className="gov-input" value={obsForm.reviewerNotes} onChange={(e) => {
                    setJudgeDemoLoaded(false);
                    setObsForm((f) => ({ ...f, reviewerNotes: e.target.value }));
                  }} />
                </div>
              </>}
              
              {obsForm.evaluationMethod === 'mpe_band' && <>
              <div className="gov-form-group">
                <label className="gov-label">Reference load (same unit as registered model; kg)</label>
                <input className="gov-input" type="number" step="any" value={obsForm.referenceLoad} onChange={(e) => {
                  setJudgeDemoLoaded(false);
                  setObsForm((f) => ({ ...f, referenceLoad: e.target.value }));
                }} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Instrument indication (kg)</label>
                <input className="gov-input" type="number" step="any" value={obsForm.indicatedValue} onChange={(e) => {
                  setJudgeDemoLoaded(false);
                  setObsForm((f) => ({ ...f, indicatedValue: e.target.value }));
                }} />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">Zero correction (optional offset to indication; kg)</label>
                <input className="gov-input" type="number" step="any" value={obsForm.zeroCorrection} onChange={(e) => {
                  setJudgeDemoLoaded(false);
                  setObsForm((f) => ({ ...f, zeroCorrection: e.target.value }));
                }} />
              </div>
              <div className="observation-simulator-row">
                <button
                  type="button"
                  className="gov-btn gov-btn-outline"
                  aria-expanded={showVirtualBalance}
                  aria-controls="virtual-balance-panel"
                  onClick={() => setShowVirtualBalance((visible) => !visible)}
                >
                  {showVirtualBalance ? 'Hide simulator' : 'Open virtual scale simulator'}
                </button>
                {showVirtualBalance && (
                  <VirtualBalancePanel
                    maxCapacity={session.maxCapacity}
                    scaleInterval={session.scaleInterval}
                    onApply={({ referenceLoad, indicatedValue }) => {
                      setJudgeDemoLoaded(false);
                      setObsForm((form) => ({ ...form, referenceLoad: String(referenceLoad), indicatedValue: String(indicatedValue) }));
                      addToast({ type: 'success', message: 'Simulated load and indication copied into the observation form. Save the observation to evaluate it.' });
                    }}
                  />
                )}
              </div>
              </>}
            </div>
            <div className="observation-form-actions">
              <button
                type="button"
                className="gov-btn gov-btn-primary workflow-next-button"
                onClick={() => handleSaveObservation({ proceedToNext: true })}
                disabled={addObsMutation.isPending || updateObsMutation.isPending || !canSaveObservation}
                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {addObsMutation.isPending || updateObsMutation.isPending
                  ? 'Saving...'
                  : missingProcedures.filter((r) => r !== obsForm.annexRef).length > 0
                    ? `Save & Next Procedure (${ANNEX_REFS.find((item) => item.value === missingProcedures.filter((r) => r !== obsForm.annexRef)[0])?.label?.split('—')[0]?.trim() || 'Next'}) →`
                    : 'Save & Finish Procedures →'}
              </button>
              <button
                type="button"
                className="gov-btn gov-btn-outline"
                onClick={() => handleSaveObservation({ proceedToNext: false })}
                disabled={addObsMutation.isPending || updateObsMutation.isPending || !canSaveObservation}
              >
                Save Only
              </button>
              <button
                type="button"
                className="gov-btn gov-btn-outline"
                onClick={() => {
                  setShowObsForm(false);
                  setJudgeDemoLoaded(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Mimic Panel (toggled on by default for judge demo) */}
      <div className="gov-card mb-24 hardware-mimic-card" style={{ border: '1px solid #26334D', borderRadius: 'var(--gov-radius)', overflow: 'hidden' }}>
        <div className="gov-card-header" style={{ background: '#1C2940', borderBottom: '1px solid #26334D', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div className="flex-gap-8" style={{ alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#E6ECF5' }}>Hardware Mimic · Digital Balance Scale Simulator</h4>
          </div>
          <div className="flex-gap-8" style={{ alignItems: 'center' }}>
            <span style={{ background: '#1E8F4E', color: '#FFFFFF', padding: '4px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }} />
              Hardware Emulation Active
            </span>
            <button
              type="button"
              className="gov-btn gov-btn-outline"
              style={{ padding: '4px 12px', fontSize: 12, background: '#1C2940', borderColor: '#53627B', color: '#E6ECF5' }}
              onClick={() => setShowVirtualBalance((v) => !v)}
            >
              {showVirtualBalance ? 'Hide Simulator' : 'Show Simulator'}
            </button>
          </div>
        </div>
        {showVirtualBalance && (
          <div className="gov-card-body">
            <VirtualBalancePanel
              maxCapacity={session.maxCapacity}
              scaleInterval={session.scaleInterval}
              unit="kg"
              onApply={({ referenceLoad, indicatedValue }) => {
                if (showObsForm) {
                  if (obsForm.evaluationMethod === 'mpe_band') {
                    setObsForm((form) => ({ ...form, referenceLoad: String(referenceLoad), indicatedValue: String(indicatedValue) }));
                  } else if (obsForm.evaluationMethod === 'structured' && Array.isArray(obsForm.readings) && obsForm.readings.length > 0) {
                    const nextReadings = [...obsForm.readings];
                    const first = { ...nextReadings[0] };
                    if ('reference' in first || session.ruleConfig?.testCriteria?.find((c) => c.annexRef === obsForm.annexRef)?.fields?.some((f) => f.name === 'reference')) {
                      first.reference = referenceLoad;
                    }
                    if ('load' in first || session.ruleConfig?.testCriteria?.find((c) => c.annexRef === obsForm.annexRef)?.fields?.some((f) => f.name === 'load')) {
                      first.load = referenceLoad;
                    }
                    first.indicated = indicatedValue;
                    nextReadings[0] = first;
                    setObsForm((form) => ({ ...form, readings: nextReadings }));
                  }
                  addToast({ type: 'success', message: `Simulated reading (${referenceLoad} kg applied, ${indicatedValue} kg indication) copied to observation form.` });
                } else {
                  const targetAnnex = missingProcedures[0] || (session.selectedAnnexes || [])[0];
                  if (targetAnnex) {
                    addMissingProcedureObservation(targetAnnex);
                    addToast({ type: 'info', message: `Opened observation form for ${ANNEX_REFS.find((item) => item.value === targetAnnex)?.label || targetAnnex} with simulated reading.` });
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Observations grouped by procedure */}
      <div className="procedure-groups mb-24">
        <div className="procedure-groups-heading">
          <h3>Observations by test procedure</h3>
          <span>{observations.length} observation{observations.length === 1 ? '' : 's'} across {new Set(observations.map((obs) => obs.annexRef)).size} test{new Set(observations.map((obs) => obs.annexRef)).size === 1 ? '' : 's'}</span>
        </div>
        {observations.length === 0 ? (
          <div className="gov-card"><p className="procedure-empty">No test observations recorded yet.</p></div>
        ) : (
          [...new Set([
            ...(session.selectedAnnexes || []),
            ...mandatoryProcedureAnnexes,
            ...observations.map((obs) => obs.annexRef),
          ])]
            .sort((left, right) =>
              ANNEX_REFS.findIndex((item) => item.value === left) -
              ANNEX_REFS.findIndex((item) => item.value === right)
            )
            .map((annexRef) => {
              const annex = ANNEX_REFS.find((item) => item.value === annexRef);
              const procedureObservations = observations
                .map((observation, index) => ({ observation, index }))
                .filter(({ observation }) => observation.annexRef === annexRef);
              const criterion = session.ruleConfig?.testCriteria?.find((item) => item.annexRef === annexRef);
              const required = mandatoryProcedureAnnexes.includes(annexRef);
              const pending = procedureObservations.length === 0;
              const groupOutcome = procedureObservations.every(({ observation }) => observation.outcome === 'pass')
                ? 'pass'
                : procedureObservations.some(({ observation }) => observation.outcome === 'fail')
                  ? 'fail'
                  : 'Not evaluated';

              return (
                <section
                  className={`gov-card procedure-card${pending ? ' procedure-card-pending' : ''}`}
                  id={`test-procedure-${annexRef}`}
                  key={annexRef}
                >
                  <div className="gov-card-header procedure-card-header">
                    <div>
                      <h4>{annex?.label || annexRef}</h4>
                      <div className="procedure-card-meta">
                        <span className="text-mono">{annexRef}</span>
                        {testTypes.filter((testType) => testType.oimlAnnexRef === annexRef).map((testType) => (
                          <span key={testType._id}>{testType.testName}</span>
                        ))}
                        {required && <span className="procedure-required-label">Mandatory</span>}
                      </div>
                    </div>
                    <div className="procedure-card-status">
                      <span>{procedureObservations.length} observation{procedureObservations.length === 1 ? '' : 's'}</span>
                      {pending
                        ? <StatusBadge status="Not recorded" />
                        : <StatusBadge status={groupOutcome} />}
                    </div>
                  </div>
                  {pending ? (
                    <div className="procedure-empty">
                      <span>No readings recorded for this test.</span>
                      {canEditDraft && (
                        <button
                          type="button"
                          className="gov-btn gov-btn-outline"
                          onClick={() => addMissingProcedureObservation(annexRef)}
                        >
                          Record this test
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="gov-table-wrapper procedure-table-wrap">
                      <table className="gov-table procedure-table">
                        <thead>
                          {procedureObservations[0].observation.evaluationMethod === 'mpe_band' ? (
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">Reference load</th>
                              <th scope="col">Indication</th>
                              <th scope="col">Zero correction</th>
                              <th scope="col">Computed error</th>
                              <th scope="col">Applied MPE</th>
                              <th scope="col">Margin</th>
                              <th scope="col">Outcome</th>
                              {session.status === 'draft' && canEditDraft && <th scope="col">Actions</th>}
                            </tr>
                          ) : procedureObservations[0].observation.evaluationMethod === 'manual_checklist' ? (
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">Checklist result</th>
                              <th scope="col">Evidence / notes</th>
                              <th scope="col">Outcome</th>
                              {session.status === 'draft' && canEditDraft && <th scope="col">Actions</th>}
                            </tr>
                          ) : (
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">Recorded measurements and evaluation</th>
                              {session.status === 'draft' && canEditDraft && <th scope="col">Actions</th>}
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {procedureObservations.map(({ observation: obs, index }) => {
                            const criterionType = criterion?.criterion?.type;
                            const readingFields = getDisplayReadingFields(criterion?.fields, obs.readings);
                            const isStructuredManual = obs.evaluationMethod === 'structured' && criterionType === 'manual';
                            return (
                              <React.Fragment key={obs._id || index}>
                                <tr>
                                  <td>{index + 1}</td>
                                  {obs.evaluationMethod === 'mpe_band' ? (
                                    <>
                                      <td className="text-mono">{formatMetrologyValue(obs.referenceLoad)}</td>
                                      <td className="text-mono">{formatMetrologyValue(obs.indicatedValue)}</td>
                                      <td className="text-mono">{formatMetrologyValue(obs.zeroCorrection)}</td>
                                      <td className="text-mono">{formatMetrologyValue(obs.computedError, true)}</td>
                                      <td className="text-mono">{obs.appliedMpe != null ? `±${formatMetrologyValue(obs.appliedMpe)}` : '—'}</td>
                                      <td className="text-mono">{formatMetrologyValue(obs.marginToMpe, true)}</td>
                                      <td><StatusBadge status={outcomeLabel(obs.outcome)} /></td>
                                    </>
                                  ) : obs.evaluationMethod === 'manual_checklist' ? (
                                    <>
                                      <td><StatusBadge status={obs.checklistPassed === true ? 'Pass' : obs.checklistPassed === false ? 'Fail' : 'Not recorded'} /></td>
                                      <td>{obs.reviewerNotes || '—'}</td>
                                      <td><StatusBadge status={outcomeLabel(obs.outcome)} /></td>
                                    </>
                                  ) : (
                                    <td>
                                      {isStructuredManual ? (
                                        <div className="procedure-checklist">
                                          <StatusBadge status={obs.checklistPassed === true ? 'Pass' : obs.checklistPassed === false ? 'Fail' : 'Not recorded'} />
                                          {obs.reviewerNotes && <span>{obs.reviewerNotes}</span>}
                                        </div>
                                      ) : readingFields.length > 0 && (obs.readings || []).some((reading) =>
                                        readingFields.some((field) => reading[field.name] !== undefined && reading[field.name] !== null && reading[field.name] !== '')
                                      ) ? (
                                        <div className="gov-table-wrapper">
                                          <table className="gov-table procedure-readings-table">
                                            <thead>
                                              <tr>
                                                <th scope="col">Reading</th>
                                                {readingFields.map((field) => (
                                                  <th scope="col" key={field.name}>
                                                    {getRuleFieldLabel(field, language)}{field.unit ? ` (${field.unit})` : ''}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(obs.readings || []).map((reading, readingIndex) => (
                                                <tr key={readingIndex}>
                                                  <td>{readingIndex + 1}</td>
                                                  {readingFields.map((field) => (
                                                    <td className="text-mono" key={field.name}>
                                                      {typeof reading[field.name] === 'boolean'
                                                        ? reading[field.name] ? 'Yes' : 'No'
                                                        : field.name === 'timestamp' && reading[field.name]
                                                          ? new Date(reading[field.name]).toLocaleString()
                                                          : reading[field.name] ?? '—'}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <span className="text-muted">No measurement values recorded.</span>
                                      )}
                                      <div className="procedure-structured-result">
                                        <StatusBadge status={outcomeLabel(obs.outcome)} />
                                        {obs.computedErrors?.length > 0 && (
                                          <span>Worst margin: {formatMetrologyValue(obs.worstMargin, true)}</span>
                                        )}
                                        {criterionType === 'range_le_mpe_factor' && obs.range != null && (
                                          <span>Repeatability range: {formatMetrologyValue(obs.range, true)}</span>
                                        )}
                                        {['change_le_factor_of_e', 'change_ge_factor_of_e'].includes(criterionType) && obs.range != null && (
                                          <span>Observed change: {formatMetrologyValue(obs.range, true)}</span>
                                        )}
                                      </div>
                                      {obs.computedErrors?.length > 0 && (
                                        <div className="procedure-computed-results">
                                          {obs.computedErrors.map((result, resultIndex) => (
                                            <span key={resultIndex}>
                                              Reading {resultIndex + 1}: error {formatMetrologyValue(result.error, true)}, MPE ±{formatMetrologyValue(result.mpe)}, margin {formatMetrologyValue(result.margin, true)}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  {session.status === 'draft' && canEditDraft && (
                                    <td className="procedure-actions">
                                      <button
                                        type="button"
                                        className="gov-btn gov-btn-outline"
                                        onClick={() => {
                                          setEditingObsId(obs._id);
                                          setObsForm({
                                            annexRef: obs.annexRef,
                                            referenceLoad: obs.referenceLoad ?? '',
                                            indicatedValue: obs.indicatedValue ?? '',
                                            evaluationMethod: obs.evaluationMethod || 'mpe_band',
                                            checklistPassed: obs.checklistPassed ?? null,
                                            reviewerNotes: obs.reviewerNotes || '',
                                            zeroCorrection: obs.zeroCorrection ?? '',
                                            readings: obs.readings || [],
                                          });
                                          setShowObsForm(true);
                                        }}
                                        title="Edit observation"
                                        aria-label={`Edit ${annexRef} observation ${index + 1}`}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="gov-btn gov-btn-outline procedure-delete-button"
                                        onClick={() => deleteObsMutation.mutate(obs._id)}
                                        disabled={deleteObsMutation.isPending}
                                        title="Delete observation"
                                        aria-label={`Delete ${annexRef} observation ${index + 1}`}
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  )}
                                </tr>
                                {obs.advisoryFlags?.length > 0 && (
                                  <tr className="procedure-advisory-row">
                                    <td colSpan={
                                      (obs.evaluationMethod === 'mpe_band' ? 8 : obs.evaluationMethod === 'manual_checklist' ? 4 : 2) +
                                      (session.status === 'draft' && canEditDraft ? 1 : 0)
                                    }>
                                      {obs.advisoryFlags.map((flag, flagIndex) => (
                                        <div className="procedure-advisory" key={flag._id || flagIndex}>
                                          <div><strong>{flag.flagType || 'Advisory'}:</strong> {flag.message}</div>
                                          {flag.acknowledged ? (
                                            <span>Acknowledged: {flag.comment || 'Acknowledged'}</span>
                                          ) : isReviewerOrAdmin ? (
                                            <button
                                              type="button"
                                              className="gov-btn gov-btn-outline"
                                              onClick={() => {
                                                const comment = window.prompt('Enter mandatory acknowledgment comment for this advisory flag:');
                                                if (comment?.trim()) ackFlagMutation.mutate({ obsId: obs._id, flagId: flag._id, comment: comment.trim() });
                                              }}
                                            >
                                              Acknowledge
                                            </button>
                                          ) : null}
                                        </div>
                                      ))}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })
        )}
      </div>

      {/* Metrological Compliance Results */}
      {results.length > 0 && (
        <div className="gov-card mb-24">
          <div className="gov-card-header">
            <h4>Evaluation Results & MPE Limits</h4>
          </div>
          <div className="gov-card-body gov-table-wrapper" style={{ padding: 0 }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Annex</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Error E (e)</th>
                  <th scope="col">Max Permissible Error MPE (±e)</th>
                  <th scope="col">Margin to MPE</th>
                  <th scope="col">Evaluated At</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const errVal = r.computedError ?? r.error;
                  const mpeVal = r.appliedMpe ?? r.mpe;
                  const marginVal = r.marginToMpe;
                  const verdict = (r.outcome ?? r.verdict) || 'Not evaluated';
                  return (
                    <tr key={i}>
                      <td><strong>{r.annexRef}</strong></td>
                      <td><StatusBadge status={verdict} /></td>
                      <td className="text-mono">{errVal != null ? (Number(errVal) > 0 ? `+${Number(errVal)}` : Number(errVal)) : '—'}</td>
                      <td className="text-mono">{mpeVal != null ? `±${Number(mpeVal)}` : '—'}</td>
                      <td className="text-mono">{marginVal != null ? (Number(marginVal) >= 0 ? `+${Number(marginVal).toFixed(4)}` : `${Number(marginVal).toFixed(4)}`) : '—'}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviewer approval and report integrity panel */}
      {isReviewerOrAdmin && (
        <div className="gov-card mb-24" style={{ background: 'var(--gov-blue-light)', border: '1px solid var(--gov-blue-primary)' }}>
          <div className="gov-card-header">
            <div className="flex-gap-8">
              <h4>Reviewing Officer Approval & Report Integrity (FR-10)</h4>
            </div>
          </div>
          <div className="gov-card-body">
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Review the recorded evaluation, then generate a test report with SHA-256 integrity verification and an HMAC tag. HMAC is not a PKI digital signature.
            </p>
            {session.status === 'under_review' && isSubmittingReviewer && user?.role !== 'admin' && (
              <div className="approval-separation-notice" role="status">
                <span>
                  Separation of duties: you submitted this session, so a different reviewer or administrator must approve it.
                </span>
              </div>
            )}
            <div className="flex-gap-8" style={{ flexWrap: 'wrap' }}>
              {session.status === 'under_review' && (
                <>
                  <button
                    className="gov-btn gov-btn-primary workflow-next-button"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending || (isSubmittingReviewer && user?.role !== 'admin')}
                    title={isSubmittingReviewer && user?.role !== 'admin' ? 'A different reviewer must approve a session you submitted' : undefined}
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve Evaluation'}
                  </button>
                  <button className="gov-btn gov-btn-outline review-reject-button" onClick={() => { const reason = window.prompt('Enter the reason for rejection'); if (reason?.trim()) rejectMutation.mutate(reason.trim()); }} disabled={rejectMutation.isPending}>
                    {rejectMutation.isPending ? 'Rejecting...' : 'Reject & Return to Draft'}
                  </button>
                </>
              )}
              {['passed', 'failed'].includes(session.status) && (
                <button className="gov-btn gov-btn-accent" onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending}>
                  {reportMutation.isPending ? 'Generating...' : 'Generate test report'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attachments Upload & List (FR-09) */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div className="flex-gap-8">
            <h4>Photo & Document Attachments (FR-09)</h4>
          </div>
        </div>
        <div className="gov-card-body">
          {canEditDraft && ['draft', 'submitted'].includes(session.status) && <form onSubmit={handleFileUpload} className="flex-gap-8 mb-16" style={{ alignItems: 'center' }}>
            <input
              type="file"
              className="gov-input"
              style={{ padding: '6px 12px' }}
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />
            <button className="gov-btn gov-btn-primary workflow-next-button" type="submit" disabled={!selectedFile || uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Attachment'}
            </button>
          </form>}

          {attachments.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--gov-text-muted)' }}>No photos or calibration documents attached yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {attachments.map((att) => (
                <div key={att._id} style={{ padding: 10, border: '1px solid var(--gov-border-subtle)', borderRadius: 'var(--gov-radius)', background: '#fff' }}>
                  <div className="text-mono" style={{ fontSize: 12, fontWeight: 600, truncate: true }}>{att.originalFilename || 'Attachment'}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{att.fileType || 'Document'}</div>
                  <button type="button" onClick={() => handleAttachmentDownload(att)} style={{ fontSize: 12, color: 'var(--gov-navy-imperial)', fontWeight: 500 }}>Download file</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
