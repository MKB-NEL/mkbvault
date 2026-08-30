import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, update, get } from 'firebase/database';

// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: 'AIzaSyBbrRHlakmOdKwuDGwYAx5qf-e6DOHW7s0',
  authDomain: 'joefootball-15e7a.firebaseapp.com',
  databaseURL: 'https://joefootball-15e7a-default-rtdb.firebaseio.com',
  projectId: 'joefootball-15e7a',
  storageBucket: 'joefootball-15e7a.firebasestorage.app',
  messagingSenderId: '976347287101',
  appId: '1:976347287101:web:93a93c519fff7e60986454',
  measurementId: 'G-3Q10KV3HE3'
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const itemsRef = ref(database, 'vault-items');
const categoriesRef = ref(database, 'categories');

// ============================================================
// ICON
// ============================================================
const Icon = ({ icon, className = '' }) => (
  <iconify-icon icon={icon} class={className}></iconify-icon>
);

// ============================================================
// TOAST CONTEXT
// ============================================================
const ToastContext = React.createContext();
const useToast = () => React.useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon icon={t.type === 'success' ? 'mdi:check-circle' : t.type === 'error' ? 'mdi:alert-circle' : 'mdi:information'} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============================================================
// MODAL CONTEXT
// ============================================================
const ModalContext = React.createContext();
const useModal = () => React.useContext(ModalContext);

const ModalProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, title: '', body: '', actions: '' });
  const resolveRef = React.useRef(null);

  const show = (title, body, actions) => new Promise((resolve) => {
    setState({ open: true, title, body, actions });
    resolveRef.current = resolve;
  });

  const close = () => {
    setState({ open: false, title: '', body: '', actions: '' });
    if (resolveRef.current) resolveRef.current(null);
  };

  const handleAction = (result) => {
    setState({ open: false, title: '', body: '', actions: '' });
    if (resolveRef.current) resolveRef.current(result);
  };

  const prompt = (title, label, defaultValue = '', type = 'text', options = null) => {
    let body = `<label>${label}</label>`;
    if (options) {
      body += `<select id="modalSelect">${options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
    } else {
      body += `<input type="${type}" id="modalInput" value="${defaultValue || ''}" />`;
    }
    const actions = `<button class="btn btn-secondary" data-action="cancel">Cancel</button><button class="btn btn-primary" data-action="confirm">OK</button>`;
    return show(title, body, actions).then((result) => {
      if (result === null) return null;
      const input = document.getElementById('modalInput');
      const select = document.getElementById('modalSelect');
      return input ? input.value : select ? select.value : '';
    });
  };

  const confirm = (message) => {
    const body = `<p>${message}</p>`;
    const actions = `<button class="btn btn-secondary" data-action="cancel">Cancel</button><button class="btn btn-danger" data-action="confirm">Confirm</button>`;
    return show('Confirm', body, actions).then((result) => result === 'confirm');
  };

  return (
    <ModalContext.Provider value={{ prompt, confirm }}>
      {children}
      {state.open && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal-box">
            <div className="title">{state.title}</div>
            <div className="body" dangerouslySetInnerHTML={{ __html: state.body }} />
            <div className="actions" dangerouslySetInnerHTML={{ __html: state.actions }}
              onClick={(e) => {
                const btn = e.target.closest('[data-action]');
                if (btn) handleAction(btn.dataset.action);
              }} />
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

// ============================================================
// CREDENTIALS WIDGET
// ============================================================
const CredentialsWidget = ({ items, navigate }) => {
  const { prompt, confirm } = useModal();
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const g = {};
    items.filter(i => i.type === 'credential' && !i.trash).forEach(item => {
      const group = item.group || 'General';
      if (!g[group]) g[group] = [];
      g[group].push(item);
    });
    if (!g['General']) g['General'] = [];
    return g;
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const result = {};
    let total = 0;
    Object.keys(groups).forEach(group => {
      const items = groups[group].filter(item =>
        !term || (item.title && item.title.toLowerCase().includes(term)) ||
        (item.username && item.username.toLowerCase().includes(term)) ||
        (item.url && item.url.toLowerCase().includes(term))
      );
      if (items.length > 0 || !term) { result[group] = items; total += items.length; }
    });
    return { groups: result, total };
  }, [groups, search]);

  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const moveToTrash = (id) => {
    update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
    toast('Moved to trash', 'warning');
  };

  const deleteGroup = async (groupName) => {
    if (await confirm(`Delete group "${groupName}" and move items to "General"?`)) {
      const items = groups[groupName] || [];
      const updates = {};
      items.forEach(item => { updates[`vault-items/${item.id}/group`] = 'General'; });
      update(ref(database), updates);
      toast(`Group "${groupName}" deleted`, 'warning');
    }
  };

  const renameGroup = async (groupName) => {
    const newName = await prompt('Rename Group', `Rename "${groupName}" to:`, groupName);
    if (newName && newName.trim() && newName.trim() !== groupName) {
      const items = groups[groupName] || [];
      const updates = {};
      items.forEach(item => { updates[`vault-items/${item.id}/group`] = newName.trim(); });
      update(ref(database), updates);
      toast(`Group renamed to "${newName.trim()}"`, 'success');
    }
  };

  const addGroup = async () => {
    const name = await prompt('New Group', 'Enter group name:');
    if (name && name.trim() && !groups[name.trim()]) {
      toast(`Group "${name.trim()}" created`, 'success');
    } else if (name && name.trim()) {
      toast('Group already exists.', 'warning');
    }
  };

  const openCredential = (id) => {
    if (id === 'new') navigate('/credential?action=add');
    else navigate(`/credential/${id}`);
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <div className="title"><Icon icon="mdi:key" /> Credentials</div>
        <div className="controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelected(new Set()); }} /> Select</label>
          <div className="search">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="match">{search ? `(${filtered.total} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={addGroup}>+Group</button>
          <button className="btn-icon primary" onClick={() => openCredential('new')}>+Credential</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'credential' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => openCredential(i.id)}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        {Object.keys(filtered.groups).sort((a, b) => a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)).map(group => (
          <div key={group} className="cred-group">
            <div className="group-header" onClick={() => {
              const content = document.querySelector(`.cred-group[data-group="${group}"] .group-content`);
              if (content) content.classList.toggle('open');
            }}>
              <Icon icon="mdi:chevron-down" />
              <span className="name">{group}</span>
              <span className="count">({filtered.groups[group].length})</span>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => renameGroup(group)}>✎</button>
                <button className="danger" onClick={() => deleteGroup(group)}>✕</button>
              </div>
            </div>
            <div className="group-content open" data-group={group}>
              {filtered.groups[group].map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div key={item.id} className="cred-item">
                    <span className={`checkbox ${selectMode ? 'show' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                    </span>
                    <span className="title" onClick={() => openCredential(item.id)}>{item.title || 'Untitled'}</span>
                    <div className="actions">
                      <button onClick={() => openCredential(item.id)}>📂</button>
                      <button className="delete" onClick={() => moveToTrash(item.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className={`multi-actions ${selectMode && selected.size > 0 ? 'show' : ''}`}>
          <button className="btn" onClick={() => { selected.forEach(id => openCredential(id)); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn" onClick={() => { selected.forEach(id => moveToTrash(id)); setSelected(new Set()); toast('Credentials moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// KEYS WIDGET
// ============================================================
const KeysWidget = ({ items, navigate }) => {
  const { prompt, confirm } = useModal();
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const g = {};
    items.filter(i => i.type === 'key' && !i.trash).forEach(item => {
      const subtype = item.subtype || 'password';
      if (!g[subtype]) g[subtype] = [];
      g[subtype].push(item);
    });
    return g;
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const result = {};
    let total = 0;
    Object.keys(groups).forEach(subtype => {
      const items = groups[subtype].filter(item =>
        !term || (item.title && item.title.toLowerCase().includes(term)) ||
        (item.content && item.content.toLowerCase().includes(term)) ||
        (item.number && item.number.toLowerCase().includes(term))
      );
      if (items.length > 0 || !term) { result[subtype] = items; total += items.length; }
    });
    return { groups: result, total };
  }, [groups, search]);

  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const moveToTrash = (id) => {
    update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
    toast('Moved to trash', 'warning');
  };

  const openKey = (id) => {
    if (id === 'new') navigate('/key?action=add');
    else navigate(`/key/${id}`);
  };

  const handleAddKey = async () => {
    const subtype = await prompt('Select Type', 'Choose key type:', 'password', 'select', ['password', 'card']);
    if (!subtype) return;
    navigate(`/key?action=add&subtype=${subtype}`);
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <div className="title"><Icon icon="mdi:key-variant" /> Keys</div>
        <div className="controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelected(new Set()); }} /> Select</label>
          <div className="search">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="match">{search ? `(${filtered.total} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={handleAddKey}>+Key</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'key' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => openKey(i.id)}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        {Object.keys(filtered.groups).sort().map(subtype => (
          <div key={subtype} className="cred-group">
            <div className="group-header" onClick={() => {
              const content = document.querySelector(`.keys-group[data-subtype="${subtype}"] .group-content`);
              if (content) content.classList.toggle('open');
            }}>
              <Icon icon="mdi:chevron-down" />
              <span className="name">{subtype === 'password' ? '🔑 Passwords' : '💳 Cards'}</span>
              <span className="count">({filtered.groups[subtype].length})</span>
            </div>
            <div className="group-content open" data-subtype={subtype}>
              {filtered.groups[subtype].map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div key={item.id} className="cred-item">
                    <span className={`checkbox ${selectMode ? 'show' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                    </span>
                    <span className="title" onClick={() => openKey(item.id)}>{item.title || 'Untitled'}</span>
                    <div className="actions">
                      <button onClick={() => openKey(item.id)}>📂</button>
                      <button className="delete" onClick={() => moveToTrash(item.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className={`multi-actions ${selectMode && selected.size > 0 ? 'show' : ''}`}>
          <button className="btn" onClick={() => { selected.forEach(id => openKey(id)); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn" onClick={() => { selected.forEach(id => moveToTrash(id)); setSelected(new Set()); toast('Keys moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// BOOKMARKS WIDGET
// ============================================================
const BookmarksWidget = ({ items }) => {
  const { prompt, confirm } = useModal();
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: '', title: '', description: '', category: 'Uncategorized' });
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('Ready');
  const [categories, setCategories] = useState(['Uncategorized']);

  useEffect(() => {
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const catList = Object.keys(data).filter(key => data[key] === true);
        setCategories(catList.length ? catList : ['Uncategorized']);
      } else {
        setCategories(['Uncategorized']);
      }
    });
    return () => unsubscribe();
  }, []);

  const books = useMemo(() => {
    let b = items.filter(i => i.type === 'bookmark' && !i.trash);
    const term = search.toLowerCase().trim();
    if (term) {
      b = b.filter(item => (item.title && item.title.toLowerCase().includes(term)) ||
        (item.url && item.url.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)));
    }
    return b.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, search]);

  const totalPages = Math.ceil(books.length / 36) || 1;
  const pageBooks = books.slice(page * 36, (page + 1) * 36);

  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const moveToTrash = (id) => {
    update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
    toast('Moved to trash', 'warning');
  };

  const addCategory = async () => {
    const name = await prompt('New Category', 'Enter category name:');
    if (name && name.trim() && !categories.includes(name.trim())) {
      const newCatRef = push(categoriesRef);
      await set(newCatRef, true);
      setCategories(prev => [...prev, name.trim()]);
      setForm(prev => ({ ...prev, category: name.trim() }));
      toast(`Category "${name.trim()}" created`, 'success');
    } else if (name && name.trim()) {
      toast('Category already exists.', 'warning');
    }
  };

  const fetchMetadata = async (url) => {
    if (!url || !url.startsWith('http')) { setFetchMsg('Enter valid URL'); return; }
    setFetching(true);
    setFetchMsg('Fetching...');
    try {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Fetch failed');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = doc.querySelector('title')?.textContent?.trim() || '';
      const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
      if (title) setForm(prev => ({ ...prev, title }));
      if (desc) setForm(prev => ({ ...prev, description: desc }));
      setFetchMsg('✅ Fetched');
    } catch (e) {
      setFetchMsg('⚠️ Manual entry');
    }
    setFetching(false);
  };

  const saveBookmark = () => {
    const { url, title, description, category } = form;
    if (!url || !url.startsWith('http')) { toast('Enter a valid URL.', 'warning'); return; }
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
    setForm({ url: '', title: '', description: '', category: 'Uncategorized' });
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <div className="title"><Icon icon="mdi:bookmark" /> Bookmarks</div>
        <div className="controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelected(new Set()); }} /> Select</label>
          <div className="search">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="match">{search ? `(${books.length} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={() => setShowForm(!showForm)}>+Link</button>
        </div>
      </div>

      {showForm && (
        <div className="bookmark-form show">
          <div className="row">
            <label>URL</label>
            <input type="url" placeholder="https://example.com" value={form.url}
              onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
              onBlur={(e) => fetchMetadata(e.target.value)} />
            <span className="status">
              <span className={`spinner-small ${fetching ? 'active' : ''}`}></span>
              <span>{fetchMsg}</span>
            </span>
          </div>
          <div className="row">
            <label>Title</label>
            <input type="text" placeholder="Page title" value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="row">
            <label>Description</label>
            <input type="text" placeholder="Short description" value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="row">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn-icon primary" onClick={addCategory}>+</button>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setForm({ url: '', title: '', description: '', category: 'Uncategorized' }); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveBookmark}>Save</button>
          </div>
        </div>
      )}

      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'bookmark' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => i.url && window.open(i.url, '_blank')}>{i.title || 'Link'}</span>
        ))}
      </div>

      <div className="widget-body">
        <div className="bookmark-carousel">
          <div className="bookmark-track" style={{ transform: `translateX(-${page * 100}%)` }}>
            {Array.from({ length: Math.ceil(pageBooks.length / 36) || 1 }).map((_, idx) => (
              <div key={idx} className="bookmark-page">
                {pageBooks.slice(idx * 36, (idx + 1) * 36).map(item => {
                  const isSelected = selected.has(item.id);
                  return (
                    <div key={item.id} className="bookmark-item" onClick={() => item.url && window.open(item.url, '_blank')}>
                      <span className={`checkbox ${selectMode ? 'show' : ''}`}>
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
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>&lt;</button>
          <span className="page-info">{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>&gt;</button>
        </div>
        <div className={`multi-actions ${selectMode && selected.size > 0 ? 'show' : ''}`}>
          <button className="btn" onClick={() => { selected.forEach(id => { const item = items.find(i => i.id === id); if (item && item.url) window.open(item.url, '_blank'); }); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn" onClick={() => { selected.forEach(id => moveToTrash(id)); setSelected(new Set()); toast('Bookmarks moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// NOTES WIDGET
// ============================================================
const NotesWidget = ({ items, navigate }) => {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const notes = useMemo(() => {
    let n = items.filter(i => i.type === 'note' && !i.trash);
    const term = search.toLowerCase().trim();
    if (term) {
      n = n.filter(item => (item.title && item.title.toLowerCase().includes(term)) ||
        (item.content && item.content.toLowerCase().includes(term)));
    }
    return n.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, search]);

  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const openNote = (id) => {
    if (id === 'new') navigate('/note?action=add');
    else navigate(`/note/${id}`);
  };

  return (
    <div className="widget" style={{ flex: 7 }}>
      <div className="widget-header">
        <div className="title"><Icon icon="mdi:note-text" /> Notes</div>
        <div className="controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelected(new Set()); }} /> Select</label>
          <div className="search">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="match">{search ? `(${notes.length} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={() => openNote('new')}>+Note</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'note' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => openNote(i.id)}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-box" onClick={() => openNote(note.id)}>
              {selectMode && <input type="checkbox" checked={selected.has(note.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(note.id); }} style={{ position: 'absolute', top: '4px', left: '4px' }} />}
              {note.title || 'Untitled'}
            </div>
          ))}
          {notes.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>No notes yet.</div>}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PROJECTS WIDGET
// ============================================================
const ProjectsWidget = ({ items, navigate }) => {
  const [search, setSearch] = useState('');

  const projects = useMemo(() => {
    let p = items.filter(i => i.type === 'project' && !i.trash);
    const term = search.toLowerCase().trim();
    if (term) {
      p = p.filter(item => (item.title && item.title.toLowerCase().includes(term)) || (item.status && item.status.toLowerCase().includes(term)));
    }
    return p.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, search]);

  const openProject = (id) => {
    if (id === 'new') navigate('/project?action=add');
    else navigate(`/project/${id}`);
  };

  return (
    <div className="widget" style={{ flex: 3 }}>
      <div className="widget-header">
        <div className="title"><Icon icon="mdi:folder-open" /> Projects</div>
        <div className="controls">
          <div className="search">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="match">{search ? `(${projects.length} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={() => openProject('new')}>+Project</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'project' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => openProject(i.id)}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="project-list">
          {projects.map(proj => (
            <div key={proj.id} className="project-item" onClick={() => openProject(proj.id)}>
              {proj.title || 'Untitled'}
            </div>
          ))}
          {projects.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--muted)' }}>No projects yet.</div>}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// LOGIN PAGE
// ============================================================
const LoginPage = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [showPassword, setShowPassword] = useState(false);

  const hashPassword = async (pwd) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' });
    const entered = password.trim();
    if (!entered) { setFeedback({ message: 'Please enter your master password.', type: 'warning' }); return; }

    setLoading(true);
    setFeedback({ message: 'Verifying credentials ...', type: 'warning' });

    try {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore(app);
      const docRef = doc(db, 'password', 'master-key');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setFeedback({ message: 'No master password set.', type: 'error' });
        setLoading(false); return;
      }

      const storedHash = docSnap.data().value;
      const enteredHash = await hashPassword(entered);

      if (enteredHash === storedHash) {
        setFeedback({ message: 'Access granted! Redirecting ...', type: 'success' });
        sessionStorage.setItem('vault_authenticated', 'true');
        sessionStorage.setItem('vault_login_time', Date.now().toString());
        setLoading(false);
        setTimeout(() => window.location.reload(), 600);
      } else {
        setFeedback({ message: 'Incorrect password.', type: 'error' });
        setPassword('');
        setLoading(false);
      }
    } catch (error) {
      setFeedback({ message: 'Connection error.', type: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-grid">
        <div className="login-left">
          <img src="https://i.ibb.co/whjyTVcM/759803063-18074799167426474-8240875063787582035-n.jpg" alt="MK Bertrand" />
          <h1>Private Vault</h1>
          <p>Designed exclusively for <strong>MK Bertrand</strong></p>
          <div className="sep"><span className="line"></span><span className="diamond"></span><span className="line"></span></div>
          <p className="contact"><span>📞</span> Need one? Contact: <span className="highlight">+250 795 065 789</span></p>
        </div>
        <div className="login-right">
          <h2>Secure Access</h2>
          <p>Enter your master password to unlock</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <div>
              <label>Master Password</label>
              <div className="input-wrap">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your master password" autoFocus required />
                <button type="button" className="toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className={`feedback ${feedback.message ? 'show' : ''} ${feedback.type}`}>
              {feedback.message}
            </div>
            <button type="submit" className={`btn ${loading ? 'loading' : ''}`} disabled={loading}>
              <span className="btn-text">{loading ? 'Verifying...' : 'Unlock Vault'}</span>
              <span className="spinner-small"></span>
            </button>
          </form>
        </div>
      </div>
      <div className="footer">
        <span>&copy; {new Date().getFullYear()} · PIReactive · MK Bertrand</span>
        <div>
          <a href="https://pireactive.vercel.app/" target="_blank">🏢 PIReactive</a>
          <span style={{ margin: '0 8px', opacity: 0.3 }}>●</span>
          <a href="https://www.instagram.com/kai_b3rt" target="_blank">📷 Instagram</a>
          <span style={{ margin: '0 8px', opacity: 0.3 }}>●</span>
          <a href="mailto:contact@pireactive.com">✉️ Support</a>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// CREDENTIAL DETAIL
// ============================================================
const CredentialDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();
  const isNew = searchParams.get('action') === 'add' || !id;
  const [credential, setCredential] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);
  const [showPassword, setShowPassword] = useState(false);
  const [groups, setGroups] = useState(['General']);
  const [formData, setFormData] = useState({ title: '', url: '', username: '', password: '', group: 'General' });

  useEffect(() => {
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      const all = data ? Object.entries(data).map(([id, value]) => ({ id, ...value })).filter(i => i.type === 'credential' && !i.trash) : [];
      const groupSet = new Set();
      all.forEach(c => { if (c.group) groupSet.add(c.group); });
      if (!groupSet.has('General')) groupSet.add('General');
      setGroups(Array.from(groupSet).sort());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      const credRef = ref(database, `vault-items/${id}`);
      get(credRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setCredential({ id, ...data });
          setFormData({
            title: data.title || '',
            url: data.url || '',
            username: data.username || '',
            password: data.password || '',
            group: data.group || 'General'
          });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast('Title is required.', 'warning');
      return;
    }
    const data = {
      type: 'credential',
      title: formData.title.trim(),
      url: formData.url.trim() || '',
      username: formData.username.trim() || '',
      password: formData.password || '',
      group: formData.group || 'General',
      favorite: false,
      trash: false,
      createdAt: Date.now()
    };
    try {
      if (isNew) {
        const newRef = push(itemsRef);
        await set(newRef, data);
        toast('Credential created!', 'success');
        navigate(`/credential/${newRef.key}`);
      } else {
        await update(ref(database, `vault-items/${id}`), data);
        toast('Credential updated!', 'success');
        setIsEditing(false);
        const credRef = ref(database, `vault-items/${id}`);
        const snapshot = await get(credRef);
        if (snapshot.exists()) setCredential({ id, ...snapshot.val() });
      }
    } catch (error) {
      toast('Error saving credential.', 'error');
    }
  };

  const handleDelete = async () => {
    if (await confirm(`Delete credential "${credential?.title || 'Untitled'}"?`)) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast('Copied!', 'success')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied!', 'success');
    });
  };

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}><Icon icon="mdi:arrow-left" /> Back</button>
        <h2>{isNew ? 'New Credential' : credential?.title || 'Credential'}</h2>
        <div className="actions">
          {!isNew && !isEditing && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}><Icon icon="mdi:pencil" /> Edit</button>
              <button className="btn btn-danger" onClick={handleDelete}><Icon icon="mdi:delete" /> Delete</button>
            </>
          )}
          {(isNew || isEditing) && (
            <>
              <button className="btn btn-primary" onClick={handleSave}><Icon icon="mdi:check" /> Save</button>
              <button className="btn btn-secondary" onClick={() => { if (isNew) navigate('/'); else setIsEditing(false); }}>Cancel</button>
            </>
          )}
        </div>
      </header>
      <div className="detail-content">
        {!isNew && !isEditing && credential && (
          <div className="view-mode">
            <div className="field"><label>URL</label><div>{credential.url || '—'} {credential.url && <button className="copy-btn" onClick={() => copyToClipboard(credential.url)}><Icon icon="mdi:content-copy" /></button>}</div></div>
            <div className="field"><label>Username</label><div>{credential.username || '—'} {credential.username && <button className="copy-btn" onClick={() => copyToClipboard(credential.username)}><Icon icon="mdi:content-copy" /></button>}</div></div>
            <div className="field"><label>Password</label><div><span className={showPassword ? '' : 'password-dots'}>{showPassword ? (credential.password || '—') : (credential.password ? '••••••••' : '—')}</span> {credential.password && <><button className="toggle-pwd" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button><button className="copy-btn" onClick={() => copyToClipboard(credential.password)}><Icon icon="mdi:content-copy" /></button></>}</div></div>
            <div className="field"><label>Group</label><div>{credential.group || 'General'}</div></div>
          </div>
        )}
        {(isNew || isEditing) && (
          <div className="edit-mode">
            <div className="field"><label>Title *</label><input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title" style={{ border: '2px solid #000' }} /></div>
            <div className="field"><label>URL</label><input type="url" name="url" value={formData.url} onChange={handleChange} placeholder="https://example.com" style={{ border: '2px solid #000' }} /></div>
            <div className="field"><label>Username</label><input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Username / Email" style={{ border: '2px solid #000' }} /></div>
            <div className="field"><label>Password</label><input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} placeholder="Password" style={{ border: '2px solid #000' }} /> <button className="toggle-pwd" onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? 'Hide' : 'Show'}</button></div>
            <div className="field"><label>Group</label><select name="group" value={formData.group} onChange={handleChange} style={{ border: '2px solid #000' }}>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// NOTE DETAIL
// ============================================================
const NoteDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();
  const isNew = searchParams.get('action') === 'add' || !id;
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);
  const [formData, setFormData] = useState({ title: '', content: '', folder: '', fields: {} });

  useEffect(() => {
    if (!isNew && id) {
      const noteRef = ref(database, `vault-items/${id}`);
      get(noteRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setNote({ id, ...data });
          setFormData({ title: data.title || '', content: data.content || '', folder: data.folder || '', fields: data.fields || {} });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFieldChange = (key, field, value) => {
    setFormData(prev => ({
      ...prev,
      fields: { ...prev.fields, [key]: { ...prev.fields[key], [field]: value } }
    }));
  };

  const addField = () => {
    const key = `field_${Date.now()}`;
    setFormData(prev => ({ ...prev, fields: { ...prev.fields, [key]: { title: '', value: '' } } }));
  };

  const removeField = (key) => {
    setFormData(prev => {
      const newFields = { ...prev.fields };
      delete newFields[key];
      return { ...prev, fields: newFields };
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast('Title is required.', 'warning'); return; }
    const data = {
      type: 'note',
      title: formData.title.trim(),
      content: formData.content || '',
      folder: formData.folder || '',
      fields: formData.fields || {},
      favorite: false,
      trash: false,
      createdAt: Date.now()
    };
    try {
      if (isNew) {
        const newRef = push(itemsRef);
        await set(newRef, data);
        toast('Note created!', 'success');
        navigate(`/note/${newRef.key}`);
      } else {
        await update(ref(database, `vault-items/${id}`), data);
        toast('Note updated!', 'success');
        setIsEditing(false);
        const noteRef = ref(database, `vault-items/${id}`);
        const snapshot = await get(noteRef);
        if (snapshot.exists()) setNote({ id, ...snapshot.val() });
      }
    } catch (error) {
      toast('Error saving note.', 'error');
    }
  };

  const handleDelete = async () => {
    if (await confirm(`Delete note "${note?.title || 'Untitled'}"?`)) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast('Copied!', 'success')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied!', 'success');
    });
  };

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}><Icon icon="mdi:arrow-left" /> Back</button>
        <h2>{isNew ? 'New Note' : note?.title || 'Note'}</h2>
        <div className="actions">
          {!isNew && !isEditing && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}><Icon icon="mdi:pencil" /> Edit</button>
              <button className="btn btn-danger" onClick={handleDelete}><Icon icon="mdi:delete" /> Delete</button>
            </>
          )}
          {(isNew || isEditing) && (
            <>
              <button className="btn btn-primary" onClick={handleSave}><Icon icon="mdi:check" /> Save</button>
              <button className="btn btn-secondary" onClick={() => { if (isNew) navigate('/'); else setIsEditing(false); }}>Cancel</button>
            </>
          )}
        </div>
      </header>
      <div className="detail-content">
        {!isNew && !isEditing && note && (
          <div className="view-mode">
            <div className="field"><label>Title</label><div>{note.title || 'Untitled'}</div></div>
            <div className="field"><label>Folder</label><div>{note.folder || '—'}</div></div>
            <div className="field"><label>Description</label><div>{note.content || '—'} {note.content && <button className="copy-btn" onClick={() => copyToClipboard(note.content)}><Icon icon="mdi:content-copy" /></button>}</div></div>
            {Object.keys(note.fields || {}).length > 0 && (
              <div className="fields-section"><div className="fields-title">Custom Fields</div>
                {Object.entries(note.fields).map(([key, field]) => (
                  <div key={key} className="custom-field"><span className="f-label">{field.title || key}</span><span className="f-value">{field.value || ''} {field.value && <button className="copy-btn" onClick={() => copyToClipboard(field.value)}><Icon icon="mdi:content-copy" /></button>}</span></div>
                ))}
              </div>
            )}
          </div>
        )}
        {(isNew || isEditing) && (
          <div className="edit-mode">
            <div className="field"><label>Title *</label><input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title" style={{ border: '2px solid #000' }} /></div>
            <div className="field"><label>Folder</label><input type="text" name="folder" value={formData.folder} onChange={handleChange} placeholder="Folder" style={{ border: '2px solid #000' }} /></div>
            <div className="field"><label>Description</label><textarea name="content" value={formData.content} onChange={handleChange} rows="4" placeholder="Write your note..." style={{ border: '2px solid #000' }} /></div>
            <div className="fields-section"><div className="fields-title">Custom Fields</div>
              {Object.entries(formData.fields).map(([key, field]) => (
                <div key={key} className="custom-field-edit">
                  <input className="f-label-input" placeholder="Field name" value={field.title || ''} onChange={(e) => handleFieldChange(key, 'title', e.target.value)} style={{ border: '2px solid #000' }} />
                  <input className="f-value-input" placeholder="Value" value={field.value || ''} onChange={(e) => handleFieldChange(key, 'value', e.target.value)} style={{ border: '2px solid #000' }} />
                  <button className="remove-field-btn" onClick={() => removeField(key)}><Icon icon="mdi:close" /></button>
                </div>
              ))}
              <button className="add-field-btn" onClick={addField}><Icon icon="mdi:plus" /> Add Field</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// PROJECT DETAIL
// ============================================================
const ProjectDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();
  const isNew = searchParams.get('action') === 'add' || !id;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);
  const [formData, setFormData] = useState({ title: '', status: 'Active', description: '' });

  useEffect(() => {
    if (!isNew && id) {
      const projRef = ref(database, `vault-items/${id}`);
      get(projRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setProject({ id, ...data });
          setFormData({ title: data.title || '', status: data.status || 'Active', description: data.description || '' });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast('Title is required.', 'warning'); return; }
    const data = {
      type: 'project',
      title: formData.title.trim(),
      status: formData.status || 'Active',
      description: formData.description || '',
      favorite: false,
      trash: false,
      createdAt: Date.now()
    };
    try {
      if (isNew) {
        const newRef = push(itemsRef);
        await set(newRef, data);
        toast('Project created!', 'success');
        navigate(`/project/${newRef.key}`);
      } else {
        await update(ref(database, `vault-items/${id}`), data);
        toast('Project updated!', 'success');
        setIsEditing(false);
        const projRef = ref(database, `vault-items/${id}`);
        const snapshot = await get(projRef);
        if (snapshot.exists()) setProject({ id, ...snapshot.val() });
      }
    } catch (error) {
      toast('Error saving project.', 'error');
    }
  };

  const handleDelete = async () => {
    if (await confirm(`Delete project "${project?.title || 'Untitled'}"?`)) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}><Icon icon="mdi:arrow-left" /> Back</button>
        <h2>{isNew ? 'New Project' : project?.title || 'Project'}</h2>
        <div className="actions">
          {!isNew && !isEditing && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}><Icon icon="mdi:pencil" /> Edit</button>
              <button className="btn btn-danger" onClick={handleDelete}><Icon icon="mdi:delete" /> Delete</button>
            </>
          )}
          {(isNew || isEditing) && (
            <>
              <button className="btn btn-primary" onClick={handleSave}><Icon icon="mdi:check" /> Save</button>
              <button className="btn btn-secondary" onClick={() => { if (isNew) navigate('/'); else setIsEditing(false); }}>Cancel</button>
            </>
          )}
        </div>
      </header>
      <div className="detail-content">
        {!isNew && !isEditing && project && (
          <div className="view-mode">
            <div className="field"><label>Title</label><div>{project.title || 'Untitled'}</div></div>
            <div className="field"><label>Status</label><div><span className={`status-badge ${project.status?.toLowerCase() || 'active'}`}>{project.status || 'Active'}</span></div></div>
            {project.description && <div className="field"><label>Description</label><div>{project.description}</div></div>}
          </div>
        )}
        {(isNew || isEditing) && (
          <div className="edit-mode">
            <div className="field"><label>Title *</label><input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Project title" style={{ border: '2px solid #000' }} /></div>
            <div className="field"><label>Status</label><select name="status" value={formData.status} onChange={handleChange} style={{ border: '2px solid #000' }}><option value="Active">Active</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option><option value="On Hold">On Hold</option><option value="Archived">Archived</option></select></div>
            <div className="field"><label>Description</label><textarea name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Project description..." style={{ border: '2px solid #000' }} /></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// KEY DETAIL
// ============================================================
const KeyDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();

  const action = searchParams.get('action');
  const subtypeParam = searchParams.get('subtype') || 'password';
  const isNew = action === 'add' || !id;

  const [keyItem, setKeyItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    number: '',
    cvv: '',
    note: '',
    subtype: subtypeParam
  });

  useEffect(() => {
    if (!isNew && id) {
      const keyRef = ref(database, `vault-items/${id}`);
      get(keyRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setKeyItem({ id, ...data });
          setFormData({
            title: data.title || '',
            content: data.content || '',
            number: data.number || '',
            cvv: data.cvv || '',
            note: data.note || '',
            subtype: data.subtype || 'password'
          });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setFormData(prev => ({ ...prev, subtype: subtypeParam }));
      setLoading(false);
    }
  }, [id, isNew, subtypeParam]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast('Title is required.', 'warning');
      return;
    }
    const data = {
      type: 'key',
      subtype: formData.subtype,
      title: formData.title.trim(),
      content: formData.content || '',
      number: formData.number || '',
      cvv: formData.cvv || '',
      note: formData.note || '',
      favorite: false,
      trash: false,
      createdAt: Date.now()
    };
    try {
      if (isNew) {
        const newRef = push(itemsRef);
        await set(newRef, data);
        toast('Key created!', 'success');
        navigate(`/key/${newRef.key}`);
      } else {
        await update(ref(database, `vault-items/${id}`), data);
        toast('Key updated!', 'success');
        setIsEditing(false);
        const keyRef = ref(database, `vault-items/${id}`);
        const snapshot = await get(keyRef);
        if (snapshot.exists()) setKeyItem({ id, ...snapshot.val() });
      }
    } catch (error) {
      toast('Error saving key.', 'error');
    }
  };

  const handleDelete = async () => {
    if (await confirm(`Delete key "${keyItem?.title || 'Untitled'}"?`)) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast('Copied!', 'success')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied!', 'success');
    });
  };

  if (loading) return <div className="loader"><div className="spinner"></div></div>;

  const isPassword = formData.subtype === 'password';
  const isCard = formData.subtype === 'card';

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}><Icon icon="mdi:arrow-left" /> Back</button>
        <h2>{isNew ? `New ${isPassword ? 'Password' : 'Card'}` : keyItem?.title || 'Key'}</h2>
        <div className="actions">
          {!isNew && !isEditing && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}><Icon icon="mdi:pencil" /> Edit</button>
              <button className="btn btn-danger" onClick={handleDelete}><Icon icon="mdi:delete" /> Delete</button>
            </>
          )}
          {(isNew || isEditing) && (
            <>
              <button className="btn btn-primary" onClick={handleSave}><Icon icon="mdi:check" /> Save</button>
              <button className="btn btn-secondary" onClick={() => { if (isNew) navigate('/'); else setIsEditing(false); }}>Cancel</button>
            </>
          )}
        </div>
      </header>
      <div className="detail-content">
        {!isNew && !isEditing && keyItem && (
          <div className="view-mode">
            <div className="field"><label>Title</label><div>{keyItem.title || 'Untitled'}</div></div>
            {isPassword && <div className="field"><label>Password</label><div>{keyItem.content || '—'} {keyItem.content && <button className="copy-btn" onClick={() => copyToClipboard(keyItem.content)}><Icon icon="mdi:content-copy" /></button>}</div></div>}
            {isCard && (
              <>
                <div className="field"><label>Number</label><div>{keyItem.number || '—'} {keyItem.number && <button className="copy-btn" onClick={() => copyToClipboard(keyItem.number)}><Icon icon="mdi:content-copy" /></button>}</div></div>
                <div className="field"><label>CVV</label><div>{keyItem.cvv || '—'} {keyItem.cvv && <button className="copy-btn" onClick={() => copyToClipboard(keyItem.cvv)}><Icon icon="mdi:content-copy" /></button>}</div></div>
              </>
            )}
            {keyItem.note && <div className="field"><label>Note</label><div>{keyItem.note}</div></div>}
          </div>
        )}
        {(isNew || isEditing) && (
          <div className="edit-mode">
            <div className="field">
              <label htmlFor="key-title">Title *</label>
              <div className="value">
                <input id="key-title" name="title" type="text" value={formData.title} onChange={handleChange} placeholder="Title" style={{ border: '2px solid #000' }} />
              </div>
            </div>
            {isPassword && (
              <div className="field">
                <label htmlFor="key-content">Password</label>
                <div className="value">
                  <input id="key-content" name="content" type="text" value={formData.content} onChange={handleChange} placeholder="Password" style={{ border: '2px solid #000' }} />
                </div>
              </div>
            )}
            {isCard && (
              <>
                <div className="field">
                  <label htmlFor="key-number">Number</label>
                  <div className="value">
                    <input id="key-number" name="number" type="text" value={formData.number} onChange={handleChange} placeholder="Card number" style={{ border: '2px solid #000' }} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="key-cvv">CVV</label>
                  <div className="value">
                    <input id="key-cvv" name="cvv" type="text" value={formData.cvv} onChange={handleChange} placeholder="CVV" style={{ border: '2px solid #000' }} />
                  </div>
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="key-note">Note</label>
              <div className="value">
                <textarea id="key-note" name="note" value={formData.note} onChange={handleChange} rows="3" placeholder="Optional note..." style={{ border: '2px solid #000' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// VAULT DASHBOARD (Desktop)
// ============================================================
const VaultDashboard = ({ items }) => {
  const navigate = useNavigate();
  const handleLogout = () => {
    sessionStorage.removeItem('vault_authenticated');
    sessionStorage.removeItem('vault_login_time');
    window.location.reload();
  };

  return (
    <div className="vault">
      <section className="hero" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=300&fit=crop&crop=center')" }}>
        <div className="hero-content">
          <h1>Welcome back, Bertrand</h1>
          <p>Your digital vault — secure, organized, always accessible.</p>
        </div>
      </section>

      <header className="header">
        <div className="brand">
          <div className="logo"><Icon icon="mdi:lock-open" /></div>
          <h1>Vault <span className="mono" style={{ fontFamily: 'monospace', fontSize: '0.6rem', opacity: 0.7, background: 'rgba(255,255,255,0.15)', padding: '0.05rem 0.5rem', borderRadius: '20px' }}>· MK Bertrand</span></h1>
        </div>
        <div className="actions">
          <button className="btn btn-danger" onClick={handleLogout}>
            <Icon icon="mdi:logout" /> Logout
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <CredentialsWidget items={items} navigate={navigate} />
          <KeysWidget items={items} navigate={navigate} />
        </aside>
        <div className="main">
          <BookmarksWidget items={items} />
          <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
            <NotesWidget items={items} navigate={navigate} />
            <ProjectsWidget items={items} navigate={navigate} />
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '2rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 300 }}>
        <span>&copy; {new Date().getFullYear()} · PIReactive · MK Bertrand</span>
        <span>Encrypted · Secure · Private</span>
      </footer>
    </div>
  );
};

// ============================================================
// MOBILE LAYOUT (Bottom Navigation)
// ============================================================
const MobileLayout = ({ items }) => {
  const [tab, setTab] = useState('credentials');
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem('vault_authenticated');
    sessionStorage.removeItem('vault_login_time');
    window.location.reload();
  };

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="brand">
          <div className="logo"><Icon icon="mdi:lock-open" /></div>
          <h1>Vault</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}><Icon icon="mdi:logout" /></button>
      </header>
      <div className="mobile-content">
        {tab === 'credentials' && <CredentialsWidget items={items} navigate={navigate} />}
        {tab === 'keys' && <KeysWidget items={items} navigate={navigate} />}
        {tab === 'bookmarks' && <BookmarksWidget items={items} />}
        {tab === 'notes' && <NotesWidget items={items} navigate={navigate} />}
        {tab === 'projects' && <ProjectsWidget items={items} navigate={navigate} />}
      </div>
      <nav className="bottom-nav">
        <button className={`nav-item ${tab === 'credentials' ? 'active' : ''}`} onClick={() => setTab('credentials')}><Icon icon="mdi:key" /><span>Credentials</span></button>
        <button className={`nav-item ${tab === 'keys' ? 'active' : ''}`} onClick={() => setTab('keys')}><Icon icon="mdi:key-variant" /><span>Keys</span></button>
        <button className={`nav-item ${tab === 'bookmarks' ? 'active' : ''}`} onClick={() => setTab('bookmarks')}><Icon icon="mdi:bookmark" /><span>Bookmarks</span></button>
        <button className={`nav-item ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}><Icon icon="mdi:note-text" /><span>Notes</span></button>
        <button className={`nav-item ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}><Icon icon="mdi:folder-open" /><span>Projects</span></button>
      </nav>
    </div>
  );
};

// ============================================================
// STYLES (FULL CSS)
// ============================================================
const styles = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --bg: #f6f8f6; --card: #ffffff; --text: #333333; --text2: #7A7A7A; --muted: #aaaaaa; --blue: #2395ed; --blue-hover: #016fc6; --blue-light: #e8f4fd; --green: #1aaa4d; --red: #dc2626; --orange: #f59e0b; --border: #f0f0f0; --shadow: 0 1px 3px rgba(0,0,0,0.06); --radius: 6px; --radius-lg: 12px; --header: #2395ed; --yellow: #fef3c7; }
body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
.spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.auth-guard { position: fixed; inset: 0; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; z-index: 9999; }
.auth-guard .spinner { width: 48px; height: 48px; border: 3px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: spin 0.8s linear infinite; }
.auth-guard p { font-size: 0.9rem; color: var(--text2); }
.login-wrapper { max-width: 1000px; margin: auto; background: var(--card); border-radius: var(--radius-lg); overflow: hidden; display: flex; flex-direction: column; }
.login-grid { display: grid; grid-template-columns: 1fr 1fr; }
.login-left { padding: 2.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.login-left img { width: 200px; height: 200px; border-radius: 50%; object-fit: cover; margin-bottom: 1.5rem; }
.login-left h1 { font-size: 1.4rem; font-weight: 600; }
.login-left p { color: var(--text2); font-size: 0.95rem; }
.login-left .contact { margin-top: 0.5rem; font-size: 0.85rem; color: var(--text2); display: flex; gap: 0.4rem; align-items: center; justify-content: center; flex-wrap: wrap; }
.login-left .contact .highlight { color: var(--blue); font-weight: 500; }
.sep { display: flex; gap: 0.8rem; align-items: center; margin: 0.8rem auto; width: 60%; }
.sep .line { flex: 1; height: 1px; background: var(--bg); }
.sep .diamond { width: 6px; height: 6px; background: var(--blue); transform: rotate(45deg); opacity: 0.6; }
.login-right { padding: 2.5rem 2rem; display: flex; flex-direction: column; justify-content: center; }
.login-right h2 { font-size: 1.5rem; font-weight: 600; text-align: center; }
.login-right p { text-align: center; color: var(--text2); font-size: 0.9rem; margin-bottom: 2rem; }
.login-form { display: flex; flex-direction: column; gap: 1.2rem; }
.login-form label { font-size: 0.75rem; font-weight: 500; color: var(--text2); text-transform: uppercase; letter-spacing: 0.3px; }
.input-wrap { display: flex; align-items: center; background: var(--bg); border-radius: var(--radius); transition: box-shadow 0.2s; }
.input-wrap:focus-within { box-shadow: 0 0 0 2px var(--blue-light); }
.input-wrap input { flex: 1; padding: 0.85rem 1rem; border: none; background: transparent; font-size: 1rem; outline: none; font-family: 'Inter', sans-serif; }
.input-wrap .toggle { background: none; border: none; padding: 0 1rem; cursor: pointer; color: var(--muted); font-size: 1.2rem; }
.feedback { min-height: 1.5rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; opacity: 0; transition: opacity 0.25s; }
.feedback.show { opacity: 1; }
.feedback.error { color: var(--red); }
.feedback.success { color: var(--green); }
.feedback.warning { color: var(--orange); }
.btn { padding: 0.9rem 1.5rem; background: var(--blue); color: #fff; border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.25s; display: flex; align-items: center; justify-content: center; gap: 0.6rem; }
.btn:hover { background: var(--blue-hover); }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.btn .spinner-small { display: none; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
.btn.loading .spinner-small { display: block; }
.btn.loading .btn-text { display: none; }
.footer { background: var(--bg); padding: 1.2rem 2rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem; border-top: 1px solid rgba(0,0,0,0.04); font-size: 0.75rem; color: var(--muted); }
.footer a { color: var(--text2); text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem; }
.footer a:hover { color: var(--blue); }
.vault { max-width: 1400px; margin: 0 auto; padding: 0 16px 24px; }
.hero { height: 140px; border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; background: #2d2d2d; display: flex; align-items: center; justify-content: center; color: #fff; text-align: center; background-size: cover; background-position: center; position: relative; }
.hero::after { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.35); }
.hero-content { position: relative; z-index: 2; padding: 1rem 2rem; }
.hero-content h1 { font-size: 1.8rem; font-weight: 700; }
.hero-content p { font-weight: 300; opacity: 0.9; }
.header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; height: 52px; padding: 0 16px; margin: 0 -16px 16px; background: var(--header); color: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.1); }
.header .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 1.1rem; }
.header .brand .logo { width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; }
.header .btn { background: rgba(255,255,255,0.15); color: #fff; padding: 0.4rem 0.9rem; border: none; border-radius: var(--radius); font-size: 0.8rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.header .btn:hover { background: rgba(255,255,255,0.3); }
.header .btn-danger { background: transparent; border: 1px solid rgba(255,255,255,0.3); }
.header .btn-danger:hover { background: rgba(220,38,38,0.3); border-color: var(--red); }
.layout { display: flex; gap: 20px; margin-top: 16px; }
.sidebar { flex: 0 0 30%; min-width: 260px; max-width: 380px; display: flex; flex-direction: column; gap: 20px; }
.main { flex: 1; display: flex; flex-direction: column; gap: 20px; }
.widget { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; }
.widget-header { padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-weight: 600; font-size: 0.9rem; }
.widget-header .title { flex: 1; display: flex; align-items: center; gap: 6px; }
.widget-header .controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.widget-header .controls .search { display: flex; align-items: center; background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 0 8px; height: 28px; }
.widget-header .controls .search input { border: none; background: transparent; outline: none; font-size: 0.8rem; padding: 0 4px; width: 80px; font-family: 'Inter', sans-serif; }
.widget-header .controls .search input:focus { width: 120px; }
.widget-header .controls .btn-icon { background: none; border: none; cursor: pointer; padding: 2px 4px; color: var(--text2); font-size: 0.8rem; display: flex; align-items: center; gap: 3px; }
.widget-header .controls .btn-icon:hover { background: var(--bg); }
.widget-header .controls .btn-icon.primary { color: var(--blue); }
.widget-header .controls .btn-icon.danger { color: var(--red); }
.widget-header .controls label { font-size: 0.8rem; font-weight: 400; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.widget-header .controls .match { font-size: 0.7rem; color: var(--muted); }
.widget-recents { padding: 4px 12px 6px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.7rem; color: var(--muted); }
.widget-recents .label { font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.widget-recents .item { background: var(--card); padding: 1px 8px; border-radius: 20px; border: 1px solid var(--border); color: var(--text2); cursor: pointer; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.widget-recents .item:hover { background: var(--blue-light); color: var(--text); }
.widget-body { flex: 1; overflow-y: auto; padding: 8px 12px; max-height: 400px; }
.widget-body::-webkit-scrollbar { width: 5px; }
.widget-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
.cred-group { border-bottom: 1px solid var(--border); }
.cred-group:last-child { border-bottom: none; }
.group-header { display: flex; align-items: center; padding: 6px 0; cursor: pointer; font-weight: 500; font-size: 0.85rem; gap: 6px; user-select: none; }
.group-header .name { flex: 1; }
.group-header .count { font-weight: 400; color: var(--muted); font-size: 0.75rem; }
.group-header .actions { display: flex; gap: 4px; }
.group-header .actions button { background: none; border: none; cursor: pointer; color: var(--muted); padding: 0 4px; font-size: 0.8rem; }
.group-header .actions button:hover { color: var(--text); }
.group-content { overflow: hidden; max-height: 0; transition: max-height 0.3s; padding-left: 24px; }
.group-content.open { max-height: 3000px; }
.cred-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 0.85rem; border-bottom: 1px solid var(--border); }
.cred-item:last-child { border-bottom: none; }
.cred-item .checkbox { display: none; }
.cred-item .checkbox.show { display: inline-flex; }
.cred-item .title { flex: 1; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cred-item .title:hover { text-decoration: underline; }
.cred-item .actions { display: flex; gap: 4px; }
.cred-item .actions button { background: none; border: none; cursor: pointer; color: var(--muted); padding: 0 4px; font-size: 0.8rem; }
.cred-item .actions .delete:hover { color: var(--red); }
.multi-actions { display: none; padding: 4px 0 8px; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--border); margin-top: 4px; }
.multi-actions.show { display: flex; }
.multi-actions .btn { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 2px 10px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.bookmark-track { display: flex; transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.bookmark-page { flex: 0 0 100%; display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; padding: 4px 0; }
.bookmark-item { display: flex; flex-direction: column; align-items: center; padding: 6px 4px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--card); cursor: pointer; position: relative; text-align: center; min-height: 60px; justify-content: center; transition: all 0.2s; }
.bookmark-item:hover { border-color: var(--blue-light); background: var(--blue-light); transform: scale(1.02); }
.bookmark-item .checkbox { position: absolute; top: 2px; left: 2px; display: none; }
.bookmark-item .checkbox.show { display: block; }
.bookmark-item .favicon { width: 24px; height: 24px; object-fit: contain; margin-bottom: 2px; }
.bookmark-item .b-title { font-size: 0.6rem; font-weight: 500; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bookmark-nav { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 8px 0 4px; font-size: 0.8rem; color: var(--text2); }
.bookmark-nav button { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 14px; cursor: pointer; font-size: 0.9rem; color: var(--text); }
.bookmark-nav button:hover:not(:disabled) { background: var(--blue-light); }
.bookmark-nav button:disabled { opacity: 0.3; cursor: not-allowed; }
.bookmark-form { padding: 12px 14px; background: var(--bg); border-bottom: 1px solid var(--border); display: none; flex-direction: column; gap: 10px; }
.bookmark-form.show { display: flex; }
.bookmark-form .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.bookmark-form .row label { font-size: 0.75rem; font-weight: 500; color: var(--text2); min-width: 60px; }
.bookmark-form .row input, .bookmark-form .row select { flex: 1; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.85rem; background: var(--card); outline: none; min-width: 120px; }
.bookmark-form .row input:focus, .bookmark-form .row select:focus { border-color: var(--blue); }
.bookmark-form .row .status { font-size: 0.75rem; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.bookmark-form .row .status .spinner-small { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: spin 0.7s linear infinite; display: none; }
.bookmark-form .row .status .spinner-small.active { display: inline-block; }
.bookmark-form .actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
.bookmark-form .actions .btn { padding: 5px 14px; border: none; border-radius: var(--radius); font-size: 0.8rem; font-weight: 500; cursor: pointer; }
.bookmark-form .actions .btn-primary { background: var(--blue); color: #fff; }
.bookmark-form .actions .btn-primary:hover { background: var(--blue-hover); }
.bookmark-form .actions .btn-secondary { background: var(--card); color: var(--text2); border: 1px solid var(--border); }
.bookmark-form .actions .btn-secondary:hover { background: var(--bg); }
.notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
.note-box { background: var(--yellow); border-radius: var(--radius); padding: 12px 8px; text-align: center; font-weight: 500; color: #1a1a1a; cursor: pointer; min-height: 60px; display: flex; align-items: center; justify-content: center; word-break: break-word; font-size: 0.85rem; position: relative; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.note-box:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.project-list { display: flex; flex-direction: column; gap: 4px; }
.project-item { padding: 6px 8px; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 0.85rem; }
.project-item:hover { background: var(--bg); }
.project-item:last-child { border-bottom: none; }
.toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; max-width: 360px; }
.toast { background: var(--card); padding: 10px 16px; border-radius: var(--radius); box-shadow: 0 4px 16px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 10px; font-size: 0.9rem; animation: slideIn 0.3s ease; border-left: 4px solid var(--blue); }
.toast.success { border-left-color: var(--green); }
.toast.error { border-left-color: var(--red); }
.toast.warning { border-left-color: var(--orange); }
@keyframes slideIn { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 10000; display: none; align-items: center; justify-content: center; padding: 20px; }
.modal-overlay.active { display: flex; }
.modal-box { background: var(--card); border-radius: var(--radius-lg); max-width: 460px; width: 100%; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); animation: modalSlide 0.25s ease; }
@keyframes modalSlide { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
.modal-box .title { font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; }
.modal-box .body { margin-bottom: 20px; }
.modal-box .body label { display: block; font-size: 0.8rem; font-weight: 500; color: var(--text2); margin-bottom: 4px; }
.modal-box .body input, .modal-box .body textarea, .modal-box .body select { width: 100%; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.9rem; background: var(--bg); outline: none; margin-bottom: 12px; font-family: 'Inter', sans-serif; }
.modal-box .body input:focus, .modal-box .body textarea:focus, .modal-box .body select:focus { border-color: var(--blue); }
.modal-box .actions { display: flex; gap: 10px; justify-content: flex-end; }
.modal-box .actions .btn { padding: 0.5rem 1.2rem; border: none; border-radius: var(--radius); font-size: 0.85rem; font-weight: 500; cursor: pointer; }
.modal-box .actions .btn-primary { background: var(--blue); color: #fff; }
.modal-box .actions .btn-primary:hover { background: var(--blue-hover); }
.modal-box .actions .btn-secondary { background: var(--bg); color: var(--text2); }
.modal-box .actions .btn-secondary:hover { background: var(--border); }
.modal-box .actions .btn-danger { background: var(--red); color: #fff; }
.modal-box .actions .btn-danger:hover { background: #b91c1c; }
.detail-page { max-width: 900px; margin: 0 auto; padding: 20px; }
.detail-header { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); margin-bottom: 20px; flex-wrap: wrap; }
.detail-header .back-btn { background: none; border: none; cursor: pointer; color: var(--text2); display: flex; align-items: center; gap: 4px; font-size: 0.9rem; }
.detail-header .back-btn:hover { color: var(--text); }
.detail-header h2 { flex: 1; font-size: 1.4rem; font-weight: 600; }
.detail-header .actions { display: flex; gap: 8px; flex-wrap: wrap; }
.detail-content .field { display: flex; padding: 8px 0; border-bottom: 1px solid var(--border); gap: 16px; align-items: flex-start; }
.detail-content .field label { width: 120px; font-weight: 500; color: var(--text2); flex-shrink: 0; padding-top: 4px; }
.detail-content .field .value { flex: 1; word-break: break-all; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-content .field input, .detail-content .field textarea, .detail-content .field select { flex: 1; padding: 6px 10px; border: 2px solid #000 !important; border-radius: var(--radius); font-size: 0.9rem; background: var(--bg); outline: none; font-family: 'Inter', sans-serif; }
.detail-content .field input:focus, .detail-content .field textarea:focus, .detail-content .field select:focus { border-color: var(--blue); }
.detail-content .field textarea { min-height: 80px; resize: vertical; }
.copy-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0 4px; }
.copy-btn:hover { color: var(--blue); }
.toggle-pwd { background: none; border: none; cursor: pointer; color: var(--text2); font-size: 0.8rem; }
.password-dots { letter-spacing: 2px; }
.fields-section { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.fields-title { font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.3px; margin-bottom: 6px; }
.custom-field { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--border); align-items: center; }
.custom-field .f-label { font-weight: 500; color: var(--text2); min-width: 100px; }
.custom-field .f-value { flex: 1; display: flex; align-items: center; gap: 8px; }
.custom-field-edit { display: flex; gap: 8px; padding: 4px 0; align-items: center; flex-wrap: wrap; }
.custom-field-edit .f-label-input { flex: 0 0 120px; }
.custom-field-edit .f-value-input { flex: 1; min-width: 100px; }
.custom-field-edit input { padding: 4px 8px; border: 2px solid #000 !important; border-radius: var(--radius); font-size: 0.85rem; background: var(--bg); outline: none; }
.custom-field-edit input:focus { border-color: var(--blue); }
.remove-field-btn { background: none; border: none; cursor: pointer; color: var(--red); font-size: 1rem; }
.add-field-btn { background: none; border: 1px dashed var(--border); border-radius: var(--radius); padding: 6px 12px; color: var(--text2); font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; }
.add-field-btn:hover { border-color: var(--blue); background: var(--blue-light); }
.status-badge { padding: 2px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 500; display: inline-block; }
.status-badge.active { background: #d1fae5; color: #065f46; }
.status-badge.in-progress { background: #fef3c7; color: #92400e; }
.status-badge.completed { background: #dbeafe; color: #1e40af; }
.status-badge.on-hold { background: #fed7d7; color: #991b1b; }
.status-badge.archived { background: #e5e7eb; color: #4b5563; }
.mobile-container { display: flex; flex-direction: column; height: 100vh; max-height: 100vh; overflow: hidden; background: var(--bg); }
.mobile-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--header); color: #fff; flex-shrink: 0; }
.mobile-header .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 1.1rem; }
.mobile-header .brand .logo { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: var(--radius); }
.mobile-header .logout-btn { background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 6px 12px; border-radius: var(--radius); cursor: pointer; }
.mobile-content { flex: 1; overflow-y: auto; padding: 12px 16px; }
.bottom-nav { display: flex; justify-content: space-around; align-items: center; padding: 8px 0 env(safe-area-inset-bottom); background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
.bottom-nav .nav-item { display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-family: 'Inter', sans-serif; font-size: 0.6rem; padding: 4px 12px; transition: color 0.2s; }
.bottom-nav .nav-item iconify-icon { font-size: 1.4rem; }
.bottom-nav .nav-item.active { color: var(--blue); }
.bottom-nav .nav-item span { font-size: 0.55rem; }
@media (max-width: 992px) {
  .layout { flex-direction: column; }
  .sidebar { flex: none; max-width: none; width: 100%; }
  .bookmark-page { grid-template-columns: repeat(6, 1fr); }
}
@media (max-width: 768px) {
  .login-grid { grid-template-columns: 1fr; }
  .login-left { padding: 2rem 1.5rem 1.5rem; border-bottom: 1px solid var(--bg); }
  .login-left img { max-width: 120px; }
  .login-right { padding: 2rem 1.5rem 2.2rem; }
  .footer { flex-direction: column; text-align: center; }
  .hero { height: 100px; }
  .hero-content h1 { font-size: 1.2rem; }
  .hero-content p { font-size: 0.8rem; }
  .header { flex-wrap: wrap; height: auto; padding: 8px 12px; }
  .bookmark-page { grid-template-columns: repeat(4, 1fr); }
  .notes-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .bookmark-page { grid-template-columns: repeat(3, 1fr); }
  .notes-grid { grid-template-columns: 1fr; }
  .detail-header { flex-direction: column; align-items: stretch; }
  .detail-header .actions { justify-content: flex-start; }
  .detail-content .field { flex-direction: column; gap: 4px; }
  .detail-content .field label { width: 100%; }
  .bottom-nav .nav-item { padding: 4px 6px; font-size: 0.5rem; }
  .bottom-nav .nav-item iconify-icon { font-size: 1.2rem; }
}
`;

// ============================================================
// MAIN APP
// ============================================================
function App() {
  const [items, setItems] = useState([]);
  const [auth, setAuth] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Inject styles
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    return () => styleEl.remove();
  }, []);

  // Auth check
  useEffect(() => {
    const isAuth = sessionStorage.getItem('vault_authenticated');
    const loginTime = parseInt(sessionStorage.getItem('vault_login_time') || '0');
    if (isAuth === 'true' && Date.now() - loginTime < 24 * 60 * 60 * 1000) {
      setAuth(true);
    } else {
      sessionStorage.removeItem('vault_authenticated');
      sessionStorage.removeItem('vault_login_time');
      setAuth(false);
    }
  }, []);

  // Load items
  useEffect(() => {
    if (auth !== true) return;
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      setItems(data ? Object.entries(data).map(([id, value]) => ({ id, ...value, createdAt: value.createdAt || Date.now() })) : []);
    });
    return () => unsubscribe();
  }, [auth]);

  if (auth === null) {
    return <div className="auth-guard"><div className="spinner"></div><p>Verifying session ...</p></div>;
  }

  if (!auth) {
    return <LoginPage />;
  }

  return (
    <ToastProvider>
      <ModalProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={isMobile ? <MobileLayout items={items} /> : <VaultDashboard items={items} />} />
            <Route path="/key" element={<KeyDetail />} />
            <Route path="/key/:id" element={<KeyDetail />} />
            <Route path="/credential" element={<CredentialDetail />} />
            <Route path="/credential/:id" element={<CredentialDetail />} />
            <Route path="/note" element={<NoteDetail />} />
            <Route path="/note/:id" element={<NoteDetail />} />
            <Route path="/project" element={<ProjectDetail />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </ModalProvider>
    </ToastProvider>
  );
}

export default App;
