'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailsApi, userApi } from '@/lib/api';
import { Card, CategoryBadge, PriorityDot, Spinner, EmptyState } from '@/components/ui';
import {
  Mail,
  Search,
  Star,
  StarOff,
  Filter,
  ChevronLeft,
  ChevronRight,
  Circle,
  RefreshCw,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Work', 'Personal', 'Social', 'Invoice', 'Promotion', 'Security'];

// Bug #2 fix: Updated interface to match backend _email_to_dict() fields
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

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [stats, setStats] = useState<{ categoryBreakdown: Array<{ category: string; count: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  // Bug #4: last fetch timestamp for polling since=
  const [lastFetchTime, setLastFetchTime] = useState<string>(new Date().toISOString());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  // Bug #4: new email banner state
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
      setNewEmailBanner(null); // Clear banner after reload
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

  // Bug #4: Lightweight polling every 30 seconds – only queries DB, no Gmail API call
  useEffect(() => {
    // Start polling after initial load
    pollingRef.current = setInterval(async () => {
      try {
        const res = await emailsApi.checkNew(lastFetchTime);
        const { count, emails: newEmails } = res.data;
        if (count > 0) {
          // Show banner instead of auto-reloading
          setNewEmailBanner({ count, emails: newEmails.slice(0, 3) });
        }
      } catch {
        // Polling errors are non-critical, ignore silently
      }
    }, 30_000); // Every 30 seconds

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [lastFetchTime]);

  // Bug #3 fix: manual sync using incremental Gmail History API
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

  // Load new emails when banner is clicked
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
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Mail className="w-6 h-6 text-blue-400" />
            Emails
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {meta.total} emails total
            {lastRefresh && (
              <span className="ml-2">
                · Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
              </span>
            )}
          </p>
        </div>

        {/* Sync Limit Selector and Refresh Button */}
        <div className="flex items-center gap-2">
          <select
            value={syncLimit}
            onChange={(e) => setSyncLimit(Number(e.target.value))}
            disabled={syncing}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer transition-all duration-200"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Số lượng email muốn đồng bộ"
          >
            <option value={10}>10 emails</option>
            <option value={20}>20 emails</option>
            <option value={50}>50 emails</option>
            <option value={100}>100 emails</option>
            <option value={200}>200 emails</option>
          </select>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid var(--border)',
              color: 'var(--accent)',
            }}
          >
            <motion.div
              animate={syncing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.6, repeat: syncing ? Infinity : 0, ease: 'linear' }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Bug #4: New Email Banner – shown when polling detects new emails */}
      <AnimatePresence>
        {newEmailBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button
              onClick={loadNewEmails}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:brightness-110"
              style={{
                background: 'var(--theme-gradient)',
                border: '1px solid var(--border)',
                color: 'white',
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-white animate-pulse" />
                <span>
                  {newEmailBanner.count} new email{newEmailBanner.count > 1 ? 's' : ''} arrived
                  {newEmailBanner.emails.length > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {' '}– {newEmailBanner.emails[0].subject}
                      {newEmailBanner.count > 1 && ` +${newEmailBanner.count - 1} more`}
                    </span>
                  )}
                </span>
              </div>
              <span className="text-xs underline text-white">Load now →</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="glass p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10 w-full"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="w-3.5 h-3.5 mr-1" style={{ color: 'var(--text-secondary)' }} />
          {(() => {
            const getCategoryCount = (cat: string) => {
              if (cat === 'All') return meta.total || 0;
              const item = stats?.categoryBreakdown?.find(
                (b) => b.category.toLowerCase() === cat.toLowerCase()
              );
              return item ? item.count : 0;
            };
            return CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                style={{
                  background: category === cat ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                  border: `1px solid ${category === cat ? 'var(--accent)' : 'var(--border)'}`,
                  color: category === cat ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <span>{cat}</span>
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: category === cat ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: category === cat ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {getCategoryCount(cat)}
                </span>
              </button>
            ));
          })()}
        </div>
      </div>

      {/* Email list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : emails.length === 0 ? (
        search ? (
          <EmptyState variant="search" title="No results" description="Try different keywords" />
        ) : (
          <EmptyState variant="inbox" title="Inbox is empty" description="Click Refresh to sync Gmail" />
        )
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {emails.map((email, i) => (
              <motion.div
                key={email.id}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/emails/${email.id}`}>
                  <div
                    className="glass-hover p-4 flex items-start gap-3 group"
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="mt-1.5 flex-shrink-0">
                      <Circle
                        className="w-2 h-2"
                        fill={email.isRead ? 'transparent' : 'var(--accent)'}
                        style={{ color: email.isRead ? 'var(--border)' : 'var(--accent)' }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-semibold truncate flex-1"
                          style={{ color: email.isRead ? 'var(--text-muted)' : 'var(--text-primary)' }}
                        >
                          {email.subject || '(No subject)'}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {email.receivedAt
                            ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                            : '—'}
                        </span>
                      </div>

                      <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                        From: {email.sender || email.fromAddress || 'Unknown'}
                      </div>

                      {email.summary ? (
                        <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--text-secondary)' }}>
                          📝 {email.summary}
                        </p>
                      ) : email.bodyPreview ? (
                        <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--text-muted)' }}>
                          {email.bodyPreview}
                        </p>
                      ) : null}

                      <div className="flex items-center gap-2">
                        {email.category && <CategoryBadge category={email.category} />}
                        {email.priority && <PriorityDot priority={email.priority} />}
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleStar(e, email.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-yellow-400/10"
                    >
                      {email.isStarred ? (
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      ) : (
                        <StarOff className="w-4 h-4" style={{ color: '#475569' }} />
                      )}
                    </button>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost px-3 py-2 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm" style={{ color: '#94a3b8' }}>
            {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="btn-ghost px-3 py-2 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
