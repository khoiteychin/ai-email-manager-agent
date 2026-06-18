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
    <aside
      className="flex flex-col h-screen w-64 border-r"
      style={{
        background: 'var(--bg-sidebar)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              AI Email
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Manager</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                style={isActive ? { borderLeft: '2.5px solid var(--accent)', borderRadius: '0 8px 8px 0' } : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? 'var(--icon-active)' : 'var(--icon-default)' }} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'var(--theme-gradient)' }}
            >
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-sidebar-user)' }}>
                {user?.name || 'User'}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Theme Toggler inline */}
          <button
            onClick={toggleTheme}
            className="flex items-center p-1.5 rounded-lg border transition-all duration-150 cursor-pointer flex-shrink-0 ml-2"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)'
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          onClick={logout}
          className="sidebar-item w-full text-red-400 hover:text-red-300"
          style={{ color: '#f87171' }}
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
