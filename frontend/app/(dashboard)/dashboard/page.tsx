'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CategoryBadge, PriorityDot, EmptyState } from '@/components/ui';
import { BrutalCard, BrutalCardHeader, BrutalCardTitle, BrutalCardContent } from '@/components/ui/brutal-card';
import { BrutalButton } from '@/components/ui/brutal-button';
import {
  Mail,
  TrendingUp,
  Inbox,
  Star,
  BarChart2,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { IllustrationEmptyInbox } from '@/components/ui/illustrations';

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
  work: '#3b82f6',
  personal: '#10b981',
  invoice: '#a855f7',
  social: '#ec4899',
  promotion: '#ef4444',
  security: '#06b6d4',
};

function StatCard({ icon, label, value, sub, color, bgClass, href }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bgClass: string;
  href?: string;
}) {
  const content = (
    <BrutalCard className="hover:-translate-y-1 hover:shadow-[var(--neo-shadow-hover)] cursor-pointer" style={{ background: bgClass }}>
      <BrutalCardContent className="p-5 pt-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-[var(--border)] bg-white"
          >
            <span style={{ color }}>{icon}</span>
          </div>
          {href && <ArrowUpRight className="w-5 h-5 text-[var(--border)]" />}
        </div>
        <div className="text-3xl font-extrabold mb-1 text-[var(--border)]">{value}</div>
        <div className="text-sm font-bold text-[var(--border)]">{label}</div>
        {sub && <div className="text-[11px] font-bold mt-1 text-[var(--text-secondary)]">{sub}</div>}
      </BrutalCardContent>
    </BrutalCard>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <BrutalCard key={i} className="h-32 bg-gray-200 animate-pulse border-gray-300 shadow-none" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
          {[1, 2, 3].map((i) => (
            <BrutalCard key={i} className="h-24 bg-gray-200 animate-pulse border-gray-300 shadow-none" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
          <BrutalCard className="h-64 bg-gray-200 animate-pulse border-gray-300 shadow-none" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi.getStats()
      .then((res) => {
        setStats(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">
          {greeting}, {user?.name || user?.email?.split('@')[0]}
        </h1>
        <p className="text-sm mt-1 font-semibold text-[var(--text-secondary)]">
          Here's what's happening with your emails today
        </p>
      </motion.div>

      {loading ? (
        <DashboardSkeleton />
      ) : stats?.totalEmails === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-6"
        >
          <IllustrationEmptyInbox />
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">No emails yet</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Connect your Gmail account in settings to get started.
            </p>
            <Link href="/settings">
              <BrutalButton variant="primary">Connect Gmail</BrutalButton>
            </Link>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
            <StatCard
              icon={<Mail className="w-5 h-5" />}
              label="Total Emails"
              value={stats?.totalEmails ?? 0}
              sub="All time"
              color="#B45309"
              bgClass="#FFEDD5"
              href="/emails"
            />
            <StatCard
              icon={<Inbox className="w-5 h-5" />}
              label="Unread"
              value={stats?.unreadCount ?? 0}
              sub="Need your attention"
              color="#1D4ED8"
              bgClass="#DBEAFE"
              href="/emails"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Categories"
              value={stats?.categoryBreakdown?.length ?? 0}
              sub="Active categories"
              color="#047857"
              bgClass="#D1FAE5"
              href="/emails"
            />
            <StatCard
              icon={<Star className="w-5 h-5" />}
              label="Starred"
              value={stats?.starredCount ?? 0}
              sub="Quick access"
              color="#B45309"
              bgClass="#FEF3C7"
              href="/emails"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Recent emails */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black flex items-center gap-2 text-[var(--text-primary)]">
                  <Clock className="w-5 h-5 text-[var(--accent)]" />
                  Recent Emails
                </h2>
                <Link href="/emails">
                  <BrutalButton variant="ghost" size="sm">
                    View all <ArrowUpRight className="w-4 h-4 ml-1" />
                  </BrutalButton>
                </Link>
              </div>

              <div className="space-y-3">
                {stats?.recentActivity?.length === 0 ? (
                  <BrutalCard className="p-8 text-center bg-[var(--bg-secondary)]">
                    <p className="font-bold text-[var(--text-secondary)]">No recent emails</p>
                  </BrutalCard>
                ) : (
                  stats?.recentActivity?.map((email) => (
                    <Link key={email.id} href={`/emails/${email.id}`} className="block">
                      <BrutalCard className="hover:bg-[var(--bg-elevated)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[var(--neo-shadow-hover)] transition-all">
                        <BrutalCardContent className="p-4 pt-4">
                          <div className="flex items-start gap-4">
                            <div
                              className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 border-2 border-[var(--border)]"
                              style={{ background: email.isRead ? 'var(--bg-card)' : 'var(--accent)' }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                <span
                                  className="text-base font-bold truncate"
                                  style={{ color: email.isRead ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                                >
                                  {email.subject || '(No subject)'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-bold text-[var(--text-secondary)]">
                                  {email.fromAddress || email.sender || 'Unknown'}
                                </span>
                                <span className="text-[var(--text-muted)]">•</span>
                                <span className="text-xs font-bold text-[var(--text-muted)]">
                                  {email.receivedAt
                                    ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                                    : 'Unknown'}
                                </span>
                              </div>
                              {email.summary && (
                                <p className="text-sm font-medium line-clamp-2 text-[var(--text-secondary)]">
                                  {email.summary}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                {email.category && <CategoryBadge category={email.category} />}
                                {email.priority && <PriorityDot priority={email.priority} />}
                              </div>
                            </div>
                          </div>
                        </BrutalCardContent>
                      </BrutalCard>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Category breakdown */}
            <div className="space-y-4">
              <h2 className="text-lg font-black flex items-center gap-2 text-[var(--text-primary)]">
                <BarChart2 className="w-5 h-5 text-[var(--accent)]" />
                Categories
              </h2>
              <BrutalCard>
                <BrutalCardContent className="p-6 flex flex-col gap-5" style={{ paddingTop: '1.5rem' }}>
                  {stats?.categoryBreakdown?.length === 0 ? (
                    <p className="text-sm font-bold text-center py-8 text-[var(--text-muted)]">
                      No data yet
                    </p>
                  ) : (
                    stats?.categoryBreakdown?.map((item) => {
                      const total = stats.totalEmails || 1;
                      const pct = Math.round((item.count / total) * 100);
                      const catLower = item.category.toLowerCase();
                      const color = CATEGORY_COLORS[catLower] || 'var(--accent)';
                      const catLabel = catLower.charAt(0).toUpperCase() + catLower.slice(1);
                      return (
                        <div key={item.category}>
                          <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-[var(--text-secondary)]">{catLabel}</span>
                            <span>{item.count}</span>
                          </div>
                          <div
                            className="h-3 rounded-full overflow-hidden border-2 border-[var(--border)]"
                            style={{ background: 'var(--bg-card)' }}
                          >
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                              className="h-full border-r-2 border-[var(--border)]"
                              style={{ background: color }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </BrutalCardContent>
              </BrutalCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
