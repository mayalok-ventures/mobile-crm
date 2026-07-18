'use client';
import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // Native window redirect is significantly faster than Next.js router hydration on slow mobile devices
    const token = localStorage.getItem('token');
    if (token) {
      window.location.replace('/dashboard');
    } else {
      window.location.replace('/login');
    }
  }, []);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if (localStorage.getItem('token')) {
              window.location.replace('/dashboard');
            } else {
              window.location.replace('/login');
            }
          `,
        }}
      />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: 'var(--bg)',
      }}>
        <div className="spinner" />
      </div>
    </>
  );
}
