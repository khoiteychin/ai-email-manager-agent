'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiApi } from '@/lib/api';
import { Spinner } from '@/components/ui';
import {
  Send,
  Bot,
  User,
  Plus,
  MessageSquare,
  Sparkles,
  Trash2,
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
}

// Bug #7a fix: Updated Session interface to match backend response fields
interface Session {
  id: string;          // canonical (was sessionId before)
  sessionId: string;   // alias provided by backend
  title: string;       // canonical (was content before)
  content: string;     // alias provided by backend
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

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await aiApi.getSessions();
      // Backend returns array directly
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data);
    } catch {
      // Silently fail – user might not have any sessions yet
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sid: string) => {
    setSessionId(sid);
    try {
      const res = await aiApi.getSessionHistory(sid);
      // Backend returns { session, messages } or just array
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

  // Bug #7b fix: Delete session handler
  const deleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    setDeletingId(sid);
    try {
      await aiApi.deleteSession(sid);
      setSessions((prev) => prev.filter((s) => s.id !== sid && s.sessionId !== sid));
      // If we deleted the active session, start a new chat
      if (sessionId === sid) {
        newChat();
      }
      toast.success('Chat deleted');
    } catch {
      toast.error('Failed to delete chat');
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
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
      loadSession(sessionId);
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

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await aiApi.chat({ message: messageText, sessionId });
      // Bug #7a fix: backend returns { sessionId, message: { id, role, content, createdAt }, sources }
      const msgData = res.data.message;
      const assistantMessage: Message = {
        id: msgData.id || uuidv4(),
        role: 'assistant',
        content: msgData.content,
        createdAt: new Date(msgData.createdAt || Date.now()),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update sessionId in case backend created a new session
      if (res.data.sessionId) {
        setSessionId(String(res.data.sessionId));
      }

      // Refresh sessions list
      loadSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'AI is temporarily unavailable');
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
    <div className="flex h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Sessions sidebar */}
      <div
        className="w-64 flex flex-col border-r"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={newChat}
            className="w-full btn-ghost justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          {sessionsLoading ? (
            <div className="flex justify-center pt-4">
              <Spinner className="w-4 h-4" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-center pt-8" style={{ color: '#475569' }}>
              No chats yet
            </p>
          ) : (
            sessions.map((session) => {
              // Bug #7a fix: use id (canonical) with sessionId as fallback
              const sid = session.id || session.sessionId;
              const isActive = sessionId === sid;
              const label = session.title || session.content || 'Chat Session';

              return (
                <div
                  key={sid}
                  className="w-full text-left rounded-lg group relative"
                  style={{
                    background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                    border: isActive
                      ? '1px solid rgba(59,130,246,0.2)'
                      : '1px solid transparent',
                  }}
                >
                  {/* Session click area */}
                  <button
                    onClick={() => loadSession(sid)}
                    className="w-full text-left px-3 py-2.5 text-xs transition-all duration-200 pr-8"
                    style={{ color: isActive ? '#60a5fa' : '#64748b' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate font-medium">{label}</span>
                    </div>
                    <span className="text-xs" style={{ color: '#475569' }}>
                      {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                    </span>
                  </button>

                  {/* Bug #7b fix: Delete button on each session */}
                  <button
                    onClick={(e) => deleteSession(e, sid)}
                    disabled={deletingId === sid}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/20"
                    title="Delete chat"
                    style={{ color: '#ef4444' }}
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
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--theme-gradient)' }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Email Assistant</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Powered by your AI Email Assistant
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-6 space-y-5">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-6"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--theme-gradient)' }}
              >
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">How can I help you?</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Ask me anything about your emails
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="p-3 rounded-xl text-left text-sm transition-all duration-200"
                    style={{
                      background: 'rgba(14,22,41,0.8)',
                      border: '1px solid rgba(59,130,246,0.15)',
                      color: '#94a3b8',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)';
                      e.currentTarget.style.color = '#e2e8f0';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.15)';
                      e.currentTarget.style.color = '#94a3b8';
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 group relative ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--theme-gradient)',
                  }}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className="max-w-2xl px-4 py-3 rounded-2xl text-sm"
                  style={{
                    background:
                      message.role === 'user'
                        ? 'var(--accent-glow)'
                        : 'var(--bg-secondary)',
                    border: `1px solid ${message.role === 'user'
                        ? 'var(--accent)'
                        : 'var(--border)'
                      }`,
                    color: 'var(--text-primary)',
                    borderRadius:
                      message.role === 'user'
                        ? '20px 20px 4px 20px'
                        : '20px 20px 20px 4px',
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

                {/* Delete Message Button */}
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 self-center"
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
          className="px-6 py-4 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
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
              placeholder="Ask about your emails... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-sm"
              style={{
                color: 'var(--text-primary)',
                caretColor: 'var(--accent)',
                maxHeight: '160px',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40"
              style={{
                background: input.trim() && !loading
                  ? 'var(--theme-gradient)'
                  : 'var(--border)',
              }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
            AI responses are powered by RAG search over your emails
          </p>
        </div>
      </div>
    </div>
  );
}
