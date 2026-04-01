'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
          <h3>✏️ Edit Customer</h3>
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
              onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [toast, setToast] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCustomerId, setEditCustomerId] = useState(null);

  const fetchCustomers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterPlan) params.set('plan', filterPlan);
    if (filterStatus) params.set('status', filterStatus);
    fetch(`/api/subscriptions?${params}`)
      .then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, [filterPlan, filterStatus]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditSave = async (form) => {
    if (!editCustomerId) return;
    try {
      const res = await fetch(`/api/customers/${editCustomerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast('Customer updated');
      setEditingCustomer(null);
      setEditCustomerId(null);
      fetchCustomers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const planFilters = ['', 'trial', 'starter', 'pro', 'enterprise'];
  const statusFilters = ['', 'trial', 'active', 'expired', 'suspended'];

  return (
    <>
      <div className="page-header">
        <h2>🧑‍💼 Customers</h2>
        <p>Browse and search all customers — newest first</p>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <form className="table-toolbar__search" onSubmit={(e) => { e.preventDefault(); fetchCustomers(); }}>
            <span className="search-icon">🔍</span>
            <input placeholder="Search name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          {planFilters.map(p => (
            <button key={`p-${p}`}
              className={`filter-btn ${filterPlan === p ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterPlan(p)}>
              {p || 'All Plans'}
            </button>
          ))}
          {statusFilters.map(s => (
            <button key={`s-${s}`}
              className={`filter-btn ${filterStatus === s ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterStatus(s)}>
              {s || 'All Status'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No customers found</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th><th>Email</th><th>Phone</th>
                <th>Plan</th><th>Status</th><th>Billing End</th><th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, idx) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => router.push(`/customers/${s.customer_id}`)}>{s.customers?.full_name || '—'}</td>
                  <td>{s.customers?.email || '—'}</td>
                  <td style={{ fontWeight: 500, color: s.customers?.phone ? 'var(--green)' : 'var(--text-muted)' }}>
                    {s.customers?.phone || '—'}
                  </td>
                  <td><span className={`badge badge--${s.plan}`}>{s.plan}</span></td>
                  <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                  <td>{s.billing_end ? new Date(s.billing_end).toLocaleDateString() : '—'}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn--secondary btn--sm" title="Edit"
                      onClick={(e) => { e.stopPropagation(); setEditingCustomer(s.customers); setEditCustomerId(s.customer_id); }}>
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingCustomer && (
        <EditModal
          customer={editingCustomer}
          onClose={() => { setEditingCustomer(null); setEditCustomerId(null); }}
          onSave={handleEditSave}
        />
      )}

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
