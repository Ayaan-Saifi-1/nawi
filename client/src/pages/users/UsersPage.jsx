import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser } from '../../services/user.service.js';
import apiClient from '../../services/apiClient.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useModalA11y } from '../../utils/useModalA11y.js';
import { Users, Plus, X } from 'lucide-react';

const ADMIN_ROLES = ['lab_technician', 'reviewer', 'lab_admin', 'manufacturer', 'doca_officer', 'auditor', 'metrology_expert'];
const LAB_ADMIN_ROLES = ['lab_technician', 'reviewer'];
const LAB_ROLES = ['lab_technician', 'reviewer', 'lab_admin'];
const EMPTY_FORM = { name: '', email: '', password: '', role: 'lab_technician', labId: '', manufacturerRef: '' };
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).{8,}$/;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'admin';
  const roles = isAdmin ? ADMIN_ROLES : LAB_ADMIN_ROLES;
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const modalRef = useModalA11y(showModal, () => setShowModal(false));

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
    select: (r) => (Array.isArray(r?.data) ? r.data : []),
  });
  const { data: labs = [] } = useQuery({
    queryKey: ['laboratories-select'],
    queryFn: () => apiClient.get('/laboratories'),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.data || []),
    enabled: isAdmin,
  });
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers-select'],
    queryFn: () => apiClient.get('/manufacturers'),
    select: (r) => (Array.isArray(r?.data) ? r.data : r?.data?.manufacturers || r?.data?.docs || []),
    enabled: isAdmin,
  });

  const errMsg = (e, fallback) => e?.response?.data?.error?.message || e?.message || fallback;

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast({ type: 'success', message: 'User account created' });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => addToast({ type: 'error', message: errMsg(e, 'Unable to create user') }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, active }) => updateUser(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => addToast({ type: 'error', message: errMsg(e, 'Unable to update user') }),
  });

  const needsLab = isAdmin && LAB_ROLES.includes(form.role);
  const needsMfg = form.role === 'manufacturer';
  const valid = form.name.trim() && /^\S+@\S+\.\S+$/.test(form.email) && PASSWORD_RE.test(form.password)
    && (!needsLab || form.labId) && (!needsMfg || form.manufacturerRef);

  const handleCreate = () => {
    const payload = { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role };
    if (needsLab) payload.labId = form.labId;
    if (needsMfg) payload.manufacturerRef = form.manufacturerRef;
    createMut.mutate(payload);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1><Users size={22} style={{ marginRight: 8, verticalAlign: -3 }} />User Management</h1>
          <p className="page-header-subtitle">{isAdmin ? 'All system accounts' : 'Accounts in your laboratory'}</p>
        </div>
        <button className="gov-btn gov-btn-accent" onClick={() => setShowModal(true)}><Plus size={16} /> Add user</button>
      </div>

      <div className="gov-card">
        <div className="gov-card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Laboratory</th><th scope="col">Status</th><th scope="col">Action</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--gov-text-muted)' }}>No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td className="text-mono">{u.email}</td>
                  <td>{u.role.replace('_', ' ')}</td>
                  <td className="text-mono">{u.labId || '—'}</td>
                  <td><span className={`gov-badge user-status-badge ${u.active ? 'gov-badge-passed' : 'gov-badge-failed'}`}>{u.active ? 'active' : 'disabled'}</span></td>
                  <td>
                    {u._id !== me?._id && (
                      <button className={`gov-btn gov-btn-outline user-toggle-btn ${u.active ? 'is-disable' : 'is-enable'}`} disabled={toggleMut.isPending} onClick={() => toggleMut.mutate({ id: u._id, active: !u.active })}>
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div ref={modalRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="user-create-title" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 id="user-create-title">Add user</h3>
              <button aria-label="Close" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="gov-form-group"><label className="gov-label" htmlFor="u-name">Full name</label>
                <input id="u-name" className="gov-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="gov-form-group"><label className="gov-label" htmlFor="u-email">Email</label>
                <input id="u-email" type="email" className="gov-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="gov-form-group"><label className="gov-label" htmlFor="u-pass">Temporary password</label>
                <input id="u-pass" type="password" autoComplete="new-password" className="gov-input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Min 8 chars with upper, lower, number and one of @$!%*?&#</div></div>
              <div className="gov-form-group"><label className="gov-label" htmlFor="u-role">Role</label>
                <select id="u-role" className="gov-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  {roles.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select></div>
              {needsLab && <div className="gov-form-group"><label className="gov-label" htmlFor="u-lab">Laboratory</label>
                <select id="u-lab" className="gov-select" value={form.labId} onChange={(e) => setForm((f) => ({ ...f, labId: e.target.value }))}>
                  <option value="">Select laboratory…</option>
                  {labs.map((l) => <option key={l._id} value={l.labId}>{l.labName} ({l.labId})</option>)}
                </select></div>}
              {needsMfg && <div className="gov-form-group"><label className="gov-label" htmlFor="u-mfg">Manufacturer</label>
                <select id="u-mfg" className="gov-select" value={form.manufacturerRef} onChange={(e) => setForm((f) => ({ ...f, manufacturerRef: e.target.value }))}>
                  <option value="">Select manufacturer…</option>
                  {manufacturers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select></div>}
              {!isAdmin && <p className="text-muted" style={{ fontSize: 12 }}>The account will be created in your laboratory.</p>}
            </div>
            <div className="modal-footer">
              <button className="gov-btn gov-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="gov-btn gov-btn-primary" disabled={!valid || createMut.isPending} onClick={handleCreate}>{createMut.isPending ? 'Creating…' : 'Create user'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
