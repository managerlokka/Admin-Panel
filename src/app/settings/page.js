'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { setPlans(d.plans || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updatePlan = async (plan, field, value) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast(`${plan} ${field} updated`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>Plan configuration and admin management</p>
      </div>

      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>📊 Plan Configuration</h3>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Monthly Price (LKR)</th>
                <th>Order Limit</th>
                <th>Extra Order Price (LKR)</th>
                <th>Hard Stop</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.plan}>
                  <td><span className={`badge badge--${p.plan}`}>{p.plan}</span></td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      defaultValue={p.monthly_price}
                      style={{ width: '120px', padding: '0.35rem 0.5rem' }}
                      onBlur={(e) => updatePlan(p.plan, 'monthly_price', parseFloat(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      defaultValue={p.order_limit}
                      style={{ width: '100px', padding: '0.35rem 0.5rem' }}
                      onBlur={(e) => updatePlan(p.plan, 'order_limit', parseInt(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      defaultValue={p.extra_order_price}
                      style={{ width: '100px', padding: '0.35rem 0.5rem' }}
                      onBlur={(e) => updatePlan(p.plan, 'extra_order_price', parseFloat(e.target.value))}
                    />
                  </td>
                  <td>{p.hard_stop ? '✅ Yes' : '❌ No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>🔐 Admin Setup</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.6 }}>
          To add the first admin user, run this SQL in your Supabase SQL Editor:<br /><br />
          <code style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px', display: 'block', fontSize: '0.78rem', color: 'var(--accent)', lineHeight: 1.8 }}>
            INSERT INTO admin_users (email, password_hash, display_name, role)<br />
            VALUES ('your@email.com', '$2a$10$...bcrypt_hash...', 'Admin Name', 'super_admin');
          </code>
          <br />
          Generate a bcrypt hash at <a href="https://bcrypt-generator.com" target="_blank" rel="noopener">bcrypt-generator.com</a> (use 10 rounds).
        </p>
      </div>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
