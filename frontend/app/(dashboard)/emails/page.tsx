'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailsApi } from '@/lib/api';
import { Card, CategoryBadge, PriorityDot, Spinner, EmptyState, Input } from '@/components/ui';
import {
  Mail,
  Search,
  Star,
  StarOff,
  Filter,
  ChevronLeft,
  ChevronRight,
  Circle,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

const CATEGORIES = ['All', 'Work', 'Personal', 'Ads', 'Invoice', 'Social'];
const PRIORITIES = ['All', 'High', 'Medium', 'Low'];

interface Email {
  id: string;
  subject: string;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [page, setPage] = useState(1);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await emailsApi.list({
        page,
        limit: 20,
        search: search || undefined,
        category: category !== 'All' ? category : undefined,
        priority: priority !== 'All' ? priority : undefined,
      });
      setEmails(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, priority]);

  useEffect(() => {
    const timer = setTimeout(fetchEmails, 300);
    return () => clearTimeout(timer);
  }, [fetchEmails]);

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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-400" />
            Emails
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {meta.total} emails total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
          <input
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10 w-full"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Category filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3.5 h-3.5 mr-1" style={{ color: '#64748b' }} />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-200"
                style={{
                  background: category === cat ? 'rgba(59,130,246,0.2)' : 'rgba(14,22,41,0.5)',
                  border: `1px solid ${category === cat ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'}`,
                  color: category === cat ? '#60a5fa' : '#64748b',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Email list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : emails.length === 0 ? (
        <EmptyState
          icon={<Mail className="w-8 h-8" />}
          title="No emails found"
          description="Try adjusting your search or filters, or connect your Gmail account"
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {emails.map((email, i) => (
              <motion.div
                key={email.id}
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
                    {/* Unread indicator */}
                    <div className="mt-1.5 flex-shrink-0">
                      <Circle
                        className="w-2 h-2"
                        fill={email.isRead ? 'transparent' : '#3b82f6'}
                        style={{ color: email.isRead ? '#1e2d4a' : '#3b82f6' }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-semibold truncate flex-1"
                          style={{ color: email.isRead ? '#94a3b8' : '#e2e8f0' }}
                        >
                          {email.subject || '(No subject)'}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                          {email.receivedAt
                            ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                            : '—'}
                        </span>
                      </div>

                      <div className="text-xs mb-2" style={{ color: '#64748b' }}>
                        From: {email.fromAddress || 'Unknown'}
                      </div>

                      {email.summary ? (
                        <p className="text-xs line-clamp-2 mb-2" style={{ color: '#94a3b8' }}>
                          📝 {email.summary}
                        </p>
                      ) : email.bodyPreview ? (
                        <p className="text-xs line-clamp-2 mb-2" style={{ color: '#64748b' }}>
                          {email.bodyPreview}
                        </p>
                      ) : null}

                      <div className="flex items-center gap-2">
                        {email.category && <CategoryBadge category={email.category} />}
                        {email.priority && <PriorityDot priority={email.priority} />}
                      </div>
                    </div>

                    {/* Star */}
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
