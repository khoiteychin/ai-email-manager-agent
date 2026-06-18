'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiApi, draftsApi } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { IllustrationEmptyChat } from '@/components/ui/illustrations';
import {
  Send,
  Bot,
  User,
  Plus,
  MessageSquare,
  Sparkles,
  Trash2,
  PenSquare,
  X,
  Mail,
  Check,
  ChevronDown,
  Search,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  draft?: DraftData | null;
  action?: string;
}

interface DraftData {
  id?: string | null;
  to: string;
  subject: string;
  body: string;
  signature?: string;
}

interface Session {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  createdAt: string;
}

const SUGGESTIONS = [
  { icon: '🔍', text: 'Find emails from Khanh Do' },
  { icon: '📋', text: 'Summarize work emails this week' },
  { icon: '⚡', text: 'Which emails have high priority?' },
  { icon: '✉️', text: 'Compose a thank you email to boss' },
];

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: DraftData;
  onSent?: () => void;
}

function ComposeModal({ isOpen, onClose, initialDraft, onSent }: ComposeModalProps) {
  const [to, setTo] = useState(initialDraft?.to || '');
  const [subject, setSubject] = useState(initialDraft?.subject || '');
  const [body, setBody] = useState(initialDraft?.body || '');
  const [draftId, setDraftId] = useState(initialDraft?.id || null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (initialDraft) {
      setTo(initialDraft.to || '');
      setSubject(initialDraft.subject || '');
      const fullBody = initialDraft.signature
        ? `${initialDraft.body}\n\n${initialDraft.signature}`
        : initialDraft.body || '';
      setBody(fullBody);
      setDraftId(initialDraft.id || null);
    }
  }, [initialDraft, isOpen]);

  const handleGenerate = async () => {
    if (!instruction.trim()) return;
    setGenerating(true);
    try {
      const res = await aiApi.generateDraft({ instruction, context: `To: ${to}\nSubject: ${subject}` });
      const d = res.data;
      if (d.to) setTo(d.to);
      if (d.subject) setSubject(d.subject);
      const nb = d.signature ? `${d.body}\n\n${d.signature}` : d.body;
      setBody(nb || '');
      if (d.id) setDraftId(d.id);
      setInstruction('');
      toast.success('Đã tạo nội dung email!');
    } catch {
      toast.error('Không thể tạo email');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftId) {
      toast.error('Chưa có draft ID');
      return;
    }
    setSaving(true);
    try {
      await draftsApi.save(draftId, { to, subject, body });
      toast.success('Đã lưu draft!');
    } catch {
      toast.error('Lưu draft thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('Vui lòng nhập người nhận');
      return;
    }
    setSending(true);
    try {
      if (draftId) {
        await draftsApi.save(draftId, { to, subject, body });
        await draftsApi.send(draftId);
      } else {
        await aiApi.sendEmail({ to, subject, body });
      }
      toast.success('Email đã được gửi! 🎉');
      onSent?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gửi email thất bại');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(7, 12, 24, 0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            boxShadow: '0 25px 60px rgba(99, 102, 241, 0.2)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{
              background: 'var(--theme-gradient)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <PenSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Compose Email</div>
                <div className="text-white/60 text-xs">Compose &amp; Send</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* AI Instruction Bar */}
            <div
              className="flex gap-2 p-3 rounded-xl"
              style={{ background: 'var(--accent-glow)', border: '1px solid var(--border)' }}
            >
              <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Describe the email you want to write... (Enter to generate)"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
              {generating ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!instruction.trim() || generating}
                  className="text-xs px-3 py-1 rounded-lg font-medium transition-all disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  Generate
                </button>
              )}
            </div>

            {/* To */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                To
              </label>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Subject */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email content..."
                rows={8}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              {draftId && (
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  {saving ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  Save Draft
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all ml-auto"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !to.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: 'var(--theme-gradient)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                }}
              >
                {sending ? <Spinner className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                Send Email
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string>(uuidv4());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<DraftData | undefined>(undefined);
  const [sendingDrafts, setSendingDrafts] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await aiApi.getSessions();
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
    } catch {
      // Silently fail
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sid: string) => {
    setSessionId(sid);
    try {
      const res = await aiApi.getSessionHistory(sid);
      const msgs = res.data?.messages ?? res.data ?? [];
      setMessages(
        msgs.map((m: any) => ({
          id: m.id || uuidv4(),
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt || Date.now()),
        }))
      );
    } catch {
      toast.error('Failed to load chat history');
    }
  };

  const newChat = () => {
    setSessionId(uuidv4());
    setMessages([]);
    setInput('');
  };

  const deleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    setDeletingId(sid);
    try {
      await aiApi.deleteSession(sid);
      setSessions((prev) => prev.filter((s) => s.id !== sid && s.sessionId !== sid));
      if (sessionId === sid) newChat();
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const updatedMessages = [...messages];
    const index = updatedMessages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      const targetRole = updatedMessages[index].role;
      updatedMessages.splice(index, 1);
      if (targetRole === 'user' && index < updatedMessages.length && updatedMessages[index].role === 'assistant') {
        updatedMessages.splice(index, 1);
      }
      setMessages(updatedMessages);
    }
    try {
      await aiApi.deleteMessage(messageId);
    } catch {
      toast.error('Failed to delete message');
      loadSession(sessionId);
    }
  };

  const openComposeWithDraft = (draft?: DraftData) => {
    setComposeDraft(draft);
    setComposeOpen(true);
  };

  const handleSendDirectly = async (messageId: string, draft: DraftData) => {
    setSendingDrafts((prev) => ({ ...prev, [messageId]: true }));
    try {
      if (draft.id) {
        await draftsApi.send(draft.id);
      } else {
        const fullBody = draft.signature ? `${draft.body}\n\n${draft.signature}` : draft.body;
        const htmlBody = `<p>${fullBody.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
        await aiApi.sendEmail({
          to: draft.to,
          subject: draft.subject,
          body: htmlBody,
        });
      }
      toast.success('Email sent successfully! 🎉');
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, draft: null } : m))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send email');
    } finally {
      setSendingDrafts((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await aiApi.chat({ message: messageText, sessionId });
      const msgData = res.data.message;
      const assistantMessage: Message = {
        id: msgData.id || uuidv4(),
        role: 'assistant',
        content: msgData.content,
        createdAt: new Date(msgData.createdAt || Date.now()),
        draft: res.data.draft || null,
        action: res.data.action || undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (res.data.sessionId) {
        setSessionId(String(res.data.sessionId));
      }
      loadSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'AI temporarily unavailable');
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        initialDraft={composeDraft}
        onSent={() => toast.success('Email sent successfully!')}
      />

      <div className="flex h-full" style={{ background: 'var(--bg-primary)' }}>
        {/* ── Sessions Sidebar ─────────────────────────────── */}
        <div
          className="w-72 flex flex-col border-r"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          {/* Sidebar header */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--theme-gradient)' }}
              >
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                AI Assistant
              </span>
            </div>
            <button onClick={newChat} className="w-full btn-ghost justify-center gap-2 text-xs py-2">
              <Plus className="w-3.5 h-3.5" />
              New Conversation
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-auto p-3 space-y-1">
            <p className="text-xs font-medium px-2 pb-1" style={{ color: 'var(--text-muted)' }}>
              History
            </p>
            {sessionsLoading ? (
              <div className="flex justify-center pt-6">
                <Spinner className="w-4 h-4" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center pt-8 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No conversations yet
                </p>
              </div>
            ) : (
              sessions.map((session) => {
                const sid = session.id || session.sessionId;
                const isActive = sessionId === sid;
                const label = session.title || session.content || 'Chat Session';

                return (
                  <div
                    key={sid}
                    className="w-full text-left rounded-xl group relative transition-all duration-150"
                    style={{
                      background: isActive ? 'var(--accent-glow)' : 'transparent',
                      border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                    }}
                  >
                    <button
                      onClick={() => loadSession(sid)}
                      className="w-full text-left px-3 py-2.5 pr-9"
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare
                          className="w-3 h-3 flex-shrink-0 mt-0.5"
                          style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-xs font-medium truncate"
                            style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                          >
                            {label}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={(e) => deleteSession(e, sid)}
                      disabled={deletingId === sid}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                      style={{ color: '#ef4444' }}
                      title="Delete conversation"
                    >
                      {deletingId === sid ? (
                        <Spinner className="w-3 h-3" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Compose button at bottom */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => openComposeWithDraft(undefined)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: 'var(--theme-gradient)',
                color: 'white',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)',
              }}
            >
              <PenSquare className="w-4 h-4" />
              Compose New Email
            </button>
          </div>
        </div>

        {/* ── Chat Area ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--theme-gradient)' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">AI Email Assistant</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Online · Smart Search
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => openComposeWithDraft(undefined)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-glow)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <PenSquare className="w-3.5 h-3.5" />
              Compose Email
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-6 py-6 space-y-5">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center space-y-8"
              >
                <div className="flex flex-col items-center gap-6">
                  <IllustrationEmptyChat />
                  <div className="text-center">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Ask me anything about your emails
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Summarize, find, or compose — I've got you
                    </p>
                  </div>
                </div>

                {/* Suggestion chips */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <motion.button
                      key={s.text}
                      onClick={() => sendMessage(s.text)}
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                      className="p-4 rounded-2xl text-left text-sm transition-all duration-200 group"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.boxShadow = '0 0 20px var(--accent-glow)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="text-xl mb-2">{s.icon}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{s.text}</div>
                    </motion.button>
                  ))}
                </div>

                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Try typing: "find emails from [name]" or "compose email to boss about project X"
                </p>
              </motion.div>
            )}

            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-3 group relative ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--theme-gradient)' }}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="max-w-2xl space-y-2">
                    <div
                      className="px-4 py-3 text-sm"
                      style={{
                        background:
                          message.role === 'user' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                        border: `1px solid ${
                          message.role === 'user' ? 'rgba(99,102,241,0.4)' : 'var(--border)'
                        }`,
                        color: 'var(--text-primary)',
                        borderRadius:
                          message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      }}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>

                    {/* Draft action buttons */}
                    {message.role === 'assistant' && message.draft && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2 px-1"
                      >
                        <button
                          onClick={() => handleSendDirectly(message.id, message.draft!)}
                          disabled={sendingDrafts[message.id]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                          style={{
                            background: 'var(--theme-gradient)',
                            color: 'white',
                          }}
                        >
                          {sendingDrafts[message.id] ? (
                            <Spinner className="w-3 h-3" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Send Now
                        </button>
                        <button
                          onClick={() => openComposeWithDraft(message.draft!)}
                          disabled={sendingDrafts[message.id]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                          style={{
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <PenSquare className="w-3 h-3" />
                          Edit
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg self-center"
                    style={{ color: '#ef4444' }}
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-3"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--theme-gradient)' }}
                >
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl flex items-center gap-2"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px 20px 20px 4px',
                  }}
                >
                  <div className="flex gap-1.5">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            className="px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
          >
            <div
              className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
              onFocusCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px var(--accent-glow)';
              }}
              onBlurCapture={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your emails... or 'compose email to...' (Enter to send)"
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-sm"
                style={{
                  color: 'var(--text-primary)',
                  caretColor: 'var(--accent)',
                  maxHeight: '160px',
                }}
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openComposeWithDraft(undefined)}
                  title="Compose email"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--accent-glow)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <PenSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                  style={{
                    background: input.trim() && !loading ? 'var(--theme-gradient)' : 'var(--border)',
                  }}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Search by sender name, content, or subject · AI will automatically understand your request
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
