'use client';
import { useState, useEffect } from 'react';

export default function UsagePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState('');

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getUsageLevel = (used, limit, hardStop) => {
    if (limit <= 0) return 'normal';
    const pct = (used / limit) * 100;
    if (pct >= 100) return hardStop ? 'danger' : 'warning';
    if (pct >= 80) return 'warning';
    return 'normal';
  };

  // Plan categories with counts
  const planCategories = ['', 'trial', 'starter', 'pro', 'enterprise', 'lifetime'];
  const planLabels = { '': 'All', trial: 'Trial', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', lifetime: 'Lifetime' };
  const planCounts = {};
  planCategories.forEach(p => {
    planCounts[p] = p === '' ? data.length : data.filter(d => d.plan === p).length;
  });

  const filtered = filterPlan ? data.filter(d => d.plan === filterPlan) : data;

  return (
    <>
      <div className="page-header">
        <h2>📈 Usage Monitoring</h2>
        <p>Current cycle usage across all active subscriptions</p>
      </div>

      {/* Category Filter Tabs */}
      <div className="table-container">
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
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">{filterPlan ? `No ${planLabels[filterPlan]} usage data` : 'No usage data'}</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Plan</th>
                <th>Cycle Start</th>
                <th>Cycle End</th>
                <th>Orders Used</th>
                <th>Limit</th>
                <th>Extra</th>
                <th>Est. Extra Charge</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const level = getUsageLevel(row.orders_used, row.order_limit, row.hard_stop);
                const pct = row.order_limit > 0 ? Math.round((row.orders_used / row.order_limit) * 100) : 0;
                return (
                  <tr key={row.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.customer_name || '—'}</td>
                    <td><span className={`badge badge--${row.plan}`}>{row.plan}</span></td>
                    <td>{new Date(row.cycle_start).toLocaleDateString()}</td>
                    <td>{new Date(row.cycle_end).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700 }}>{row.orders_used}</td>
                    <td>{row.order_limit}</td>
                    <td>{row.extra_orders || 0}</td>
                    <td>{row.extra_charge > 0 ? `LKR ${row.extra_charge.toLocaleString()}` : '—'}</td>
                    <td>
                      <span className={`badge badge--${level}`}>
                        {pct}% {level === 'danger' ? '🔴' : level === 'warning' ? '🟡' : '🟢'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
