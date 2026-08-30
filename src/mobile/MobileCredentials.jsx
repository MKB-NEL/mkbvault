 
import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { update } from 'firebase/database';
import { itemsRef } from '../App';

const MobileCredentials = ({ items, onNavigate }) => {
  const { prompt, confirm } = useModal();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set(['General']));

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

  const toggleGroup = (group) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) newSet.delete(group);
      else newSet.add(group);
      return newSet;
    });
  };

  const moveToTrash = (id) => {
    update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
    toast('Moved to trash', 'warning');
  };

  return (
    <div className="mobile-widget">
      <div className="mobile-search">
        <Icon icon="mdi:search" />
        <input type="text" placeholder="Search credentials..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <div className="mobile-actions">
        <button className="btn-icon primary" onClick={() => onNavigate('credential.html', { action: 'add' })}>
          <Icon icon="mdi:plus" /> Add
        </button>
      </div>
      <div className="mobile-list">
        {Object.keys(credentialGroups).sort((a, b) => {
          if (a === 'General') return -1;
          if (b === 'General') return 1;
          return a.localeCompare(b);
        }).map(group => {
          const items = credentialGroups[group];
          const isExpanded = expandedGroups.has(group);
          return (
            <div key={group} className="mobile-group">
              <div className="mobile-group-header" onClick={() => toggleGroup(group)}>
                <Icon icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} />
                <span>{group}</span>
                <span className="count">({items.length})</span>
              </div>
              {isExpanded && items.map(item => (
                <div key={item.id} className="mobile-item" onClick={() => onNavigate('credential.html', { id: item.id })}>
                  <span className="item-title">{item.title || 'Untitled'}</span>
                  <button className="delete" onClick={(e) => { e.stopPropagation(); moveToTrash(item.id); }}>🗑</button>
                </div>
              ))}
            </div>
          );
        })}
        {Object.keys(credentialGroups).length === 0 && (
          <div className="empty-state">No credentials yet. Add one!</div>
        )}
      </div>
    </div>
  );
};

export default MobileCredentials;
