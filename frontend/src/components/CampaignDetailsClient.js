'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import { ChevronLeft, RefreshCw, AlertTriangle, CheckCircle, XCircle, ArrowLeft, Pause, Play, Trash } from 'lucide-react';

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id;

  const [campaign, setCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchCampaign = async () => {
    try {
      const res = await api.get(`/campaigns/${campaignId}`);
      setCampaign(res.data);
    } catch (err) {
      toast.error('Failed to load campaign info');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (p = page) => {
    setLogsLoading(true);
    try {
      const res = await api.get(`/campaigns/${campaignId}/logs?page=${p}&limit=50`);
      setLogs(res.data.logs);
      setTotalLogs(res.data.total);
      setTotalPages(res.data.pages);
      setPage(res.data.page);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchCampaign();
      fetchLogs(1);
    }
  }, [campaignId]);

  // Poll progress when running or queued
  useEffect(() => {
    if (!campaign || !['running', 'queued'].includes(campaign.status)) return;
    const interval = setInterval(() => {
      fetchCampaign();
      fetchLogs(page);
    }, 4000);
    return () => clearInterval(interval);
  }, [campaign?.status, page]);

  const handlePause = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/pause`);
      toast.success('Campaign paused');
      fetchCampaign();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pause campaign');
    }
  };

  const handleResume = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/resume`);
      toast.success('Campaign resumed');
      fetchCampaign();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resume campaign');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success('Campaign cancelled');
      fetchCampaign();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel campaign');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container" style={{ padding: 20 }}>
        <div className="empty-state">
          <h3>Campaign not found</h3>
          <Link href="/campaigns" className="btn btn-ghost">
            Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  const progress = campaign.totalLeads > 0 ? Math.round((campaign.lastSentIndex + 1) / campaign.totalLeads * 100) : 0;

  return (
    <div className="app-shell">
      <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/campaigns" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} />
          </Link>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Campaigns / Details</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
          <div>
            <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>{campaign.name}</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Template: {campaign.template.length > 50 ? campaign.template.slice(0, 50) + '...' : campaign.template}
            </p>
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 6,
            background: campaign.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
            color: campaign.status === 'completed' ? '#22c55e' : '#eab308',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            {campaign.status}
          </span>
        </div>
      </div>

      <div className="page-content" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Overall Progress</span>
            <strong>{campaign.lastSentIndex + 1} / {campaign.totalLeads} ({progress}%)</strong>
          </div>
          <div className="progress-bar" style={{ height: 6, background: 'var(--border)' }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {['running', 'queued'].includes(campaign.status) ? (
              <button onClick={handlePause} className="btn btn-full btn-ghost" style={{ color: 'var(--orange)', borderColor: 'rgba(249,115,22,0.2)', fontSize: 13 }}>
                <Pause size={14} /> Pause
              </button>
            ) : campaign.status === 'paused' ? (
              <button onClick={handleResume} className="btn btn-full btn-ghost" style={{ color: 'var(--green)', borderColor: 'rgba(34,197,94,0.2)', fontSize: 13 }}>
                <Play size={14} /> Resume
              </button>
            ) : null}

            {['running', 'queued', 'paused'].includes(campaign.status) && (
              <button onClick={handleCancel} className="btn btn-full btn-ghost" style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)', fontSize: 13 }}>
                <XCircle size={14} /> Cancel
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Delivery Log ({totalLogs})</h3>
          <button onClick={() => fetchLogs(page)} className="btn btn-ghost" style={{ padding: 6, height: 'auto', minHeight: 'auto' }}>
            <RefreshCw size={13} className={logsLoading ? 'spin' : ''} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No delivery records yet.
            </div>
          ) : (
            logs.map(log => (
              <div key={log._id} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{log.number}</div>
                  {log.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{log.error}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: log.status === 'sent' ? 'rgba(34,197,94,0.1)' : log.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                    color: log.status === 'sent' ? '#22c55e' : log.status === 'failed' ? '#ef4444' : '#f97316',
                    textTransform: 'uppercase'
                  }}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button
              disabled={page === 1}
              onClick={() => fetchLogs(page - 1)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 12px' }}
            >
              Prev
            </button>
            <span style={{ fontSize: 12 }}>Page {page} of {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => fetchLogs(page + 1)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 12px' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <BottomNav active="campaigns" />
    </div>
  );
}
