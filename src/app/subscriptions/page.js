'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAction, setShowAction] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [toast, setToast] = useState(null);
  const [cpPlan, setCpPlan] = useState('starter');
  const [cpTerm, setCpTerm] = useState('monthly');

  const fetchSubs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    if (filterPlan) params.set('plan', filterPlan);
    fetch(`/api/subscriptions?${params}`)
      .then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchSubs(); }, [filterStatus, filterPlan]);

  const handleSearch = (e) => { e.preventDefault(); fetchSubs(); };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Created: ${data.subscription_key}`);
      setShowCreate(false);
      fetchSubs();
    } catch (err) { showToast(err.message, 'error'); }
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
      showToast(result.note || 'Action completed');
      setShowAction(null);
      setActiveAction(null);
      fetchSubs();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const statusFilters = ['', 'trial', 'active', 'expired', 'suspended'];
  const planFilters = ['', 'trial', 'starter', 'pro', 'enterprise', 'lifetime'];

  const termLabels = { monthly: 'Monthly', yearly: 'Yearly', two_year: '2 Years', lifetime: 'Lifetime' };
  const getPlanLabel = (s) => {
    if (!s) return '—';
    const plan = s.plan || '';
    const term = s.billing_term || 'monthly';
    if (plan === 'lifetime') return '♾️ Lifetime';
    if (plan === 'trial') return '⏳ Trial';
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    return `${planName} (${termLabels[term] || term})`;
  };

  return (
    <>
      <div className="page-header">
        <h2>👥 Subscriptions</h2>
        <p>Manage all customer subscriptions</p>
      </div>

      <div className="actions-bar">
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          ➕ New Subscription
        </button>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <form className="table-toolbar__search" onSubmit={handleSearch}>
            <span className="search-icon">🔍</span>
            <input placeholder="Search name, email, phone, key..." value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </form>
          {statusFilters.map(s => (
            <button key={`s-${s}`}
              className={`filter-btn ${filterStatus === s ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterStatus(s)}>
              {s || 'All Status'}
            </button>
          ))}
          {planFilters.map(p => (
            <button key={`p-${p}`}
              className={`filter-btn ${filterPlan === p ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterPlan(p)}>
              {p || 'All Plans'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No subscriptions found</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th><th>Email</th><th>Key</th>
                <th>Plan</th><th>Status</th><th>Billing End</th>
                <th>Device</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} onClick={() => router.push(`/customers/${s.customer_id}`)}>
                  <td style={{ fontWeight: 600 }}>{s.customers?.full_name || '—'}</td>
                  <td>{s.customers?.email || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.subscription_key}</td>
                  <td><span className={`badge badge--${s.plan}`}>{getPlanLabel(s)}</span></td>
                  <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                  <td>{s.plan === 'lifetime' ? '♾️ Never' : (s.billing_end ? new Date(s.billing_end).toLocaleDateString() : '—')}</td>
                  <td>{s.device_id ? '✅' : '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn--secondary btn--sm"
                      onClick={() => { setShowAction(s); setActiveAction(null); setCpPlan(s.plan || 'starter'); setCpTerm(s.billing_term || 'monthly'); }}>⚙️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <ActionModal title="➕ New Subscription" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Name *</label>
                <input name="full_name" className="form-input" required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" className="form-input" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input name="phone" className="form-input" />
              </div>
              <div className="form-group">
                <label>Plan</label>
                <select name="plan" className="form-select">
                  <option value="trial">Trial (4 days free)</option>
                  <option value="starter">Starter — LKR 1,250/mo (250 orders)</option>
                  <option value="pro">Pro — LKR 1,950/mo (600 orders)</option>
                  <option value="enterprise">Enterprise — LKR 3,450/mo (3,000+ orders)</option>
                  <option value="lifetime">♾️ Lifetime — LKR 24,500 (admin only)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Billing Term</label>
                <select name="billing_term" className="form-select">
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly (2 months free)</option>
                  <option value="two_year">2 Years (4 months free)</option>
                  <option value="lifetime">Lifetime (one-time)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Billing Start</label>
                <input name="billing_start" type="date" className="form-input" />
              </div>
            </div>
            <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: '1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary">Create</button>
            </div>
          </form>
        </ActionModal>
      )}

      {/* Quick Actions Modal — with inline forms */}
      {showAction && (
        <ActionModal title={`⚙️ ${showAction.customers?.full_name}`} onClose={() => { setShowAction(null); setActiveAction(null); }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Key: <code style={{ color: 'var(--accent)' }}>{showAction.subscription_key}</code> · Plan: <span className={`badge badge--${showAction.plan}`}>{getPlanLabel(showAction)}</span> · Status: <span className={`badge badge--${showAction.status}`}>{showAction.status}</span>
          </p>

          {/* Action buttons */}
          {!activeAction && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <button className="btn btn--primary" onClick={() => setActiveAction('change_plan')}>🔄 Change Plan</button>
              <button className="btn btn--secondary" onClick={() => setActiveAction('extend_trial')}>⏳ Extend Trial</button>
              <button className="btn btn--secondary" onClick={() => setActiveAction('extend_billing')}>📅 Extend Billing</button>
              {showAction.status !== 'suspended' ? (
                <button className="btn btn--danger" onClick={() => setActiveAction('suspend')}>⛔ Suspend</button>
              ) : (
                <button className="btn btn--success" onClick={() => doAction('reactivate', showAction.id)}>✅ Reactivate</button>
              )}
              <button className="btn btn--secondary" onClick={() => setActiveAction('reset_device')}>💻 Reset Device</button>
              <button className="btn btn--success" onClick={() => setActiveAction('mark_payment')}>💰 Mark Payment</button>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />
              <button className="btn btn--danger" onClick={() => {
                if (window.confirm(`Delete "${showAction.customers?.full_name}" signup permanently?\n\nThis will remove the subscription, usage data, and customer record (if no other subscriptions).`)) {
                  doAction('delete_subscription', showAction.id, { confirm: true, reason: 'Unwanted trial signup' });
                }
              }}>🗑️ Delete Signup</button>
            </div>
          )}

          {/* Change Plan Form */}
          {activeAction === 'change_plan' && (
            <form className="action-form" onSubmit={(e) => {
              e.preventDefault();
              doAction('change_plan', showAction.id, { plan: cpPlan, billing_term: cpPlan === 'lifetime' ? 'lifetime' : cpTerm });
            }}>
              <label>Select New Plan</label>
              <select className="form-select" value={cpPlan}
                onChange={(e) => { setCpPlan(e.target.value); if (e.target.value === 'lifetime') setCpTerm('lifetime'); }}>
                <option value="starter">🔵 Starter — LKR 1,250/mo (250 orders)</option>
                <option value="pro">🟣 Pro — LKR 1,950/mo (600 orders)</option>
                <option value="enterprise">🟠 Enterprise — LKR 3,450/mo (3,000+ orders)</option>
                <option value="lifetime">♾️ Lifetime — LKR 24,500 one-time (3,000 orders)</option>
              </select>
              <label style={{ marginTop: '0.5rem' }}>Billing Term</label>
              <select className="form-select" value={cpPlan === 'lifetime' ? 'lifetime' : cpTerm}
                disabled={cpPlan === 'lifetime'}
                onChange={(e) => setCpTerm(e.target.value)}>
                {cpPlan === 'lifetime' ? (
                  <option value="lifetime">Lifetime (one-time payment)</option>
                ) : (
                  <>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly (Save 2 months)</option>
                    <option value="two_year">2 Years (Save 4 months)</option>
                  </>
                )}
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>← Back</button>
                <button type="submit" className="btn btn--primary">Apply</button>
              </div>
            </form>
          )}

          {/* Extend Trial Form */}
          {activeAction === 'extend_trial' && (
            <form className="action-form" onSubmit={(e) => {
              e.preventDefault();
              const d = e.target.trial_end.value;
              doAction('extend_trial', showAction.id, { trial_end: new Date(d).toISOString() });
            }}>
              <label>New Trial End Date</label>
              <input name="trial_end" type="date" className="form-input" required
                defaultValue={showAction.trial_end ? new Date(showAction.trial_end).toISOString().split('T')[0] : ''} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>← Back</button>
                <button type="submit" className="btn btn--primary">Extend Trial</button>
              </div>
            </form>
          )}

          {/* Extend Billing Form */}
          {activeAction === 'extend_billing' && (
            <form className="action-form" onSubmit={(e) => {
              e.preventDefault();
              const d = e.target.billing_end.value;
              doAction('extend_billing', showAction.id, { billing_end: new Date(d).toISOString() });
            }}>
              <label>New Billing End Date</label>
              <input name="billing_end" type="date" className="form-input" required
                defaultValue={showAction.billing_end ? new Date(showAction.billing_end).toISOString().split('T')[0] : ''} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>← Back</button>
                <button type="submit" className="btn btn--primary">Extend Billing</button>
              </div>
            </form>
          )}

          {/* Suspend Confirm */}
          {activeAction === 'suspend' && (
            <div className="action-form">
              <p style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ Are you sure you want to suspend this subscription?</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>The customer will lose access immediately.</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button className="btn btn--secondary" onClick={() => setActiveAction(null)}>← Cancel</button>
                <button className="btn btn--danger" onClick={() => doAction('suspend', showAction.id)}>⛔ Confirm Suspend</button>
              </div>
            </div>
          )}

          {/* Reset Device Confirm */}
          {activeAction === 'reset_device' && (
            <div className="action-form">
              <p style={{ fontWeight: 600 }}>🔄 Reset device binding?</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                The customer will need to re-activate on their PC. Resets: {showAction.device_reset_count || 0}/2 this month.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button className="btn btn--secondary" onClick={() => setActiveAction(null)}>← Cancel</button>
                <button className="btn btn--primary" onClick={() => doAction('reset_device', showAction.id)}>Reset Device</button>
              </div>
            </div>
          )}

          {/* Mark Payment Form */}
          {activeAction === 'mark_payment' && (
            <form className="action-form" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              doAction('mark_payment', showAction.id, {
                amount: parseFloat(fd.get('amount')),
                note: fd.get('note'),
                payment_date: fd.get('payment_date') ? new Date(fd.get('payment_date')).toISOString() : undefined,
              });
            }}>
              <label>Payment Amount (LKR) *</label>
              <input name="amount" type="number" className="form-input" required placeholder="e.g. 1450" />
              <label>Payment Date</label>
              <input name="payment_date" type="date" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} />
              <label>Note</label>
              <input name="note" className="form-input" placeholder="e.g. Bank transfer" />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setActiveAction(null)}>← Back</button>
                <button type="submit" className="btn btn--success">💰 Record Payment</button>
              </div>
            </form>
          )}
        </ActionModal>
      )}

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
