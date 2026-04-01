'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

function ActionModal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const [customer, setCustomer] = useState(null);
  const [sub, setSub] = useState(null);
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchData = () => {
    fetch(`/api/customers/${params.id}`)
      .then(r => r.json())
      .then(d => {
        setCustomer(d.customer);
        setSub(d.subscription);
        setUsage(d.usage);
        setPayments(d.payments || []);
        setActions(d.actions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [params.id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const doAction = async (action, data = {}) => {
    if (!sub) return;
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, subscription_id: sub.id, data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(result.note || 'Done');
      setActiveAction(null);
      fetchData();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast('Profile updated successfully');
      setActiveAction(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!customer) return <div className="empty-state"><div className="empty-state__icon">❌</div><div className="empty-state__text">Customer not found</div></div>;

  return (
    <>
      <div className="page-header">
        <h2>🧑‍💼 {customer.full_name}</h2>
        <p>Customer detail</p>
      </div>

      {/* Action Buttons */}
      {sub && (
        <div className="actions-bar">
          <button className="btn btn--primary btn--sm" onClick={() => {
            setEditForm({
              full_name: customer.full_name || '',
              email: customer.email || '',
              phone: customer.phone || '',
              notes: customer.notes || '',
            });
            setActiveAction('edit_profile');
          }}>✏️ Edit Profile</button>
          <button className="btn btn--primary btn--sm" onClick={() => setActiveAction('change_plan')}>🔄 Change Plan</button>
          <button className="btn btn--secondary btn--sm" onClick={() => setActiveAction('extend_trial')}>⏳ Extend Trial</button>
          <button className="btn btn--secondary btn--sm" onClick={() => setActiveAction('extend_billing')}>📅 Extend Billing</button>
          {sub.status !== 'suspended' ? (
            <button className="btn btn--danger btn--sm" onClick={() => setActiveAction('suspend')}>⛔ Suspend</button>
          ) : (
            <button className="btn btn--success btn--sm" onClick={() => doAction('reactivate')}>✅ Reactivate</button>
          )}
          <button className="btn btn--secondary btn--sm" onClick={() => setActiveAction('reset_device')}>💻 Reset Device</button>
          <button className="btn btn--success btn--sm" onClick={() => setActiveAction('mark_payment')}>💰 Mark Payment</button>
        </div>
      )}

      <div className="detail-grid">
        {/* Profile */}
        <div className="detail-section">
          <div className="detail-section__title">👤 Profile</div>
          <div className="detail-row"><span className="detail-row__label">Name</span><span className="detail-row__value">{customer.full_name}</span></div>
          <div className="detail-row"><span className="detail-row__label">Email</span><span className="detail-row__value">{customer.email || '—'}</span></div>
          <div className="detail-row"><span className="detail-row__label">Phone</span><span className="detail-row__value" style={{ fontWeight: 600, color: customer.phone ? 'var(--green)' : 'var(--text-muted)' }}>{customer.phone || '—'}</span></div>
          <div className="detail-row"><span className="detail-row__label">Notes</span><span className="detail-row__value">{customer.notes || '—'}</span></div>
          <div className="detail-row"><span className="detail-row__label">Created</span><span className="detail-row__value">{new Date(customer.created_at).toLocaleDateString()}</span></div>
        </div>

        {/* Subscription */}
        {sub && (
          <div className="detail-section">
            <div className="detail-section__title">📋 Subscription</div>
            <div className="detail-row"><span className="detail-row__label">Key</span><span className="detail-row__value" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{sub.subscription_key}</span></div>
            <div className="detail-row"><span className="detail-row__label">Plan</span><span className="detail-row__value"><span className={`badge badge--${sub.plan}`}>{sub.plan}</span></span></div>
            <div className="detail-row"><span className="detail-row__label">Status</span><span className="detail-row__value"><span className={`badge badge--${sub.status}`}>{sub.status}</span></span></div>
            <div className="detail-row"><span className="detail-row__label">Trial</span><span className="detail-row__value">{sub.trial_start ? `${new Date(sub.trial_start).toLocaleDateString()} → ${new Date(sub.trial_end).toLocaleDateString()}` : '—'}</span></div>
            <div className="detail-row"><span className="detail-row__label">Billing</span><span className="detail-row__value">{sub.billing_start ? `${new Date(sub.billing_start).toLocaleDateString()} → ${sub.billing_end ? new Date(sub.billing_end).toLocaleDateString() : 'Ongoing'}` : '—'}</span></div>
          </div>
        )}

        {/* Usage */}
        <div className="detail-section">
          <div className="detail-section__title">📈 Usage (Current Cycle)</div>
          {usage ? (
            <>
              <div className="detail-row"><span className="detail-row__label">Cycle</span><span className="detail-row__value">{new Date(usage.cycle_start).toLocaleDateString()} → {new Date(usage.cycle_end).toLocaleDateString()}</span></div>
              <div className="detail-row"><span className="detail-row__label">Orders Used</span><span className="detail-row__value" style={{ fontWeight: 800 }}>{usage.orders_used}</span></div>
              <div className="detail-row"><span className="detail-row__label">Extra Orders</span><span className="detail-row__value">{usage.extra_orders || 0}</span></div>
            </>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No usage data</p>}
        </div>

        {/* Device */}
        {sub && (
          <div className="detail-section">
            <div className="detail-section__title">💻 Device</div>
            <div className="detail-row"><span className="detail-row__label">Device ID</span><span className="detail-row__value" style={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all' }}>{sub.device_id || 'Not bound'}</span></div>
            <div className="detail-row"><span className="detail-row__label">Bound At</span><span className="detail-row__value">{sub.device_bound_at ? new Date(sub.device_bound_at).toLocaleString() : '—'}</span></div>
            <div className="detail-row"><span className="detail-row__label">Last Validation</span><span className="detail-row__value">{sub.last_validation_at ? new Date(sub.last_validation_at).toLocaleString() : '—'}</span></div>
            <div className="detail-row"><span className="detail-row__label">Reset Count</span><span className="detail-row__value">{sub.device_reset_count || 0}</span></div>
          </div>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>💳 Payment History</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight: 600 }}>LKR {Number(p.total_due).toLocaleString()}</td>
                    <td><span className={`badge badge--${p.payment_status}`}>{p.payment_status}</span></td>
                    <td>{p.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      {actions.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>📋 Admin Actions</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Action</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                {actions.map(a => (
                  <tr key={a.id}>
                    <td><span className="badge badge--active">{a.action_type}</span></td>
                    <td>{a.action_note || '—'}</td>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {activeAction === 'edit_profile' && (
        <ActionModal title="✏️ Edit Profile" onClose={() => setActiveAction(null)}>
          <form className="action-form" onSubmit={handleEditProfile}>
            <label>Full Name</label>
            <input className="form-input" value={editForm.full_name}
              onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} required />
            <label>Email</label>
            <input className="form-input" type="email" value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <label>Phone / WhatsApp</label>
            <input className="form-input" value={editForm.phone}
              onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="07XXXXXXXX" />
            <label>Notes</label>
            <textarea className="form-input" rows={3} value={editForm.notes}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any notes about this customer..." />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Save</button>
            </div>
          </form>
        </ActionModal>
      )}

      {/* Action Modals */}
      {activeAction === 'change_plan' && (
        <ActionModal title="🔄 Change Plan" onClose={() => setActiveAction(null)}>
          <form className="action-form" onSubmit={(e) => { e.preventDefault(); doAction('change_plan', { plan: e.target.plan.value }); }}>
            <label>Select New Plan</label>
            <select name="plan" className="form-select" defaultValue="starter">
              <option value="starter">🔵 Starter — LKR 1,250/mo</option>
              <option value="pro">🟣 Pro — LKR 1,950/mo</option>
              <option value="enterprise">🟠 Enterprise — LKR 3,450/mo</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Apply</button>
            </div>
          </form>
        </ActionModal>
      )}

      {activeAction === 'extend_trial' && (
        <ActionModal title="⏳ Extend Trial" onClose={() => setActiveAction(null)}>
          <form className="action-form" onSubmit={(e) => { e.preventDefault(); doAction('extend_trial', { trial_end: new Date(e.target.trial_end.value).toISOString() }); }}>
            <label>New Trial End Date</label>
            <input name="trial_end" type="date" className="form-input" required
              defaultValue={sub?.trial_end ? new Date(sub.trial_end).toISOString().split('T')[0] : ''} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Extend</button>
            </div>
          </form>
        </ActionModal>
      )}

      {activeAction === 'extend_billing' && (
        <ActionModal title="📅 Extend Billing" onClose={() => setActiveAction(null)}>
          <form className="action-form" onSubmit={(e) => { e.preventDefault(); doAction('extend_billing', { billing_end: new Date(e.target.billing_end.value).toISOString() }); }}>
            <label>New Billing End Date</label>
            <input name="billing_end" type="date" className="form-input" required
              defaultValue={sub?.billing_end ? new Date(sub.billing_end).toISOString().split('T')[0] : ''} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Extend</button>
            </div>
          </form>
        </ActionModal>
      )}

      {activeAction === 'suspend' && (
        <ActionModal title="⛔ Suspend Subscription" onClose={() => setActiveAction(null)}>
          <div className="action-form">
            <p style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ Are you sure?</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>The customer will lose access immediately.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={() => doAction('suspend')}>Confirm Suspend</button>
            </div>
          </div>
        </ActionModal>
      )}

      {activeAction === 'reset_device' && (
        <ActionModal title="💻 Reset Device" onClose={() => setActiveAction(null)}>
          <div className="action-form">
            <p>Reset device binding for this subscription?</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Resets used: {sub?.device_reset_count || 0}/2 this month
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={() => doAction('reset_device')}>Reset</button>
            </div>
          </div>
        </ActionModal>
      )}

      {activeAction === 'mark_payment' && (
        <ActionModal title="💰 Mark Payment" onClose={() => setActiveAction(null)}>
          <form className="action-form" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            doAction('mark_payment', {
              amount: parseFloat(fd.get('amount')),
              note: fd.get('note'),
              payment_date: fd.get('payment_date') ? new Date(fd.get('payment_date')).toISOString() : undefined,
            });
          }}>
            <label>Amount (LKR) *</label>
            <input name="amount" type="number" className="form-input" required placeholder="1450" />
            <label>Payment Date</label>
            <input name="payment_date" type="date" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} />
            <label>Note</label>
            <input name="note" className="form-input" placeholder="Bank transfer, cash, etc." />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>Cancel</button>
              <button type="submit" className="btn btn--success">Record Payment</button>
            </div>
          </form>
        </ActionModal>
      )}

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
