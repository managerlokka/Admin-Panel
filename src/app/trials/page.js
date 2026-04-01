'use client';
import { useState, useEffect } from 'react';

function EditModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState({
    full_name: customer?.full_name || '',
    phone: customer?.phone || '',
    notes: customer?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3>✏️ Edit Trial User</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <form className="action-form" onSubmit={handleSubmit}>
            <label>Name</label>
            <input className="form-input" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} required />
            <label>Phone / WhatsApp</label>
            <input className="form-input" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="07XXXXXXXX" />
            <label>Notes</label>
            <input className="form-input" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Colombo seller, referred by..." />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function TrialsPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editSubId, setEditSubId] = useState(null);

  const fetchTrials = () => {
    setLoading(true);
    fetch('/api/subscriptions?plan=trial')
      .then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchTrials(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const doAction = async (action, subId, data = {}) => {
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subscription_id: subId, data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(result.note || 'Done');
      fetchTrials();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEditSave = async (form) => {
    if (!editSubId) return;
    const sub = subs.find(s => s.id === editSubId);
    if (!sub?.customer_id) return;
    try {
      const res = await fetch(`/api/customers/${sub.customer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast('Customer updated');
      setEditingCustomer(null);
      setEditSubId(null);
      fetchTrials();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (subId) => {
    if (!confirm('Delete this trial subscription? This cannot be undone.')) return;
    await doAction('delete_subscription', subId, { confirm: true, reason: 'Admin deleted from trials page' });
  };

  const getDaysRemaining = (trialEnd) => {
    if (!trialEnd) return 0;
    const ms = new Date(trialEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  const getHoursRemaining = (trialEnd) => {
    if (!trialEnd) return 0;
    const ms = new Date(trialEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60)));
  };

  return (
    <>
      <div className="page-header">
        <h2>⏳ Trial Management</h2>
        <p>Monitor and manage trial users — newest first</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No trial users</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Trial Start</th>
                <th>Trial End</th>
                <th>Time Left</th>
                <th>Device</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, idx) => {
                const days = getDaysRemaining(s.trial_end);
                const hours = getHoursRemaining(s.trial_end);
                const isExpired = hours <= 0;
                const isLow = hours <= 12 && !isExpired;

                return (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.customers?.full_name || '—'}</td>
                    <td>{s.customers?.email || '—'}</td>
                    <td style={{ fontWeight: 500, color: s.customers?.phone ? 'var(--green)' : 'var(--text-muted)' }}>
                      {s.customers?.phone || '—'}
                    </td>
                    <td>{s.trial_start ? new Date(s.trial_start).toLocaleDateString() : '—'}</td>
                    <td>{s.trial_end ? new Date(s.trial_end).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`badge ${isExpired ? 'badge--danger' : isLow ? 'badge--warning' : 'badge--normal'}`}>
                        {isExpired ? 'Expired' : `${hours}h (${days}d)`}
                      </span>
                    </td>
                    <td>{s.device_id ? '✅' : '❌'}</td>
                    <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <button className="btn btn--secondary btn--sm" title="Edit user"
                          onClick={() => { setEditingCustomer(s.customers); setEditSubId(s.id); }}>
                          ✏️
                        </button>
                        <button className="btn btn--secondary btn--sm" onClick={() => {
                          const d = prompt('Extend trial to (YYYY-MM-DD):');
                          if (d) doAction('extend_trial', s.id, { trial_end: new Date(d).toISOString() });
                        }}>⏳</button>
                        <button className="btn btn--sm" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }} onClick={() => {
                          doAction('change_plan', s.id, { plan: 'starter' });
                        }}>→ STR</button>
                        <button className="btn btn--sm" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid rgba(168,85,247,0.2)' }} onClick={() => {
                          doAction('change_plan', s.id, { plan: 'pro' });
                        }}>→ PRO</button>
                        <button className="btn btn--sm" style={{ background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid rgba(249,115,22,0.2)' }} onClick={() => {
                          doAction('change_plan', s.id, { plan: 'enterprise' });
                        }}>→ ENT</button>
                        <button className="btn btn--danger btn--sm" title="Delete trial"
                          onClick={() => handleDelete(s.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editingCustomer && (
        <EditModal
          customer={editingCustomer}
          onClose={() => { setEditingCustomer(null); setEditSubId(null); }}
          onSave={handleEditSave}
        />
      )}

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
