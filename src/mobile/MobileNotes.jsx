 
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';

const MobileNotes = ({ items, onNavigate }) => {
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

  return (
    <div className="mobile-widget">
      <div className="mobile-search">
        <Icon icon="mdi:search" />
        <input type="text" placeholder="Search notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <div className="mobile-actions">
        <button className="btn-icon primary" onClick={() => onNavigate('note.html', { action: 'add' })}>
          <Icon icon="mdi:plus" /> Add
        </button>
      </div>
      <div className="mobile-grid-notes">
        {notes.map(note => (
          <div key={note.id} className="mobile-note" onClick={() => onNavigate('note.html', { id: note.id })}>
            {note.title || 'Untitled'}
          </div>
        ))}
        {notes.length === 0 && <div className="empty-state">No notes.</div>}
      </div>
    </div>
  );
};

export default MobileNotes;
