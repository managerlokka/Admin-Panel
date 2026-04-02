'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { section: 'Overview' },
  { href: '/', label: 'Dashboard', icon: '📊' },
  { section: 'Management' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '👥' },
  { href: '/trials', label: 'Trials', icon: '⏳' },
  { href: '/customers', label: 'Customers', icon: '🧑‍💼' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { section: 'Monitoring' },
  { href: '/usage', label: 'Usage', icon: '📈' },
  { href: '/revenue', label: 'Revenue', icon: '💰' },
  { href: '/devices', label: 'Devices', icon: '💻' },
  { section: 'System' },
  { href: '/logs', label: 'Action Logs', icon: '📋' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ adminName, adminEmail }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState('dark');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('admin-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile hamburger button - always visible on mobile */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <span className="mobile-menu-btn__bar"></span>
        <span className="mobile-menu-btn__bar"></span>
        <span className="mobile-menu-btn__bar"></span>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        {/* Mobile close button inside sidebar */}
        <button
          className="sidebar__close-btn"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        >
          ✕
        </button>

        <div className="sidebar__brand">
          <h1>Manager Lokka</h1>
          <small>Subscription Admin</small>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="sidebar__section-label">
                  {item.section}
                </div>
              );
            }

            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <button
            onClick={toggleTheme}
            className="btn btn--secondary btn--sm theme-toggle-btn"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '0.5rem' }}
          >
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {(adminName || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                {adminName || 'Admin'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {adminEmail || ''}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn--secondary btn--sm"
            style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
}
