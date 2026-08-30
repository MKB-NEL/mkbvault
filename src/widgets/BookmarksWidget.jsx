 
import React, { useState, useMemo, useRef } from 'react';
import { Icon } from '../components/Icon';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { push, set, update } from 'firebase/database';
import { itemsRef } from '../App';

const BookmarksWidget = ({ items }) => {
  const { prompt, confirm } = useModal();
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ url: '', title: '', description: '', category: 'Uncategorized' });
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('Ready');

  const books = useMemo(() => {
    let b = items.filter(i => i.type === 'bookmark' && !i.trash);
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      b = b.filter(item =>
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.url && item.url.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term))
      );
    }
    return b.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, searchTerm]);

  const totalPages = Math.ceil(books.length / 36) || 1;
  const pageBooks = books.slice(page * 36, (page + 1) * 36);

  const categories = useMemo(() => {
    const cats = new Set();
    items.filter(i => i.type === 'bookmark' && !i.trash).forEach(i => {
      if (i.category) cats.add(i.category);
    });
    if (!cats.has('Uncategorized')) cats.add('Uncategorized');
    return Array.from(cats).sort();
  }, [items]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const moveToTrash = (id) => {
    update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
    toast('Moved to trash', 'warning');
  };

  const handleAddCategory = async () => {
    const name = await prompt('New Category', 'Enter category name:');
    if (name && name.trim() && !categories.includes(name.trim())) {
      categories.push(name.trim());
      setFormData(prev => ({ ...prev, category: name.trim() }));
      toast(`Category "${name.trim()}" created`, 'success');
    } else if (name && name.trim()) {
      toast('Category already exists.', 'warning');
    }
  };

  const handleFetchMetadata = async (url) => {
    if (!url || !url.startsWith('http')) { setFetchMsg('Enter a valid URL'); return; }
    setFetching(true);
    setFetchMsg('Fetching...');
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Fetch failed');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const title = doc.querySelector('title')?.textContent?.trim() || '';
      const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      if (title) setFormData(prev => ({ ...prev, title }));
      if (desc) setFormData(prev => ({ ...prev, description: desc }));
      setFetchMsg('✅ Fetched successfully');
    } catch (e) {
      setFetchMsg('⚠️ Could not fetch, enter manually');
    }
    setFetching(false);
  };

  const handleSaveBookmark = () => {
    const { url, title, description, category } = formData;
    if (!url || !url.startsWith('http')) {
      toast('Please enter a valid URL.', 'warning');
      return;
    }
    const newItem = {
      type: 'bookmark',
      title: title || url,
      url,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`,
      description: description || '',
      category: category || 'Uncategorized',
      favorite: false,
      trash: false,
      createdAt: Date.now()
    };
    const newRef = push(itemsRef);
    set(newRef, newItem);
    toast('Bookmark added!', 'success');
    setShowForm(false);
    setFormData({ url: '', title: '', description: '', category: 'Uncategorized' });
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <div className="widget-title"><Icon icon="mdi:bookmark" /> Bookmarks</div>
        <div className="widget-controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelectedIds(new Set()); }} /> Select</label>
          <div className="search-box">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <span className="match-count">{searchTerm ? `(${books.length} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={() => setShowForm(!showForm)}>+Link</button>
        </div>
      </div>

      {showForm && (
        <div className="bookmark-form show">
          <div className="form-row">
            <label>URL</label>
            <input type="url" placeholder="https://example.com" value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              onBlur={(e) => handleFetchMetadata(e.target.value)} />
            <span className="status-text">
              <span className={`spinner-small ${fetching ? 'active' : ''}`}></span>
              <span>{fetchMsg}</span>
            </span>
          </div>
          <div className="form-row">
            <label>Title</label>
            <input type="text" placeholder="Page title" value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <input type="text" placeholder="Short description" value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="form-row">
            <label>Category</label>
            <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn-icon primary" onClick={handleAddCategory}>+</button>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setFormData({ url: '', title: '', description: '', category: 'Uncategorized' }); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveBookmark}>Save</button>
          </div>
        </div>
      )}

      <div className="widget-recents">
        <span className="recent-label">Recent</span>
        {(items.filter(i => i.type === 'bookmark' && !i.trash).slice(0, 3)).map(i => (
          <span key={i.id} className="recent-item" onClick={() => i.url && window.open(i.url, '_blank')}>{i.title || 'Link'}</span>
        ))}
      </div>

      <div className="widget-body">
        <div className="bookmark-carousel">
          <div className="bookmark-track" style={{ transform: `translateX(-${page * 100}%)` }}>
            {Array.from({ length: Math.ceil(pageBooks.length / 36) || 1 }).map((_, idx) => (
              <div key={idx} className="bookmark-page">
                {pageBooks.slice(idx * 36, (idx + 1) * 36).map(item => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div key={item.id} className="bookmark-item" onClick={() => item.url && window.open(item.url, '_blank')}>
                      <span className={`bookmark-checkbox ${selectMode ? 'show' : ''}`}>
                        <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleSelect(item.id); }} />
                      </span>
                      <img className="favicon" src={item.favicon || `https://www.google.com/s2/favicons?domain=${item.url || ''}`}
                        onError={(e) => e.target.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔗</text></svg>"} />
                      <span className="b-title">{item.title ? item.title.slice(0, 5) : 'Link'}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="bookmark-nav">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}><</button>
          <span className="page-info">{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>></button>
        </div>
        <div className={`multi-select-actions ${selectMode && selectedIds.size > 0 ? 'show' : ''}`}>
          <button className="btn-icon" onClick={() => { selectedIds.forEach(id => { const item = items.find(i => i.id === id); if (item && item.url) window.open(item.url, '_blank'); }); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn-icon danger" onClick={() => { selectedIds.forEach(id => moveToTrash(id)); setSelectedIds(new Set()); toast('Bookmarks moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
        </div>
      </div>
    </div>
  );
};

export default BookmarksWidget;
