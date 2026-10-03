import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInstrumentModels, createInstrumentModel } from '../../services/instrumentModel.service.js';
import { getManufacturers } from '../../services/manufacturer.service.js';
import { ACCURACY_CLASSES } from '../../config/constants.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useTranslation } from '../../config/i18n.js';
import { Plus, X, Scale } from 'lucide-react';
import { useModalA11y } from '../../utils/useModalA11y.js';

export default function InstrumentModelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = ['admin', 'lab_admin', 'manufacturer'].includes(role);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useModalA11y(showModal, () => setShowModal(false));
  const [form, setForm] = useState({
    modelName: '',
    manufacturerId: '',
    accuracyClass: 'III',
    maxCapacity: '',
    minCapacity: '',
    scaleInterval: '',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['instrument-models'],
    queryFn: () => getInstrumentModels({ limit: 100 }),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.models || r?.data?.docs || []),
  });

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers-select'],
    queryFn: () => getManufacturers({ limit: 200 }),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.manufacturers || r?.data?.docs || []),
  });

  const createMut = useMutation({
    mutationFn: createInstrumentModel,
    onSuccess: () => {
      queryClient.invalidateQueries(['instrument-models']);
      addToast({ type: 'success', message: 'Instrument model created successfully' });
      setShowModal(false);
      setForm({
        modelName: '',
        manufacturerId: '',
        accuracyClass: 'III',
        maxCapacity: '',
        minCapacity: '',
        scaleInterval: '',
      });
    },
  });

  const handleCreate = () => {
    if (
      !form.modelName.trim() ||
      !form.manufacturerId ||
      form.maxCapacity === '' ||
      form.minCapacity === '' ||
      form.scaleInterval === ''
    ) {
      addToast({
        type: 'error',
        message: 'Enter the model identity and all registered capacity and interval values.',
      });
      return;
    }
    const maxCap = Number(form.maxCapacity);
    const intervalE = Number(form.scaleInterval);
    const minCap = Number(form.minCapacity);
    const computedN = maxCap / intervalE;
    if (
      !Number.isFinite(computedN) ||
      maxCap <= 0 ||
      intervalE <= 0 ||
      minCap < 0 ||
      Math.abs(computedN - Math.round(computedN)) > 1e-9
    ) {
      addToast({
        type: 'error',
        message: 'Capacity and verification interval must be valid, and Max must be an integer multiple of e.',
      });
      return;
    }

    createMut.mutate({
      modelName: form.modelName,
      manufacturerId: form.manufacturerId,
      accuracyClass: form.accuracyClass,
      maxCapacity: maxCap,
      minCapacity: minCap,
      scaleInterval: intervalE,
      e: intervalE,
      d: intervalE,
      n: Math.round(computedN),
    });
  };

  const modelsList = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            <Scale size={22} style={{ marginRight: 8, verticalAlign: -3 }} />
            {t('nav_instrument_models')}
          </h1>
          <p className="page-header-subtitle">NAWI instrument type catalogue</p>
        </div>
        {canCreate && <button className="gov-btn gov-btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Register Model
        </button>}
      </div>

      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0 }}>
          <div className="gov-table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Model Name</th>
                  <th scope="col">Manufacturer</th>
                  <th scope="col">Accuracy Class</th>
                  <th scope="col">Max Cap.</th>
                  <th scope="col">Min Cap.</th>
                  <th scope="col">Scale Interval (e)</th>
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
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Unable to load instrument models.</td></tr>
                ) : modelsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>
                      No instrument models registered
                    </td>
                  </tr>
                ) : (
                  modelsList.map((m) => (
                    <tr
                      key={m._id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/instrument-models/${m._id}`)}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--gov-navy-imperial)' }}>{m.modelName}</td>
                      <td>{m.manufacturer?.name || m.manufacturerId?.name || '—'}</td>
                      <td>Class {m.accuracyClass}</td>
                      <td className="text-mono">{m.maxCapacity ?? '—'}</td>
                      <td className="text-mono">{m.minCapacity ?? '—'}</td>
                      <td className="text-mono">{m.e || m.scaleInterval || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div ref={modalRef} className="modal-content" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Register Instrument Model</h3>
                <button aria-label="Close instrument model form"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="gov-form-group">
                  <label className="gov-label" htmlFor="model-name">Model Name</label>
                  <input id="model-name"
                  className="gov-input"
                  value={form.modelName}
                  onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                />
              </div>
              <div className="gov-form-group">
                  <label className="gov-label" htmlFor="model-manufacturer">Manufacturer</label>
                  <select id="model-manufacturer"
                  className="gov-select"
                  value={form.manufacturerId}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturerId: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  {(manufacturers || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="gov-form-group">
                  <label className="gov-label" htmlFor="model-accuracy">Accuracy Class</label>
                  <select id="model-accuracy"
                  className="gov-select"
                  value={form.accuracyClass}
                  onChange={(e) => setForm((f) => ({ ...f, accuracyClass: e.target.value }))}
                >
                  {ACCURACY_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                <div className="gov-form-group">
                  <label className="gov-label" htmlFor="model-max-capacity">Max Capacity (kg)</label>
                  <input id="model-max-capacity"
                    className="gov-input"
                    required
                    type="number"
                    value={form.maxCapacity}
                    onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))}
                  />
                </div>
                <div className="gov-form-group">
                  <label className="gov-label" htmlFor="model-min-capacity">Min Capacity (kg)</label>
                  <input id="model-min-capacity"
                    className="gov-input"
                    required
                    type="number"
                    value={form.minCapacity}
                    onChange={(e) => setForm((f) => ({ ...f, minCapacity: e.target.value }))}
                  />
                </div>
                <div className="gov-form-group">
                  <label className="gov-label" htmlFor="model-scale-interval">Verification Interval e (kg)</label>
                  <input id="model-scale-interval"
                    className="gov-input"
                    required
                    type="number"
                    value={form.scaleInterval}
                    onChange={(e) => setForm((f) => ({ ...f, scaleInterval: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="gov-btn gov-btn-outline" onClick={() => setShowModal(false)}>
                {t('btn_cancel')}
              </button>
              <button
                className="gov-btn gov-btn-primary"
                onClick={handleCreate}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? 'Creating...' : 'Register Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
