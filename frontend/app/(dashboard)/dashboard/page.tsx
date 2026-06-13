'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CategoryBadge, PriorityDot, Spinner, EmptyState } from '@/components/ui';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Stats {
  totalEmails: number;
  unreadCount: number;
  starredCount: number;
  highPriorityCount: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  recentActivity: Array<{
    id: string;
    subject: string;
    fromAddress: string;
    sender: string;
    category: string;
    priority: string;
    isRead: boolean;
    receivedAt: string;
    summary: string;
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  work:      '#60a5fa',
  personal:  '#00FF88',
  invoice:   '#FFB800',
  social:    '#f472b6',
  promotion: '#FF3B3B',
  security:  '#22d3ee',
};

// ── Stat Card — brutalist, no glass ─────────────────────────
function StatCard({ symbol, label, value, sub, color }: {
  symbol: string;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `4px 4px 0px ${color}40` }}
      transition={{ duration: 0.12 }}
      className="p-5"
      style={{
        background: 'var(--black-card)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="font-mono text-2xl leading-none select-none"
          style={{ color }}
        >
          {symbol}
        </span>
        <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
          ↗
        </span>
      </div>
      <div
        className="font-editorial text-3xl font-bold leading-none mb-1"
        style={{ color: 'var(--white)' }}
      >
        {value}
      </div>
      <div className="font-mono text-xs uppercase tracking-wider mt-2" style={{ color: 'var(--white-muted)' }}>
        {label}
      </div>
      {sub && (
        <div className="font-mono text-xs mt-0.5" style={{ color }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi.getStats()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'good morning' : greetingHour < 18 ? 'good afternoon' : 'good evening';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Terminal breadcrumb */}
        <div className="font-mono text-xs mb-2" style={{ color: 'var(--green)' }}>
          ~/dashboard
        </div>
        <div className="flex items-end gap-4">
          <h1 className="font-editorial text-3xl font-bold leading-none" style={{ color: 'var(--white)' }}>
            {greeting},
          </h1>
          <span
            className="font-editorial text-3xl font-bold leading-none"
            style={{ color: 'var(--green)' }}
          >
            {user?.name || user?.email?.split('@')[0]}
          </span>
        </div>
        <p className="font-mono text-xs mt-2" style={{ color: 'var(--white-muted)' }}>
          — email intelligence dashboard / {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              symbol="✉"
              label="Total Emails"
              value={stats?.totalEmails ?? 0}
              color="#60a5fa"
            />
            <StatCard
              symbol="◉"
              label="Unread"
              value={stats?.unreadCount ?? 0}
              sub="need attention"
              color="var(--amber)"
            />
            <StatCard
              symbol="⊡"
              label="Categories"
              value={stats?.categoryBreakdown?.length ?? 0}
              sub="active"
              color="var(--green)"
            />
            <StatCard
              symbol="★"
              label="Starred"
              value={stats?.starredCount ?? 0}
              sub="quick access"
              color="#f472b6"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Recent Emails — git-log style ── */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="section-label">Recent Emails</div>
                  <div
                    className="font-mono text-xs"
                    style={{ color: 'var(--white-muted)' }}
                  >
                    — latest {stats?.recentActivity?.length ?? 0} commits
                  </div>
                </div>
                <Link
                  href="/emails"
                  className="font-mono text-xs transition-colors"
                  style={{ color: 'var(--green)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none')}
                >
                  view all →
                </Link>
              </div>

              {/* Divider */}
              <div className="border-t" style={{ borderColor: 'var(--border)' }} />

              {stats?.recentActivity?.length === 0 ? (
                <EmptyState
                  icon="✉"
                  title="No emails yet"
                  description="Connect your Gmail account to start seeing emails here"
                />
              ) : (
                <div className="space-y-0">
                  {stats?.recentActivity?.map((email, i) => (
                    <motion.div
                      key={email.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link href={`/emails/${email.id}`}>
                        {/* Git-log row */}
                        <div
                          className="flex items-start gap-4 px-4 py-3 transition-all duration-100 border-b"
                          style={{
                            borderColor: 'var(--border)',
                            background: email.isRead ? 'transparent' : 'rgba(0,255,136,0.03)',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,242,236,0.04)';
                            (e.currentTarget as HTMLDivElement).style.borderLeft = '2px solid var(--green)';
                            (e.currentTarget as HTMLDivElement).style.paddingLeft = '14px';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.background = email.isRead ? 'transparent' : 'rgba(0,255,136,0.03)';
                            (e.currentTarget as HTMLDivElement).style.borderLeft = '';
                            (e.currentTarget as HTMLDivElement).style.paddingLeft = '16px';
                          }}
                        >
                          {/* Unread dot */}
                          <div className="flex-shrink-0 pt-1.5">
                            <div
                              className="w-1.5 h-1.5"
                              style={{
                                background: email.isRead ? 'var(--border-strong)' : 'var(--green)',
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className="text-sm font-medium truncate"
                                style={{ color: email.isRead ? 'var(--white-dim)' : 'var(--white)' }}
                              >
                                {email.subject || '(No subject)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
                                {email.fromAddress || email.sender || 'Unknown'}
                              </span>
                              <span style={{ color: 'var(--border-strong)' }}>·</span>
                              <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
                                {email.receivedAt
                                  ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                                  : '—'}
                              </span>
                            </div>
                            {email.summary && (
                              <p
                                className="font-mono text-xs mt-1.5 line-clamp-1"
                                style={{ color: 'var(--white-muted)' }}
                              >
                                {email.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {email.category && <CategoryBadge category={email.category} />}
                              {email.priority && <PriorityDot priority={email.priority} />}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Category Breakdown ── */}
            <div className="space-y-3">
              <div className="section-label">Categories</div>
              <div className="border-t" style={{ borderColor: 'var(--border)' }} />

              <div
                className="p-5 space-y-5"
                style={{
                  background: 'var(--black-card)',
                  border: '1px solid var(--border)',
                }}
              >
                {stats?.categoryBreakdown?.length === 0 ? (
                  <p className="font-mono text-xs text-center py-8" style={{ color: 'var(--white-muted)' }}>
                    no data yet
                  </p>
                ) : (
                  stats?.categoryBreakdown?.map((item) => {
                    const total = stats.totalEmails || 1;
                    const pct = Math.round((item.count / total) * 100);
                    const catLower = item.category.toLowerCase();
                    const color = CATEGORY_COLORS[catLower] || 'var(--green)';
                    const catLabel = catLower.charAt(0).toUpperCase() + catLower.slice(1);
                    return (
                      <div key={item.category}>
                        <div className="flex justify-between font-mono text-xs mb-2">
                          <span style={{ color: 'var(--white-dim)' }}>{catLabel}</span>
                          <span style={{ color }} className="tabular-nums">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                        {/* Brutalist bar — square, no radius */}
                        <div
                          className="h-1"
                          style={{ background: 'var(--black-elevated)' }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            className="h-full"
                            style={{ background: color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
