'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { connectApi, discordApi } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface ConnectedAccount {
  provider: string;
  metadata: any;
  updatedAt: string;
}

// ─── Discord Panel ────────────────────────────────────────────
function DiscordPanel({
  account, onConnect, onDisconnect, disconnecting,
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

  useEffect(() => {
    if (account) {
      discordApi.getStatus().then((res) => setChannelId(res.data.channelId)).catch(() => {});
    }
  }, [account]);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await discordApi.getStatus();
      setChannelId(res.data.channelId);
    } catch { toast.error('Failed to update status'); }
    finally { setRefreshing(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await discordApi.testNotification();
      if (res.data.success) toast.success('Test notification sent to Discord');
      else toast.error(res.data.error || 'Failed');
    } catch { toast.error('Failed to send test'); }
    finally { setTesting(false); }
  };

  const isConnected = !!account;

  return (
    <div style={{ background: 'var(--black)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {/* Discord symbol — no icon */}
          <div
            className="w-9 h-9 flex items-center justify-center font-mono text-base font-bold"
            style={{
              background: isConnected ? 'rgba(0,255,136,0.10)' : 'var(--black-elevated)',
              border: `1px solid ${isConnected ? 'var(--green-border)' : 'var(--border)'}`,
              color: isConnected ? 'var(--green)' : 'var(--white-muted)',
            }}
          >
            ◈
          </div>
          <div>
            <div className="font-mono text-sm font-medium flex items-center gap-2" style={{ color: 'var(--white)' }}>
              Discord
              {isConnected && channelId && (
                <span className="font-mono text-xs px-1.5 py-0.5" style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green-border)' }}>
                  ● connected
                </span>
              )}
              {isConnected && !channelId && (
                <span className="font-mono text-xs px-1.5 py-0.5" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(255,184,0,0.25)' }}>
                  ◌ awaiting ping
                </span>
              )}
            </div>
            <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--white-muted)' }}>
              {isConnected ? 'receive email notifications via Discord bot' : 'not connected — notifications & AI chat'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>✓</span>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="font-mono text-xs px-2 py-1 transition-colors"
                style={{ color: 'var(--white-muted)', border: '1px solid var(--border)' }}
              >
                {expanded ? '▲ hide' : '▼ config'}
              </button>
              <button
                onClick={onDisconnect}
                disabled={disconnecting}
                className="font-mono text-xs px-2 py-1 transition-all"
                style={{ color: 'var(--red)', border: '1px solid rgba(255,59,59,0.3)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                ✕ disconnect
              </button>
            </>
          ) : (
            <button onClick={onConnect} className="btn-primary">
              ↗ connect
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
            className="overflow-hidden border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="p-4 space-y-4">
              <div
                className="p-4 space-y-3 font-mono text-xs"
                style={{ background: 'var(--black-soft)', border: '1px solid var(--border)' }}
              >
                <div style={{ color: 'var(--amber)' }}>⚠ setup instructions</div>
                <div style={{ color: 'var(--white-dim)' }}>
                  <div>1. Add <strong style={{ color: 'var(--white)' }}>ktcbot</strong> to your server.</div>
                  <div className="mt-1">2. Type <strong style={{ color: 'var(--green)' }}>@ktcbot Xin chào</strong> in your notification channel.</div>
                  <div className="mt-1">3. Bot will auto-link that channel to your account.</div>
                </div>

                {channelId ? (
                  <div className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                    ● linked channel: <code style={{ color: 'var(--white)', background: 'var(--black-elevated)', padding: '1px 6px' }}>{channelId}</code>
                  </div>
                ) : (
                  <div className="font-mono text-xs" style={{ color: 'var(--amber)' }}>
                    ◌ waiting for bot message...
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={fetchStatus}
                    disabled={refreshing}
                    className="btn-ghost text-xs px-3 py-1.5"
                  >
                    {refreshing ? '⟳ refreshing...' : '⟳ refresh status'}
                  </button>
                  {channelId && (
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="font-mono text-xs px-3 py-1.5 transition-all"
                      style={{
                        background: 'var(--green-dim)',
                        color: 'var(--green)',
                        border: '1px solid var(--green-border)',
                      }}
                    >
                      {testing ? '⟳ sending...' : '↗ test notification'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Settings Content ─────────────────────────────────────────
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
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected`);
        loadAccounts();
      } else if (event.data?.type === 'OAUTH_ERROR') {
        toast.error(`Failed to connect ${event.data.provider || 'account'}`);
      }
    };
    window.addEventListener('message', handleMessage);

    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected && (!window.opener || window.name !== 'oauth_popup')) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected`);
      loadAccounts();
    }
    if (error) toast.error(`Failed to connect ${error}`);

    return () => window.removeEventListener('message', handleMessage);
  }, [searchParams]);

  useEffect(() => { if (user?.id) loadAccounts(); }, [user]);

  const loadAccounts = async () => {
    if (!user?.id) return;
    try {
      const res = await connectApi.getAccounts(user.id);
      setAccounts(res.data);
    } catch { /* no accounts */ }
    finally { setLoading(false); }
  };

  const handleConnect = (provider: 'gmail' | 'discord') => {
    if (!user?.id) { toast.error('Loading user info...'); return; }
    const url = provider === 'gmail' ? connectApi.getGmailUrl(user.id) : connectApi.getDiscordUrl(user.id);
    const [w, h] = [600, 700];
    const popup = window.open(url, 'oauth_popup', `width=${w},height=${h},top=${window.screen.height / 2 - h / 2},left=${window.screen.width / 2 - w / 2}`);
    if (!popup) toast.error('Popup blocked. Allow popups and try again.');
  };

  const disconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      await connectApi.disconnectProvider(provider);
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`);
    } catch { toast.error('Failed to disconnect'); }
    finally { setDisconnecting(null); }
  };

  const gmailAccount = accounts.find((a) => a.provider === 'gmail');
  const discordAccount = accounts.find((a) => a.provider === 'discord');

  const SECURITY_ITEMS = [
    { label: 'Authentication', value: 'Firebase JWT (signed & verified)', ok: true },
    { label: 'Token storage', value: 'Encrypted at rest (AES-256)', ok: true },
    { label: 'XSS Protection', value: 'CSP + X-XSS-Protection headers', ok: true },
    { label: 'HTTPS', value: "HSTS enforced (Let's Encrypt SSL)", ok: true },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="font-mono text-xs mb-1" style={{ color: 'var(--green)' }}>~/settings</div>
        <h1 className="font-editorial text-3xl font-bold leading-none" style={{ color: 'var(--white)' }}>
          Settings
        </h1>
        <p className="font-mono text-xs mt-1.5" style={{ color: 'var(--white-muted)' }}>
          — account config · integrations · security
        </p>
      </motion.div>

      {/* ── Profile ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="section-label mb-3">Profile</div>
        <div
          className="p-5 flex items-center gap-4"
          style={{ background: 'var(--black-card)', border: '1px solid var(--border)' }}
        >
          {/* Square avatar */}
          <div
            className="w-12 h-12 flex items-center justify-center text-lg font-mono font-bold flex-shrink-0"
            style={{ background: 'var(--green)', color: 'var(--black)', border: '2px solid var(--green)' }}
          >
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="font-medium" style={{ color: 'var(--white)' }}>{user?.name || '—'}</div>
            <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--white-muted)' }}>{user?.email}</div>
          </div>
          <div className="ml-auto">
            <span className="ai-tag">firebase auth</span>
          </div>
        </div>
      </motion.div>

      {/* ── Integrations ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
        <div className="section-label mb-3">Integrations</div>

        <div className="space-y-2">
          {/* Gmail */}
          <div style={{ background: 'var(--black-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 flex items-center justify-center font-mono text-base font-bold"
                  style={{
                    background: gmailAccount ? 'rgba(0,255,136,0.10)' : 'var(--black-elevated)',
                    border: `1px solid ${gmailAccount ? 'var(--green-border)' : 'var(--border)'}`,
                    color: gmailAccount ? 'var(--green)' : 'var(--white-muted)',
                  }}
                >
                  ✉
                </div>
                <div>
                  <div className="font-mono text-sm font-medium" style={{ color: 'var(--white)' }}>Gmail</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--white-muted)' }}>
                    {gmailAccount
                      ? `${gmailAccount.metadata?.email || user?.email || 'Connected'} — read, send & manage`
                      : 'not connected — read, send & manage emails'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gmailAccount ? (
                  <>
                    <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>✓</span>
                    <button
                      onClick={() => disconnect('gmail')}
                      disabled={disconnecting === 'gmail'}
                      className="font-mono text-xs px-2 py-1 transition-all"
                      style={{ color: 'var(--red)', border: '1px solid rgba(255,59,59,0.3)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      ✕ disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect('gmail')}
                    disabled={!user?.id}
                    className="btn-primary disabled:opacity-50"
                  >
                    ↗ connect
                  </button>
                )}
              </div>
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
      </motion.div>

      {/* ── Security ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="section-label mb-3">Security</div>
        <div
          className="p-5 space-y-3"
          style={{ background: 'var(--black-card)', border: '1px solid var(--border)' }}
        >
          {SECURITY_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="font-mono text-xs" style={{ color: 'var(--white-dim)' }}>{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>{item.value}</span>
                <span
                  className="font-mono text-xs"
                  style={{ color: item.ok ? 'var(--green)' : 'var(--red)' }}
                >
                  {item.ok ? '✓' : '✗'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 font-mono text-sm" style={{ color: 'var(--white-muted)' }}>
        loading settings...
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
