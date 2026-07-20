'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api, { uploadApi } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import { Plus, Trash2, Edit2, X, FileText, Image as ImageIcon, Video as VideoIcon, File as FileIcon, Zap, Paperclip, Upload } from 'lucide-react';

const TEMPLATE_PRESETS = [
  { title: 'Quick Introduction', text: 'Hi {name}! 👋\n\nI wanted to reach out and introduce myself. I work with businesses like {company} to help them grow.\n\nWould you be open to a quick 10-minute chat? 😊' },
  { title: 'Follow-up #1', text: 'Hi {name}! 😊\n\nJust checking in to see if you had a chance to review what we discussed.\n\nLet me know if you have any questions!' },
  { title: 'Follow-up #2', text: 'Hey {name}! 👋\n\nI know you\'re busy, but I wanted to make sure my previous message didn\'t get lost.\n\nAre you still interested? Happy to answer any questions!' },
  { title: 'Pricing Inquiry', text: 'Hi {name}! 💼\n\nThanks for your interest! I\'d be happy to share our pricing details for {company}.\n\nWhen would be a good time for a quick call?' },
  { title: 'Meeting Request', text: 'Hi {name}! 📅\n\nI\'d love to schedule a quick meeting to discuss how we can help {company}.\n\nAre you available this week?' },
];

function TemplateModal({ template, onClose, onSaved }) {
  const [title, setTitle] = useState(template?.title || '');
  const [text, setText] = useState(template?.text || '');
  const [tags, setTags] = useState(template?.tags?.join(', ') || '');
  
  // New file state
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [docFile, setDocFile] = useState(null);

  // Previews
  const [imgPreview, setImgPreview] = useState(template?.imageFile?.url || null);

  // Removals flags
  const [removeImage, setRemoveImage] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [removeDoc, setRemoveDoc] = useState(false);

  const [loading, setLoading] = useState(false);

  const imgRef = useRef();
  const vidRef = useRef();
  const docRef = useRef();

  const isEdit = !!template?._id;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setRemoveImage(false);
      const reader = new FileReader();
      reader.onloadend = () => setImgPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title || !text) return toast.error('Title and message text are required');

    const hasMedia = imageFile || videoFile || docFile;
    setLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('text', text);
    formData.append('tags', tags);

    if (imageFile) formData.append('image', imageFile);
    if (videoFile) formData.append('video', videoFile);
    if (docFile) formData.append('doc', docFile);

    if (isEdit) {
      formData.append('removeImage', removeImage);
      formData.append('removeVideo', removeVideo);
      formData.append('removeDoc', removeDoc);
    }

    // Show a persistent toast for uploads so the user knows it's working in background
    let uploadToastId;
    if (hasMedia) {
      uploadToastId = toast.loading('Uploading media... this may take a moment ⏳', { duration: 120000 });
    }

    try {
      // Use uploadApi (120s timeout) for multipart requests with media files
      // Use regular api (20s timeout) for text-only templates
      const client = hasMedia ? uploadApi : api;
      let data;
      if (isEdit) {
        ({ data } = await client.put(`/templates/${template._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }));
      } else {
        ({ data } = await client.post('/templates', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }));
      }
      if (uploadToastId) toast.dismiss(uploadToastId);
      onSaved(data, isEdit);
      toast.success(isEdit ? 'Template updated ✅' : 'Template created ✅');
      onClose();
    } catch (err) {
      if (uploadToastId) toast.dismiss(uploadToastId);
      const msg = err.response?.data?.message || err.message || 'Failed to save';
      if (err.code === 'ECONNABORTED') {
        toast.error('Upload timed out. Please try a smaller file or check your connection.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{isEdit ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="Template name" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          <div>
            <label className="label">Message * (use {'{name}'}, {'{company}'})</label>
            <textarea className="input" placeholder="Type your message..." value={text} onChange={e => setText(e.target.value)} rows={4} required />
          </div>

          <div>
            <label className="label">Tags (comma separated)</label>
            <input className="input" placeholder="e.g. intro, pricing, promo" value={tags} onChange={e => setTags(e.target.value)} />
          </div>

          {/* Media Attachments Section */}
          <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
              Attach Media files (WebP compression enabled)
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Image Input */}
              <div>
                <span className="label" style={{ marginBottom: 4 }}>Image (Max 10MB)</span>
                {imgPreview && !removeImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
                    <img src={imgPreview} alt="Preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imageFile ? imageFile.name : template?.imageFile?.originalName || 'Attached Image'}
                    </span>
                    <button type="button" onClick={() => { setRemoveImage(true); setImageFile(null); setImgPreview(null); }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => imgRef.current.click()} style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}>
                    <ImageIcon size={16} /> Choose Image
                  </button>
                )}
                <input ref={imgRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              </div>

              {/* Video Input */}
              <div>
                <span className="label" style={{ marginBottom: 4 }}>Video (Max 100MB)</span>
                {(videoFile || (template?.videoFile && !removeVideo)) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
                    <VideoIcon size={18} color="var(--accent)" />
                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {videoFile ? videoFile.name : template?.videoFile?.originalName || 'Attached Video'}
                    </span>
                    <button type="button" onClick={() => { setRemoveVideo(true); setVideoFile(null); }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => vidRef.current.click()} style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}>
                    <VideoIcon size={16} /> Choose Video
                  </button>
                )}
                <input ref={vidRef} type="file" accept="video/*" onChange={e => { setVideoFile(e.target.files[0]); setRemoveVideo(false); }} style={{ display: 'none' }} />
              </div>

              {/* Document Input */}
              <div>
                <span className="label" style={{ marginBottom: 4 }}>Document/File (Max 50MB)</span>
                {(docFile || (template?.docFile && !removeDoc)) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
                    <FileIcon size={18} color="var(--accent)" />
                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {docFile ? docFile.name : template?.docFile?.originalName || 'Attached File'}
                    </span>
                    <button type="button" onClick={() => { setRemoveDoc(true); setDocFile(null); }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => docRef.current.click()} style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}>
                    <Paperclip size={16} /> Choose File
                  </button>
                )}
                <input ref={docRef} type="file" accept="*" onChange={e => { setDocFile(e.target.files[0]); setRemoveDoc(false); }} style={{ display: 'none' }} />
              </div>

            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [addedPresets, setAddedPresets] = useState(false);

  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data)).finally(() => setLoading(false));
  }, []);

  const handleSaved = (data, isEdit) => {
    if (isEdit) {
      setTemplates(prev => prev.map(t => t._id === data._id ? data : t));
    } else {
      setTemplates(prev => [data, ...prev]);
    }
  };

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(prev => prev.filter(t => t._id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const addPresets = async () => {
    setAddedPresets(true);
    let added = 0;
    for (const preset of TEMPLATE_PRESETS) {
      try {
        const { data } = await api.post('/templates', preset, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setTemplates(prev => [...prev, data]);
        added++;
      } catch {}
    }
    toast.success(`Added ${added} preset templates! 🎉`);
  };

  return (
    <div className="app-shell">
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Templates</h1>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTemplate(null); setShowModal(true); }}>
            <Plus size={16} /> New
          </button>
        </div>

        <div className="page-content">
          {templates.length === 0 && !loading && !addedPresets && (
            <div style={{ marginBottom: 20, padding: 16, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Zap size={18} color="var(--accent)" />
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Quick Start</p>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>Add professional templates instantly</p>
              <button className="btn btn-primary btn-sm" onClick={addPresets}>Add Preset Templates</button>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
          ) : templates.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No templates yet</h3>
              <p>Create templates for quick WhatsApp follow-ups</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {templates.map(t => {
                const hasImage = !!t.imageFile;
                const hasVideo = !!t.videoFile;
                const hasDoc = !!t.docFile;

                return (
                  <div key={t._id} className="card" style={{ borderRadius: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title}
                          </p>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {hasImage && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(99,102,241,0.2)', borderRadius: 4, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 2 }}><ImageIcon size={10} /> Image</span>}
                            {hasVideo && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(234,179,8,0.2)', borderRadius: 4, color: '#eab308', display: 'flex', alignItems: 'center', gap: 2 }}><VideoIcon size={10} /> Video</span>}
                            {hasDoc && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(34,197,94,0.2)', borderRadius: 4, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 2 }}><FileIcon size={10} /> Doc</span>}
                          </div>
                        </div>

                        {hasImage && (
                          <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', maxWidth: 120 }}>
                            <img src={t.imageFile.url} alt="Attached image preview" style={{ width: '100%', height: 70, objectFit: 'cover' }} />
                          </div>
                        )}

                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {t.text}
                        </p>
                        
                        {t.tags && t.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                            {t.tags.map(tag => (
                              <span key={tag} className="badge badge-tag">#{tag}</span>
                            ))}
                          </div>
                        )}

                        {t.usageCount > 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--accent)' }}>Used {t.usageCount}x</p>}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setEditTemplate(t); setShowModal(true); }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteTemplate(t._id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--red)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <TemplateModal
          template={editTemplate}
          onClose={() => { setShowModal(false); setEditTemplate(null); }}
          onSaved={handleSaved}
        />
      )}

      <BottomNav active="templates" />
    </div>
  );
}
