'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailsApi, userApi } from '@/lib/api';
import { CategoryBadge, PriorityDot, EmptyState } from '@/components/ui';
import { BrutalCard, BrutalCardContent } from '@/components/ui/brutal-card';
import { BrutalButton } from '@/components/ui/brutal-button';
import {
  Mail,
  Search,
  Star,
  StarOff,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Work', 'Personal', 'Social', 'Invoice', 'Promotion', 'Security'];

interface Email {
  id: string;
  subject: string;
  sender: string;
  fromAddress: string;
  bodyPreview: string;
  summary: string;
  category: string;
  priority: string;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
}

function EmailListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading emails">
      {[1, 2, 3, 4, 5].map((i) => (
        <BrutalCard key={i} className="h-28 bg-gray-200 animate-pulse border-gray-300 shadow-none" />
      ))}
    </div>
  );
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [stats, setStats] = useState<{ totalEmails?: number; categoryBreakdown: Array<{ category: string; count: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [lastFetchTime, setLastFetchTime] = useState<string>(new Date().toISOString());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [newEmailBanner, setNewEmailBanner] = useState<{ count: number; emails: Array<{ subject: string; sender: string }> } | null>(null);
  const [syncLimit, setSyncLimit] = useState(50);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = async () => {
    try {
      const res = await userApi.getStats();
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await emailsApi.list({
        page,
        limit: 20,
        search: search || undefined,
        category: category !== 'All' ? category.toLowerCase() : undefined,
      });
      setEmails(res.data.data);
      setMeta({
        total: res.data.meta.total,
        page: res.data.meta.page,
        totalPages: res.data.meta.pages || 1,
      });
      const now = new Date().toISOString();
      setLastFetchTime(now);
      setLastRefresh(new Date());
      setNewEmailBanner(null);
      fetchStats();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, category]);

  useEffect(() => {
    const timer = setTimeout(fetchEmails, 300);
    return () => clearTimeout(timer);
  }, [fetchEmails]);

  useEffect(() => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await emailsApi.checkNew(lastFetchTime);
        const { count, emails: newEmails } = res.data;
        if (count > 0) {
          setNewEmailBanner({ count, emails: newEmails.slice(0, 3) });
        }
      } catch {
        // Polling errors are non-critical
      }
    }, 30_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [lastFetchTime]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await emailsApi.sync();
      const newCount = res.data.newEmails ?? 0;
      if (newCount > 0) {
        toast.success(`✨ ${newCount} new email${newCount > 1 ? 's' : ''} synced!`);
        await fetchEmails();
      } else {
        toast.success('Inbox is up to date');
        setLastRefresh(new Date());
      }
    } catch {
      toast.error('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const loadNewEmails = async () => {
    setNewEmailBanner(null);
    await fetchEmails();
  };

  const toggleStar = async (e: React.MouseEvent, emailId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEmails((prev) =>
      prev.map((em) => (em.id === emailId ? { ...em, isStarred: !em.isStarred } : em))
    );
    await emailsApi.toggleStar(emailId);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-[var(--text-primary)]">
            <Mail className="w-6 h-6 text-[var(--accent)]" />
            Emails
          </h1>
          <p className="text-sm mt-1 font-bold text-[var(--text-secondary)]">
            {meta.total} emails total
            {lastRefresh && (
              <span className="ml-2 opacity-80">
                · Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
              </span>
            )}
          </p>
        </div>

        {/* Sync Limit Selector and Refresh Button */}
        <div className="flex items-center gap-3">
          <select
            value={syncLimit}
            onChange={(e) => setSyncLimit(Number(e.target.value))}
            disabled={syncing}
            className="px-3 py-2 rounded-xl text-sm font-bold outline-none cursor-pointer border-2 border-[var(--border)] bg-[var(--bg-card)] shadow-[2px_2px_0px_var(--border)] focus:ring-2 focus:ring-[var(--accent)]"
            title="Emails to sync"
          >
            <option value={10}>10 emails</option>
            <option value={20}>20 emails</option>
            <option value={50}>50 emails</option>
            <option value={100}>100 emails</option>
            <option value={200}>200 emails</option>
          </select>

          <BrutalButton onClick={handleSync} disabled={syncing} variant="ghost" className="bg-[var(--accent-light)]">
            <motion.div
              animate={syncing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.6, repeat: syncing ? Infinity : 0, ease: 'linear' }}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
            </motion.div>
            {syncing ? 'Syncing...' : 'Refresh'}
          </BrutalButton>
        </div>
      </div>

      {/* New Email Banner */}
      <AnimatePresence>
        {newEmailBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={loadNewEmails}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all duration-150 active:translate-y-1 active:shadow-none"
              style={{
                background: 'var(--accent)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
                boxShadow: '4px 4px 0px var(--border)',
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 animate-bounce" />
                <span>
                  {newEmailBanner.count} new email{newEmailBanner.count > 1 ? 's' : ''} arrived
                  {newEmailBanner.emails.length > 0 && (
                    <span className="opacity-80">
                      {' '}– {newEmailBanner.emails[0].subject}
                      {newEmailBanner.count > 1 && ` +${newEmailBanner.count - 1} more`}
                    </span>
                  )}
                </span>
              </div>
              <span className="text-xs underline">Load now →</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Search */}
      <BrutalCard className="bg-[var(--bg-card)]">
        <BrutalCardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--border)]" />
            <input
              type="text"
              placeholder="Search emails..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-12 pr-4 py-3 rounded-xl text-base font-bold outline-none border-2 border-[var(--border)] bg-white shadow-[inset_2px_2px_0px_rgba(0,0,0,0.05)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-light)] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 mr-1 text-[var(--border)]" />
            {(() => {
              const getCategoryCount = (cat: string) => {
                if (cat === 'All') return stats?.totalEmails || meta.total || 0;
                const item = stats?.categoryBreakdown?.find(
                  (b) => b.category.toLowerCase() === cat.toLowerCase()
                );
                return item ? item.count : 0;
              };
              return CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setPage(1); }}
                  className="px-4 py-2 rounded-full text-sm font-bold transition-all duration-150 flex items-center gap-2 border-2 active:translate-y-1 active:shadow-none"
                  style={{
                    background: category === cat ? 'var(--accent)' : 'var(--bg-card)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                    boxShadow: category === cat ? '2px 2px 0px var(--border)' : '3px 3px 0px var(--border)',
                    transform: category === cat ? 'translate(1px, 1px)' : 'none',
                  }}
                >
                  <span>{cat}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-black border-2"
                    style={{
                      background: category === cat ? 'rgba(255,255,255,0.3)' : 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {getCategoryCount(cat)}
                  </span>
                </button>
              ));
            })()}
          </div>
        </BrutalCardContent>
      </BrutalCard>

      {/* Email list */}
      {loading ? (
        <EmailListSkeleton />
      ) : emails.length === 0 ? (
        search ? (
          <EmptyState variant="search" title="No results" description="Try different keywords" />
        ) : (
          <EmptyState variant="inbox" title="Inbox is empty" description="Click Refresh to sync Gmail" />
        )
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <div key={email.id}>
              <Link href={`/emails/${email.id}`} className="block">
                <BrutalCard className="hover:bg-[var(--bg-elevated)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[var(--neo-shadow-hover)] transition-all group">
                  <BrutalCardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <div className="mt-1.5 flex-shrink-0 w-3 h-3 flex items-center justify-center">
                        {!email.isRead && (
                          <div className="w-3 h-3 rounded-full border-2 border-[var(--border)] bg-[var(--danger)] animate-pulse" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                          <span
                            className={`text-base truncate flex-1 ${email.isRead ? 'text-[var(--text-secondary)] font-bold' : 'text-[var(--text-primary)] font-black'}`}
                          >
                            {email.subject || '(No subject)'}
                          </span>
                          <span className="text-sm flex-shrink-0 font-bold text-[var(--text-muted)]">
                            {email.receivedAt
                              ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                              : '—'}
                          </span>
                        </div>

                        <div className="text-sm mb-2 font-bold text-[var(--text-secondary)]">
                          From: {email.sender || email.fromAddress || 'Unknown'}
                        </div>

                        {email.summary ? (
                          <p className="text-sm line-clamp-2 mb-3 font-semibold text-[var(--text-secondary)]">
                            🧸 AI Summary: {email.summary}
                          </p>
                        ) : email.bodyPreview ? (
                          <p className="text-sm line-clamp-2 mb-3 text-[var(--text-muted)] font-medium">
                            {email.bodyPreview}
                          </p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          {email.category && <CategoryBadge category={email.category} />}
                          {email.priority && <PriorityDot priority={email.priority} />}
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleStar(e, email.id)}
                        className="flex-shrink-0 p-2 rounded-xl border-2 hover:bg-[#FEF3C7] transition-all active:translate-y-1 active:shadow-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', boxShadow: '3px 3px 0px var(--border)' }}
                      >
                        {email.isStarred ? (
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="w-5 h-5 text-[var(--text-muted)]" />
                        )}
                      </button>
                    </div>
                  </BrutalCardContent>
                </BrutalCard>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6 pb-10">
          <BrutalButton
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="ghost"
          >
            <ChevronLeft className="w-5 h-5" />
          </BrutalButton>
          <span className="text-sm font-black text-[var(--text-secondary)]">
            {page} / {meta.totalPages}
          </span>
          <BrutalButton
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            variant="ghost"
          >
            <ChevronRight className="w-5 h-5" />
          </BrutalButton>
        </div>
      )}
    </div>
  );
}
