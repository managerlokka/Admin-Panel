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

function formatLKR(amount) {
  return 'LKR ' + Number(amount || 0).toLocaleString();
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!data || data.error) return (
    <div className="empty-state">
      <div className="empty-state__icon">⚠️</div>
      <div className="empty-state__text">Failed to load. {data?.error || 'Check Supabase.'}</div>
    </div>
  );

  const c = data.counts;
  const r = data.revenue;
  const cv = data.conversion;

  return (
    <>
      <div className="page-header">
        <h2>📊 Dashboard</h2>
        <p>Subscription system overview</p>
      </div>

      {/* User Stats */}
      <div className="cards-grid">
        <StatCard icon="👥" value={c.total} label="Total Users" variant="accent" />
        <StatCard icon="⏳" value={c.trialActive} label="Active Trials" variant="yellow" />
        <StatCard icon="🔵" value={c.activeStarter} label="Starter" variant="blue" />
        <StatCard icon="⭐" value={c.activePro} label="Pro" variant="purple" />
        <StatCard icon="🏢" value={c.activeEnterprise} label="Enterprise" variant="orange" />
        <StatCard icon="♾️" value={c.activeLifetime || 0} label="Lifetime" variant="cyan" />
        <StatCard icon="❌" value={c.expired} label="Expired" variant="red" />
        <StatCard icon="⛔" value={c.suspended} label="Suspended" variant="red" />
        <StatCard icon="⚠️" value={c.expiringSoon} label="Expiring Soon" variant="yellow" />
      </div>

      {/* Revenue */}
      <h3 style={{ fontSize: '0.9rem', margin: '0.5rem 0 0.4rem' }}>💰 Revenue</h3>
      <div className="cards-grid">
        <StatCard icon="💙" value={formatLKR(r.starterRevenue)} label="Starter" variant="blue" />
        <StatCard icon="💜" value={formatLKR(r.proRevenue)} label="Pro" variant="purple" />
        <StatCard icon="🧡" value={formatLKR(r.enterpriseBaseRevenue)} label="Enterprise" variant="orange" />
        <StatCard icon="📊" value={formatLKR(r.enterpriseExtraRevenue)} label="Extras" variant="cyan" />
        <StatCard icon="♾️" value={formatLKR(r.lifetimeRevenue || 0)} label="Lifetime" variant="yellow" />
        <StatCard icon="💎" value={formatLKR(r.totalRevenue)} label="Total Revenue" variant="green" />
      </div>

      {/* Conversion */}
      <h3 style={{ fontSize: '0.9rem', margin: '0.5rem 0 0.4rem' }}>🎯 Conversion</h3>
      <div className="cards-grid">
        <StatCard icon="🎯" value={`${cv.conversionRate}%`} label="Trial→Paid" variant="accent" />
        <StatCard icon="📝" value={cv.trialSignups} label="Trial Signups" variant="yellow" />
        <StatCard icon="✅" value={cv.paidConversions} label="Conversions" variant="green" />
        <StatCard icon="🔔" value={c.nearLimit} label="Near Limit" variant="red" />
      </div>

      {/* Recent Actions */}
      {data.recentActions?.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>📋 Recent Actions</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>Action</th><th>Note</th><th>Date</th></tr>
              </thead>
              <tbody>
                {data.recentActions.map(a => (
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
    </>
  );
}
