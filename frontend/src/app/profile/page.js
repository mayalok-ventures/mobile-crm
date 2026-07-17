'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import {
  User, Shield, Link2, Copy, LogOut, Star, ToggleLeft, ToggleRight, ChevronRight, Package, MessageCircle
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [togglingShare, setTogglingShare] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    const u = getUser();
    setUser(u);
    api.get('/auth/me').then(r => {
      setUser(r.data);
      setShareToken(r.data.shareToken);
      setShareEnabled(r.data.shareTokenEnabled);
    }).catch(() => {});
  }, []);

  const toggleShare = async () => {
    setTogglingShare(true);
    try {
      const { data } = await api.post('/auth/share-token');
      setShareEnabled(data.enabled);
      setShareToken(data.shareToken);
      toast.success(data.enabled ? 'Share link enabled ✅' : 'Share link disabled');
    } catch {
      toast.error('Failed');
    } finally {
      setTogglingShare(false);
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied! 📋');
  };

  const logout = () => {
    clearAuth();
    router.replace('/login');
  };

  const PLAN_COLORS = { free: '#94a3b8', starter: '#6366f1', pro: '#f59e0b', enterprise: '#22c55e' };

  return (
    <div className="app-shell">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div className="page-content">
        {/* User info */}
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), #8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'white' }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <p style={{ margin:0, fontSize:18, fontWeight:700 }}>{user?.name || '—'}</p>
              <p style={{ margin:0, fontSize:13, color:'var(--text-muted)' }}>{user?.email || user?.phone || '—'}</p>
            </div>
          </div>

          {/* Plan badge */}
          <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(99,102,241,0.08)', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
            <Package size={16} color={PLAN_COLORS[user?.plan] || 'var(--accent)'} />
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:600, textTransform:'capitalize', color: PLAN_COLORS[user?.plan] || 'var(--accent)' }}>
                {user?.plan || 'Free'} Plan
              </p>
              {user?.plan === 'free' && (
                <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>Upgrade to unlock all features</p>
              )}
            </div>
            {user?.plan === 'free' && (
              <button onClick={() => router.push('/plans')} className="btn btn-primary btn-sm" style={{ marginLeft:'auto' }}>
                <Star size={12} /> Upgrade
              </button>
            )}
          </div>
        </div>

        {/* Share dashboard */}
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: shareEnabled && shareToken ? 12 : 0 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Link2 size={18} color="var(--accent)" />
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontWeight:600, fontSize:14 }}>Share Dashboard</p>
              <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>Generate a read-only link for clients</p>
            </div>
            <button onClick={toggleShare} disabled={togglingShare} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text)', padding:4 }}>
              {shareEnabled ? <ToggleRight size={28} color="var(--accent)" /> : <ToggleLeft size={28} color="var(--text-muted)" />}
            </button>
          </div>
          {shareEnabled && shareToken && (
            <div style={{ display:'flex', gap:8 }}>
              <input
                readOnly
                value={`${origin}/share/${shareToken}`}
                className="input"
                style={{ fontSize:12, height:40, minHeight:40 }}
              />
              <button onClick={copyShareLink} className="btn btn-ghost btn-sm" style={{ flexShrink:0, height:40 }}>
                <Copy size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Menu items */}
        <div className="card" style={{ marginBottom:16, padding:0, overflow:'hidden' }}>
          {[
            { icon: MessageCircle, label: 'WhatsApp Connect', color:'var(--green)', action: () => router.push('/whatsapp') },
            { icon: Star, label: 'Upgrade Plan', color:'#f59e0b', action: () => router.push('/plans') },
            { icon: Shield, label: 'Admin Panel', color:'var(--accent)', action: () => router.push('/admin'), show: user?.isAdmin },
          ].filter(i => i.show !== false).map((item, i, arr) => {
            const Icon = item.icon;
            return (
              <button key={i} onClick={item.action} style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'none', border:'none', cursor:'pointer', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', textAlign:'left' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${item.color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={16} color={item.color} />
                </div>
                <span style={{ flex:1, fontSize:14, color:'var(--text)', fontWeight:500 }}>{item.label}</span>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <button onClick={logout} className="btn btn-full" style={{ background:'rgba(239,68,68,0.1)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.25)', gap:8 }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
