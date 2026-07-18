'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Plus, Search, Bell, MessageCircle, Calendar,
  User, ChevronRight, Filter, X, ShieldAlert, CheckCircle, Volume2, Mic, AlertTriangle, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS = { new: 'New', contacted: 'Contacted', follow_up: 'Follow-up', closed: 'Closed' };

function UpgradeModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', padding: '24px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', marginBottom: 16 }}>
          <ShieldAlert size={32} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Lead Limit Reached</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, margin: '0 0 20px' }}>
          You have saved 10 leads on your free account. Upgrade to a paid plan now to save unlimited leads, send bulk WhatsApp broadcasts, and access full analytics.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/plans" className="btn btn-primary btn-full" style={{ justifyContent: 'center', textDecoration: 'none', gap: 8 }} onClick={onClose}>
            View Premium Plans <ArrowRight size={16} />
          </Link>
          <button className="btn btn-ghost btn-full" onClick={onClose}>Maybe Later</button>
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onCreated, onLimitReached }) {
  const [form, setForm] = useState({ 
    name: '', phone: '', company: '', tags: '', status: 'new', followUpDate: '',
    location: '', profession: '', budget: '', areasOfInterest: '', project: ''
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error('Name and phone are required');
    if (!form.followUpDate) return toast.error('Next follow-up date is mandatory to schedule');
    
    setLoading(true);
    try {
      const { data } = await api.post('/leads', {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        areasOfInterest: form.areasOfInterest ? form.areasOfInterest.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      toast.success('Lead added ✅');
      onCreated(data);
      onClose();
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === 'LIMIT_REACHED') {
        onClose();
        onLimitReached();
      } else {
        toast.error(err.response?.data?.message || 'Failed to add lead');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85dvh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Add New Lead</h2>
        <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="label">Name *</label>
            <input className="input" placeholder="Lead name" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input className="input" type="tel" placeholder="+91 9999999999" value={form.phone} onChange={set('phone')} inputMode="tel" required />
          </div>
          <div>
            <label className="label">Next Follow-up Date *</label>
            <input className="input" type="datetime-local" value={form.followUpDate} onChange={set('followUpDate')} required style={{ borderColor: form.followUpDate ? 'var(--border)' : 'var(--red)' }} />
            {!form.followUpDate && <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠️ Next follow-up is mandatory</span>}
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingPoint: '8px 0', marginTop: 4 }}>
            <p style={{ margin: '8px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Additional Details (Optional)</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Location</label>
              <input className="input" placeholder="e.g. Mumbai" value={form.location} onChange={set('location')} />
            </div>
            <div>
              <label className="label">Profession</label>
              <input className="input" placeholder="e.g. Doctor" value={form.profession} onChange={set('profession')} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Budget</label>
              <input className="input" placeholder="e.g. 50L - 75L" value={form.budget} onChange={set('budget')} />
            </div>
            <div>
              <label className="label">Project of Interest</label>
              <input className="input" placeholder="e.g. Sunrise Apts" value={form.project} onChange={set('project')} />
            </div>
          </div>
          <div>
            <label className="label">Areas of Interest (comma separated)</label>
            <input className="input" placeholder="3BHK, Balcony, Sea view" value={form.areasOfInterest} onChange={set('areasOfInterest')} />
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" placeholder="Company name" value={form.company} onChange={set('company')} />
          </div>
          <div>
            <label className="label">Tags (comma separated)</label>
            <input className="input" placeholder="vip, hot, referral" value={form.tags} onChange={set('tags')} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="follow_up">Follow-up</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:10 }}>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <div className="spinner" style={{ width:18, height:18 }} /> : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PermissionPromptBar({ onGranted }) {
  const [micState, setMicState] = useState('prompt');
  const [notifState, setNotifState] = useState('prompt');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check Notification permission
    if (typeof window !== 'undefined') {
      setNotifState(Notification.permission);
      
      // Check Mic permission
      navigator.permissions?.query({ name: 'microphone' }).then(res => {
        setMicState(res.state);
        if (Notification.permission !== 'granted' || res.state !== 'granted') {
          setVisible(true);
        }
      }).catch(() => {
        setVisible(Notification.permission !== 'granted');
      });
    }
  }, []);

  const requestAll = async () => {
    try {
      // 1. Notification permission
      const notifPerm = await Notification.requestPermission();
      setNotifState(notifPerm);

      // 2. Mic permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setMicState('granted');
      } catch (e) {
        setMicState('denied');
        console.warn('Microphone permission denied:', e);
      }

      // 3. Autoplay unlock
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);

      toast.success('Permissions updated successfully! 🚀');
      setVisible(false);
      if (onGranted) onGranted();
    } catch (err) {
      toast.error('Failed to configure permissions');
    }
  };

  if (!visible) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          <Volume2 size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Enable Voice & Follow-up Alerts</h4>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            We need <strong>Notification</strong> and <strong>Microphone</strong> permissions so we can sound alerts when follow-ups are due and allow you to record voice notes/call recordings directly.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={requestAll} className="btn btn-sm btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
              Grant Permissions
            </button>
            <button onClick={() => setVisible(false)} className="btn btn-sm btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [unread, setUnread] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/leads', { params });
      setLeads(data.leads);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchLeads(false); }, [fetchLeads]);

  useEffect(() => {
    api.get('/leads/follow-ups/today').then(r => setFollowUps(r.data)).catch(() => {});
    api.get('/notifications').then(r => setUnread(r.data.unreadCount || 0)).catch(() => {});
  }, []);

  const statusFilters = ['', 'new', 'contacted', 'follow_up', 'closed'];

  const isFreePlan = user?.plan === 'free';
  const leadLimitReached = isFreePlan && (pagination.total >= 10);

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">My Leads</h1>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/notifications" style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:40, height:40, borderRadius:10, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text-muted)', textDecoration:'none' }}>
            <Bell size={18} />
            {unread > 0 && <div className="notif-badge" />}
          </Link>
        </div>
      </div>

      <div className="page-content">
        {/* Permission setup prompt */}
        <PermissionPromptBar />

        {/* Lead Usage Limit Bar for Free Users */}
        {isFreePlan && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              <span>Free Plan Limit</span>
              <span style={{ color: leadLimitReached ? 'var(--red)' : 'var(--text-muted)' }}>{pagination.total || 0} / 5 Leads Used</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(((pagination.total || 0) / 5) * 100, 100)}%`, height: '100%', background: leadLimitReached ? 'var(--red)' : 'var(--accent)', borderRadius: 3 }} />
            </div>
            {leadLimitReached && (
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> Limit reached! Please upgrade to add more leads.
              </p>
            )}
          </div>
        )}

        {/* Today's Follow-ups */}
        {followUps.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <p className="section-title">📅 Today's Follow-ups ({followUps.length})</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {followUps.slice(0,3).map(lead => (
                <Link key={lead._id} href={`/leads/${lead._id}`} style={{ textDecoration:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:12 }}>
                    <Calendar size={16} color="#f97316" />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ margin:0, fontWeight:600, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.name}</p>
                      <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>{lead.phone}</p>
                    </div>
                    <a
                      href={waLink(lead.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, background:'rgba(37,211,102,0.15)', borderRadius:8, border:'none', cursor:'pointer', textDecoration:'none' }}
                    >
                      <MessageCircle size={16} color="#25D366" />
                    </a>
                  </div>
                </Link>
              ))}
              {followUps.length > 3 && (
                <p style={{ textAlign:'center', fontSize:13, color:'var(--text-muted)', margin:0 }}>+{followUps.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="search-bar" style={{ marginBottom:12 }}>
          <Search size={18} />
          <input
            className="input"
            type="search"
            placeholder="Search leads..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16} /></button>}
        </div>

        {/* Status filters */}
        <div className="filter-chips" style={{ marginBottom:16 }}>
          {statusFilters.map(s => (
            <button key={s} className={`chip ${statusFilter === s ? 'active' : ''}`} onClick={() => { setStatusFilter(s); setPage(1); }}>
              {s ? STATUS_LABELS[s] : 'All'}
            </button>
          ))}
        </div>

        {/* Lead list */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
            <div className="spinner" />
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <User size={48} />
            <h3>{search ? 'No results found' : 'No leads yet'}</h3>
            <p>{search ? 'Try a different search' : 'Tap + to add your first lead'}</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {leads.map(lead => (
              <Link key={lead._id} href={`/leads/${lead._id}`} className="lead-card" style={{ textDecoration:'none', color:'inherit' }}>
                <div className={`avatar`} style={{ background: lead.status === 'closed' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : lead.status === 'follow_up' ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                    <p style={{ margin:0, fontWeight:600, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.name}</p>
                    <span className={`badge badge-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
                  </div>
                  <p style={{ margin:0, fontSize:13, color:'var(--text-muted)' }}>{lead.phone}</p>
                  {lead.project && <p style={{ margin:0, fontSize:12, color:'var(--accent)', fontWeight: 500 }}>🎯 {lead.project}</p>}
                  {lead.followUpDate && (
                    <p style={{ margin:'4px 0 0', fontSize:11, color:'#f97316' }}>
                      📅 Follow-up: {format(new Date(lead.followUpDate), 'dd MMM, h:mm a')}
                    </p>
                  )}
                  {lead.tags?.length > 0 && (
                    <div className="tag-list" style={{ marginTop:4 }}>
                      {lead.tags.slice(0,3).map(t => <span key={t} className="badge badge-tag">{t}</span>)}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink:0, marginTop:4 }} />
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p-1)}>Prev</button>
            <span style={{ display:'flex', alignItems:'center', fontSize:13, color:'var(--text-muted)' }}>{page}/{pagination.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p+1)}>Next</button>
          </div>
        )}
      </div>

      {/* FAB */}
      <button 
        className="fab fab-right" 
        onClick={() => {
          if (leadLimitReached) {
            setShowUpgrade(true);
          } else {
            setShowAdd(true);
          }
        }} 
        aria-label="Add lead"
      >
        <Plus size={24} />
      </button>

      {showAdd && (
        <AddLeadModal 
          onClose={() => setShowAdd(false)} 
          onCreated={l => { setLeads(prev => [l, ...prev]); fetchLeads(true); }} 
          onLimitReached={() => setShowUpgrade(true)}
        />
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      <BottomNav active="dashboard" />
    </div>
  );
}
