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

interface Session {
  sessionId: string;
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
      setSessions(res.data);
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
      setMessages(
        res.data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
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
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: res.data.message,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      // Refresh sessions
      loadSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'AI is temporarily unavailable');
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
    <div className="flex h-full" style={{ background: '#050914' }}>
      {/* Sessions sidebar */}
      <div
        className="w-64 flex flex-col border-r"
        style={{
          background: 'rgba(10,15,30,0.9)',
          borderColor: 'rgba(59,130,246,0.1)',
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'rgba(59,130,246,0.1)' }}>
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
            sessions.map((session) => (
              <button
                key={session.sessionId}
                onClick={() => loadSession(session.sessionId)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-200"
                style={{
                  background:
                    session.sessionId === sessionId
                      ? 'rgba(59,130,246,0.15)'
                      : 'transparent',
                  border:
                    session.sessionId === sessionId
                      ? '1px solid rgba(59,130,246,0.2)'
                      : '1px solid transparent',
                  color: session.sessionId === sessionId ? '#60a5fa' : '#64748b',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate font-medium">Chat Session</span>
                </div>
                <span className="text-xs" style={{ color: '#475569' }}>
                  {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center gap-3"
          style={{ borderColor: 'rgba(59,130,246,0.1)', background: 'rgba(10,15,30,0.5)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">AI Email Assistant</div>
            <div className="text-xs" style={{ color: '#64748b' }}>
              Powered by your n8n workflow
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
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">How can I help you?</h2>
                <p className="text-sm" style={{ color: '#64748b' }}>
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
                className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      message.role === 'user'
                        ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
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
                        ? 'rgba(59,130,246,0.15)'
                        : 'rgba(14,22,41,0.8)',
                    border: `1px solid ${
                      message.role === 'user'
                        ? 'rgba(59,130,246,0.3)'
                        : 'rgba(59,130,246,0.1)'
                    }`,
                    color: '#e2e8f0',
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
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div
                className="px-4 py-3 rounded-2xl flex items-center gap-2"
                style={{
                  background: 'rgba(14,22,41,0.8)',
                  border: '1px solid rgba(59,130,246,0.1)',
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
          style={{ borderColor: 'rgba(59,130,246,0.1)', background: 'rgba(10,15,30,0.8)' }}
        >
          <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{
              background: 'rgba(14,22,41,0.9)',
              border: '1px solid rgba(59,130,246,0.2)',
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
                color: '#e2e8f0',
                caretColor: '#60a5fa',
                maxHeight: '160px',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40"
              style={{
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                  : 'rgba(59,130,246,0.1)',
              }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: '#334155' }}>
            AI responses are powered by your n8n workflow
          </p>
        </div>
      </div>
    </div>
  );
}
