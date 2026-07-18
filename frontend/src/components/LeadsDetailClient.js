'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink, mergeTemplate } from '@/lib/auth';
import {
  ArrowLeft, MessageCircle, Phone, Edit2, Trash2, Mic, MicOff,
  Play, Pause, Send, Plus, X, Check, Calendar, AlertTriangle, ExternalLink, Image, Video, File
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_OPTIONS = ['new', 'contacted', 'follow_up', 'closed'];
const STATUS_LABELS = { new: 'New', contacted: 'Contacted', follow_up: 'Follow-up', closed: 'Closed' };

function RecordingSection({ leadId }) {
  const [recordings, setRecordings] = useState([]);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [duration, setDuration] = useState(0);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const audioRefs = useRef({});
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    api.get(`/recordings/${leadId}`).then(r => setRecordings(r.data)).catch(() => {});
  }, [leadId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks.current = [];
      mr.ondataavailable = e => chunks.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, `recording-${Date.now()}.webm`);
        try {
          const { data } = await api.post(`/recordings/upload/${leadId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setRecordings(prev => [data, ...prev]);
          toast.success('Recording saved ✅');
        } catch {
          toast.error('Failed to save recording');
        }
        stream.getTracks().forEach(t => t.stop());
        setDuration(0);
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Microphone access denied. Grant microphone permission to record audio.');
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
    setMediaRecorder(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 20MB max
    if (file.size > 20 * 1024 * 1024) {
      return toast.error('File too large. Max size is 20MB.');
    }

    const formData = new FormData();
    formData.append('audio', file);
    setUploadingFile(true);

    try {
      const { data } = await api.post(`/recordings/upload/${leadId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRecordings(prev => [data, ...prev]);
      toast.success('Call recording uploaded successfully! 📁');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload call recording file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteRecording = async (id) => {
    try {
      await api.delete(`/recordings/${id}`);
      setRecordings(prev => prev.filter(r => r._id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const togglePlay = (id, url) => {
    if (playingId === id) {
      audioRefs.current[id]?.pause();
      setPlayingId(null);
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause();
      }
      setPlayingId(id);
      if (!audioRefs.current[id]) {
        audioRefs.current[id] = new Audio(url);
        audioRefs.current[id].onended = () => setPlayingId(null);
      }
      audioRefs.current[id].play();
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`;
  const BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <div>
      <p className="section-title">🎙️ Call Recordings & Voice Notes</p>

      {/* Record button */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
        <button
          className={`rec-btn ${recording ? 'recording' : ''}`}
          onClick={recording ? stopRecording : startRecording}
        >
          {recording ? <MicOff size={22} color="white" /> : <Mic size={22} color="white" />}
        </button>
        <div>
          {recording ? (
            <div>
              <p style={{ margin:0, fontWeight:600, color:'var(--red)', fontSize:14 }}>● Recording {fmt(duration)}</p>
              <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>Tap to stop</p>
            </div>
          ) : (
            <div>
              <p style={{ margin:0, fontWeight:600, fontSize:14 }}>Record Voice Note</p>
              <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>Tap mic to start</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload call recording file uploader */}
      <div style={{ marginBottom: 16 }}>
        <input 
          type="file" 
          accept="audio/*" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
        />
        <button 
          onClick={() => fileInputRef.current?.click()} 
          disabled={uploadingFile}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 13 }}
        >
          {uploadingFile ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><Plus size={16} /> Upload Call Recording File</>}
        </button>
      </div>

      {/* Recordings list */}
      {recordings.length > 0 ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {recordings.map(r => (
            <div key={r._id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--surface)', borderRadius:10, border:'1px solid var(--border)' }}>
              <button
                onClick={() => togglePlay(r._id, `${BASE}/uploads/recordings/${r.filename}`)}
                style={{ width:36, height:36, borderRadius:'50%', background:'var(--accent)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
              >
                {playingId === r._id ? <Pause size={16} color="white" /> : <Play size={16} color="white" />}
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {r.originalName || r.filename}
                </p>
                <p style={{ margin:0, fontSize:11, color:'var(--text-muted)' }}>{format(new Date(r.createdAt), 'dd MMM, h:mm a')}</p>
              </div>
              <button onClick={() => deleteRecording(r._id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', padding:4 }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'12px 0' }}>No recordings yet</p>
      )}
    </div>
  );
}

function TemplatePickerModal({ lead, waStatus, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data)).finally(() => setLoading(false));
  }, []);

  const sendTemplate = async (template) => {
    const text = mergeTemplate(template.text, lead);
    
    // Check if we can send directly
    if (waStatus?.status === 'connected') {
      setSendingId(template._id);
      try {
        await api.post('/whatsapp/send-media', {
          to: lead.phone,
          text,
          image: template.imageFile?.url,
          video: template.videoFile?.url,
          document: template.docFile?.url
        });
        api.post(`/templates/${template._id}/use`).catch(() => {});
        toast.success('Sent directly via linked WhatsApp! 🚀');
        onClose();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to send directly');
      } finally {
        setSendingId(null);
      }
    } else {
      // Fallback
      if (template.imageFile || template.videoFile || template.docFile) {
        toast.error('Connect your WhatsApp to send files directly. Sending text only.');
      }
      try {
        await api.post(`/leads/${lead._id}/track-message`);
        api.post(`/templates/${template._id}/use`).catch(() => {});
        window.open(waLink(lead.phone, text), '_blank');
        onClose();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to send template message');
      }
    }
  };

  const isConnected = waStatus?.status === 'connected';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize:18, fontWeight:700, margin: 0 }}>Choose Template</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        
        {/* Connection status header */}
        <div style={{ background: isConnected ? 'rgba(34,197,94,0.06)' : 'rgba(234,179,8,0.06)', border: `1px solid ${isConnected ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)'}`, borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            WhatsApp status: <strong style={{ color: isConnected ? 'var(--green)' : 'var(--yellow)' }}>{waStatus?.status || 'disconnected'}</strong>
          </span>
          {!isConnected && (
            <Link href="/whatsapp" onClick={onClose} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Link device →</Link>
          )}
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'24px 0' }}><div className="spinner" /></div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)' }}>
            <p>No templates yet.</p>
            <Link href="/templates" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:600 }} onClick={onClose}>Create templates →</Link>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight: '50dvh', overflowY: 'auto' }}>
            {templates.map(t => {
              const hasImage = !!t.imageFile;
              const hasVideo = !!t.videoFile;
              const hasDoc = !!t.docFile;

              return (
                <button
                  key={t._id}
                  disabled={sendingId !== null}
                  onClick={() => sendTemplate(t)}
                  style={{ width:'100%', textAlign:'left', padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', transition:'border-color 0.2s', position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                >
                  {sendingId === t._id && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="spinner" style={{ width: 20, height: 20 }} />
                    </div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', justifyContent: 'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t.title}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {hasImage && <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(99,102,241,0.2)', borderRadius: 3, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 1 }}><Image size={8} /> Image</span>}
                      {hasVideo && <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(234,179,8,0.2)', borderRadius: 3, color: '#eab308', display: 'flex', alignItems: 'center', gap: 1 }}><Video size={8} /> Video</span>}
                      {hasDoc && <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(34,197,94,0.2)', borderRadius: 3, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 1 }}><File size={8} /> Doc</span>}
                    </div>
                  </div>
                  <p style={{ margin:0, fontSize:12, color:'var(--text-muted)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{mergeTemplate(t.text, lead)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  
  // WhatsApp connection status
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', phone: null });

  useEffect(() => {
    if (!id || id === '[id]' || id === 'undefined') return;

    setLoading(true);
    // Get Lead
    api.get(`/leads/${id}`)
      .then(r => { setLead(r.data); setForm(r.data); })
      .catch(() => toast.error('Lead not found'))
      .finally(() => setLoading(false));

    // Get WhatsApp status
    api.get('/whatsapp/status')
      .then(r => setWaStatus(r.data))
      .catch(() => {});
  }, [id]);

  const saveLead = async () => {
    if (!form.followUpDate) return toast.error('Next follow-up date is mandatory');
    setSaving(true);
    try {
      const { data } = await api.put(`/leads/${id}`, {
        ...form,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        areasOfInterest: typeof form.areasOfInterest === 'string' ? form.areasOfInterest.split(',').map(t => t.trim()).filter(Boolean) : form.areasOfInterest
      });
      setLead(data);
      setForm(data);
      setEditing(false);
      toast.success('Saved ✅');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async () => {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.delete(`/leads/${id}`);
      toast.success('Deleted');
      router.replace('/dashboard');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/leads/${id}/notes`, { text: noteText });
      const { data } = await api.get(`/leads/${id}`);
      setLead(data);
      setNoteText('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleManualSend = async () => {
    try {
      await api.post(`/leads/${id}/track-message`);
      window.open(waLink(lead.phone), '_blank');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    }
  };

  if (loading) return (
    <div className="app-shell" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh' }}>
      <div className="spinner" />
    </div>
  );

  if (!lead) return null;

  const isConnected = waStatus.status === 'connected';

  return (
    <div className="app-shell">
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => router.back()} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text)', padding:4, display:'flex' }}>
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 style={{ fontSize:17, fontWeight:700, margin:0 }}>{lead.name}</h1>
              <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>{lead.phone}</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'8px', cursor:'pointer', color:'var(--text)', display:'flex' }}>
                  <Edit2 size={16} />
                </button>
                <button onClick={deleteLead} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px', cursor:'pointer', color:'var(--red)', display:'flex' }}>
                  <Trash2 size={16} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setForm(lead); }} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'8px', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
                  <X size={16} />
                </button>
                <button onClick={saveLead} disabled={saving} style={{ background:'var(--accent)', border:'none', borderRadius:10, padding:'8px 16px', cursor:'pointer', color:'white', display:'flex', alignItems:'center', gap:6, fontWeight:600, fontSize:13 }}>
                  {saving ? <div className="spinner" style={{ width:14, height:14 }} /> : <><Check size={14} /> Save</>}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          {/* Quick actions */}
          <div style={{ display:'flex', flexWrap: 'wrap', gap:8, marginBottom:20 }}>
            <a href={`tel:${lead.phone}`} className="btn btn-secondary" style={{ flex:1, gap:8 }}>
              <Phone size={16} /> Call
            </a>
            
            {isConnected ? (
              <button 
                onClick={() => setShowTemplates(true)} 
                className="btn btn-success" 
                style={{ flex:1.5, gap:8 }}
              >
                <MessageCircle size={16} /> Send Direct WA
              </button>
            ) : (
              <button 
                onClick={handleManualSend} 
                className="btn btn-secondary" 
                style={{ flex:1, gap:8, borderColor: 'rgba(34,197,94,0.3)', cursor: 'pointer' }}
              >
                <MessageCircle size={16} color="var(--green)" /> Send manual
              </button>
            )}

            {!isConnected && (
              <button onClick={() => setShowTemplates(true)} className="btn btn-primary" style={{ flex:1, gap:6, fontSize:13 }}>
                <Send size={14} /> Use Template
              </button>
            )}
          </div>

          {/* Connection status warning */}
          {!isConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '10px 14px', borderRadius: 12, marginBottom: 20 }}>
              <AlertTriangle size={18} color="var(--yellow)" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                WhatsApp not connected. Messages will open in the WhatsApp app.
              </p>
              <Link href="/whatsapp" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                Connect <ExternalLink size={12} />
              </Link>
            </div>
          )}

          {/* Status + Details */}
          <div className="card" style={{ marginBottom:16 }}>
            <p className="section-title" style={{ margin:'0 0 12px' }}>Lead Details</p>
            {editing ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={form.name || ''} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" type="tel" value={form.phone || ''} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input className="input" value={form.company || ''} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input className="input" value={form.location || ''} onChange={e => setForm(f => ({...f, location: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Profession</label>
                  <input className="input" value={form.profession || ''} onChange={e => setForm(f => ({...f, profession: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Budget</label>
                  <input className="input" value={form.budget || ''} onChange={e => setForm(f => ({...f, budget: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Project</label>
                  <input className="input" value={form.project || ''} onChange={e => setForm(f => ({...f, project: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Areas of Interest (comma separated)</label>
                  <input className="input" value={Array.isArray(form.areasOfInterest) ? form.areasOfInterest.join(', ') : (form.areasOfInterest || '')} onChange={e => setForm(f => ({...f, areasOfInterest: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tags (comma separated)</label>
                  <input className="input" value={Array.isArray(form.tags) ? form.tags.join(', ') : (form.tags || '')} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Follow-up Date</label>
                  <input className="input" type="datetime-local"
                    value={form.followUpDate ? new Date(form.followUpDate).toISOString().slice(0,16) : ''}
                    onChange={e => setForm(f => ({...f, followUpDate: e.target.value || null}))}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  ['Status', <span key="s" className={`badge badge-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>],
                  ['Company', lead.company || '—'],
                  ['Email', lead.email || '—'],
                  ['Source', lead.source || 'manual'],
                  ['Location', lead.location || '—'],
                  ['Profession', lead.profession || '—'],
                  ['Budget', lead.budget || '—'],
                  ['Project', lead.project || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p style={{ margin:0, fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>{label}</p>
                    <p style={{ margin:'2px 0 0', fontSize:14, fontWeight:500 }}>{val}</p>
                  </div>
                ))}
                {lead.followUpDate && (
                  <div style={{ gridColumn:'1/-1', padding:'8px 10px', background:'rgba(249,115,22,0.1)', borderRadius:8, display:'flex', alignItems:'center', gap:8 }}>
                    <Calendar size={14} color="#f97316" />
                    <p style={{ margin:0, fontSize:13, color:'#f97316' }}>Follow-up: {format(new Date(lead.followUpDate), 'dd MMM yyyy, h:mm a')}</p>
                  </div>
                )}
                {lead.areasOfInterest?.length > 0 && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <p style={{ margin:'0 0 6px', fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>Areas of Interest</p>
                    <div className="tag-list">
                      {lead.areasOfInterest.map(t => <span key={t} className="badge" style={{ background:'rgba(99,102,241,0.15)', color:'var(--accent)', fontSize:11, padding:'2px 8px', borderRadius:8 }}>{t}</span>)}
                    </div>
                  </div>
                )}
                {lead.tags?.length > 0 && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <p style={{ margin:'0 0 6px', fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>Tags</p>
                    <div className="tag-list">
                      {lead.tags.map(t => <span key={t} className="badge badge-tag">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Edit History Change Log */}
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="section-title" style={{ margin: '0 0 12px' }}>🕰️ Change Log History</p>
            {lead.editHistory && lead.editHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.editHistory.slice().reverse().map((h, i) => {
                  return (
                    <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Updated by Lead Owner</span>
                        <span>{format(new Date(h.updatedAt), 'dd MMM, h:mm a')}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {Object.keys(h.changes || {}).map(field => {
                          const c = h.changes[field];
                          return (
                            <p key={field} style={{ margin: 0, fontSize: 12 }}>
                              ✍️ <strong style={{ textTransform: 'capitalize' }}>{field}</strong> changed from <span style={{ color: 'var(--text-muted)' }}>"{String(c.old || 'none')}"</span> to <span style={{ color: 'var(--accent)', fontWeight: 500 }}>"{String(c.new || 'none')}"</span>
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', padding: '8px 0', margin: 0 }}>No edits made yet</p>
            )}
          </div>

          {/* Notes */}
          <div className="card" style={{ marginBottom:16 }}>
            <p className="section-title" style={{ margin:'0 0 12px' }}>📝 Notes History</p>

            {/* Add note */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <textarea
                className="input"
                placeholder="Add a note..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                style={{ flex:1, minHeight:60 }}
              />
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                style={{ width:48, background:'var(--accent)', border:'none', borderRadius:12, cursor:'pointer', color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
              >
                {addingNote ? <div className="spinner" style={{ width:16, height:16 }} /> : <Plus size={20} />}
              </button>
            </div>

            {/* Notes list */}
            {lead.notes?.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...lead.notes].reverse().map((n, i) => (
                  <div key={i} style={{ padding:'10px 12px', background:'var(--surface)', borderRadius:10, borderLeft:'3px solid var(--accent)' }}>
                    <p style={{ margin:0, fontSize:14, lineHeight:1.5 }}>{n.text}</p>
                    <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--text-muted)' }}>{format(new Date(n.createdAt), 'dd MMM, h:mm a')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)', padding:'8px 0' }}>No notes yet</p>
            )}
          </div>

          {/* Recordings */}
          <div className="card" style={{ marginBottom:16 }}>
            <RecordingSection leadId={id} />
          </div>
        </div>
      </div>

      {showTemplates && <TemplatePickerModal lead={lead} waStatus={waStatus} onClose={() => setShowTemplates(false)} />}
    </div>
  );
}
