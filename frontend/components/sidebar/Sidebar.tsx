'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  Zap,
  ChevronRight,
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

  return (
    <aside
      className="flex flex-col h-screen w-64 border-r"
      style={{
        background: 'rgba(10, 15, 30, 0.95)',
        borderColor: 'rgba(59,130,246,0.12)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'rgba(59,130,246,0.12)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">AI Email</div>
            <div className="text-xs" style={{ color: '#64748b' }}>
              Manager
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t" style={{ borderColor: 'rgba(59,130,246,0.12)' }}>
        <div className="flex items-center gap-3 mb-3 px-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{user?.name || 'User'}</div>
            <div className="text-xs truncate" style={{ color: '#64748b' }}>
              {user?.email}
            </div>
          </div>
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
