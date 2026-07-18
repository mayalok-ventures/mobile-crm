import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import NotificationPoller from '@/components/NotificationPoller';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'SalesCRM — Mobile Sales Tool',
  description: 'Fast, lightweight CRM for individual sales professionals. Manage leads, send WhatsApp follow-ups, and close deals on the go.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SalesCRM',
  },
};

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        {children}
        <NotificationPoller />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            },
          }}
        />
      </body>
    </html>
  );
}
