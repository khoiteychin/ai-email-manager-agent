'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Input, Button } from '@/components/ui';
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConfirmed(new URLSearchParams(window.location.search).get('confirmed') === 'true');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--green) 0%, #00b4d8 100%)',
              boxShadow: '0 0 24px var(--green-glow)',
            }}
          >
            <Zap className="w-6 h-6" style={{ color: 'var(--black)' }} />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--white)' }}>
            Welcome to{' '}
            <span className="gradient-text">MailOS</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--white-muted)' }}>
            {confirmed
              ? '✓ Email confirmed — sign in to continue'
              : 'AI-powered email management'}
          </p>
        </div>

        {/* Card */}
        <div
          className="p-8"
          style={{
            background: 'var(--black-card)',
            border: '1px solid var(--border-strong)',
            borderRadius: '12px',
            boxShadow: '0 0 0 1px var(--border), 0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              icon={<Mail className="w-4 h-4" />}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold" style={{ color: 'var(--white-muted)' }}>
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--white-muted)' }}>
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--white-muted)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--white)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--white-muted)')}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full justify-center">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--white-muted)' }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-semibold transition-colors"
                style={{ color: 'var(--green)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none')}
              >
                Create account
              </Link>
            </p>
          </div>
        </div>

        {/* Mono tag */}
        <div className="mt-4 text-center">
          <span className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
            v1.0.0 · secured by Firebase Auth
          </span>
        </div>
      </motion.div>
    </div>
  );
}
