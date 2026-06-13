'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/emails',    icon: Mail,            label: 'Emails'    },
  { href: '/chat',      icon: MessageSquare,   label: 'AI Chat'   },
  { href: '/settings',  icon: Settings,        label: 'Settings'  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const initial = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <aside
      className="flex flex-col h-screen w-60 border-r flex-shrink-0"
      style={{ background: 'var(--black-soft)', borderColor: 'var(--border)' }}
    >
      {/* ── Brand ── */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--green) 0%, #00b4d8 100%)',
            }}
          >
            <Zap className="w-4 h-4" style={{ color: 'var(--black)' }} />
          </div>
          <div>
            <div className="font-semibold text-sm leading-none" style={{ color: 'var(--white)' }}>
              MailOS
            </div>
            <div
              className="font-mono text-xs mt-0.5 tabular-nums"
              style={{ color: 'var(--green)' }}
            >
              {time || '--:--:--'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 p-3 space-y-0.5">
        <div className="section-label px-3 py-2.5">Navigation</div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: isActive ? 'var(--green)' : 'var(--white-muted)' }}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--green)' }}
                  />
                )}
              </div>
            </Link>
          );
        })}

        <div className="my-3" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Status block */}
        <div
          className="mx-1 p-3 rounded-lg"
          style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--green)' }}
            />
            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--green)' }}>
              system online
            </span>
          </div>
          <div className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
            AI · DB · Gmail — active
          </div>
        </div>
      </nav>

      {/* ── User ── */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--green) 0%, #00b4d8 100%)',
              color: 'var(--black)',
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--white)' }}>
              {user?.name || 'User'}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--white-muted)' }}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md transition-all duration-150 flex-shrink-0"
            style={{ color: 'var(--white-muted)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--white-muted)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
