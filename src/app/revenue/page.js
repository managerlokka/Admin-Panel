'use client';
import { useState, useEffect } from 'react';

function StatCard({ icon, value, label, variant = '' }) {
  return (
    <div className={`stat-card ${variant ? `stat-card--${variant}` : ''}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}

function formatLKR(n) { return 'LKR ' + Number(n || 0).toLocaleString(); }

export default function RevenuePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!data) return <div className="empty-state"><div className="empty-state__icon">⚠️</div><div className="empty-state__text">Failed to load</div></div>;

  const c = data.counts;
  const r = data.revenue;

  return (
    <>
      <div className="page-header">
        <h2>💰 Revenue Dashboard</h2>
        <p>Monthly recurring revenue and billing overview</p>
      </div>

      <div className="cards-grid">
        <StatCard icon="🔵" value={c.activeStarter} label="Active Starter" variant="blue" />
        <StatCard icon="🟣" value={c.activePro} label="Active Pro" variant="purple" />
        <StatCard icon="🟠" value={c.activeEnterprise} label="Active Enterprise" variant="orange" />
      </div>

      <div className="cards-grid">
        <StatCard icon="💙" value={formatLKR(r.starterRevenue)} label="Starter Revenue" variant="blue" />
        <StatCard icon="💜" value={formatLKR(r.proRevenue)} label="Pro Revenue" variant="purple" />
        <StatCard icon="🧡" value={formatLKR(r.enterpriseBaseRevenue)} label="Enterprise Base" variant="orange" />
        <StatCard icon="📊" value={formatLKR(r.enterpriseExtraRevenue)} label="Enterprise Extras" variant="cyan" />
      </div>

      <div className="cards-grid">
        <StatCard icon="💎" value={formatLKR(r.totalMRR)} label="Total Projected MRR" variant="green" />
        <StatCard icon="📋" value={formatLKR(r.starterRevenue + r.proRevenue + r.enterpriseBaseRevenue)} label="Base MRR (excl. extras)" variant="accent" />
      </div>

      {/* Plan Pricing Reference */}
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>💵 Plan Pricing</h3>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Plan</th><th>Monthly Price</th><th>Order Limit</th><th>Extra Rate</th><th>Hard Stop</th></tr></thead>
            <tbody>
              <tr><td><span className="badge badge--starter">Starter</span></td><td>LKR 1,250</td><td>250</td><td>—</td><td>Yes</td></tr>
              <tr><td><span className="badge badge--pro">Pro</span></td><td>LKR 1,950</td><td>600</td><td>—</td><td>Yes</td></tr>
              <tr><td><span className="badge badge--enterprise">Enterprise</span></td><td>LKR 3,450</td><td>3,000</td><td>LKR 5/order</td><td>No (soft)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
