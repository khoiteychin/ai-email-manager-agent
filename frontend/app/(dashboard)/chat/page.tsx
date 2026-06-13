'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiApi } from '@/lib/api';
import { Spinner } from '@/components/ui';
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
}

interface Session {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  createdAt: string;
}

const SUGGESTIONS = [
  'Summarize my recent work emails',
  'Find emails from last week about invoices',
  'What are my high priority emails?',
  'Help me write a reply to my latest email',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string>(uuidv4());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await aiApi.getSessions();
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
    } catch { /* silent */ }
    finally { setSessionsLoading(false); }
  };

  const loadSession = async (sid: string) => {
    setSessionId(sid);
    try {
      const res = await aiApi.getSessionHistory(sid);
      const msgs = res.data?.messages ?? res.data ?? [];
      setMessages(msgs.map((m: any) => ({
        id: m.id || uuidv4(),
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt || Date.now()),
      })));
    } catch { toast.error('Failed to load history'); }
  };

  const newChat = () => { setSessionId(uuidv4()); setMessages([]); setInput(''); };

  const deleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    setDeletingId(sid);
    try {
      await aiApi.deleteSession(sid);
      setSessions((prev) => prev.filter((s) => s.id !== sid && s.sessionId !== sid));
      if (sessionId === sid) newChat();
      toast.success('Session deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeletingId(null); }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const updated = [...messages];
    const idx = updated.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      const role = updated[idx].role;
      updated.splice(idx, 1);
      if (role === 'user' && idx < updated.length && updated[idx].role === 'assistant') updated.splice(idx, 1);
      setMessages(updated);
    }
    try {
      await aiApi.deleteMessage(messageId);
    } catch {
      toast.error('Failed to delete');
      loadSession(sessionId);
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = { id: uuidv4(), role: 'user', content: messageText, createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await aiApi.chat({ message: messageText, sessionId });
      const msgData = res.data.message;
      const assistantMsg: Message = {
        id: msgData.id || uuidv4(),
        role: 'assistant',
        content: msgData.content,
        createdAt: new Date(msgData.createdAt || Date.now()),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (res.data.sessionId) setSessionId(String(res.data.sessionId));
      loadSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'AI temporarily unavailable');
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--black)' }}>

      {/* ── Sessions Sidebar ── */}
      <div
        className="w-60 flex flex-col border-r flex-shrink-0"
        style={{ background: 'var(--black-soft)', borderColor: 'var(--border)' }}
      >
        {/* New Chat */}
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={newChat}
            className="w-full font-mono text-xs px-3 py-2.5 transition-all duration-100 flex items-center justify-center gap-2"
            style={{
              background: 'var(--green)',
              color: 'var(--black)',
              fontWeight: '700',
              border: '2px solid var(--green)',
              boxShadow: '2px 2px 0px rgba(0,0,0,0.4)',
            }}
          >
            + new session
          </button>
        </div>

        {/* Section label */}
        <div className="px-3 pt-3 pb-1 section-label">History</div>

        {/* Session list */}
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {sessionsLoading ? (
            <div className="flex justify-center pt-4"><Spinner className="w-4 h-4" /></div>
          ) : sessions.length === 0 ? (
            <p className="font-mono text-xs text-center pt-8" style={{ color: 'var(--white-muted)' }}>
              no sessions yet
            </p>
          ) : (
            sessions.map((session) => {
              const sid = session.id || session.sessionId;
              const isActive = sessionId === sid;
              const label = session.title || session.content || 'Chat Session';
              return (
                <div
                  key={sid}
                  className="relative group"
                  style={{
                    background: isActive ? 'var(--green-dim)' : 'transparent',
                    border: isActive ? '1px solid var(--green-border)' : '1px solid transparent',
                  }}
                >
                  <button
                    onClick={() => loadSession(sid)}
                    className="w-full text-left px-3 py-2.5 pr-8 transition-all duration-100"
                  >
                    <div
                      className="font-mono text-xs truncate font-medium"
                      style={{ color: isActive ? 'var(--green)' : 'var(--white-dim)' }}
                    >
                      {isActive ? '▶ ' : '  '}{label}
                    </div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--white-muted)' }}>
                      {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                    </div>
                  </button>
                  <button
                    onClick={(e) => deleteSession(e, sid)}
                    disabled={deletingId === sid}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs px-1 py-0.5"
                    style={{ color: 'var(--red)' }}
                    title="Delete"
                  >
                    {deletingId === sid ? <Spinner className="w-3 h-3" /> : '✕'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header bar */}
        <div
          className="px-6 py-3 border-b flex items-center gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--black-soft)' }}
        >
          <div
            className="w-7 h-7 flex items-center justify-center font-mono text-sm font-bold flex-shrink-0"
            style={{ background: 'var(--green)', color: 'var(--black)' }}
          >
            »
          </div>
          <div>
            <div className="font-mono text-sm font-bold" style={{ color: 'var(--white)' }}>
              ai:chat
            </div>
            <div className="font-mono text-xs" style={{ color: 'var(--green)' }}>
              ● RAG powered · gpt-4o
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-8"
            >
              {/* ASCII art box */}
              <div
                className="font-mono text-xs leading-relaxed"
                style={{ color: 'var(--green)' }}
              >
                <div>┌─────────────────────────┐</div>
                <div>│   AI Email Assistant    │</div>
                <div>│   RAG · GPT-4o · v1.0  │</div>
                <div>└─────────────────────────┘</div>
              </div>

              <div>
                <h2 className="font-editorial text-2xl font-bold mb-1" style={{ color: 'var(--white)' }}>
                  How can I help?
                </h2>
                <p className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
                  Ask anything about your emails
                </p>
              </div>

              {/* Suggestion chips — monospace tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="p-3 text-left font-mono text-xs transition-all duration-100"
                    style={{
                      background: 'var(--black-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--white-dim)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--green)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--green)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 0px var(--green-dim)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--white-dim)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ color: 'var(--green)' }}>$ </span>{suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 group ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar — brutalist square */}
                <div
                  className="w-7 h-7 flex items-center justify-center font-mono text-xs font-bold flex-shrink-0"
                  style={{
                    background: message.role === 'user' ? 'var(--white)' : 'var(--green)',
                    color: 'var(--black)',
                    border: `2px solid ${message.role === 'user' ? 'var(--white-dim)' : 'var(--green)'}`,
                  }}
                >
                  {message.role === 'user' ? 'U' : 'AI'}
                </div>

                {/* Message bubble — hard borders, no radius */}
                <div
                  className="max-w-2xl px-4 py-3 text-sm"
                  style={{
                    background: message.role === 'user' ? 'rgba(245,242,236,0.06)' : 'var(--black-card)',
                    border: `1px solid ${message.role === 'user' ? 'var(--border-strong)' : 'var(--border)'}`,
                    color: 'var(--white)',
                    borderLeft: message.role === 'assistant' ? '3px solid var(--green)' : undefined,
                  }}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none font-mono">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="font-mono whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs self-center px-1"
                  style={{ color: 'var(--red)' }}
                  title="Delete"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator — square dots */}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
              <div
                className="w-7 h-7 flex items-center justify-center font-mono text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--green)', color: 'var(--black)', border: '2px solid var(--green)' }}
              >
                AI
              </div>
              <div
                className="px-4 py-3 flex items-center gap-2"
                style={{ background: 'var(--black-card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)' }}
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

        {/* ── Input bar ── */}
        <div
          className="px-6 py-4 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--black-soft)' }}
        >
          <div
            className="flex items-end gap-3"
            style={{
              background: 'var(--black)',
              border: '1px solid var(--border-strong)',
              padding: '8px 12px',
            }}
          >
            {/* Terminal prompt prefix */}
            <span
              className="font-mono text-sm font-bold flex-shrink-0 mb-1.5"
              style={{ color: 'var(--green)' }}
            >
              &gt;
            </span>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="ask about your emails... (Enter ↵ to send)"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none font-mono text-sm"
              style={{
                color: 'var(--white)',
                caretColor: 'var(--green)',
                maxHeight: '160px',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 font-mono text-xs px-3 py-1.5 transition-all duration-100 disabled:opacity-30 mb-0.5"
              style={{
                background: input.trim() && !loading ? 'var(--green)' : 'var(--black-elevated)',
                color: input.trim() && !loading ? 'var(--black)' : 'var(--white-muted)',
                border: '1px solid var(--border)',
                fontWeight: '700',
              }}
            >
              send ↵
            </button>
          </div>
          <p className="font-mono text-xs mt-2 text-center" style={{ color: 'var(--white-muted)' }}>
            RAG · searches your email index · shift+enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
