import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, update } from 'firebase/database';

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

// ============================================================
// ICON COMPONENT
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
const CredentialsWidget = ({ items, onNavigate }) => {
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

  const handleAddCredential = () => {
    // Navigate to credential.html with action=add
    window.location.href = 'credential.html?action=add';
  };

  const handleOpenCredential = (id) => {
    window.location.href = `credential.html?id=${id}`;
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
          <button className="btn-icon primary" onClick={handleAddCredential}>+Credential</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'credential' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => handleOpenCredential(i.id)}>{i.title || 'Untitled'}</span>
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
                    <span className="title" onClick={() => handleOpenCredential(item.id)}>{item.title || 'Untitled'}</span>
                    <div className="actions">
                      <button onClick={() => handleOpenCredential(item.id)}>📂</button>
                      <button className="delete" onClick={() => moveToTrash(item.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className={`multi-actions ${selectMode && selected.size > 0 ? 'show' : ''}`}>
          <button className="btn" onClick={() => { selected.forEach(id => handleOpenCredential(id)); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn" onClick={() => { selected.forEach(id => moveToTrash(id)); setSelected(new Set()); toast('Credentials moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
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

  const categories = useMemo(() => {
    const cats = new Set();
    items.filter(i => i.type === 'bookmark' && !i.trash).forEach(i => { if (i.category) cats.add(i.category); });
    if (!cats.has('Uncategorized')) cats.add('Uncategorized');
    return Array.from(cats).sort();
  }, [items]);

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
      categories.push(name.trim());
      setForm(prev => ({ ...prev, category: name.trim() }));
      toast(`Category "${name.trim()}" created`, 'success');
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
const NotesWidget = ({ items }) => {
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

  const handleOpenNote = (id) => {
    window.location.href = `note.html?id=${id}`;
  };

  const handleAddNote = () => {
    window.location.href = 'note.html?action=add';
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
          <button className="btn-icon primary" onClick={handleAddNote}>+Note</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'note' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => handleOpenNote(i.id)}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-box" onClick={() => handleOpenNote(note.id)}>
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
const ProjectsWidget = ({ items }) => {
  const [search, setSearch] = useState('');

  const projects = useMemo(() => {
    let p = items.filter(i => i.type === 'project' && !i.trash);
    const term = search.toLowerCase().trim();
    if (term) {
      p = p.filter(item => (item.title && item.title.toLowerCase().includes(term)) || (item.status && item.status.toLowerCase().includes(term)));
    }
    return p.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, search]);

  const handleOpenProject = (id) => {
    window.location.href = `project.html?id=${id}`;
  };

  const handleAddProject = () => {
    window.location.href = 'project.html?action=add';
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
          <button className="btn-icon primary" onClick={handleAddProject}>+Project</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'project' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => handleOpenProject(i.id)}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="project-list">
          {projects.map(proj => (
            <div key={proj.id} className="project-item" onClick={() => handleOpenProject(proj.id)}>
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
// STYLES (inline in JS)
// ============================================================
const styles = `
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #f6f8f6; --card: #ffffff; --text: #333333; --text2: #7A7A7A;
  --muted: #aaaaaa; --blue: #2395ed; --blue-hover: #016fc6;
  --blue-light: #e8f4fd; --green: #1aaa4d; --red: #dc2626;
  --orange: #f59e0b; --border: #f0f0f0; --shadow: 0 1px 3px rgba(0,0,0,0.06);
  --radius: 6px; --radius-lg: 12px; --header: #2395ed; --yellow: #fef3c7;
}

body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }

.spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.auth-guard { position: fixed; inset: 0; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; z-index: 9999; }
.auth-guard .spinner { width: 48px; height: 48px; border: 3px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: spin 0.8s linear infinite; }
.auth-guard p { font-size: 0.9rem; color: var(--text2); }

/* LOGIN */
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

/* VAULT */
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
.sidebar { flex: 0 0 30%; min-width: 260px; max-width: 380px; }
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
  .header .brand { flex: 0 0 auto; }
  .header .actions { flex: 0 0 auto; }
  .bookmark-page { grid-template-columns: repeat(4, 1fr); }
  .notes-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .login-left { padding: 1.5rem 1rem 1.2rem; }
  .login-right { padding: 1.5rem 1rem 1.8rem; }
  .login-left img { max-width: 100px; }
  .bookmark-page { grid-template-columns: repeat(3, 1fr); }
  .notes-grid { grid-template-columns: 1fr; }
}
`;

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
// VAULT DASHBOARD
// ============================================================
const VaultDashboard = ({ items }) => {
  const toast = useToast();

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
          <CredentialsWidget items={items} onNavigate={() => {}} />
        </aside>
        <div className="main">
          <BookmarksWidget items={items} />
          <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
            <NotesWidget items={items} />
            <ProjectsWidget items={items} />
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
// MAIN APP
// ============================================================
function App() {
  const [items, setItems] = useState([]);
  const [auth, setAuth] = useState(null);

  // Inject styles
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    return () => styleEl.remove();
  }, []);

  // Check auth
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

  // Load items from Firebase
  useEffect(() => {
    if (auth !== true) return;
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      setItems(data ? Object.entries(data).map(([id, value]) => ({ id, ...value, createdAt: value.createdAt || Date.now() })) : []);
    });
    return () => unsubscribe();
  }, [auth]);

  if (auth === null) {
    return (
      <div className="auth-guard">
        <div className="spinner"></div>
        <p>Verifying session ...</p>
      </div>
    );
  }

  if (!auth) {
    return <LoginPage />;
  }

  return (
    <ToastProvider>
      <ModalProvider>
        <VaultDashboard items={items} />
      </ModalProvider>
    </ToastProvider>
  );
}

export default App;
