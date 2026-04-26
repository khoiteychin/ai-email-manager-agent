'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { connectApi, userApi } from '@/lib/api';
import { Card, Button } from '@/components/ui';
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
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

interface ConnectedAccount {
  provider: string;
  scope: string;
  metadata: any;
  updatedAt: string;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    // Handle OAuth callbacks
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully! ✨`);
      loadAccounts();
    }
    if (error) {
      toast.error(`Failed to connect ${error}. Please try again.`);
    }
  }, [searchParams]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await connectApi.getAccounts();
      setAccounts(res.data);
    } catch {
      // No accounts yet
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      await connectApi.disconnectProvider(provider);
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
      toast.success(`${provider} disconnected`);
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
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Manage your account and integrations
        </p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-blue-400" />
            Profile
          </h2>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            >
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="text-base font-semibold text-white">{user?.name || '—'}</div>
              <div className="text-sm" style={{ color: '#64748b' }}>{user?.email}</div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Integrations */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
            <Bell className="w-4 h-4 text-blue-400" />
            Connected Accounts
          </h2>

          <div className="space-y-4">
            {/* Gmail */}
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(14,22,41,0.6)', border: '1px solid rgba(59,130,246,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: gmailAccount ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)' }}
                >
                  <Mail
                    className="w-5 h-5"
                    style={{ color: gmailAccount ? '#10b981' : '#3b82f6' }}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Gmail</div>
                  {gmailAccount ? (
                    <div className="text-xs" style={{ color: '#10b981' }}>
                      ✓ Connected — {(gmailAccount.metadata as any)?.email || 'Unknown'}
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: '#64748b' }}>
                      Not connected — Read, send & manage emails
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gmailAccount ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
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
                  <a href="/api/connect/gmail">
                    <Button variant="primary" size="sm">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Connect Gmail
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Discord */}
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(14,22,41,0.6)', border: '1px solid rgba(59,130,246,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: discordAccount ? 'rgba(16,185,129,0.15)' : 'rgba(88,101,242,0.15)' }}
                >
                  <MessageSquare
                    className="w-5 h-5"
                    style={{ color: discordAccount ? '#10b981' : '#5865f2' }}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Discord</div>
                  {discordAccount ? (
                    <div className="text-xs" style={{ color: '#10b981' }}>
                      ✓ Connected — {(discordAccount.metadata as any)?.username || 'Unknown'}
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: '#64748b' }}>
                      Not connected — Receive notifications & chat with AI
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {discordAccount ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <button
                      onClick={() => disconnect('discord')}
                      disabled={disconnecting === 'discord'}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Disconnect"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                ) : (
                  <a href="/api/connect/discord">
                    <Button variant="primary" size="sm">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Connect Discord
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Security info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-blue-400" />
            Security
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Password hashing', value: 'bcrypt (rounds: 12)', ok: true },
              { label: 'Token storage', value: 'AES-256-CBC encrypted at rest', ok: true },
              { label: 'Auth tokens', value: 'httpOnly cookies (XSS-safe)', ok: true },
              { label: 'Rate limiting', value: 'Active (10 req/10s auth, 100/min API)', ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span style={{ color: '#94a3b8' }}>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#64748b' }}>{item.value}</span>
                  {item.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
