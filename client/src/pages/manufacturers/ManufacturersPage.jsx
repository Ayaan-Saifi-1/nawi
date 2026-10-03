import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createManufacturer, deleteManufacturer, getManufacturers, updateManufacturer } from '../../services/manufacturer.service.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useModalA11y } from '../../utils/useModalA11y.js';

const EMPTY_FORM = {
  name: '',
  contactEmail: '',
  licenseNumber: '',
  contactPhone: '',
  address: '',
};

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback;
}

export default function ManufacturersPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const addToast = useNotificationStore((state) => state.addToast);
  const canManage = ['admin', 'doca_officer'].includes(me?.role);
  const [showModal, setShowModal] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const modalRef = useModalA11y(showModal, () => setShowModal(false));

  const {
    data: manufacturers = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => getManufacturers({ limit: 100 }),
    select: (response) => (Array.isArray(response?.data) ? response.data : []),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingManufacturer(null);
    setForm(EMPTY_FORM);
  };

  const saveMutation = useMutation({
    mutationFn: (payload) => (
      editingManufacturer
        ? updateManufacturer(editingManufacturer._id, payload)
        : createManufacturer(payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      addToast({
        type: 'success',
        message: editingManufacturer ? 'Manufacturer updated' : 'Manufacturer added',
      });
      closeModal();
    },
    onError: (saveError) => addToast({
      type: 'error',
      message: getErrorMessage(saveError, 'Unable to save manufacturer'),
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManufacturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      addToast({ type: 'success', message: 'Manufacturer deleted' });
    },
    onError: (deleteError) => addToast({
      type: 'error',
      message: getErrorMessage(deleteError, 'Unable to delete manufacturer'),
    }),
  });

  const openCreateModal = () => {
    setEditingManufacturer(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (manufacturer) => {
    setEditingManufacturer(manufacturer);
    setForm({
      name: manufacturer.name || '',
      contactEmail: manufacturer.contactEmail || '',
      licenseNumber: manufacturer.licenseNumber || '',
      contactPhone: manufacturer.contactPhone || '',
      address: manufacturer.address || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      name: form.name.trim(),
      contactEmail: form.contactEmail.trim(),
      licenseNumber: form.licenseNumber.trim(),
      contactPhone: form.contactPhone.trim(),
      address: form.address.trim(),
    });
  };

  const handleDelete = (manufacturer) => {
    if (window.confirm(`Delete ${manufacturer.name}? This cannot be undone.`)) {
      deleteMutation.mutate(manufacturer._id);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1><Building2 size={22} style={{ marginRight: 8, verticalAlign: -3 }} />Manufacturers</h1>
          <p className="page-header-subtitle">Manufacturer organizations and their contact details</p>
        </div>
        {canManage && (
          <button className="gov-btn gov-btn-accent" onClick={openCreateModal}>
            <Plus size={16} /> Add manufacturer
          </button>
        )}
      </div>

      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0 }}>
          <div className="gov-table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th scope="col">Manufacturer</th>
                  <th scope="col">Contact Email</th>
                  <th scope="col">License Number</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Address</th>
                  {canManage && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: 40 }}>Loading manufacturers…</td></tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} role="alert" style={{ textAlign: 'center', padding: 40, color: 'var(--gov-red)' }}>
                      {getErrorMessage(error, 'Unable to load manufacturers.')}
                    </td>
                  </tr>
                ) : manufacturers.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>
                      No manufacturers found
                    </td>
                  </tr>
                ) : manufacturers.map((manufacturer) => (
                  <tr key={manufacturer._id}>
                    <td>{manufacturer.name}</td>
                    <td className="text-mono">{manufacturer.contactEmail}</td>
                    <td>{manufacturer.licenseNumber || '—'}</td>
                    <td>{manufacturer.contactPhone || '—'}</td>
                    <td>{manufacturer.address || '—'}</td>
                    {canManage && (
                      <td>
                        <div className="flex-gap-8">
                          <button
                            type="button"
                            className="gov-btn gov-btn-outline"
                            aria-label={`Edit ${manufacturer.name}`}
                            onClick={() => openEditModal(manufacturer)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="gov-btn gov-btn-outline"
                            aria-label={`Delete ${manufacturer.name}`}
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(manufacturer)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <form
            ref={modalRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manufacturer-form-title"
            style={{ maxWidth: 560 }}
            onSubmit={handleSubmit}
          >
            <div className="modal-header">
              <h3 id="manufacturer-form-title">{editingManufacturer ? 'Edit manufacturer' : 'Add manufacturer'}</h3>
              <button type="button" aria-label="Close" onClick={closeModal} style={{ background: 'none', border: 'none' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="gov-form-group">
                <label className="gov-label" htmlFor="manufacturer-name">Manufacturer name</label>
                <input
                  id="manufacturer-name"
                  className="gov-input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>
              <div className="gov-form-group">
                <label className="gov-label" htmlFor="manufacturer-email">Contact email</label>
                <input
                  id="manufacturer-email"
                  type="email"
                  className="gov-input"
                  value={form.contactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                  required
                />
              </div>
              <div className="responsive-form-grid">
                <div className="gov-form-group">
                  <label className="gov-label" htmlFor="manufacturer-license">License number</label>
                  <input
                    id="manufacturer-license"
                    className="gov-input"
                    value={form.licenseNumber}
                    onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                  />
                </div>
                <div className="gov-form-group">
                  <label className="gov-label" htmlFor="manufacturer-phone">Contact phone</label>
                  <input
                    id="manufacturer-phone"
                    type="tel"
                    className="gov-input"
                    value={form.contactPhone}
                    onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                  />
                </div>
              </div>
              <div className="gov-form-group">
                <label className="gov-label" htmlFor="manufacturer-address">Address</label>
                <textarea
                  id="manufacturer-address"
                  className="gov-input"
                  rows={3}
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="gov-btn gov-btn-outline" onClick={closeModal}>Cancel</button>
              <button
                type="submit"
                className="gov-btn gov-btn-primary"
                disabled={!form.name.trim() || !form.contactEmail.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : editingManufacturer ? 'Save changes' : 'Add manufacturer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
