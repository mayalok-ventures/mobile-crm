'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import { MessageCircle, CheckCircle2, AlertCircle, RefreshCw, XCircle, Copy, HelpCircle } from 'lucide-react';

const COUNTRIES = [
  { code: 'IN', name: '🇮🇳 India (+91)', prefix: '91', digits: 10 },
  { code: 'US', name: '🇺🇸 US/Canada (+1)', prefix: '1', digits: 10 },
  { code: 'GB', name: '🇬🇧 United Kingdom (+44)', prefix: '44', digits: 10 },
  { code: 'AE', name: '🇦🇪 UAE (+971)', prefix: '971', digits: 9 },
  { code: 'SA', name: '🇸🇦 Saudi Arabia (+966)', prefix: '966', digits: 9 },
  { code: 'OTHER', name: '🌐 Other (Custom prefix)', prefix: '', digits: null }
];

export default function WhatsAppConnectPage() {
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [localNumber, setLocalNumber] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');
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
          setPairingCode(data.pairingCode || '');
        }
      } catch (err) {
        if (active) setStatusLoading(false);
      }
    };

    checkStatus();
    // Poll every 8s — frequent enough to catch status changes without hitting rate limits (429)
    const interval = setInterval(checkStatus, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    
    const country = COUNTRIES.find(c => c.code === selectedCountry);
    const prefix = selectedCountry === 'OTHER' ? customPrefix.replace(/\D/g, '') : country.prefix;
    
    if (!prefix) return toast.error('Country code prefix is required');
    if (!localNumber) return toast.error('Phone number is required');

    // Indian phone validation
    if (selectedCountry === 'IN' && localNumber.replace(/\D/g, '').length !== 10) {
      return toast.error('Indian phone number must be exactly 10 digits');
    }

    const fullPhone = `${prefix}${localNumber.replace(/\D/g, '')}`;

    const attemptConnect = async (isRetry = false) => {
      try {
        const { data } = await api.post('/whatsapp/connect', { phoneNumber: fullPhone });
        setPairingCode(data.pairingCode);
        toast.success('Pairing code ready! Enter it in WhatsApp 📲');
        return true;
      } catch (err) {
        const isNetworkError = !err.response; // no HTTP response = connection reset / server down
        const isHttpError = !!err.response;   // got a real HTTP response

        if (isNetworkError && !isRetry) {
          // First attempt failed with network error — wait 2.5s and retry once.
          // This handles the case where the server was momentarily restarting.
          toast.loading('Connection interrupted. Retrying in 2 seconds...', { id: 'wa-retry', duration: 3000 });
          await new Promise(r => setTimeout(r, 2500));
          toast.dismiss('wa-retry');
          return await attemptConnect(true); // single retry
        }

        // Final failure — show helpful message based on error type
        if (isNetworkError) {
          toast.error('Cannot reach server. Check your connection and try again.');
        } else {
          toast.error(err.response?.data?.message || 'Failed to generate pairing code');
        }
        return false;
      }
    };

    setLoading(true);
    setPairingCode('');
    try {
      await attemptConnect();
    } finally {
      setLoading(false); // always re-enable button so user can retry manually
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

  const handleEditNumber = async () => {
    setLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      setPairingCode('');
      setStatus({ status: 'disconnected', phone: null, pairingCode: null });
      toast.success('Ready to edit phone number! ✏️');
    } catch (err) {
      toast.error('Failed to reset connection');
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
              {/* Connected State */}
              {status.status === 'connected' && (
                <div className="card" style={{ marginBottom: 24, padding: 20, borderLeft: '4px solid var(--green)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MessageCircle size={24} color="var(--green)" />
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Connection Status</span>
                    </div>
                    <span className="badge badge-closed">Connected</span>
                  </div>
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
              )}

              {/* Connecting State */}
              {status.status === 'connecting' && (
                <div className="card" style={{ marginBottom: 24, padding: 20, borderLeft: '4px solid var(--yellow)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MessageCircle size={24} color="var(--yellow)" />
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Connecting Device</span>
                    </div>
                    <span className="badge badge-follow_up">Connecting</span>
                  </div>

                  {!pairingCode ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <RefreshCw className="spinner" size={32} color="var(--yellow)" style={{ marginBottom: 12, display: 'inline-block' }} />
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Generating Pairing Code...</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        Requesting secure credentials for +{status.phone}
                      </p>
                    </div>
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

                      <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 12, padding: 12, textAlign: 'left', marginBottom: 16 }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)' }}>
                          <AlertCircle size={15} />
                          WhatsApp Security Notice:
                        </h4>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: '1.4' }}>
                          WhatsApp might display a warning saying <strong>&quot;This may be a scam&quot;</strong> when pairing. This is a standard safety prompt shown by WhatsApp for all custom server linkages. Since this is your official CRM workspace, it is safe to proceed.
                        </p>
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
                        onClick={handleEditNumber}
                        disabled={loading}
                        className="btn btn-secondary btn-full btn-sm"
                        style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        ✏️ Edit Phone Number / Start Over
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Disconnected State */}
              {status.status === 'disconnected' && (
                <div className="card" style={{ marginBottom: 24, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <MessageCircle size={24} color="var(--text-muted)" />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Link WhatsApp Account</span>
                  </div>
                  
                  <form onSubmit={handleConnect}>
                    <div style={{ marginBottom: 16 }}>
                      <label className="label">Select Country</label>
                      <select
                        value={selectedCountry}
                        onChange={(e) => {
                          setSelectedCountry(e.target.value);
                          setLocalNumber('');
                        }}
                        className="input"
                        style={{ marginBottom: 12, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px' }}
                        disabled={loading}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      {selectedCountry === 'OTHER' && (
                        <div style={{ marginBottom: 12 }}>
                          <label className="label">Custom Country Prefix Code</label>
                          <input
                            type="tel"
                            placeholder="e.g. 971"
                            value={customPrefix}
                            onChange={(e) => setCustomPrefix(e.target.value.replace(/\D/g, ''))}
                            className="input"
                            required
                            disabled={loading}
                          />
                        </div>
                      )}

                      <label className="label">WhatsApp Number</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          padding: '10px 12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap'
                        }}>
                          +{selectedCountry === 'OTHER' ? (customPrefix || '?') : COUNTRIES.find(c => c.code === selectedCountry).prefix}
                        </span>
                        <input
                          type="tel"
                          placeholder={selectedCountry === 'IN' ? "10-digit mobile number" : "Mobile number"}
                          value={localNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (selectedCountry === 'IN' && val.length > 10) return;
                            setLocalNumber(val);
                          }}
                          maxLength={selectedCountry === 'IN' ? 10 : 15}
                          className="input"
                          style={{ flex: 1 }}
                          required
                          disabled={loading}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'block' }}>
                        {selectedCountry === 'IN' ? '🇮🇳 Enter exactly 10 digits without +91 or leading 0' : 'Enter mobile number without country prefix'}
                      </span>
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary btn-full">
                      {loading ? <RefreshCw className="spinner" size={18} style={{ display: 'inline-block' }} /> : 'Generate Pairing Code'}
                    </button>
                  </form>
                </div>
              )}

              {/* Info Card */}
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
