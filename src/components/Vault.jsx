import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { itemsRef } from '../App';
import { push, set, update, remove, ref } from 'firebase/database';

// ===== ICON WRAPPER =====
const Icon = ({ icon, className = '' }) => (
  <iconify-icon icon={icon} class={className}></iconify-icon>
);

// ===== TOAST SYSTEM =====
const ToastContext = React.createContext();
export const useToast = () => React.useContext(ToastContext);

export const ToastProvider = ({ children }) => {
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

// ===== MODAL SYSTEM =====
const ModalContext = React.createContext();
export const useModal = () => React.useContext(ModalContext);

export const ModalProvider = ({ children }) => {
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

// ===== CREDENTIALS WIDGET =====
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
          <button className="btn-icon primary" onClick={() => onNavigate('credential.html', { action: 'add' })}>+Credential</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'credential' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => onNavigate('credential.html', { id: i.id })}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        {Object.keys(filtered.groups).sort((a, b) => a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)).map(group => (
          <div key={group} className="cred-group">
            <div className="group-header">
              <Icon icon="mdi:chevron-down" />
              <span className="name">{group}</span>
              <span className="count">({filtered.groups[group].length})</span>
              <div className="actions">
                <button onClick={() => renameGroup(group)}>✎</button>
                <button className="danger" onClick={() => deleteGroup(group)}>✕</button>
              </div>
            </div>
            <div className="group-content open">
              {filtered.groups[group].map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div key={item.id} className="cred-item">
                    <span className={`checkbox ${selectMode ? 'show' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                    </span>
                    <span className="title" onClick={() => onNavigate('credential.html', { id: item.id })}>{item.title || 'Untitled'}</span>
                    <div className="actions">
                      <button onClick={() => onNavigate('credential.html', { id: item.id })}>📂</button>
                      <button className="delete" onClick={() => moveToTrash(item.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className={`multi-actions ${selectMode && selected.size > 0 ? 'show' : ''}`}>
          <button className="btn" onClick={() => { selected.forEach(id => onNavigate('credential.html', { id })); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn" onClick={() => { selected.forEach(id => moveToTrash(id)); setSelected(new Set()); toast('Credentials moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
        </div>
      </div>
    </div>
  );
};

// ===== BOOKMARKS WIDGET =====
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

// ===== NOTES WIDGET =====
const NotesWidget = ({ items, onNavigate }) => {
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
          <button className="btn-icon primary" onClick={() => onNavigate('note.html', { action: 'add' })}>+Note</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'note' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => onNavigate('note.html', { id: i.id })}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note.id} className="note-box" onClick={() => onNavigate('note.html', { id: note.id })}>
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

// ===== PROJECTS WIDGET =====
const ProjectsWidget = ({ items, onNavigate }) => {
  const [search, setSearch] = useState('');

  const projects = useMemo(() => {
    let p = items.filter(i => i.type === 'project' && !i.trash);
    const term = search.toLowerCase().trim();
    if (term) {
      p = p.filter(item => (item.title && item.title.toLowerCase().includes(term)) || (item.status && item.status.toLowerCase().includes(term)));
    }
    return p.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, search]);

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
          <button className="btn-icon primary" onClick={() => onNavigate('project.html', { action: 'add' })}>+Project</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="label">Recent</span>
        {items.filter(i => i.type === 'project' && !i.trash).slice(0, 3).map(i => (
          <span key={i.id} className="item" onClick={() => onNavigate('project.html', { id: i.id })}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        <div className="project-list">
          {projects.map(proj => (
            <div key={proj.id} className="project-item" onClick={() => onNavigate('project.html', { id: proj.id })}>
              {proj.title || 'Untitled'}
            </div>
          ))}
          {projects.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--muted)' }}>No projects yet.</div>}
        </div>
      </div>
    </div>
  );
};

// ===== MAIN VAULT =====
const Vault = ({ items, isMobile }) => {
  const toast = useToast();

  const navigateTo = (page, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    window.location.href = qs ? `${page}?${qs}` : page;
  };

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
          <CredentialsWidget items={items} onNavigate={navigateTo} />
        </aside>
        <div className="main">
          <BookmarksWidget items={items} />
          <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
            <NotesWidget items={items} onNavigate={navigateTo} />
            <ProjectsWidget items={items} onNavigate={navigateTo} />
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

// ===== EXPORT =====
export default function App() {
  return (
    <ToastProvider>
      <ModalProvider>
        <Vault items={[]} isMobile={false} />
      </ModalProvider>
    </ToastProvider>
  );
}
