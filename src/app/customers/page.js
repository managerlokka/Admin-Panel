'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomersPage() {
  const router = useRouter();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchCustomers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterPlan) params.set('plan', filterPlan);
    if (filterStatus) params.set('status', filterStatus);
    fetch(`/api/subscriptions?${params}`)
      .then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, [filterPlan, filterStatus]);

  const planFilters = ['', 'trial', 'starter', 'pro', 'enterprise'];
  const statusFilters = ['', 'trial', 'active', 'expired', 'suspended'];

  return (
    <>
      <div className="page-header">
        <h2>🧑‍💼 Customers</h2>
        <p>Browse and search all customers</p>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <form className="table-toolbar__search" onSubmit={(e) => { e.preventDefault(); fetchCustomers(); }}>
            <span className="search-icon">🔍</span>
            <input placeholder="Search name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          {planFilters.map(p => (
            <button key={`p-${p}`}
              className={`filter-btn ${filterPlan === p ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterPlan(p)}>
              {p || 'All Plans'}
            </button>
          ))}
          {statusFilters.map(s => (
            <button key={`s-${s}`}
              className={`filter-btn ${filterStatus === s ? 'filter-btn--active' : ''}`}
              onClick={() => setFilterStatus(s)}>
              {s || 'All Status'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : subs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No customers found</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th>
                <th>Plan</th><th>Status</th><th>Billing End</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} onClick={() => router.push(`/customers/${s.customer_id}`)}>
                  <td style={{ fontWeight: 600 }}>{s.customers?.full_name || '—'}</td>
                  <td>{s.customers?.email || '—'}</td>
                  <td>{s.customers?.phone || '—'}</td>
                  <td><span className={`badge badge--${s.plan}`}>{s.plan}</span></td>
                  <td><span className={`badge badge--${s.status}`}>{s.status}</span></td>
                  <td>{s.billing_end ? new Date(s.billing_end).toLocaleDateString() : '—'}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
