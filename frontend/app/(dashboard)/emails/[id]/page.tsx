'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { emailsApi, aiApi, draftsApi } from '@/lib/api';
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
  // Bug #2 fix: backend returns both sender (canonical) and fromAddress (alias)
  sender: string;
  fromAddress: string;
  receiver: string;
  toAddress: string;
  bodyText: string;
  bodyPreview: string;
  summary: string;
  category: string;
  priority: string;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
}

interface DraftResult {
  id?: string;
  subject?: string;
  body?: string;
  to?: string;
}

export default function EmailDetailPage({ params }: { params: { id: string } }) {
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Draft Editor State
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editTo, setEditTo] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    emailsApi.get(params.id)
      .then((res) => {
        setEmail(res.data);
        if (res.data && !res.data.isRead) {
          emailsApi.markAsRead(params.id, true)
            .then(() => {
              setEmail((prev) => prev ? { ...prev, isRead: true } : null);
            })
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const generateReply = async () => {
    if (!email) return;
    setGenerating(true);
    try {
      const senderName = email.sender || email.fromAddress || 'the sender';
      const res = await aiApi.generateDraft({
        instruction: `Generate a professional reply to this email from ${senderName} with subject: "${email.subject}"`,
        emailId: email.id,
        context: email.summary || email.bodyPreview,
      });
      setDraft(res.data);
      setEditTo(res.data.to || email.sender || email.fromAddress || '');
      setEditSubject(res.data.subject || `Re: ${email.subject}`);
      setEditBody(res.data.body || '');
      toast.success('Draft generated!');
    } catch {
      toast.error('Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  const copyDraft = async () => {
    const textToCopy = isEditingDraft ? editBody : (draft?.body || '');
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const saveDraft = async () => {
    if (!draft?.id) {
      toast.error('No draft to save');
      return;
    }
    setSavingDraft(true);
    try {
      await draftsApi.save(draft.id, {
        to: editTo,
        subject: editSubject,
        body: editBody,
      });
      setDraft({
        ...draft,
        to: editTo,
        subject: editSubject,
        body: editBody,
      });
      setIsEditingDraft(false);
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const sendDraftEmail = async () => {
    if (!draft?.id) {
      toast.error('No draft ID found');
      return;
    }
    setSendingEmail(true);
    try {
      await draftsApi.send(draft.id);
      toast.success('Email sent successfully! ✨');
      setDraft(null);
      setIsEditingDraft(false);
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const sendEmail = async () => {
    if (!email || !draft?.body) return;
    setSendingEmail(true);
    try {
      // Bug #5/#6 fix: body is now plain text, wrap in <p> tags for Gmail API HTML compatibility
      const htmlBody = draft.body
        .split('\n\n')
        .map((para: string) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
        .join('');
      await aiApi.sendEmail({
        to: email.sender || email.fromAddress,
        subject: draft.subject || `Re: ${email.subject}`,
        body: htmlBody,
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
        style={{ color: 'var(--text-secondary)' }}
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
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {email.subject || '(No subject)'}
              </h1>
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {/* Bug #2 fix: use sender (canonical) with fromAddress fallback */}
                <span>From: {email.sender || email.fromAddress || 'Unknown'}</span>
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
                <StarOff className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
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
              style={{ background: 'var(--accent-glow)', border: '1px solid var(--border)' }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--accent)' }}>
                🤖 AI Summary
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {email.summary}
              </p>
            </div>
          )}

          {/* Body */}
          {(email.bodyPreview || email.bodyText) && (
            <div
              className="p-4 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {email.bodyPreview || email.bodyText}
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* AI Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>⚡ AI Actions</h2>
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
                  setEditTo(res.data.to || email.sender || email.fromAddress || '');
                  setEditSubject(res.data.subject || `Re: ${email.subject}`);
                  setEditBody(res.data.body || '');
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-5 space-y-3"
            >
              {isEditingDraft ? (
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                      Edit Draft
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>To</label>
                    <input
                      type="text"
                      value={editTo}
                      onChange={(e) => setEditTo(e.target.value)}
                      className="input-field w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Subject</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="input-field w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Body</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="input-field w-full text-sm font-sans"
                      rows={8}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                      Generated Draft
                    </span>
                    <button onClick={copyDraft} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {draft.subject && (
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Subject: {draft.subject}
                    </p>
                  )}
                  {draft.to && (
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      To: {draft.to}
                    </p>
                  )}
                  {/* Bug #5/#6 fix: draft body is plain text, display with whitespace-pre-wrap */}
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                    {draft.body || (draft as any).signature || JSON.stringify(draft, null, 2)}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                {isEditingDraft ? (
                  <>
                    <Button onClick={saveDraft} loading={savingDraft} variant="primary">
                      Save Draft
                    </Button>
                    <Button onClick={sendDraftEmail} loading={sendingEmail} variant="primary">
                      <Send className="w-4 h-4" />
                      Send Email
                    </Button>
                    <Button onClick={() => setIsEditingDraft(false)} variant="ghost">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => setIsEditingDraft(true)} variant="ghost">
                      Edit Draft
                    </Button>
                    {draft.id ? (
                      <Button onClick={sendDraftEmail} loading={sendingEmail} variant="primary">
                        <Send className="w-4 h-4" />
                        Send Email
                      </Button>
                    ) : (
                      <Button onClick={sendEmail} loading={sendingEmail} variant="primary">
                        <Send className="w-4 h-4" />
                        Send Email
                      </Button>
                    )}
                    <Button onClick={() => setDraft(null)} variant="ghost">
                      Discard
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
