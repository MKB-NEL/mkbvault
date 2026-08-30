 
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';

const MobileProjects = ({ items, onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const projects = useMemo(() => {
    let p = items.filter(i => i.type === 'project' && !i.trash);
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      p = p.filter(item => (item.title && item.title.toLowerCase().includes(term)) || (item.status && item.status.toLowerCase().includes(term)));
    }
    return p.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, searchTerm]);

  return (
    <div className="mobile-widget">
      <div className="mobile-search">
        <Icon icon="mdi:search" />
        <input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <div className="mobile-actions">
        <button className="btn-icon primary" onClick={() => onNavigate('project.html', { action: 'add' })}>
          <Icon icon="mdi:plus" /> Add
        </button>
      </div>
      <div className="mobile-list">
        {projects.map(proj => (
          <div key={proj.id} className="mobile-item" onClick={() => onNavigate('project.html', { id: proj.id })}>
            {proj.title || 'Untitled'}
          </div>
        ))}
        {projects.length === 0 && <div className="empty-state">No projects.</div>}
      </div>
    </div>
  );
};

export default MobileProjects;
