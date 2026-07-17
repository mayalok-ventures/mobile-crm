'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import { MessageCircle, Play, Pause, XCircle, AlertTriangle, Eye, ChevronRight } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = () => {
    api.get('/campaigns')
      .then(r => setCampaigns(r.data))
      .catch(() => toast.error('Failed to load campaigns'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePause = async (id) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      toast.success('Campaign paused');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause campaign');
    }
  };

  const handleResume = async (id) => {
    try {
      await api.post(`/campaigns/${id}/resume`);
      toast.success('Campaign resumed');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume campaign');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campaign cancelled');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel campaign');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued': return { bg: 'rgba(234,179,8,0.1)', fg: '#eab308' };
      case 'running': return { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' };
      case 'paused': return { bg: 'rgba(249,115,22,0.1)', fg: '#f97316' };
      case 'completed': return { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e' };
      case 'cancelled': return { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' };
      default: return { bg: 'rgba(156,163,175,0.1)', fg: '#9ca3af' };
    }
  };

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <header className="header">
        <h1 className="title">Campaigns</h1>
        <p className="subtitle">Track and manage your asynchronous bulk messages</p>
      </header>

      <div style={{ marginTop: 16 }}>
        {loading && campaigns.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={48} />
            <h3>No campaigns found</h3>
            <p>Launch a campaign from the Groups tab to get started.</p>
            <Link href="/groups" className="btn btn-primary" style={{ marginTop: 12 }}>
              Go to Groups
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {campaigns.map(c => {
              const colors = getStatusColor(c.status);
              const progress = c.totalLeads > 0 ? Math.round((c.lastSentIndex + 1) / c.totalLeads * 100) : 0;

              return (
                <div key={c._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{c.name}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                        Created {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: colors.bg,
                      color: colors.fg,
                      textTransform: 'uppercase'
                    }}>
                      {c.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {c.template.length > 80 ? c.template.slice(0, 80) + '...' : c.template}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                      <strong>{c.lastSentIndex + 1} / {c.totalLeads} ({progress}%)</strong>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%`, background: colors.fg }} />
                    </div>
                  </div>

                  {c.status === 'failed' && c.error && (
                    <div style={{ display: 'flex', gap: 6, color: 'var(--red)', fontSize: 12, background: 'rgba(239,68,68,0.05)', padding: 8, borderRadius: 6 }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>Error: {c.error}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <Link href={`/campaigns/${c._id}`} className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Eye size={14} /> View Logs
                    </Link>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {c.status === 'running' || c.status === 'queued' ? (
                        <button onClick={() => handlePause(c._id)} className="btn btn-ghost" style={{ color: 'var(--orange)', borderColor: 'rgba(249,115,22,0.2)', padding: '6px 10px' }}>
                          <Pause size={14} /> Pause
                        </button>
                      ) : c.status === 'paused' ? (
                        <button onClick={() => handleResume(c._id)} className="btn btn-ghost" style={{ color: 'var(--green)', borderColor: 'rgba(34,197,94,0.2)', padding: '6px 10px' }}>
                          <Play size={14} /> Resume
                        </button>
                      ) : null}

                      {(c.status === 'running' || c.status === 'queued' || c.status === 'paused') && (
                        <button onClick={() => handleCancel(c._id)} className="btn btn-ghost" style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)', padding: '6px 10px' }}>
                          <XCircle size={14} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="campaigns" />
    </div>
  );
}
