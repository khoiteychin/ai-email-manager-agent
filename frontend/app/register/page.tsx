'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Input, Button } from '@/components/ui';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) {
      toast.error('Password needs 8+ chars, uppercase, lowercase, and a number');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      toast.success('Account created successfully. Welcome!');
    } catch (err: any) {
      const message = err?.message || err?.response?.data?.message || 'Registration failed';
      console.error('[Register Error]', err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <Mail className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Create your account</h1>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            Start managing emails with AI
          </p>
        </div>

        <div className="glass p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              icon={<User className="w-4 h-4" />}
            />
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
              <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="8+ chars, uppercase, number"
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
              Create Account <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link href="/login" className="hover:underline font-semibold" style={{ color: 'var(--accent)' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
