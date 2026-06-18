'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { IllustrationEmailLogo } from '@/components/ui/illustrations';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/emails', icon: Mail, label: 'Emails' },
  { href: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    }
  };

  return (
    <div className="h-screen py-4 pl-4 flex">
      <aside
        className="flex flex-col h-full w-64 border-2 rounded-2xl shadow-[var(--neo-shadow)] overflow-hidden transition-all"
        style={{
          background: 'var(--bg-sidebar)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Logo */}
        <div className="p-6 border-b-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <IllustrationEmailLogo width={36} height={36} />
            <div>
              <div className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                AI Email
              </div>
              <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Manager Bot 🧸</div>
            </div>
          </div>
        </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-primary)' }} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5" style={{ strokeWidth: 3 }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t-2 space-y-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 border-2"
              style={{ background: 'var(--theme-gradient)', borderColor: 'var(--border)' }}
            >
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: 'var(--text-sidebar-user)' }}>
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Theme Toggler inline */}
          <button
            onClick={toggleTheme}
            className="flex items-center p-1.5 rounded-xl border-2 transition-all duration-150 cursor-pointer flex-shrink-0 ml-2"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              boxShadow: '2px 2px 0px var(--border)'
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          onClick={logout}
          className="sidebar-item w-full hover:bg-red-100 dark:hover:bg-red-950/30"
          style={{ color: '#ef4444' }}
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
    </div>
  );
}
