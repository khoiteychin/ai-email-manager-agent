'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { emailsApi, aiApi, draftsApi } from '@/lib/api';
import { CategoryBadge, PriorityDot, Button, Spinner } from '@/components/ui';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Email {
  id: string;
  subject: string;
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
            .then(() => setEmail((prev) => prev ? { ...prev, isRead: true } : null))
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
      toast.success('Draft generated');
    } catch { toast.error('Failed to generate draft'); }
    finally { setGenerating(false); }
  };

  const copyDraft = async () => {
    const text = isEditingDraft ? editBody : (draft?.body || '');
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const saveDraft = async () => {
    if (!draft?.id) { toast.error('No draft to save'); return; }
    setSavingDraft(true);
    try {
      await draftsApi.save(draft.id, { to: editTo, subject: editSubject, body: editBody });
      setDraft({ ...draft, to: editTo, subject: editSubject, body: editBody });
      setIsEditingDraft(false);
      toast.success('Draft saved');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save draft');
    } finally { setSavingDraft(false); }
  };

  const sendDraftEmail = async () => {
    if (!draft?.id) { toast.error('No draft ID'); return; }
    setSendingEmail(true);
    try {
      // Auto-save edits first if editing mode is active
      if (isEditingDraft) {
        await draftsApi.save(draft.id, { to: editTo, subject: editSubject, body: editBody });
      }
      await draftsApi.send(draft.id);
      toast.success('Email sent');
      setDraft(null);
      setIsEditingDraft(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send');
    } finally { setSendingEmail(false); }
  };

  const sendEmail = async () => {
    if (!email || !draft?.body) return;
    setSendingEmail(true);
    try {
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
      toast.success('Email sent');
      setDraft(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send');
    } finally { setSendingEmail(false); }
  };

  const toggleStar = async () => {
    if (!email) return;
    setEmail({ ...email, isStarred: !email.isStarred });
    await emailsApi.toggleStar(email.id);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-full py-20"><Spinner /></div>
  );

  if (!email) return (
    <div className="p-8 font-mono text-sm" style={{ color: 'var(--white-muted)' }}>
      email not found.
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* ── Back link ── */}
      <Link
        href="/emails"
        className="inline-flex items-center gap-2 font-mono text-xs transition-colors"
        style={{ color: 'var(--white-muted)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--green)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--white-muted)')}
      >
        ← back to inbox
      </Link>

      {/* ── Email card ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ background: 'var(--black-card)', border: '1px solid var(--border)' }}>

          {/* Email header — editorial style */}
          <div
            className="p-6 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Subject — editorial large serif */}
                <h1
                  className="font-editorial text-2xl font-bold leading-tight mb-3"
                  style={{ color: 'var(--white)' }}
                >
                  {email.subject || '(No subject)'}
                </h1>

                {/* Meta row — monospace */}
                <div className="flex items-center gap-3 font-mono text-xs flex-wrap" style={{ color: 'var(--white-muted)' }}>
                  <span>from: <span style={{ color: 'var(--white-dim)' }}>{email.sender || email.fromAddress || 'Unknown'}</span></span>
                  <span>·</span>
                  <span>
                    {email.receivedAt
                      ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Star button */}
              <button
                onClick={toggleStar}
                className="font-mono text-xl transition-colors flex-shrink-0"
                style={{ color: email.isStarred ? 'var(--amber)' : 'var(--white-muted)' }}
                onMouseEnter={(e) => { if (!email.isStarred) (e.currentTarget as HTMLButtonElement).style.color = 'var(--amber)'; }}
                onMouseLeave={(e) => { if (!email.isStarred) (e.currentTarget as HTMLButtonElement).style.color = 'var(--white-muted)'; }}
              >
                {email.isStarred ? '★' : '☆'}
              </button>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-4">
              {email.category && <CategoryBadge category={email.category} />}
              {email.priority && <PriorityDot priority={email.priority} />}
            </div>
          </div>

          {/* AI Summary — green accent block */}
          {email.summary && (
            <div
              className="px-6 py-4 border-b"
              style={{
                borderColor: 'var(--border)',
                background: 'rgba(0,255,136,0.04)',
                borderLeft: '3px solid var(--green)',
              }}
            >
              <div className="ai-tag mb-2">AI Summary</div>
              <p className="font-mono text-xs leading-relaxed" style={{ color: 'var(--white-dim)' }}>
                {email.summary}
              </p>
            </div>
          )}

          {/* Email body — editorial reading style */}
          {(email.bodyPreview || email.bodyText) && (
            <div className="p-6">
              <div className="section-label mb-3">Message</div>
              <div
                className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  color: 'var(--white-dim)',
                  background: 'var(--black-soft)',
                  border: '1px solid var(--border)',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {email.bodyPreview || email.bodyText}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── AI Actions ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div style={{ background: 'var(--black-card)', border: '1px solid var(--border)' }}>
          <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <span className="ai-tag">AI Actions</span>
            <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
              — powered by gpt-4o
            </span>
          </div>

          <div className="p-5 space-y-5">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={generateReply} loading={generating} variant="primary">
                {generating ? 'generating...' : '↩ generate reply'}
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
                    toast.success('Draft created');
                  }).catch(() => toast.error('Failed to create draft'));
                }}
                variant="ghost"
              >
                ◻ create draft
              </Button>
            </div>

            {/* Draft result */}
            {draft && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {isEditingDraft ? (
                  /* Edit mode */
                  <div
                    className="space-y-4 p-4"
                    style={{ background: 'var(--black-soft)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="ai-tag">Edit Draft</span>
                    </div>

                    {[
                      { label: 'To', value: editTo, onChange: setEditTo, type: 'text' as const },
                      { label: 'Subject', value: editSubject, onChange: setEditSubject, type: 'text' as const },
                    ].map(({ label, value, onChange }) => (
                      <div key={label}>
                        <label className="block font-mono text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--white-muted)' }}>
                          {label}
                        </label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          className="input-field w-full text-xs"
                        />
                      </div>
                    ))}

                    <div>
                      <label className="block font-mono text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--white-muted)' }}>
                        Body
                      </label>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="input-field w-full text-sm"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        rows={8}
                      />
                    </div>
                  </div>
                ) : (
                  /* Preview mode */
                  <div
                    style={{ background: 'var(--black-soft)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)' }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 border-b"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="ai-tag">Generated Draft</span>
                      <button
                        onClick={copyDraft}
                        className="font-mono text-xs transition-colors"
                        style={{ color: copied ? 'var(--green)' : 'var(--white-muted)' }}
                      >
                        {copied ? '✓ copied' : '⎘ copy'}
                      </button>
                    </div>

                    <div className="px-4 py-3 space-y-2 font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
                      {draft.subject && <div>subj: <span style={{ color: 'var(--white-dim)' }}>{draft.subject}</span></div>}
                      {draft.to && <div>to: <span style={{ color: 'var(--white-dim)' }}>{draft.to}</span></div>}
                    </div>

                    <div className="px-4 pb-4">
                      <div
                        className="p-3 text-sm whitespace-pre-wrap"
                        style={{ color: 'var(--white-dim)', fontFamily: 'Space Grotesk, sans-serif', borderTop: '1px solid var(--border)', paddingTop: '12px' }}
                      >
                        {draft.body || (draft as any).signature || JSON.stringify(draft, null, 2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons for draft */}
                <div className="flex gap-3 flex-wrap">
                  {isEditingDraft ? (
                    <>
                      <Button onClick={saveDraft} loading={savingDraft} variant="primary">
                        ✓ save draft
                      </Button>
                      <Button onClick={sendDraftEmail} loading={sendingEmail} variant="primary">
                        ↗ send email
                      </Button>
                      <Button onClick={() => setIsEditingDraft(false)} variant="ghost">
                        cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => setIsEditingDraft(true)} variant="ghost">
                        ✎ edit draft
                      </Button>
                      {draft.id ? (
                        <Button onClick={sendDraftEmail} loading={sendingEmail} variant="primary">
                          ↗ send email
                        </Button>
                      ) : (
                        <Button onClick={sendEmail} loading={sendingEmail} variant="primary">
                          ↗ send email
                        </Button>
                      )}
                      <Button onClick={() => setDraft(null)} variant="ghost">
                        ✕ discard
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
