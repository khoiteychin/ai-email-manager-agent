'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Input, Button } from '@/components/ui';
import { Mail, Lock, Zap, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back! ✨');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            >
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Welcome back</h1>
          <p className="text-sm mt-2" style={{ color: '#64748b' }}>
            Sign in to your AI Email Manager
          </p>
        </div>

        {/* Card */}
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
              <label className="block text-xs font-medium" style={{ color: '#94a3b8' }}>
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
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
                  style={{ color: '#475569' }}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full justify-center">
              Sign In <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Demo hint */}
          <div
            className="mt-5 p-3 rounded-xl text-xs text-center"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#94a3b8' }}
          >
            💡 Demo: register an account first, then log in
          </div>

          <div className="mt-5 text-center">
            <p className="text-sm" style={{ color: '#64748b' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
