'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Input, Button } from '@/components/ui';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConfirmed(new URLSearchParams(window.location.search).get('confirmed') === 'true');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Access granted.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* ── Terminal header ── */}
        <div className="mb-6">
          <div
            className="font-mono text-xs mb-1"
            style={{ color: 'var(--green)' }}
          >
            $ ./login --auth firebase
          </div>
          <h1
            className="font-editorial text-4xl font-bold leading-none"
            style={{ color: 'var(--white)' }}
          >
            Mail<span style={{ color: 'var(--green)' }}>OS</span>
          </h1>
          <p
            className="font-mono text-xs mt-2"
            style={{ color: 'var(--white-muted)' }}
          >
            {confirmed
              ? '✓ email confirmed — sign in to continue'
              : 'AI-powered email management system'}
          </p>
        </div>

        {/* ── Auth card — brutalist border ── */}
        <div
          className="p-8"
          style={{
            background: 'var(--black-card)',
            border: '2px solid var(--border-strong)',
            boxShadow: '6px 6px 0px rgba(0,255,136,0.12)',
          }}
        >
          {/* Card header bar */}
          <div
            className="flex items-center gap-2 mb-6 pb-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="w-2 h-2 bg-red-500 inline-block" />
            <span className="w-2 h-2 bg-yellow-400 inline-block" />
            <span
              className="w-2 h-2 inline-block"
              style={{ background: 'var(--green)' }}
            />
            <span
              className="font-mono text-xs ml-2"
              style={{ color: 'var(--white-muted)' }}
            >
              authenticate.sh
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              icon="@"
            />

            <div className="space-y-1.5">
              <label
                className="block font-mono text-xs font-medium tracking-wide uppercase"
                style={{ color: 'var(--white-muted)' }}
              >
                Password
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm select-none"
                  style={{ color: 'var(--green)' }}
                >
                  #
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="input-field pl-9 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs transition-colors"
                  style={{ color: 'var(--white-muted)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--green)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--white-muted)')}
                >
                  {showPass ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center"
            >
              {loading ? 'authenticating...' : '$ sign-in --submit'}
            </Button>
          </form>

          {/* Register link */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
              no account?{' '}
              <Link
                href="/register"
                className="font-medium underline underline-offset-2 transition-colors"
                style={{ color: 'var(--green)' }}
              >
                ./register --new
              </Link>
            </p>
          </div>
        </div>

        {/* ── Bottom status bar ── */}
        <div
          className="mt-3 flex items-center justify-between font-mono text-xs px-2"
          style={{ color: 'var(--white-muted)' }}
        >
          <span>v1.0.0</span>
          <span style={{ color: 'var(--green)' }}>● system ready</span>
        </div>
      </motion.div>
    </div>
  );
}
