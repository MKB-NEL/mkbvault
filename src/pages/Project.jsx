 
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { database, itemsRef } from '../App';
import { ref, get, set, push, update, remove, onValue } from 'firebase/database';

const Project = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useModal();

  const action = searchParams.get('action');
  const isNew = action === 'add' || !id;

  const [project, setProject] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isNew);

  const [formData, setFormData] = useState({
    title: '',
    status: 'Active',
    description: ''
  });

  // Load all projects for sidebar
  useEffect(() => {
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      const all = data
        ? Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter(i => i.type === 'project' && !i.trash)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : [];
      setAllProjects(all);
    });

    return () => unsubscribe();
  }, []);

  // Load single project
  useEffect(() => {
    if (!isNew && id) {
      const projectRef = ref(database, `vault-items/${id}`);
      get(projectRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          setProject({ id, ...data });
          setFormData({
            title: data.title || '',
            status: data.status || 'Active',
            description: data.description || ''
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
        const projectRef = ref(database, `vault-items/${id}`);
        const snapshot = await get(projectRef);
        if (snapshot.exists()) {
          setProject({ id, ...snapshot.val() });
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      toast('Error saving project.', 'error');
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm(`Delete project "${project?.title || 'Untitled'}"?`);
    if (confirmed) {
      await update(ref(database, `vault-items/${id}`), { trash: true, trashedAt: Date.now() });
      toast('Moved to trash', 'warning');
      navigate('/');
    }
  };

  const goBack = () => navigate('/');

  const openProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner-ring"></div>
      </div>
    );
  }

  return (
    <div className="project-page">
      <header className="project-header">
        <div className="brand">
          <Icon icon="mdi:folder-open" />
          <span>Projects</span>
        </div>
        <div className="actions">
          <button className="btn" onClick={goBack}>
            <Icon icon="mdi:arrow-left" /> Back
          </button>
        </div>
      </header>

      <div className="project-layout">
        {/* Sidebar */}
        <aside className="project-sidebar">
          <div className="sidebar-title">All Projects</div>
          <div className="project-list">
            {allProjects.map(p => (
              <div
                key={p.id}
                className={`project-list-item ${p.id === id ? 'active' : ''}`}
                onClick={() => openProject(p.id)}
              >
                <span className="list-title">{p.title || 'Untitled'}</span>
                <span className="list-status">{p.status || ''}</span>
              </div>
            ))}
            {allProjects.length === 0 && (
              <div className="empty-msg">No projects yet.</div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="project-main">
          <div className="project-toolbar">
            <span className="title">
              {isNew ? 'New Project' : project?.title || 'Project'}
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

          <div className="project-content">
            {/* View mode */}
            {!isNew && !isEditing && project && (
              <div className="project-view">
                <div className="field">
                  <span className="label">Title</span>
                  <span className="value">{project.title || 'Untitled'}</span>
                </div>
                <div className="field">
                  <span className="label">Status</span>
                  <span className="value">
                    <span className={`status-badge ${project.status?.toLowerCase() || 'active'}`}>
                      {project.status || 'Active'}
                    </span>
                  </span>
                </div>
                {project.description && (
                  <div className="field">
                    <span className="label">Description</span>
                    <span className="value">{project.description}</span>
                  </div>
                )}
              </div>
            )}

            {/* Edit / Add mode */}
            {(isNew || isEditing) && (
              <div className="project-form">
                <div className="field">
                  <span className="label">Title *</span>
                  <span className="value">
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="Enter project title"
                    />
                  </span>
                </div>

                <div className="field">
                  <span className="label">Status</span>
                  <span className="value">
                    <select name="status" value={formData.status} onChange={handleChange}>
                      <option value="Active">Active</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </span>
                </div>

                <div className="field">
                  <span className="label">Description</span>
                  <span className="value">
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Project description..."
                      rows="4"
                    />
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

export default Project;
