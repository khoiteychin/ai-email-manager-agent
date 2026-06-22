'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { connectApi, discordApi } from '@/lib/api';
import { Card } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import {
  Mail,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
  User,
  Shield,
  Bell,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface ConnectedAccount {
  provider: string;
  metadata: any;
  updatedAt: string;
}

// ─── Discord Panel ────────────────────────────────────────────────────────────
function DiscordPanel({
  account,
  onConnect,
  onDisconnect,
  disconnecting,
}: {
  account: ConnectedAccount | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await discordApi.getStatus();
      setChannelId(res.data.channelId);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setRefreshing(false);
    }
  };

  // Check status on mount
  useEffect(() => {
    if (account) {
      discordApi.getStatus().then((res) => {
        setChannelId(res.data.channelId);
      }).catch(() => {});
    }
  }, [account]);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await discordApi.testNotification();
      if (res.data.success) {
        toast.success('📨 Test notification sent to Discord!');
      } else {
        toast.error(res.data.error || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setTesting(false);
    }
  };

  const isConnected = !!account;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      {/* Main row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: isConnected ? 'rgba(16,185,129,0.15)' : 'var(--accent-glow)' }}
          >
            <MessageSquare
              className="w-5 h-5"
              style={{ color: isConnected ? 'var(--success)' : 'var(--accent)' }}
            />
          </div>
          <div>
            <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              Discord
              {isConnected && channelId && (
                <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>
                  Bot Connected ✓
                </span>
              )}
              {isConnected && !channelId && (
                <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(234,179,8,0.15)', color: 'var(--warning)' }}>
                  Awaiting Bot Ping
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {isConnected
                ? 'Receive email notifications via Discord bot'
                : 'Not connected — Receive notifications & chat with AI'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title="Configure"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={onDisconnect}
                disabled={disconnecting}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Disconnect"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="btn-primary px-4 py-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Expandable config */}
      <AnimatePresence>
        {isConnected && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="pt-4">
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <p className="font-medium text-yellow-500 mb-1">Link your Channel ID via Discord Bot</p>
                      <p className="mb-2">1. Add <strong>ktcbot</strong> to your server.</p>
                      <div className="mb-3">
                        <a 
                          href="https://discord.com/api/oauth2/authorize?client_id=1491464406733684888&permissions=8&scope=bot" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded-md transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Add Bot to Server
                        </a>
                      </div>
                      <p className="mb-2">2. Type <strong>@ktcbot Xin chào</strong> in the channel where you want to receive notifications.</p>
                      <p>3. The bot will automatically link that channel to your account!</p>
                    </div>
                  </div>

                  {channelId ? (
                    <div className="text-sm font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                      Linked Channel ID: <code className="bg-slate-900/60 px-1.5 py-0.5 rounded text-white">{channelId}</code>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-lg">
                      Status: Waiting for bot message...
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={fetchStatus}
                      disabled={refreshing}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
                      style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      {refreshing ? 'Refreshing...' : 'Refresh Status'}
                    </button>

                    {channelId && (
                      <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid var(--success)' }}
                      >
                        {testing ? (
                          <span className="w-3.5 h-3.5 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Send test notification
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────
function SettingsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.opener && window.name === 'oauth_popup') {
      const connected = searchParams.get('connected');
      if (connected) {
        window.opener.postMessage({ type: 'OAUTH_SUCCESS', provider: connected }, '*');
        window.close();
        return;
      }
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_SUCCESS') {
        const provider = event.data.provider || 'Account';
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected successfully!`);
        loadAccounts();
      } else if (event.data?.type === 'OAUTH_ERROR') {
        const provider = event.data.provider || 'account';
        const message = event.data.message ? ` ${event.data.message}` : ' Please try again.';
        toast.error(`Failed to connect ${provider}.${message}`);
      }
    };
    window.addEventListener('message', handleMessage);

    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected && (!window.opener || window.name !== 'oauth_popup')) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully! ✨`);
      loadAccounts();
    }
    if (error) {
      toast.error(`Failed to connect ${error}. Please try again.`);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [searchParams]);

  useEffect(() => {
    if (user?.id) loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    if (!user?.id) return;
    try {
      const res = await connectApi.getAccounts(user.id);
      setAccounts(res.data);
    } catch {
      // No accounts yet
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (provider: 'gmail' | 'discord') => {
    if (!user?.id) {
      toast.error('Please wait, loading user info...');
      return;
    }
    const url = provider === 'gmail'
      ? connectApi.getGmailUrl(user.id)
      : connectApi.getDiscordUrl(user.id);
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(url, 'oauth_popup', `width=${width},height=${height},top=${top},left=${left}`);
    if (!popup) {
      toast.error('Popup was blocked. Please allow popups and try again.');
    }
  };

  const disconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      await connectApi.disconnectProvider(provider);
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`);
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const gmailAccount = accounts.find((a) => a.provider === 'gmail');
  const discordAccount = accounts.find((a) => a.provider === 'discord');


  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage your account and integrations
        </p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
            <User className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Profile
          </h2>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'var(--theme-gradient)' }}
            >
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name || '—'}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.email}</div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Integrations */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold flex items-center gap-2 mb-5" style={{ color: 'var(--text-primary)' }}>
            <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Connected Accounts
          </h2>

          <div className="space-y-3">
            {/* Gmail */}
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: gmailAccount ? 'rgba(16,185,129,0.15)' : 'var(--accent-glow)' }}
                >
                  <Mail
                    className="w-5 h-5"
                    style={{ color: gmailAccount ? 'var(--success)' : 'var(--accent)' }}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    Gmail
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {gmailAccount
                      ? `${gmailAccount.metadata?.email || user?.email || 'Connected'} — Read, send & manage emails`
                      : 'Not connected — Read, send & manage emails'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gmailAccount ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <button
                      onClick={() => disconnect('gmail')}
                      disabled={disconnecting === 'gmail'}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Disconnect"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect('gmail')}
                    disabled={!user?.id}
                    className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Discord */}
            <DiscordPanel
              account={discordAccount}
              onConnect={() => handleConnect('discord')}
              onDisconnect={() => disconnect('discord')}
              disconnecting={disconnecting === 'discord'}
            />


          </div>
        </Card>
      </motion.div>

    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
