'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// ASCII-style nav icons (no lucide icons — terminal feel)
const NAV_ITEMS = [
  { href: '/dashboard', symbol: '⊞', label: 'Dashboard',  short: 'dash' },
  { href: '/emails',    symbol: '✉',  label: 'Emails',     short: 'mail' },
  { href: '/chat',      symbol: '»',  label: 'AI Chat',    short: 'chat' },
  { href: '/settings',  symbol: '⚙',  label: 'Settings',   short: 'conf' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [time, setTime] = useState('');

  // Live clock — terminal feel
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const initial = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <aside
      className="flex flex-col h-screen w-60 border-r"
      style={{ background: 'var(--black-soft)', borderColor: 'var(--border)' }}
    >
      {/* ── Logo / Brand ── */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="font-mono text-xs mb-1" style={{ color: 'var(--white-muted)' }}>
          ai-email-agent v1.0
        </div>
        <div
          className="font-editorial text-xl font-bold leading-none"
          style={{ color: 'var(--white)' }}
        >
          Mail<span style={{ color: 'var(--green)' }}>OS</span>
        </div>
        {/* Live clock */}
        <div
          className="font-mono text-xs mt-2 tabular-nums"
          style={{ color: 'var(--green)' }}
        >
          {time || '--:--:--'}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 p-3 space-y-0.5">
        {/* Label */}
        <div className="section-label px-3 py-3">Navigation</div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${isActive ? 'active' : ''}`}>
                {/* Symbol instead of icon */}
                <span
                  className="w-5 text-center font-mono text-base leading-none select-none"
                  style={{ color: isActive ? 'var(--green)' : 'var(--white-muted)' }}
                >
                  {item.symbol}
                </span>
                <span className="flex-1">{item.label}</span>
                {/* Active marker */}
                {isActive && (
                  <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                    ●
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {/* ── Separator ── */}
        <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />

        {/* ── Status block ── */}
        <div
          className="mx-1 p-3 font-mono text-xs space-y-1"
          style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)' }}
        >
          <div style={{ color: 'var(--green)' }}>● system online</div>
          <div style={{ color: 'var(--white-muted)' }}>AI: active</div>
          <div style={{ color: 'var(--white-muted)' }}>DB: connected</div>
        </div>
      </nav>

      {/* ── User & Logout ── */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
        {/* User info */}
        <div className="p-4 flex items-center gap-3">
          {/* Avatar — brutalist square, no rounded */}
          <div
            className="w-8 h-8 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
            style={{
              background: 'var(--green)',
              color: 'var(--black)',
              border: '2px solid var(--green)',
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-medium truncate"
              style={{ color: 'var(--white)' }}
            >
              {user?.name || 'User'}
            </div>
            <div
              className="text-xs truncate font-mono"
              style={{ color: 'var(--white-muted)' }}
            >
              {user?.email}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 font-mono text-xs px-4 py-3 transition-all duration-150 border-t"
          style={{
            color: 'var(--white-muted)',
            borderColor: 'var(--border)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--white-muted)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <span className="w-5 text-center text-base">⏻</span>
          <span>logout</span>
        </button>
      </div>
    </aside>
  );
}
