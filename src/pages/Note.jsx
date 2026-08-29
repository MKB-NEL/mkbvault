// ============================================================
// FILE: src/pages/Note.jsx
// ============================================================
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { database, itemsRef } from '../App';
import { ref, get, set, push, update, remove, onValue } from 'firebase/database';

const Note = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();

  const action = searchParams.get('action');
  const isNew = action === 'add' || !id;

  const [note, setNote] = useState(null);
  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);
  const [folders, setFolders] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    folder: '',
    fields: {}
  });

  // Load all notes for sidebar
  useEffect(() => {
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      const all = data
        ? Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(i => i.type === 'note' && !i.trash)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : [];
      setAllNotes(all);

      // Build folders list
      const folderSet = new Set();
      all.forEach(n => { if (n.folder) folderSet.add(n.folder); });
      setFolders(Array.from(folderSet).sort());
    });

    return () => unsubscribe();
  }, []);

  // Load single note
  useEffect(() => {
    if (!isNew && id) {
      const noteRef = ref(database, `vault-items/${id}`);
      get(noteRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setNote({ id, ...data });
          setFormData({
            title: data.title || '',
            content: data.content || '',
            folder: data.folder || '',
            fields: data.fields || {}
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

  const handleFieldChange = (key, field, value) => {
    setFormData(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: { ...prev.fields[key], [field]: value }
      }
    }));
  };

  const addField = () => {
    const key = `field_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: { title: '', value: '' }
      }
    }));
  };

  const removeField = (key) => {
    setFormData(prev => {
      const newFields = { ...prev.fields };
      delete newFields[key];
      return { ...prev, fields: newFields };
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast('Title is required.', 'warning');
      return;
    }

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
        if (snapshot.exists()) {
          setNote({ id, ...snapshot.val() });
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      toast('Error saving note.', 'error');
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm(`Delete note "${note?.title || 'Untitled'}"?`);
    if (confirmed) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

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

  const goBack = () => navigate('/');

  const openNote = (noteId) => {
    navigate(`/note/${noteId}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner-ring"></div>
      </div>
    );
  }

  return (
    <div className="note-page">
      <header className="note-header">
        <div className="brand">
          <Icon icon="mdi:note-text" />
          <span>Notes</span>
        </div>
        <div className="actions">
          <button className="btn" onClick={goBack}>
            <Icon icon="mdi:arrow-left" /> Back
          </button>
        </div>
      </header>

      <div className="note-layout">
        {/* Sidebar */}
        <aside className="note-sidebar">
          <div className="sidebar-title">All Notes</div>
          <div className="note-list">
            {allNotes.map(n => (
              <div
                key={n.id}
                className={`note-list-item ${n.id === id ? 'active' : ''}`}
                onClick={() => openNote(n.id)}
              >
                <span className="list-title">{n.title || 'Untitled'}</span>
                <span className="list-folder">{n.folder || ''}</span>
              </div>
            ))}
            {allNotes.length === 0 && (
              <div className="empty-msg">No notes yet.</div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="note-main">
          <div className="note-toolbar">
            <span className="title">
              {isNew ? 'New Note' : note?.title || 'Note'}
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

          <div className="note-content">
            {/* View mode */}
            {!isNew && !isEditing && note && (
              <div className="note-view">
                <div className="field">
                  <span className="label">Title</span>
                  <span className="value">{note.title || 'Untitled'}</span>
                </div>
                <div className="field">
                  <span className="label">Folder</span>
                  <span className="value">{note.folder || '—'}</span>
                </div>
                <div className="field">
                  <span className="label">Description</span>
                  <span className="value">
                    {note.content || '—'}
                    {note.content && (
                      <button className="copy-btn" onClick={() => copyToClipboard(note.content)}>
                        <Icon icon="mdi:content-copy" />
                      </button>
                    )}
                  </span>
                </div>

                {Object.keys(note.fields || {}).length > 0 && (
                  <div className="fields-section">
                    <div className="fields-title">Custom Fields</div>
                    {Object.entries(note.fields).map(([key, field]) => (
                      <div key={key} className="custom-field">
                        <span className="f-label">{field.title || key}</span>
                        <span className="f-value">
                          {field.value || ''}
                          {field.value && (
                            <button className="copy-btn" onClick={() => copyToClipboard(field.value)}>
                              <Icon icon="mdi:content-copy" />
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Edit / Add mode */}
            {(isNew || isEditing) && (
              <div className="note-form">
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
                  <span className="label">Folder</span>
                  <span className="value">
                    <select name="folder" value={formData.folder} onChange={handleChange}>
                      <option value="">None</option>
                      {folders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </span>
                </div>

                <div className="field">
                  <span className="label">Description</span>
                  <span className="value">
                    <textarea
                      name="content"
                      value={formData.content}
                      onChange={handleChange}
                      placeholder="Write your note..."
                      rows="4"
                    />
                  </span>
                </div>

                <div className="fields-section">
                  <div className="fields-title">Custom Fields</div>
                  {Object.entries(formData.fields).map(([key, field]) => (
                    <div key={key} className="custom-field-edit">
                      <input
                        className="f-label-input"
                        type="text"
                        placeholder="Field name"
                        value={field.title || ''}
                        onChange={(e) => handleFieldChange(key, 'title', e.target.value)}
                      />
                      <input
                        className="f-value-input"
                        type="text"
                        placeholder="Value"
                        value={field.value || ''}
                        onChange={(e) => handleFieldChange(key, 'value', e.target.value)}
                      />
                      <button className="remove-field-btn" onClick={() => removeField(key)}>
                        <Icon icon="mdi:close" />
                      </button>
                    </div>
                  ))}
                  <button className="add-field-btn" onClick={addField}>
                    <Icon icon="mdi:plus" /> Add Field
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Note;
