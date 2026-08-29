// ============================================================
// FILE: src/widgets/ProjectsWidget.jsx
// ============================================================
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';

const ProjectsWidget = ({ items, onNavigate }) => {
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
    <div className="widget" style={{ flex: 3 }}>
      <div className="widget-header">
        <div className="widget-title"><Icon icon="mdi:folder-open" /> Projects</div>
        <div className="widget-controls">
          <div className="search-box">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <span className="match-count">{searchTerm ? `(${projects.length} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={() => onNavigate('project.html', { action: 'add' })}>+Project</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="recent-label">Recent</span>
        {(items.filter(i => i.type === 'project' && !i.trash).slice(0, 3)).map(i => (
          <span key={i.id} className="recent-item" onClick={() => onNavigate('project.html', { id: i.id })}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="project-list">
          {projects.map(proj => (
            <div key={proj.id} className="project-item" onClick={() => onNavigate('project.html', { id: proj.id })}>
              {proj.title || 'Untitled'}
            </div>
          ))}
          {projects.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No projects yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default ProjectsWidget;
