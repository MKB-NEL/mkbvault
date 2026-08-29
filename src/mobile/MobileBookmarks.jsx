// ============================================================
// FILE: src/mobile/MobileBookmarks.jsx
// ============================================================
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { push, set, update } from 'firebase/database';
import { itemsRef } from '../App';

const MobileBookmarks = ({ items }) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ url: '', title: '', category: 'Uncategorized' });

  const books = useMemo(() => {
    let b = items.filter(i => i.type === 'bookmark' && !i.trash);
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      b = b.filter(item =>
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.url && item.url.toLowerCase().includes(term))
      );
    }
    return b.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, searchTerm]);

  const moveToTrash = (id) => {
    update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
    toast('Moved to trash', 'warning');
  };

  const handleSaveBookmark = () => {
    const { url, title, category } = formData;
    if (!url || !url.startsWith('http')) {
      toast('Please enter a valid URL.', 'warning');
      return;
    }
    const newItem = {
      type: 'bookmark',
      title: title || url,
      url,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`,
      description: '',
      category: category || 'Uncategorized',
      favorite: false,
      trash: false,
      createdAt: Date.now()
    };
    const newRef = push(itemsRef);
    set(newRef, newItem);
    toast('Bookmark added!', 'success');
    setShowForm(false);
    setFormData({ url: '', title: '', category: 'Uncategorized' });
  };

  return (
    <div className="mobile-widget">
      <div className="mobile-search">
        <Icon icon="mdi:search" />
        <input type="text" placeholder="Search bookmarks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <div className="mobile-actions">
        <button className="btn-icon primary" onClick={() => setShowForm(!showForm)}>
          <Icon icon="mdi:plus" /> Add
        </button>
      </div>

      {showForm && (
        <div className="mobile-form">
          <input type="url" placeholder="URL" value={formData.url}
            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))} />
          <input type="text" placeholder="Title (optional)" value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
          <input type="text" placeholder="Category" value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveBookmark}>Save</button>
          </div>
        </div>
      )}

      <div className="mobile-grid">
        {books.map(item => (
          <div key={item.id} className="mobile-bookmark" onClick={() => item.url && window.open(item.url, '_blank')}>
            <img className="favicon" src={item.favicon || `https://www.google.com/s2/favicons?domain=${item.url || ''}`}
              onError={(e) => e.target.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔗</text></svg>"} />
            <span>{item.title ? item.title.slice(0, 8) : 'Link'}</span>
            <button className="delete" onClick={(e) => { e.stopPropagation(); moveToTrash(item.id); }}>✕</button>
          </div>
        ))}
        {books.length === 0 && <div className="empty-state">No bookmarks.</div>}
      </div>
    </div>
  );
};

export default MobileBookmarks;
