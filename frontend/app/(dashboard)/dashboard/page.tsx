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

interface Stats {
  totalEmails: number;
  unreadCount: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  recentActivity: Array<{
    id: string;
    subject: string;
    fromAddress: string;
    category: string;
    priority: string;
    isRead: boolean;
    receivedAt: string;
    summary: string;
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  Work: '#3b82f6',
  Personal: '#10b981',
  Ads: '#f59e0b',
  Invoice: '#a855f7',
  Social: '#ec4899',
};

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="glass p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <ArrowUpRight className="w-4 h-4" style={{ color: '#475569' }} />
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: '#475569' }}>{sub}</div>}
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
    greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">
          {greeting}, {user?.name || user?.email?.split('@')[0]} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Here's what's happening with your emails today
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon={<Mail className="w-5 h-5" />}
              label="Total Emails"
              value={stats?.totalEmails ?? 0}
              color="#3b82f6"
            />
            <StatCard
              icon={<Inbox className="w-5 h-5" />}
              label="Unread"
              value={stats?.unreadCount ?? 0}
              sub="Need your attention"
              color="#f59e0b"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Categories"
              value={stats?.categoryBreakdown?.length ?? 0}
              sub="Active categories"
              color="#10b981"
            />
            <StatCard
              icon={<Star className="w-5 h-5" />}
              label="Starred"
              value="—"
              sub="Quick access"
              color="#a855f7"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent emails */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Recent Emails
                </h2>
                <Link
                  href="/emails"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {stats?.recentActivity?.length === 0 ? (
                <EmptyState
                  icon={<Mail className="w-8 h-8" />}
                  title="No emails yet"
                  description="Connect your Gmail account to start seeing emails here"
                />
              ) : (
                stats?.recentActivity?.map((email, i) => (
                  <motion.div
                    key={email.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/emails/${email.id}`}>
                      <Card hover className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                            style={{ background: email.isRead ? '#1e2d4a' : '#3b82f6' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-sm font-medium truncate"
                                style={{ color: email.isRead ? '#94a3b8' : '#e2e8f0' }}
                              >
                                {email.subject || '(No subject)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs" style={{ color: '#64748b' }}>
                                {email.fromAddress}
                              </span>
                              <span className="text-xs" style={{ color: '#1e2d4a' }}>•</span>
                              <span className="text-xs" style={{ color: '#475569' }}>
                                {email.receivedAt
                                  ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                                  : 'Unknown'}
                              </span>
                            </div>
                            {email.summary && (
                              <p className="text-xs line-clamp-2" style={{ color: '#64748b' }}>
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
                  </motion.div>
                ))
              )}
            </div>

            {/* Category breakdown */}
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                Categories
              </h2>
              <Card className="p-5 space-y-4">
                {stats?.categoryBreakdown?.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: '#475569' }}>
                    No data yet
                  </p>
                ) : (
                  stats?.categoryBreakdown?.map((item) => {
                    const total = stats.totalEmails || 1;
                    const pct = Math.round((item.count / total) * 100);
                    const color = CATEGORY_COLORS[item.category] || '#3b82f6';
                    return (
                      <div key={item.category}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: '#94a3b8' }}>{item.category}</span>
                          <span style={{ color }}>{item.count}</span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: '#1e2d4a' }}
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
