// ============================================================
// FILE: src/widgets/NotesWidget.jsx
// ============================================================
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';

const NotesWidget = ({ items, onNavigate }) => {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const notes = useMemo(() => {
    let n = items.filter(i => i.type === 'note' && !i.trash);
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      n = n.filter(item =>
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.content && item.content.toLowerCase().includes(term))
      );
    }
    return n.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, searchTerm]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="widget" style={{ flex: 7 }}>
      <div className="widget-header">
        <div className="widget-title"><Icon icon="mdi:note-text" /> Notes</div>
        <div className="widget-controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelectedIds(new Set()); }} /> Select</label>
          <div className="search-box">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <span className="match-count">{searchTerm ? `(${notes.length} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={() => onNavigate('note.html', { action: 'add' })}>+Note</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="recent-label">Recent</span>
        {(items.filter(i => i.type === 'note' && !i.trash).slice(0, 3)).map(i => (
          <span key={i.id} className="recent-item" onClick={() => onNavigate('note.html', { id: i.id })}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-box" onClick={() => onNavigate('note.html', { id: note.id })}>
              {selectMode && (
                <input type="checkbox" checked={selectedIds.has(note.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(note.id); }}
                  style={{ position: 'absolute', top: '4px', left: '4px' }} />
              )}
              {note.title || 'Untitled'}
            </div>
          ))}
          {notes.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No notes yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default NotesWidget;
