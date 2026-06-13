'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Input, Button } from '@/components/ui';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) {
      toast.error('Password: 8+ chars, uppercase, lowercase, number');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      toast.success('Account created. Welcome aboard.');
    } catch (err: any) {
      const message = err?.message || err?.response?.data?.message || 'Registration failed';
      toast.error(message);
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
          <div className="font-mono text-xs mb-1" style={{ color: 'var(--green)' }}>
            $ ./register --new-account
          </div>
          <h1 className="font-editorial text-4xl font-bold leading-none" style={{ color: 'var(--white)' }}>
            Mail<span style={{ color: 'var(--green)' }}>OS</span>
          </h1>
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--white-muted)' }}>
            create account / get started
          </p>
        </div>

        {/* ── Brutalist card ── */}
        <div
          className="p-8"
          style={{
            background: 'var(--black-card)',
            border: '2px solid var(--border-strong)',
            boxShadow: '6px 6px 0px rgba(0,255,136,0.12)',
          }}
        >
          {/* Window bar */}
          <div className="flex items-center gap-2 mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="w-2 h-2 bg-red-500 inline-block" />
            <span className="w-2 h-2 bg-yellow-400 inline-block" />
            <span className="w-2 h-2 inline-block" style={{ background: 'var(--green)' }} />
            <span className="font-mono text-xs ml-2" style={{ color: 'var(--white-muted)' }}>
              register.sh
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Display Name"
              type="text"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              icon="~"
            />
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
                  placeholder="8+ chars, uppercase, number"
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
              {/* Password hint */}
              <p className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
                min 8 chars · 1 uppercase · 1 number
              </p>
            </div>

            <Button type="submit" loading={loading} className="w-full justify-center">
              {loading ? 'creating account...' : '$ register --submit'}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="font-mono text-xs" style={{ color: 'var(--white-muted)' }}>
              have account?{' '}
              <Link
                href="/login"
                className="font-medium underline underline-offset-2"
                style={{ color: 'var(--green)' }}
              >
                ./login
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-xs px-2" style={{ color: 'var(--white-muted)' }}>
          <span>v1.0.0</span>
          <span style={{ color: 'var(--green)' }}>● system ready</span>
        </div>
      </motion.div>
    </div>
  );
}
