// ============================================================
// FILE: src/widgets/CredentialsWidget.jsx
// ============================================================
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { update, remove } from 'firebase/database';
import { itemsRef } from '../App';

const CredentialsWidget = ({ items, onNavigate }) => {
  const { prompt, confirm } = useModal();
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const credentialGroups = useMemo(() => {
    const groups = {};
    const creds = items.filter(i => i.type === 'credential' && !i.trash);
    creds.forEach(item => {
      const group = item.group || 'General';
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    if (!groups['General']) groups['General'] = [];
    return groups;
  }, [items]);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const result = {};
    let total = 0;
    Object.keys(credentialGroups).forEach(group => {
      const items = credentialGroups[group].filter(item =>
        !term ||
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.username && item.username.toLowerCase().includes(term)) ||
        (item.url && item.url.toLowerCase().includes(term))
      );
      if (items.length > 0 || !term) {
        result[group] = items;
        total += items.length;
      }
    });
    return { groups: result, total };
  }, [credentialGroups, searchTerm]);

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

  const handleDeleteGroup = async (groupName) => {
    const confirmed = await confirm(`Delete group "${groupName}" and move its items to "General"?`);
    if (confirmed) {
      const items = credentialGroups[groupName] || [];
      const updates = {};
      items.forEach(item => { updates[`vault-items/${item.id}/group`] = 'General'; });
      update(ref(database), updates);
      toast(`Group "${groupName}" deleted, items moved to General`, 'warning');
    }
  };

  const handleRenameGroup = async (groupName) => {
    const newName = await prompt('Rename Group', `Rename "${groupName}" to:`, groupName);
    if (newName && newName.trim() && newName.trim() !== groupName) {
      const items = credentialGroups[groupName] || [];
      const updates = {};
      items.forEach(item => { updates[`vault-items/${item.id}/group`] = newName.trim(); });
      update(ref(database), updates);
      toast(`Group renamed to "${newName.trim()}"`, 'success');
    }
  };

  const handleAddGroup = async () => {
    const name = await prompt('New Group', 'Enter group name:');
    if (name && name.trim() && !credentialGroups[name.trim()]) {
      toast(`Group "${name.trim()}" created`, 'success');
    } else if (name && name.trim()) {
      toast('Group already exists.', 'warning');
    }
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <div className="widget-title"><Icon icon="mdi:key" /> Credentials</div>
        <div className="widget-controls">
          <label><input type="checkbox" checked={selectMode} onChange={() => { setSelectMode(prev => !prev); if (selectMode) setSelectedIds(new Set()); }} /> Select</label>
          <div className="search-box">
            <Icon icon="mdi:search" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <span className="match-count">{searchTerm ? `(${filteredGroups.total} matches)` : ''}</span>
          </div>
          <button className="btn-icon primary" onClick={handleAddGroup}>+Group</button>
          <button className="btn-icon primary" onClick={() => onNavigate('credential.html', { action: 'add' })}>+Credential</button>
        </div>
      </div>
      <div className="widget-recents">
        <span className="recent-label">Recent</span>
        {(items.filter(i => i.type === 'credential' && !i.trash).slice(0, 3)).map(i => (
          <span key={i.id} className="recent-item" onClick={() => onNavigate('credential.html', { id: i.id })}>{i.title || 'Untitled'}</span>
        ))}
      </div>
      <div className="widget-body">
        {Object.keys(filteredGroups.groups).sort((a, b) => {
          if (a === 'General') return -1;
          if (b === 'General') return 1;
          return a.localeCompare(b);
        }).map(group => (
          <div key={group} className="credential-group">
            <div className="group-header">
              <Icon icon="mdi:chevron-down" />
              <span className="group-name">{group}</span>
              <span className="group-count">({filteredGroups.groups[group].length})</span>
              <div className="group-actions">
                <button className="btn-icon" onClick={() => handleRenameGroup(group)}>✎</button>
                <button className="btn-icon danger" onClick={() => handleDeleteGroup(group)}>✕</button>
              </div>
            </div>
            <div className="group-content expanded">
              {filteredGroups.groups[group].map(item => {
                const isSelected = selectedIds.has(item.id);
                const titleHtml = item.title ? item.title.replace(new RegExp(searchTerm, 'gi'), match => `<span class="highlight">${match}</span>`) : 'Untitled';
                return (
                  <div key={item.id} className="credential-item">
                    <span className={`item-checkbox ${selectMode ? 'show' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                    </span>
                    <span className="item-title" onClick={() => onNavigate('credential.html', { id: item.id })} dangerouslySetInnerHTML={{ __html: titleHtml }} />
                    <div className="item-actions">
                      <button onClick={() => onNavigate('credential.html', { id: item.id })}>📂</button>
                      <button className="delete" onClick={() => moveToTrash(item.id)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className={`multi-select-actions ${selectMode && selectedIds.size > 0 ? 'show' : ''}`}>
          <button className="btn-icon" onClick={() => { selectedIds.forEach(id => onNavigate('credential.html', { id })); }}><Icon icon="mdi:open-in-new" /> Open</button>
          <button className="btn-icon danger" onClick={() => { selectedIds.forEach(id => moveToTrash(id)); setSelectedIds(new Set()); toast('Credentials moved to trash', 'warning'); }}><Icon icon="mdi:delete" /> Delete</button>
        </div>
      </div>
    </div>
  );
};

export default CredentialsWidget;
