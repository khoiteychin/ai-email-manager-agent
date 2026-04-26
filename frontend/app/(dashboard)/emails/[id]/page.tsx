'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { emailsApi, aiApi } from '@/lib/api';
import { Card, CategoryBadge, PriorityDot, Button, Spinner } from '@/components/ui';
import {
  ArrowLeft,
  Star,
  StarOff,
  Reply,
  Send,
  FileText,
  Loader2,
  Copy,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Email {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  bodyPreview: string;
  summary: string;
  category: string;
  priority: string;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
}

interface DraftResult {
  subject?: string;
  body?: string;
  draft?: any;
}

export default function EmailDetailPage({ params }: { params: { id: string } }) {
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    emailsApi.get(params.id)
      .then((res) => setEmail(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const generateReply = async () => {
    if (!email) return;
    setGenerating(true);
    try {
      const res = await aiApi.generateDraft({
        instruction: `Generate a professional reply to this email from ${email.fromAddress} with subject: "${email.subject}"`,
        emailId: email.id,
        context: email.summary || email.bodyPreview,
      });
      setDraft(res.data);
      toast.success('Draft generated!');
    } catch {
      toast.error('Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  const copyDraft = async () => {
    if (!draft?.body) return;
    await navigator.clipboard.writeText(draft.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const sendEmail = async () => {
    if (!email || !draft?.body) return;
    setSendingEmail(true);
    try {
      await aiApi.sendEmail({
        to: email.fromAddress,
        subject: draft.subject || `Re: ${email.subject}`,
        body: draft.body,
        emailId: email.id,
      });
      toast.success('Email sent successfully! ✨');
      setDraft(null);
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleStar = async () => {
    if (!email) return;
    setEmail({ ...email, isStarred: !email.isStarred });
    await emailsApi.toggleStar(email.id);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="p-8 text-center" style={{ color: '#64748b' }}>
        Email not found.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/emails"
        className="inline-flex items-center gap-2 text-sm hover:text-blue-400 transition-colors"
        style={{ color: '#64748b' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Emails
      </Link>

      {/* Email card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-xl font-bold text-white mb-1">
                {email.subject || '(No subject)'}
              </h1>
              <div className="flex items-center gap-3 text-sm" style={{ color: '#64748b' }}>
                <span>From: {email.fromAddress}</span>
                <span>·</span>
                <span>
                  {email.receivedAt
                    ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                    : '—'}
                </span>
              </div>
            </div>
            <button onClick={toggleStar} className="p-2 rounded-xl hover:bg-yellow-400/10 transition-colors">
              {email.isStarred ? (
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ) : (
                <StarOff className="w-5 h-5" style={{ color: '#475569' }} />
              )}
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-5">
            {email.category && <CategoryBadge category={email.category} />}
            {email.priority && <PriorityDot priority={email.priority} />}
          </div>

          {/* AI Summary */}
          {email.summary && (
            <div
              className="p-4 rounded-xl mb-5"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: '#60a5fa' }}>
                🤖 AI Summary
              </div>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                {email.summary}
              </p>
            </div>
          )}

          {/* Body */}
          {email.bodyPreview && (
            <div
              className="p-4 rounded-xl"
              style={{ background: 'rgba(14,22,41,0.8)', border: '1px solid rgba(59,130,246,0.08)' }}
            >
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#94a3b8' }}>
                {email.bodyPreview}
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* AI Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-white mb-4">⚡ AI Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={generateReply} loading={generating} variant="primary">
              <Reply className="w-4 h-4" />
              Generate Reply
            </Button>
            <Button
              onClick={() => {
                aiApi.generateDraft({
                  instruction: 'Create a professional draft for this email conversation',
                  emailId: email.id,
                }).then((res) => {
                  setDraft(res.data);
                  toast.success('Draft created!');
                }).catch(() => toast.error('Failed to create draft'));
              }}
              variant="ghost"
            >
              <FileText className="w-4 h-4" />
              Create Draft
            </Button>
          </div>

          {/* Draft result */}
          {draft && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-5 space-y-3"
            >
              <div
                className="p-4 rounded-xl"
                style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: '#60a5fa' }}>
                    Generated Draft
                  </span>
                  <button onClick={copyDraft} className="text-xs flex items-center gap-1" style={{ color: '#64748b' }}>
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {draft.subject && (
                  <p className="text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>
                    Subject: {draft.subject}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>
                  {draft.body || JSON.stringify(draft.draft, null, 2)}
                </p>
              </div>

              <div className="flex gap-3">
                <Button onClick={sendEmail} loading={sendingEmail} variant="primary">
                  <Send className="w-4 h-4" />
                  Send Email
                </Button>
                <Button onClick={() => setDraft(null)} variant="ghost">
                  Discard
                </Button>
              </div>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
