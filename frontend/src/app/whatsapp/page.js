'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import { MessageCircle, CheckCircle2, AlertCircle, RefreshCw, XCircle, Copy, HelpCircle } from 'lucide-react';

export default function WhatsAppConnectPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [status, setStatus] = useState({ status: 'disconnected', phone: null, pairingCode: null });
  const [statusLoading, setStatusLoading] = useState(true);

  // Poll connection status
  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      try {
        const { data } = await api.get('/whatsapp/status');
        if (active) {
          setStatus(data);
          setStatusLoading(false);
          if (data.pairingCode) {
            setPairingCode(data.pairingCode);
          }
        }
      } catch (err) {
        if (active) setStatusLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!phone) return toast.error('Phone number is required');

    setLoading(true);
    setPairingCode('');
    try {
      const { data } = await api.post('/whatsapp/connect', { phoneNumber: phone });
      setPairingCode(data.pairingCode);
      toast.success('Pairing code requested successfully! 📲');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate pairing code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your WhatsApp?')) return;
    setLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      setPairingCode('');
      setStatus({ status: 'disconnected', phone: null, pairingCode: null });
      toast.success('Disconnected successfully');
    } catch (err) {
      toast.error('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    toast.success('Code copied to clipboard! 📋');
  };

  return (
    <div className="app-shell">
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">WhatsApp Integration</h1>
        </div>

        <div className="page-content" style={{ maxWidth: 600 }}>
          {statusLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spinner" />
            </div>
          ) : (
            <div>
              {/* Connection Status Card */}
              <div className="card" style={{ marginBottom: 24, padding: 20, borderLeft: `4px solid ${status.status === 'connected' ? 'var(--green)' : status.status === 'connecting' ? 'var(--yellow)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MessageCircle size={24} color={status.status === 'connected' ? 'var(--green)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Connection Status</span>
                  </div>
                  <span className={`badge badge-${status.status === 'connected' ? 'closed' : status.status === 'connecting' ? 'follow_up' : 'new'}`}>
                    {status.status}
                  </span>
                </div>

                {status.status === 'connected' ? (
                  <div>
                    <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-muted)' }}>
                      Connected to WhatsApp account: <strong style={{ color: 'var(--text)' }}>+{status.phone}</strong>
                    </p>
                    <button
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="btn btn-danger btn-full btn-sm"
                      style={{ gap: 8 }}
                    >
                      <XCircle size={16} /> Disconnect WhatsApp
                    </button>
                  </div>
                ) : status.status === 'connecting' ? (
                  <div>
                    <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-muted)' }}>
                      Connecting with phone number: <strong style={{ color: 'var(--text)' }}>+{status.phone}</strong>
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(234,179,8,0.1)', padding: 12, borderRadius: 10, border: '1px solid rgba(234,179,8,0.2)', marginBottom: 16 }}>
                      <RefreshCw className="spinner" size={16} color="var(--yellow)" />
                      <span style={{ fontSize: 13, color: '#eab308' }}>Waiting for link confirmation from your phone...</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                      Link your WhatsApp directly without using wa.me redirects.
                    </p>
                  </div>
                )}
              </div>

              {/* Main Connect Action */}
              {status.status !== 'connected' && (
                <div className="card" style={{ marginBottom: 24, padding: 20 }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700 }}>Link a Device</h3>
                  
                  {!pairingCode ? (
                    <form onSubmit={handleConnect}>
                      <div style={{ marginBottom: 16 }}>
                        <label className="label">WhatsApp Phone Number</label>
                        <input
                          type="tel"
                          placeholder="e.g. 918796475107 (with country code)"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          className="input"
                          required
                          disabled={loading}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          Include country code without + or spaces (e.g., 91 for India, 1 for US)
                        </span>
                      </div>

                      <button type="submit" disabled={loading} className="btn btn-primary btn-full">
                        {loading ? <RefreshCw className="spinner" size={18} /> : 'Generate Pairing Code'}
                      </button>
                    </form>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                        Enter this code on your WhatsApp mobile app:
                      </p>
                      
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 24px', borderRadius: 12, marginBottom: 16 }}>
                        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, fontFamily: 'monospace', color: 'var(--accent-light)' }}>
                          {pairingCode}
                        </span>
                        <button onClick={copyCode} className="btn btn-ghost btn-sm" style={{ padding: 8, minHeight: 'auto' }}>
                          <Copy size={16} />
                        </button>
                      </div>

                      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, textAlign: 'left', marginTop: 12 }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <HelpCircle size={16} color="var(--accent)" />
                          How to enter the code:
                        </h4>
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <li>Open WhatsApp on your phone</li>
                          <li>Go to <strong>Settings</strong> or <strong>Menu</strong> &gt; <strong>Linked Devices</strong></li>
                          <li>Tap <strong>Link a Device</strong></li>
                          <li>Select <strong>Link with phone number instead</strong> at the bottom</li>
                          <li>Enter the code shown above</li>
                        </ol>
                      </div>

                      <button
                        onClick={() => { setPairingCode(''); setPhone(''); }}
                        className="btn btn-secondary btn-full btn-sm"
                        style={{ marginTop: 16 }}
                      >
                        Start Over
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* WhatsApp features alert */}
              <div style={{ padding: 16, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, display: 'flex', gap: 12 }}>
                <CheckCircle2 size={20} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>Why link your WhatsApp?</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Send messages instantly from the web app with no redirect pages.</li>
                    <li>Supports bulk campaigns and automation directly.</li>
                    <li>Attach actual images, videos, and PDF files.</li>
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      <BottomNav active="whatsapp" />
    </div>
  );
}
