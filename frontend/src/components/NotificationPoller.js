'use client';
import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function NotificationPoller() {
  const router = useRouter();
  const lastSeenIdRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Play synthesized crisp notification tone (D5 then A5 notes) using Web Audio API oscillators
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // First Note: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      // Second Note: A5 (880 Hz) after a short delay
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880.00, ctx.currentTime);
          gain2.gain.setValueAtTime(0.3, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.5);
        } catch {}
      }, 150);

    } catch (e) {
      console.warn('Web Audio playback failed or blocked:', e.message);
    }
  };

  useEffect(() => {
    // Only check if logged in
    const checkNotifications = async () => {
      const token = localStorage.getItem('token');
      if (!token || isFetchingRef.current) return;

      isFetchingRef.current = true;
      try {
        const { data } = await api.get('/notifications');
        const notifications = data.notifications || [];
        
        if (notifications.length > 0) {
          const latest = notifications[0];
          
          // If we have a new notification that we haven't seen in this session
          if (lastSeenIdRef.current && latest._id !== lastSeenIdRef.current) {
            // Sound alarm!
            playAlertSound();

            // Native Browser Notification
            if (Notification.permission === 'granted') {
              new Notification('SalesCRM Reminder', {
                body: latest.message,
                icon: '/icons/icon-192x192.png'
              });
            }

            // Interactive hot toast
            toast((t) => (
              <div 
                onClick={() => {
                  toast.dismiss(t.id);
                  if (latest.leadId) router.push(`/leads/${latest.leadId}`);
                }}
                style={{ cursor: 'pointer' }}
              >
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>⏰ Follow-up Reminder</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{latest.message}</p>
              </div>
            ), { duration: 6000 });
          }

          // Update ref
          lastSeenIdRef.current = latest._id;
        }
      } catch (err) {
        console.error('Notification poller check failed:', err);
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Initialize first seen ID on mount/login
    checkNotifications();

    // Poll every 15 seconds
    const interval = setInterval(checkNotifications, 15000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
