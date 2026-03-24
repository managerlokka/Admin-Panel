'use client';
import { useState, useEffect } from 'react';

const PLAN_OPTIONS = [
  { value: 'all', label: '📢 All Subscribers', color: '#6366f1' },
  { value: 'trial', label: '⏳ Trial Users', color: '#eab308' },
  { value: 'starter', label: '🔵 Starter', color: '#3b82f6' },
  { value: 'pro', label: '🟣 Pro', color: '#a855f7' },
  { value: 'enterprise', label: '🟠 Enterprise', color: '#f97316' },
];

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  // Compose form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedPlans, setSelectedPlans] = useState(['all']);
  const [priority, setPriority] = useState('normal');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMessages = () => {
    setLoading(true);
    fetch('/api/messages')
      .then(r => r.json())
      .then(data => { setMessages(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchMessages(); }, []);

  const togglePlan = (plan) => {
    if (plan === 'all') {
      setSelectedPlans(['all']);
      return;
    }
    let next = selectedPlans.filter(p => p !== 'all');
    if (next.includes(plan)) {
      next = next.filter(p => p !== plan);
    } else {
      next.push(plan);
    }
    if (next.length === 0) next = ['all'];
    setSelectedPlans(next);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast('Please enter a title and message', 'error');
      return;
    }
    if (!window.confirm(`Send this message to ${selectedPlans.includes('all') ? 'ALL subscribers' : selectedPlans.join(', ')}?`)) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, target_plans: selectedPlans, priority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`✅ Message sent to ${data.recipient_count} subscribers`);
      setTitle('');
      setMessage('');
      setSelectedPlans(['all']);
      setPriority('normal');
      fetchMessages();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setSending(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      const res = await fetch(`/api/messages?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Message deleted');
      fetchMessages();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const getPlanBadges = (plans) => {
    if (!plans || plans.length === 0) return <span className="badge badge--trial">all</span>;
    return plans.map(p => (
      <span key={p} className={`badge badge--${p === 'all' ? 'active' : p}`} style={{ marginRight: '0.25rem' }}>
        {p}
      </span>
    ));
  };

  return (
    <>
      <div className="page-header">
        <h2>💬 Messages</h2>
        <p>Send announcements to your subscribers</p>
      </div>

      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* Compose Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card__header">
          <h3>📝 Compose Message</h3>
        </div>
        <form onSubmit={handleSend} style={{ padding: '1.25rem' }}>
          {/* Target Audience */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', display: 'block' }}>
              🎯 Send To
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {PLAN_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => togglePlan(opt.value)}
                  className={`filter-btn ${selectedPlans.includes(opt.value) ? 'filter-btn--active' : ''}`}
                  style={selectedPlans.includes(opt.value) ? {
                    background: opt.color,
                    borderColor: opt.color,
                    color: '#fff',
                  } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>
              ⚡ Priority
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['normal', 'important', 'urgent'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`filter-btn ${priority === p ? 'filter-btn--active' : ''}`}
                  style={priority === p ? {
                    background: p === 'urgent' ? '#ef4444' : p === 'important' ? '#f59e0b' : '#6366f1',
                    borderColor: p === 'urgent' ? '#ef4444' : p === 'important' ? '#f59e0b' : '#6366f1',
                    color: '#fff',
                  } : {}}
                >
                  {p === 'urgent' ? '🔴' : p === 'important' ? '🟡' : '🔵'} {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Title & Message */}
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>Title</label>
            <input
              className="form-input"
              placeholder="e.g. System maintenance notice"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>Message</label>
            <textarea
              className="form-input"
              placeholder="Write your message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              required
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          <button type="submit" className="btn btn--primary" disabled={sending}
            style={{ minWidth: '160px' }}>
            {sending ? '⏳ Sending...' : '📤 Send Message'}
          </button>
        </form>
      </div>

      {/* Sent Messages History */}
      <div className="card">
        <div className="card__header">
          <h3>📬 Sent Messages</h3>
        </div>
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__text">No messages sent yet</div>
          </div>
        ) : (
          <div style={{ padding: '0 1rem 1rem' }}>
            {messages.map(m => (
              <div key={m.id} className="card" style={{
                marginBottom: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                border: m.priority === 'urgent' ? '1px solid rgba(239,68,68,0.3)' :
                         m.priority === 'important' ? '1px solid rgba(245,158,11,0.2)' :
                         '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>
                      {m.priority === 'urgent' ? '🔴 ' : m.priority === 'important' ? '🟡 ' : ''}
                      {m.title}
                    </strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {new Date(m.created_at).toLocaleString()} · {m.recipient_count} recipients · by {m.sent_by_name}
                    </div>
                  </div>
                  <button className="btn btn--danger btn--sm" onClick={() => handleDelete(m.id)}
                    style={{ flexShrink: 0, fontSize: '0.7rem' }}>🗑️</button>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>{getPlanBadges(m.target_plans)}</div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {m.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
