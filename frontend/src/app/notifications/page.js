'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Bell, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data.notifications || [])).finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="app-shell">
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text)', padding:4 }}>←</button>
          <h1 className="page-title">Notifications</h1>
        </div>
        {notifications.some(n => !n.isRead) && (
          <button onClick={markAllRead} className="btn btn-ghost btn-sm">
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner" /></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={48} />
            <h3>No notifications</h3>
            <p>Follow-up reminders will appear here</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {notifications.map(n => (
              <Link key={n._id} href={`/leads/${n.leadId}`} style={{ textDecoration:'none' }}>
                <div style={{ padding:'12px 14px', background: n.isRead ? 'var(--card)' : 'rgba(99,102,241,0.08)', border:`1px solid ${n.isRead ? 'var(--border)' : 'rgba(99,102,241,0.3)'}`, borderRadius:12 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    {!n.isRead && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', marginTop:5, flexShrink:0 }} />}
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:14, fontWeight: n.isRead ? 400 : 600 }}>{n.message}</p>
                      <p style={{ margin:'4px 0 0', fontSize:11, color:'var(--text-muted)' }}>{format(new Date(n.createdAt), 'dd MMM, h:mm a')}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
