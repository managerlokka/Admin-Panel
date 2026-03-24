'use client';
import { useState, useEffect } from 'react';

export default function TrialsPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchTrials = () => {
    setLoading(true);
    fetch('/api/subscriptions?plan=trial')
      .then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchTrials(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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
      showToast(result.note || 'Done');
      fetchTrials();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getDaysRemaining = (trialEnd) => {
    if (!trialEnd) return 0;
    const ms = new Date(trialEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  const getHoursRemaining = (trialEnd) => {
    if (!trialEnd) return 0;
    const ms = new Date(trialEnd).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60)));
  };

  return (
    <>
      <div className="page-header">
        <h2>⏳ Trial Management</h2>
        <p>Monitor and manage trial users</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No trial users</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Trial Start</th>
                <th>Trial End</th>
                <th>Time Left</th>
                <th>Device</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => {
                const days = getDaysRemaining(s.trial_end);
                const hours = getHoursRemaining(s.trial_end);
                const isExpired = hours <= 0;
                const isLow = hours <= 12 && !isExpired;

                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.customers?.full_name || '—'}</td>
                    <td>{s.customers?.email || '—'}</td>
                    <td>{s.customers?.phone || '—'}</td>
                    <td>{s.trial_start ? new Date(s.trial_start).toLocaleDateString() : '—'}</td>
                    <td>{s.trial_end ? new Date(s.trial_end).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`badge ${isExpired ? 'badge--danger' : isLow ? 'badge--warning' : 'badge--normal'}`}>
                        {isExpired ? 'Expired' : `${hours}h (${days}d)`}
                      </span>
                    </td>
                    <td>{s.device_id ? '✅' : '❌'}</td>
                    <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <button className="btn btn--secondary btn--sm" onClick={() => {
                          const d = prompt('Extend trial to (YYYY-MM-DD):');
                          if (d) doAction('extend_trial', s.id, { trial_end: new Date(d).toISOString() });
                        }}>⏳</button>
                        <button className="btn btn--sm" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)' }} onClick={() => {
                          doAction('change_plan', s.id, { plan: 'starter' });
                        }}>→ STR</button>
                        <button className="btn btn--sm" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid rgba(168,85,247,0.2)' }} onClick={() => {
                          doAction('change_plan', s.id, { plan: 'pro' });
                        }}>→ PRO</button>
                        <button className="btn btn--sm" style={{ background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid rgba(249,115,22,0.2)' }} onClick={() => {
                          doAction('change_plan', s.id, { plan: 'enterprise' });
                        }}>→ ENT</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
