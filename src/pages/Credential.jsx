// ============================================================
// FILE: src/pages/Credential.jsx
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { database, itemsRef } from '../App';
import { ref, get, set, push, update, remove, onValue } from 'firebase/database';

const Credential = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();

  const action = searchParams.get('action');
  const isNew = action === 'add' || !id;

  const [credential, setCredential] = useState(null);
  const [allCredentials, setAllCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);
  const [showPassword, setShowPassword] = useState(false);
  const [groups, setGroups] = useState(['General']);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    username: '',
    password: '',
    group: 'General'
  });

  // Load all credentials for sidebar
  useEffect(() => {
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      const all = data
        ? Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(i => i.type === 'credential' && !i.trash)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : [];
      setAllCredentials(all);

      // Build groups list
      const groupSet = new Set();
      all.forEach(c => { if (c.group) groupSet.add(c.group); });
      if (!groupSet.has('General')) groupSet.add('General');
      setGroups(Array.from(groupSet).sort());
    });

    return () => unsubscribe();
  }, []);

  // Load single credential if editing existing
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

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Save credential
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
        // Refresh data
        const credRef = ref(database, `vault-items/${id}`);
        const snapshot = await get(credRef);
        if (snapshot.exists()) {
          setCredential({ id, ...snapshot.val() });
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      toast('Error saving credential.', 'error');
    }
  };

  // Delete credential (move to trash)
  const handleDelete = async () => {
    const confirmed = await confirm(`Delete credential "${credential?.title || 'Untitled'}"?`);
    if (confirmed) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      toast('Copied to clipboard!', 'success');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast('Copied to clipboard!', 'success');
    });
  };

  // Go back to vault
  const goBack = () => navigate('/');

  // Open another credential from sidebar
  const openCredential = (credId) => {
    navigate(`/credential/${credId}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner-ring"></div>
      </div>
    );
  }

  return (
    <div className="credential-page">
      {/* Header */}
      <header className="credential-header">
        <div className="brand">
          <Icon icon="mdi:key" />
          <span>Credentials</span>
        </div>
        <div className="actions">
          <button className="btn" onClick={goBack}>
            <Icon icon="mdi:arrow-left" /> Back
          </button>
        </div>
      </header>

      <div className="credential-layout">
        {/* Sidebar - all credentials list */}
        <aside className="credential-sidebar">
          <div className="sidebar-title">All Credentials</div>
          <div className="credential-list">
            {allCredentials.map(cred => (
              <div
                key={cred.id}
                className={`cred-list-item ${cred.id === id ? 'active' : ''}`}
                onClick={() => openCredential(cred.id)}
              >
                <span className="list-title">{cred.title || 'Untitled'}</span>
                <span className="list-username">{cred.username || ''}</span>
              </div>
            ))}
            {allCredentials.length === 0 && (
              <div className="empty-msg">No credentials yet.</div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="credential-main">
          <div className="credential-toolbar">
            <span className="title">
              {isNew ? 'New Credential' : credential?.title || 'Credential'}
            </span>
            <div className="actions">
              {!isNew && !isEditing && (
                <>
                  <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                    <Icon icon="mdi:pencil" /> Edit
                  </button>
                  <button className="btn btn-danger" onClick={handleDelete}>
                    <Icon icon="mdi:delete" /> Delete
                  </button>
                </>
              )}
              {(isNew || isEditing) && (
                <>
                  <button className="btn btn-primary" onClick={handleSave}>
                    <Icon icon="mdi:check" /> Save
                  </button>
                  <button className="btn btn-secondary" onClick={() => {
                    if (isNew) navigate('/');
                    else setIsEditing(false);
                  }}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="credential-content">
            {/* View mode */}
            {!isNew && !isEditing && credential && (
              <div className="credential-view">
                <div className="field">
                  <span className="label">URL</span>
                  <span className="value">
                    {credential.url ? (
                      <a href={credential.url} target="_blank" rel="noopener noreferrer">
                        {credential.url}
                      </a>
                    ) : '—'}
                    {credential.url && (
                      <button className="copy-btn" onClick={() => copyToClipboard(credential.url)}>
                        <Icon icon="mdi:content-copy" />
                      </button>
                    )}
                  </span>
                </div>

                <div className="field">
                  <span className="label">Username</span>
                  <span className="value">
                    {credential.username || '—'}
                    {credential.username && (
                      <button className="copy-btn" onClick={() => copyToClipboard(credential.username)}>
                        <Icon icon="mdi:content-copy" />
                      </button>
                    )}
                  </span>
                </div>

                <div className="field">
                  <span className="label">Password</span>
                  <span className="value">
                    <span className={showPassword ? '' : 'password-dots'}>
                      {showPassword ? (credential.password || '—') : (credential.password ? '••••••••' : '—')}
                    </span>
                    {credential.password && (
                      <>
                        <button className="toggle-pwd" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                        <button className="copy-btn" onClick={() => copyToClipboard(credential.password)}>
                          <Icon icon="mdi:content-copy" />
                        </button>
                      </>
                    )}
                  </span>
                </div>

                <div className="field">
                  <span className="label">Group</span>
                  <span className="value">{credential.group || 'General'}</span>
                </div>
              </div>
            )}

            {/* Edit / Add mode */}
            {(isNew || isEditing) && (
              <div className="credential-form">
                <div className="field">
                  <span className="label">Title *</span>
                  <span className="value">
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="Enter title"
                    />
                  </span>
                </div>

                <div className="field">
                  <span className="label">URL</span>
                  <span className="value">
                    <input
                      type="url"
                      name="url"
                      value={formData.url}
                      onChange={handleChange}
                      placeholder="https://example.com"
                    />
                  </span>
                </div>

                <div className="field">
                  <span className="label">Username</span>
                  <span className="value">
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Username / Email"
                    />
                  </span>
                </div>

                <div className="field">
                  <span className="label">Password</span>
                  <span className="value">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Password"
                    />
                    <button className="toggle-pwd" onClick={() => setShowPassword(!showPassword)} type="button">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </div>

                <div className="field">
                  <span className="label">Group</span>
                  <span className="value">
                    <select name="group" value={formData.group} onChange={handleChange}>
                      {groups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Credential;
