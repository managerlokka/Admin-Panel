'use client';
import { useState, useEffect } from 'react';

export default function UsagePage() {
  const [data, setData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsage = (month = '') => {
    setLoading(true);
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    fetch(`/api/usage?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.cycles) {
          setData(d.cycles);
          if (d.available_months?.length > 0 && !selectedMonth) {
            setAvailableMonths(d.available_months);
          } else if (d.available_months?.length > 0) {
            setAvailableMonths(d.available_months);
          }
        } else {
          // Backward compatibility
          setData(Array.isArray(d) ? d : []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Initial load: fetch all months to populate selector, then show current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
    fetchUsage(currentMonth);
  }, []);

  // Re-fetch when month changes
  useEffect(() => {
    if (selectedMonth) fetchUsage(selectedMonth);
  }, [selectedMonth]);

  const getUsageLevel = (used, limit, hardStop) => {
    if (limit <= 0) return 'normal';
    const pct = (used / limit) * 100;
    if (pct >= 100) return hardStop ? 'danger' : 'warning';
    if (pct >= 80) return 'warning';
    return 'normal';
  };

  // Month display name
  const getMonthLabel = (monthStr) => {
    if (!monthStr) return '—';
    const [y, m] = monthStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Plan categories with counts
  const planCategories = ['', 'trial', 'starter', 'pro', 'enterprise', 'lifetime'];
  const planLabels = { '': 'All', trial: 'Trial', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', lifetime: 'Lifetime' };
  const planCounts = {};
  planCategories.forEach(p => {
    planCounts[p] = p === '' ? data.length : data.filter(d => d.plan === p).length;
  });

  // Filter by plan and search
  let filtered = filterPlan ? data.filter(d => d.plan === filterPlan) : data;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(d =>
      d.customer_name?.toLowerCase().includes(term) ||
      d.customer_email?.toLowerCase().includes(term) ||
      d.subscription_key?.toLowerCase().includes(term)
    );
  }

  // Totals
  const totalOrders = filtered.reduce((sum, r) => sum + (r.orders_used || 0), 0);
  const totalExtra = filtered.reduce((sum, r) => sum + (r.extra_orders || 0), 0);
  const totalExtraCharge = filtered.reduce((sum, r) => sum + (r.extra_charge || 0), 0);

  // Navigate months
  const navigateMonth = (direction) => {
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  return (
    <>
      <div className="page-header">
        <h2>📈 Usage Monitoring</h2>
        <p>Track order usage across all subscriptions by month</p>
      </div>

      {/* Month Navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 1rem', marginBottom: '1rem',
        background: 'var(--card-bg, #fff)', borderRadius: '12px',
        border: '1px solid var(--border, #e5e7eb)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => navigateMonth(-1)}
          style={{ padding: '0.35rem 0.6rem', fontSize: '1rem' }}
        >←</button>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            flex: 1, maxWidth: '260px',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--border, #d1d5db)',
            background: 'var(--bg, #fff)',
            color: 'var(--text, #1a1a1a)',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {availableMonths.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
          {/* Always include current and surrounding months even if no data */}
          {!availableMonths.includes(selectedMonth) && (
            <option value={selectedMonth}>{getMonthLabel(selectedMonth)}</option>
          )}
        </select>

        <button
          className="btn btn--secondary btn--sm"
          onClick={() => navigateMonth(1)}
          style={{ padding: '0.35rem 0.6rem', fontSize: '1rem' }}
        >→</button>

        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          📊 <strong>{filtered.length}</strong> cycle{filtered.length !== 1 ? 's' : ''} · <strong>{totalOrders}</strong> total orders
          {totalExtraCharge > 0 && <> · 💰 LKR {totalExtraCharge.toLocaleString()} extra</>}
        </span>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {planCategories.filter(p => p !== '').map(p => {
          const count = planCounts[p] || 0;
          const orders = data.filter(d => d.plan === p).reduce((s, r) => s + (r.orders_used || 0), 0);
          if (count === 0) return null;
          const planColors = { trial: '#f59e0b', starter: '#3b82f6', pro: '#8b5cf6', enterprise: '#10b981', lifetime: '#f97316' };
          return (
            <div key={p} onClick={() => setFilterPlan(filterPlan === p ? '' : p)} style={{
              background: filterPlan === p ? `${planColors[p]}15` : 'var(--card-bg, #fff)',
              border: `1px solid ${filterPlan === p ? planColors[p] : 'var(--border, #e5e7eb)'}`,
              borderRadius: '10px', padding: '0.65rem 0.75rem', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{planLabels[p]}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: planColors[p] }}>{count}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{orders} orders</div>
            </div>
          );
        })}
      </div>

      <div className="table-container">
        {/* Search + Filter Toolbar */}
        <div className="table-toolbar" style={{ gap: '0.4rem', flexWrap: 'wrap', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1', minWidth: '200px' }}>
            <span>🔍</span>
            <input
              placeholder="Search customer name, email, key..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px',
                border: '1px solid var(--border, #d1d5db)',
                background: 'var(--bg, #fff)', color: 'var(--text, #1a1a1a)',
                fontSize: '0.82rem',
              }}
            />
          </div>
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
                  borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 700,
                  minWidth: '18px', textAlign: 'center',
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
            <div className="empty-state__text">{filterPlan ? `No ${planLabels[filterPlan]} usage data for ${getMonthLabel(selectedMonth)}` : `No usage data for ${getMonthLabel(selectedMonth)}`}</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Cycle Start</th>
                <th>Cycle End</th>
                <th>Orders Used</th>
                <th>Limit</th>
                <th>Usage</th>
                <th>Extra</th>
                <th>Est. Charge</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const level = getUsageLevel(row.orders_used, row.order_limit, row.hard_stop);
                const pct = row.order_limit > 0 ? Math.round((row.orders_used / row.order_limit) * 100) : 0;
                return (
                  <tr key={row.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.customer_name || '—'}</div>
                      {row.customer_email && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.customer_email}</div>}
                    </td>
                    <td><span className={`badge badge--${row.plan}`}>{row.plan}</span></td>
                    <td><span className={`badge badge--${row.status}`}>{row.status}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(row.cycle_start).toLocaleDateString()}</td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(row.cycle_end).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700, fontSize: '1rem' }}>{row.orders_used}</td>
                    <td>{row.order_limit}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{
                          width: '50px', height: '6px', borderRadius: '3px',
                          background: 'var(--border, rgba(0,0,0,0.08))', overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: '3px',
                            background: level === 'danger' ? '#ef4444' : level === 'warning' ? '#f59e0b' : '#22c55e',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700,
                          color: level === 'danger' ? '#ef4444' : level === 'warning' ? '#f59e0b' : '#22c55e',
                        }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td>{row.extra_orders || 0}</td>
                    <td>{row.extra_charge > 0 ? `LKR ${row.extra_charge.toLocaleString()}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td></td>
                <td>Totals</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td style={{ fontSize: '1rem' }}>{totalOrders}</td>
                <td></td>
                <td></td>
                <td>{totalExtra}</td>
                <td>{totalExtraCharge > 0 ? `LKR ${totalExtraCharge.toLocaleString()}` : '—'}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
