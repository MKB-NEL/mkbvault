// ============================================================
// FILE: src/layouts/MobileLayout.jsx
// ============================================================
import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import MobileCredentials from '../mobile/MobileCredentials';
import MobileBookmarks from '../mobile/MobileBookmarks';
import MobileNotes from '../mobile/MobileNotes';
import MobileProjects from '../mobile/MobileProjects';

const MobileLayout = ({ items }) => {
  const [activeTab, setActiveTab] = useState('credentials');
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

  const tabs = [
    { id: 'credentials', icon: 'mdi:key', label: 'Credentials' },
    { id: 'bookmarks', icon: 'mdi:bookmark', label: 'Bookmarks' },
    { id: 'notes', icon: 'mdi:note-text', label: 'Notes' },
    { id: 'projects', icon: 'mdi:folder-open', label: 'Projects' },
  ];

  return (
    <div className="mobile-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="brand">
          <div className="logo-icon"><Icon icon="mdi:lock-open" /></div>
          <h1>Vault</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <Icon icon="mdi:logout" />
        </button>
      </header>

      {/* Content */}
      <div className="mobile-content">
        {activeTab === 'credentials' && <MobileCredentials items={items} onNavigate={navigateTo} />}
        {activeTab === 'bookmarks' && <MobileBookmarks items={items} />}
        {activeTab === 'notes' && <MobileNotes items={items} onNavigate={navigateTo} />}
        {activeTab === 'projects' && <MobileProjects items={items} onNavigate={navigateTo} />}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {tabs.map(tab => (
          <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <Icon icon={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default MobileLayout;
