'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Input, Button } from '@/components/ui';
import { Mail, Lock, Zap, ArrowRight, Eye, EyeOff } from 'lucide-react';
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
      toast.success('Welcome back');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 mb-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--theme-gradient)' }}
            >
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Welcome back</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {confirmed ? 'Email confirmed. You can sign in now.' : 'Sign in to your AI Email Manager'}
          </p>
        </div>

        <div className="glass p-8">
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
              <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full justify-center">
              Sign In <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div
            className="mt-5 p-3 rounded-xl text-xs text-center"
            style={{ background: 'var(--accent-glow)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Don't have an account? Register free to get started.
          </div>

          <div className="mt-5 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" className="hover:underline font-medium" style={{ color: 'var(--accent)' }}>
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
