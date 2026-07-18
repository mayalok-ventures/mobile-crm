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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued': return { bg: 'rgba(234,179,8,0.1)', fg: '#eab308' };
      case 'running': return { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' };
      case 'paused': return { bg: 'rgba(249,115,22,0.1)', fg: '#f97316' };
      case 'completed': return { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e' };
      case 'cancelled': return { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' };
      default: return { bg: 'rgba(148,163,184,0.1)', fg: '#94a3b8' };
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.template.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'running').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
  };

  return (
    <div className="app-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Track and manage your bulk WhatsApp broadcasts</p>
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: 80 }}>
        {/* Statistics Panel */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 90 }}>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 90 }}>
            <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.active}</div>
            <div className="stat-label">Sending</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 90 }}>
            <div className="stat-value" style={{ color: '#22c55e' }}>{stats.completed}</div>
            <div className="stat-label">Done</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 90 }}>
            <div className="stat-value" style={{ color: '#f97316' }}>{stats.paused}</div>
            <div className="stat-label">Paused</div>
          </div>
        </div>

        {/* Search & Filter bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div className="search-bar">
            <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ border: 'none', padding: 0 }}
            />
          </div>

          <div className="filter-chips">
            {[
              { id: '', label: 'All Campaigns' },
              { id: 'running', label: '⚡ Sending' },
              { id: 'paused', label: '⏸️ Paused' },
              { id: 'completed', label: '✅ Completed' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setStatusFilter(t.id)}
                className={`chip ${statusFilter === t.id ? 'active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading && campaigns.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="empty-state">
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--accent)' }}>
              <MessageCircle size={32} />
            </div>
            <h3>No campaigns found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              {search || statusFilter ? 'Try clearing your filters or search query.' : 'Launch a campaign from the Groups tab to get started.'}
            </p>
            {!search && !statusFilter && (
              <Link href="/groups" className="btn btn-primary">
                Go to Groups
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredCampaigns.map(c => {
              const colors = getStatusColor(c.status);
              const progress = c.totalLeads > 0 ? Math.round((c.lastSentIndex + 1) / c.totalLeads * 100) : 0;

              return (
                <div key={c._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{c.name}</h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                        📅 {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: colors.bg,
                      color: colors.fg,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}>
                      {c.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, background: 'var(--surface)', padding: 10, borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                    {c.template.length > 90 ? c.template.slice(0, 90) + '...' : c.template}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sent Progress</span>
                      <strong>{c.lastSentIndex + 1} / {c.totalLeads} ({progress}%)</strong>
                    </div>
                    <div className="progress-bar" style={{ height: 6, background: 'var(--border)' }}>
                      <div className="progress-fill" style={{ width: `${progress}%`, background: colors.fg }} />
                    </div>
                  </div>

                  {c.status === 'failed' && c.error && (
                    <div style={{ display: 'flex', gap: 6, color: 'var(--red)', fontSize: 11, background: 'rgba(239,68,68,0.05)', padding: 8, borderRadius: 6, border: '1px solid rgba(239,68,68,0.1)' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>Error: {c.error}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <Link href={`/campaigns/${c._id}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={13} /> View Log details
                    </Link>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {c.status === 'running' || c.status === 'queued' ? (
                        <button onClick={() => handlePause(c._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--orange)', borderColor: 'rgba(249,115,22,0.2)', padding: '6px 10px' }}>
                          <Pause size={13} /> Pause
                        </button>
                      ) : c.status === 'paused' ? (
                        <button onClick={() => handleResume(c._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--green)', borderColor: 'rgba(34,197,94,0.2)', padding: '6px 10px' }}>
                          <Play size={13} /> Resume
                        </button>
                      ) : null}

                      {(c.status === 'running' || c.status === 'queued' || c.status === 'paused') && (
                        <button onClick={() => handleCancel(c._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)', padding: '6px 10px' }}>
                          <XCircle size={13} /> Cancel
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
