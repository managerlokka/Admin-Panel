'use client';
import { useState, useEffect } from 'react';

export default function DevicesPage() {
  const [allSubs, setAllSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filterPlan, setFilterPlan] = useState('');

  const fetchDevices = () => {
    setLoading(true);
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => {
        const all = Array.isArray(d) ? d : [];
        // Show only bound devices
        setAllSubs(all.filter(s => s.device_id));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchDevices(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetDevice = async (subId) => {
    if (!confirm('Reset device binding? The customer will need to activate on their PC again.')) return;
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_device', subscription_id: subId, data: {} }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(result.note || 'Device reset');
      fetchDevices();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Plan categories with counts
  const planCategories = ['', 'trial', 'starter', 'pro', 'enterprise', 'lifetime'];
  const planLabels = { '': 'All', trial: 'Trial', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', lifetime: 'Lifetime' };
  const planCounts = {};
  planCategories.forEach(p => {
    planCounts[p] = p === '' ? allSubs.length : allSubs.filter(s => s.plan === p).length;
  });

  const filtered = filterPlan ? allSubs.filter(s => s.plan === filterPlan) : allSubs;

  return (
    <>
      <div className="page-header">
        <h2>💻 Device Bindings</h2>
        <p>Manage bound PC devices for subscriptions</p>
      </div>

      <div className="table-container">
        {/* Category Filter Tabs */}
        <div className="table-toolbar" style={{ gap: '0.4rem', flexWrap: 'wrap', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
          {planCategories.map(p => (
            <button
              key={p}
              className={`filter-btn ${filterPlan === p ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterPlan(p)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {planLabels[p]}
              {planCounts[p] > 0 && (
                <span style={{
                  background: filterPlan === p ? 'rgba(255,255,255,0.25)' : 'var(--surface-muted, rgba(0,0,0,0.1))',
                  borderRadius: '10px',
                  padding: '0 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {planCounts[p]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💻</div>
            <div className="empty-state__text">{filterPlan ? `No ${planLabels[filterPlan]} devices` : 'No devices bound yet'}</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Key</th>
                <th>Plan</th>
                <th>Device ID</th>
                <th>Bound Date</th>
                <th>Last Validation</th>
                <th>Resets</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{s.customers?.full_name || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.subscription_key}</td>
                  <td><span className={`badge badge--${s.plan}`}>{s.plan}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.device_id}</td>
                  <td>{s.device_bound_at ? new Date(s.device_bound_at).toLocaleDateString() : '—'}</td>
                  <td>{s.last_validation_at ? new Date(s.last_validation_at).toLocaleString() : '—'}</td>
                  <td>{s.device_reset_count || 0}</td>
                  <td>
                    <button className="btn btn--danger btn--sm" onClick={() => resetDevice(s.id)}>
                      🔄 Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
