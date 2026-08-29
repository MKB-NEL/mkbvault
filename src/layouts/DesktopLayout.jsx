// ============================================================
// FILE: src/layouts/DesktopLayout.jsx
// ============================================================
import React from 'react';
import CredentialsWidget from '../widgets/CredentialsWidget';
import BookmarksWidget from '../widgets/BookmarksWidget';
import NotesWidget from '../widgets/NotesWidget';
import ProjectsWidget from '../widgets/ProjectsWidget';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';

const DesktopLayout = ({ items }) => {
  const toast = useToast();

  const navigateTo = (page, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    window.location.href = qs ? `${page}?${qs}` : page;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vault_authenticated');
    sessionStorage.removeItem('vault_login_time');
    window.location.href = 'index.html';
  };

  return (
    <div id="vaultContent" className="visible">
      {/* Hero */}
      <section className="hero" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=300&fit=crop&crop=center')" }}>
        <div className="hero-content">
          <h1>Welcome back, Bertrand</h1>
          <p>Your digital vault — secure, organized, always accessible.</p>
        </div>
      </section>

      {/* Header */}
      <header className="vault-header">
        <div className="brand">
          <div className="logo-icon"><Icon icon="mdi:lock-open" /></div>
          <h1>Vault <span className="mono">· MK Bertrand</span></h1>
        </div>
        <div className="actions">
          <button className="btn btn-danger" onClick={handleLogout}>
            <Icon icon="mdi:logout" /> Logout
          </button>
        </div>
      </header>

      {/* Dashboard Layout */}
      <div className="dashboard-layout">
        <aside className="sidebar">
          <CredentialsWidget items={items} onNavigate={navigateTo} />
        </aside>
        <div className="main-area">
          <BookmarksWidget items={items} />
          <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
            <NotesWidget items={items} onNavigate={navigateTo} />
            <ProjectsWidget items={items} onNavigate={navigateTo} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ marginTop: '2rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 300 }}>
        <span>&copy; {new Date().getFullYear()} · PIReactive · MK Bertrand</span>
        <span>Encrypted · Secure · Private</span>
      </footer>
    </div>
  );
};

export default DesktopLayout;
