'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, userApi } from './api';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (res.data.accessToken) {
      localStorage.setItem('access_token', res.data.accessToken);
    }
    setUser(res.data.user);
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await authApi.register({ email, password, name });
    if (res.data.accessToken) {
      localStorage.setItem('access_token', res.data.accessToken);
    }
    setUser(res.data.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    await authApi.logout();
    localStorage.removeItem('access_token');
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    const res = await authApi.me();
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
