'use client';
import { useState, useEffect } from 'react';

export default function UsagePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <div className="page-header">
        <h2>📈 Usage Monitoring</h2>
        <p>Current cycle usage across all active subscriptions</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No usage data</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
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
              {data.map(row => {
                const level = getUsageLevel(row.orders_used, row.order_limit, row.hard_stop);
                const pct = row.order_limit > 0 ? Math.round((row.orders_used / row.order_limit) * 100) : 0;
                return (
                  <tr key={row.id}>
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
