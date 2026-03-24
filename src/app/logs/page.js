'use client';
import { useState, useEffect } from 'react';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>📋 Admin Action Logs</h2>
        <p>Audit trail of all admin actions</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__text">No actions logged yet</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Customer</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.admin_users?.display_name || l.admin_users?.email || '—'}</td>
                  <td><span className="badge badge--active">{l.action_type}</span></td>
                  <td>{l.customers?.full_name || '—'}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'normal', lineHeight: 1.4 }}>{l.action_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
