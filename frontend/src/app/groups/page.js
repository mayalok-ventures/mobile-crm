// UI — CAMPAIGN POLLING ONLY:
// This page displays campaign status by polling the backend API.
// All actual campaign execution (sending messages, retries, delays) happens
// in the backend worker (workers/campaign.worker.js via BullMQ).
//
// ⚠️ HISTORY WARNING:
// This file previously contained a frontend campaign loop using window.open.
// That approach caused:
//   - Data loss when browser tab was closed mid-campaign
//   - No resumability after disconnection
//   - Pop-up blocker interference
//   - False "sent" logs when windows were blocked
//
// DO NOT move campaign logic back to the frontend. The correct flow is:
//   1. User clicks "Start Campaign" → POST /api/campaigns (creates job in BullMQ)
//   2. This page polls GET /api/campaigns/:id every 3s (status only)
//   3. Worker runs in backend, persists progress in MongoDB
//
// Any future developer who says "it's just a loop, let's simplify"
// is about to break the campaign system. This comment is your warning.
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { waLink } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { Users, Plus, MessageCircle, Trash2, ChevronRight, AlertTriangle, X, Check, Loader, Play, Pause } from 'lucide-react';

const BULK_MAX = 500;
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function CreateGroupModal({ leads, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'manual', tags: '', leadIds: [] });
  const [loading, setLoading] = useState(false);
  const [allLeads, setAllLeads] = useState(leads || []);
  const [leadsLoading, setLeadsLoading] = useState(!leads);

  useEffect(() => {
    if (!leads) {
      api.get('/leads?limit=50').then(r => setAllLeads(r.data.leads)).finally(() => setLeadsLoading(false));
    }
  }, [leads]);

  const toggle = (id) => setForm(f => ({
    ...f,
    leadIds: f.leadIds.includes(id) ? f.leadIds.filter(x => x !== id) : [...f.leadIds, id],
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Group name required');
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        tags: form.type === 'tag_based' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        leadIds: form.type === 'manual' ? form.leadIds : undefined,
      };
      const res = await api.post('/groups', payload);
      toast.success('Group created');
      onCreated(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Create Group</h2>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Group Name</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Warm Leads"
              required
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="label">Type</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setForm(f => ({ ...f, type: 'manual' }))}
              >
                Manual Select
              </button>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'tag_based' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setForm(f => ({ ...f, type: 'tag_based' }))}
              >
                Tag Based
              </button>
            </div>
          </div>

          {form.type === 'tag_based' ? (
            <div style={{ marginBottom: 14 }}>
              <label className="label">Tags (comma separated)</label>
              <input
                type="text"
                className="input"
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="vip, warm, web-inquiry"
              />
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <label className="label">Select Leads</label>
              {leadsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><div className="spinner" /></div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  {allLeads.map(l => (
                    <div
                      key={l._id}
                      onClick={() => toggle(l._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: 6,
                        backgroundColor: form.leadIds.includes(l._id) ? 'var(--primary-light)' : 'transparent',
                        marginBottom: 4
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.phone}</div>
                      </div>
                      {form.leadIds.includes(l._id) && <Check size={14} color="var(--primary)" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkSendModal({ group, onClose }) {
  const router = useRouter();
  const [name, setName] = useState(`${group.name} Campaign`);
  const [template, setTemplate] = useState(group.campaignTemplate || '');
  const [loading, setLoading] = useState(true);
  const [leadsCount, setLeadsCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/groups/${group._id}/leads`).then(r => {
      setLeadsCount(r.data.length);
    }).finally(() => setLoading(false));
  }, [group._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter campaign name');
    if (!template.trim()) return toast.error('Enter a message');
    
    setSubmitting(true);
    try {
      const response = await api.post('/campaigns', {
        groupId: group._id,
        name: name.trim(),
        template: template.trim(),
      });
      toast.success('Campaign launched successfully! 🎉');
      router.push(`/campaigns/${response.data._id}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Start Campaign — {group.name}</h2>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><div className="spinner" /></div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Campaign Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. July Promo"
                required
                disabled={submitting}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label">Message (use {'{name}'}, {'{phone}'})</label>
              <textarea
                className="input"
                placeholder="Hi {name}! ..."
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={5}
                disabled={submitting}
                required
              />
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              🎯 Will send to <strong style={{ color: 'var(--text)' }}>{leadsCount}</strong> leads in group <strong>{group.name}</strong> asynchronously via backend.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-full" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success btn-full"
                disabled={submitting || leadsCount === 0}
                style={{ flex: 2, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {submitting ? 'Launching...' : 'Launch Campaign'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [bulkGroup, setBulkGroup] = useState(null);

  const fetchGroups = () => {
    api.get('/groups').then(r => setGroups(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const deleteGroup = async (id) => {
    if (!confirm('Delete this group?')) return;
    try {
      await api.delete(`/groups/${id}`);
      setGroups(prev => prev.filter(g => g._id !== id));
      toast.success('Group deleted');
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="app-shell">
      <div className="page-header">
        <h1 className="page-title">Groups</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Group
        </button>
      </div>

      <div className="page-content">
        <div style={{ padding:'12px 14px', background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.15)', borderRadius:12, marginBottom:20, fontSize:13, color:'var(--text-muted)', display:'flex', gap:10, alignItems:'flex-start' }}>
          <MessageCircle size={16} color="#25D366" style={{ flexShrink:0, marginTop:1 }} />
          <span>Bulk send opens WhatsApp for each lead with a random <strong style={{color:'var(--text)'}}>2–5 second delay</strong> to avoid bans. Max <strong style={{color:'var(--text)'}}>50 per batch</strong>.</span>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner" /></div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No groups yet</h3>
            <p>Create groups to bulk send WhatsApp messages</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {groups.map(g => (
              <div key={g._id} className="card">
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Users size={20} color="var(--accent)" />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <p style={{ margin:0, fontWeight:600, fontSize:15 }}>{g.name}</p>
                      {g.campaignStatus && g.campaignStatus !== 'idle' && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          marginLeft: 8,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: g.campaignStatus === 'sending' ? 'rgba(99,102,241,0.15)' : g.campaignStatus === 'paused' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                          color: g.campaignStatus === 'sending' ? '#818cf8' : g.campaignStatus === 'paused' ? '#eab308' : '#22c55e',
                          textTransform: 'uppercase'
                        }}>
                          {g.campaignStatus}
                        </span>
                      )}
                    </div>
                    <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>
                      {g.type === 'tag_based' ? `Tags: ${g.tags.join(', ')}` : `${g.leadIds.length} leads`}
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      onClick={() => setBulkGroup(g)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.25)', borderRadius:10, cursor:'pointer', color:'#22c55e', fontSize:13, fontWeight:600 }}
                    >
                      <MessageCircle size={14} /> Send
                    </button>
                    <button onClick={() => deleteGroup(g._id)} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:8, cursor:'pointer', color:'var(--red)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={g => setGroups(prev => [g, ...prev])} />}
      {bulkGroup && (
        <BulkSendModal 
          group={bulkGroup} 
          onClose={() => {
            setBulkGroup(null);
            fetchGroups();
          }} 
        />
      )}

      <BottomNav active="groups" />
    </div>
  );
}
