'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Users, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS = { new: 'New', contacted: 'Contacted', follow_up: 'Follow-up', closed: 'Closed' };

export default function ShareDashboardPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/share/${token}`).then(r => setData(r.data)).catch(e => setError(e.response?.data?.message || 'Invalid link')).finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="app-shell" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh' }}>
      <div className="spinner" />
    </div>
  );

  if (error) return (
    <div className="app-shell" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', padding:24, textAlign:'center' }}>
      <Users size={48} style={{ opacity:0.3, marginBottom:16 }} />
      <h2>Link Invalid or Expired</h2>
      <p style={{ color:'var(--text-muted)' }}>{error}</p>
    </div>
  );

  const { owner, leads, stats } = data;

  return (
    <div className="app-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{owner.name}'s Leads</h1>
          <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>👁️ Read-only shared view</p>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
          {Object.entries(stats).map(([status, count]) => (
            <div key={status} className="stat-card">
              <div className={`stat-value`} style={{ fontSize:24, color: status === 'closed' ? 'var(--green)' : status === 'follow_up' ? '#f97316' : 'var(--accent)' }}>{count}</div>
              <div className="stat-label">{STATUS_LABELS[status]}</div>
            </div>
          ))}
        </div>

        <p className="section-title">Leads ({leads.length})</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {leads.map(lead => (
            <div key={lead._id} className="card">
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div className="avatar">{lead.name.charAt(0)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <p style={{ margin:0, fontWeight:600, fontSize:15 }}>{lead.name}</p>
                    <span className={`badge badge-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
                  </div>
                  {lead.company && <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>{lead.company}</p>}
                  {lead.tags?.length > 0 && (
                    <div className="tag-list" style={{ marginTop:4 }}>
                      {lead.tags.slice(0,3).map(t => <span key={t} className="badge badge-tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
