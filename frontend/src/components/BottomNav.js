'use client';
import Link from 'next/link';
import { Home, FileText, Users, BarChart2, User, MessageCircle } from 'lucide-react';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home, key: 'dashboard' },
  { href: '/campaigns', label: 'Campaigns', icon: MessageCircle, key: 'campaigns' },
  { href: '/templates', label: 'Templates', icon: FileText, key: 'templates' },
  { href: '/groups', label: 'Groups', icon: Users, key: 'groups' },
  { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
];

const DESKTOP_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home, key: 'dashboard' },
  { href: '/whatsapp', label: 'WhatsApp Connect', icon: MessageCircle, key: 'whatsapp' },
  { href: '/campaigns', label: 'Campaigns', icon: MessageCircle, key: 'campaigns' },
  { href: '/templates', label: 'Templates', icon: FileText, key: 'templates' },
  { href: '/groups', label: 'Groups', icon: Users, key: 'groups' },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, key: 'analytics' },
  { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
];

export default function BottomNav({ active }) {
  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {MOBILE_ITEMS.map(({ href, label, icon: Icon, key }) => (
          <Link key={key} href={href} className={`nav-item ${active === key ? 'active' : ''}`}>
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="sidebar-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, paddingLeft: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 18 }}>
            ⚡
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
            SalesCRM
          </span>
        </div>

        <div style={{ flex: 1 }}>
          {DESKTOP_ITEMS.map(({ href, label, icon: Icon, key }) => (
            <Link key={key} href={href} className={`nav-item ${active === key ? 'active' : ''}`}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
        
        <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8 }}>
          v1.1.0 • Standalone
        </div>
      </nav>
    </>
  );
}
