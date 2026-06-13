'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailsApi, userApi } from '@/lib/api';
import { CategoryBadge, PriorityDot, Spinner, EmptyState } from '@/components/ui';
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

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [stats, setStats] = useState<{ categoryBreakdown: Array<{ category: string; count: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [lastFetchTime, setLastFetchTime] = useState<string>(new Date().toISOString());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [newEmailBanner, setNewEmailBanner] = useState<{ count: number; emails: Array<{ subject: string; sender: string }> } | null>(null);
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
      setMeta(res.data.meta);
      setLastFetchTime(new Date().toISOString());
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

  // Polling every 30s
  useEffect(() => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await emailsApi.checkNew(lastFetchTime);
        const { count, emails: newEmails } = res.data;
        if (count > 0) setNewEmailBanner({ count, emails: newEmails.slice(0, 3) });
      } catch { /* non-critical */ }
    }, 30_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [lastFetchTime]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await emailsApi.sync();
      const newCount = res.data.newEmails ?? 0;
      if (newCount > 0) {
        toast.success(`${newCount} new email${newCount > 1 ? 's' : ''} synced`);
        await fetchEmails();
      } else {
        toast.success('Inbox up to date');
        setLastRefresh(new Date());
      }
    } catch {
      toast.error('Sync failed');
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
    setEmails((prev) => prev.map((em) => (em.id === emailId ? { ...em, isStarred: !em.isStarred } : em)));
    await emailsApi.toggleStar(emailId);
  };

  const getCategoryCount = (cat: string) => {
    if (cat === 'All') return meta.total || 0;
    const item = stats?.categoryBreakdown?.find((b) => b.category.toLowerCase() === cat.toLowerCase());
    return item ? item.count : 0;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-xs mb-1" style={{ color: 'var(--green)' }}>
            ~/emails
          </div>
          <h1 className="font-editorial text-3xl font-bold leading-none" style={{ color: 'var(--white)' }}>
            Inbox
          </h1>
          <p className="font-mono text-xs mt-1.5" style={{ color: 'var(--white-muted)' }}>
            {meta.total} messages
            {lastRefresh && (
              <span> · synced {formatDistanceToNow(lastRefresh, { addSuffix: true })}</span>
            )}
          </p>
        </div>

        {/* Sync button — brutalist */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="font-mono text-xs px-4 py-2 transition-all duration-150 disabled:opacity-40 flex items-center gap-2"
          style={{
            background: syncing ? 'var(--green-dim)' : 'transparent',
            border: '1px solid var(--green-border)',
            color: 'var(--green)',
            boxShadow: syncing ? 'none' : '2px 2px 0px rgba(0,255,136,0.2)',
          }}
        >
          <span className={syncing ? 'animate-spin inline-block' : ''}>⟳</span>
          {syncing ? 'syncing...' : '$ sync'}
        </button>
      </div>

      {/* ── New Email Banner ── */}
      <AnimatePresence>
        {newEmailBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <button
              onClick={loadNewEmails}
              className="w-full flex items-center justify-between px-4 py-3 font-mono text-xs transition-all"
              style={{
                background: 'var(--green-dim)',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                boxShadow: '3px 3px 0px rgba(0,255,136,0.15)',
              }}
            >
              <span>
                ● {newEmailBanner.count} new email{newEmailBanner.count > 1 ? 's' : ''}
                {newEmailBanner.emails[0] && ` — "${newEmailBanner.emails[0].subject}"`}
              </span>
              <span>load now →</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters ── */}
      <div
        className="p-4 space-y-3"
        style={{ background: 'var(--black-card)', border: '1px solid var(--border)' }}
      >
        {/* Search — terminal prompt style */}
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold select-none"
            style={{ color: 'var(--green)' }}
          >
            /
          </span>
          <input
            type="text"
            placeholder="search emails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-8 w-full"
            style={{ background: 'var(--black)' }}
          />
        </div>

        {/* Category filter — monospace tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs mr-1" style={{ color: 'var(--white-muted)' }}>filter:</span>
          {CATEGORIES.map((cat) => {
            const isActive = category === cat;
            return (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className="font-mono text-xs px-2 py-1 transition-all duration-100 flex items-center gap-1.5"
                style={{
                  background: isActive ? 'var(--green)' : 'var(--black-elevated)',
                  border: `1px solid ${isActive ? 'var(--green)' : 'var(--border)'}`,
                  color: isActive ? 'var(--black)' : 'var(--white-dim)',
                  fontWeight: isActive ? '700' : '400',
                }}
              >
                {cat}
                <span
                  className="text-[10px] px-1"
                  style={{
                    background: isActive ? 'rgba(0,0,0,0.2)' : 'var(--black-soft)',
                    color: isActive ? 'var(--black)' : 'var(--white-muted)',
                  }}
                >
                  {getCategoryCount(cat)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Email List ── */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : emails.length === 0 ? (
        <EmptyState
          icon="✉"
          title="No emails found"
          description="Try adjusting your search or filters, or click sync to fetch from Gmail"
        />
      ) : (
        <div
          style={{
            border: '1px solid var(--border)',
            background: 'var(--black-card)',
          }}
        >
          {/* Table header */}
          <div
            className="grid font-mono text-xs px-4 py-2 border-b"
            style={{
              gridTemplateColumns: '16px 1fr 180px 80px 80px 32px',
              gap: '12px',
              borderColor: 'var(--border)',
              color: 'var(--white-muted)',
              background: 'var(--black-soft)',
            }}
          >
            <span></span>
            <span>SUBJECT / SENDER</span>
            <span>SUMMARY</span>
            <span>LABEL</span>
            <span>TIME</span>
            <span></span>
          </div>

          <AnimatePresence>
            {emails.map((email, i) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link href={`/emails/${email.id}`}>
                  <div
                    className="grid items-center px-4 py-3 border-b group transition-all duration-100"
                    style={{
                      gridTemplateColumns: '16px 1fr 180px 80px 80px 32px',
                      gap: '12px',
                      borderColor: 'var(--border)',
                      background: email.isRead ? 'transparent' : 'rgba(0,255,136,0.025)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,242,236,0.04)';
                      (e.currentTarget as HTMLDivElement).style.borderLeft = '2px solid var(--green)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = email.isRead ? 'transparent' : 'rgba(0,255,136,0.025)';
                      (e.currentTarget as HTMLDivElement).style.borderLeft = '';
                    }}
                  >
                    {/* Unread indicator */}
                    <div className="flex-shrink-0">
                      <div
                        className="w-1.5 h-1.5"
                        style={{ background: email.isRead ? 'transparent' : 'var(--green)' }}
                      />
                    </div>

                    {/* Subject + sender */}
                    <div className="min-w-0">
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: email.isRead ? 'var(--white-dim)' : 'var(--white)' }}
                      >
                        {email.subject || '(No subject)'}
                      </div>
                      <div className="font-mono text-xs truncate mt-0.5" style={{ color: 'var(--white-muted)' }}>
                        {email.sender || email.fromAddress || 'Unknown'}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="font-mono text-xs truncate" style={{ color: 'var(--white-muted)' }}>
                      {email.summary || email.bodyPreview || '—'}
                    </div>

                    {/* Category badge */}
                    <div>
                      {email.category && <CategoryBadge category={email.category} />}
                    </div>

                    {/* Time */}
                    <div className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
                      {email.receivedAt
                        ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: false })
                        : '—'}
                    </div>

                    {/* Star */}
                    <button
                      onClick={(e) => toggleStar(e, email.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-base"
                      style={{ color: email.isStarred ? 'var(--amber)' : 'var(--white-muted)' }}
                    >
                      {email.isStarred ? '★' : '☆'}
                    </button>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pagination ── */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost disabled:opacity-40"
          >
            ← prev
          </button>
          <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
            {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="btn-ghost disabled:opacity-40"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}
