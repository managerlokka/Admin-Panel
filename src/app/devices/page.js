'use client';
import { useState, useEffect } from 'react';

export default function DevicesPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchDevices = () => {
    setLoading(true);
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => {
        const all = Array.isArray(d) ? d : [];
        // Show only bound devices or all
        setSubs(all.filter(s => s.device_id));
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

  return (
    <>
      <div className="page-header">
        <h2>💻 Device Bindings</h2>
        <p>Manage bound PC devices for subscriptions</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💻</div>
            <div className="empty-state__text">No devices bound yet</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
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
              {subs.map(s => (
                <tr key={s.id}>
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
