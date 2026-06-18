'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { userApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CategoryBadge, PriorityDot, Spinner, EmptyState } from '@/components/ui';
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

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {greeting}, {user?.name || user?.email?.split('@')[0]}
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Here's what's happening with your emails today
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : stats?.totalEmails === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-10 gap-4"
        >
          <IllustrationEmptyInbox />
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">
            Connect Gmail in Settings to get started
          </p>
        </motion.div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon={<Mail className="w-5 h-5" />}
              label="Total Emails"
              value={stats?.totalEmails ?? 0}
              color="#C2500A"
            />
            <StatCard
              icon={<Inbox className="w-5 h-5" />}
              label="Unread"
              value={stats?.unreadCount ?? 0}
              sub="Need your attention"
              color="#3B82F6"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Categories"
              value={stats?.categoryBreakdown?.length ?? 0}
              sub="Active categories"
              color="#10B981"
            />
            <StatCard
              icon={<Star className="w-5 h-5" />}
              label="Starred"
              value={stats?.starredCount ?? 0}
              sub="Quick access"
              color="#F59E0B"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent emails */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  Recent Emails
                </h2>
                <Link
                  href="/emails"
                  className="text-xs flex items-center gap-1 hover:underline font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {stats?.recentActivity?.length === 0 ? (
                <EmptyState
                  variant="inbox"
                  title="No emails yet"
                  description="Connect your Gmail account to start seeing emails here"
                />
              ) : (
                stats?.recentActivity?.map((email) => (
                  <div key={email.id}>
                    <Link href={`/emails/${email.id}`}>
                      <Card className="p-4 hover:bg-[var(--bg-elevated)] transition-colors">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ background: email.isRead ? 'var(--border)' : 'var(--accent)' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-sm font-medium truncate"
                                style={{ color: email.isRead ? 'var(--text-muted)' : 'var(--text-primary)' }}
                              >
                                {email.subject || '(No subject)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="text-xs"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {email.fromAddress || email.sender || 'Unknown'}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--border)' }}>•</span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {email.receivedAt
                                  ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                                  : 'Unknown'}
                              </span>
                            </div>
                            {email.summary && (
                              <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                {email.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {email.category && <CategoryBadge category={email.category} />}
                              {email.priority && <PriorityDot priority={email.priority} />}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </div>
                ))
              )}
            </div>

            {/* Category breakdown */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BarChart2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                Categories
              </h2>
              <Card className="p-5 space-y-4">
                {!stats?.categoryBreakdown || stats.categoryBreakdown.filter(item => item.category.toLowerCase() !== 'security').length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No data yet
                  </p>
                ) : (
                  stats.categoryBreakdown
                    .filter(item => item.category.toLowerCase() !== 'security')
                    .map((item) => {
                    const total = stats.totalEmails || 1;
                    const pct = Math.round((item.count / total) * 100);
                    const catLower = item.category.toLowerCase();
                    const color = CATEGORY_COLORS[catLower] || 'var(--accent)';
                    const catLabel = catLower.charAt(0).toUpperCase() + catLower.slice(1);
                    return (
                      <div key={item.category}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: 'var(--text-secondary)' }}>{catLabel}</span>
                          <span style={{ color }}>{item.count}</span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--bg-secondary)' }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="h-full rounded-full"
                            style={{ background: color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
