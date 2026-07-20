'use client';
import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function NotificationPoller() {
  const router = useRouter();
  const lastSeenIdRef = useRef(null);
  const isFetchingRef = useRef(false);
  const timerRef = useRef(null);

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
    let backoffMs = 0; // extra delay added after 429/network errors

    const checkNotifications = async () => {
      const token = localStorage.getItem('token');
      if (!token || isFetchingRef.current) return;

      isFetchingRef.current = true;
      try {
        const { data } = await api.get('/notifications');
        backoffMs = 0; // reset backoff on success
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
                icon: '/android-chrome-192x192.png'
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
        if (err.response?.status === 429) {
          // Rate limited — back off exponentially, max 2 minutes
          backoffMs = Math.min((backoffMs || 15000) * 2, 120000);
        } else if (!err.response) {
          // Network error (server restarting, offline) — don't log, just wait
        } else if (err.response?.status === 401) {
          // Not logged in — stop polling silently
        } else {
          console.error('Notification poller check failed:', err);
        }
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Initialize first seen ID on mount/login
    checkNotifications();

    // Base interval 15s + any active backoff
    const poll = () => {
      const delay = 15000 + backoffMs;
      return setTimeout(async () => {
        await checkNotifications();
        timerRef.current = poll(); // reschedule after completion
      }, delay);
    };

    timerRef.current = poll();
    return () => clearTimeout(timerRef.current);
  }, [router]);

  return null;
}
