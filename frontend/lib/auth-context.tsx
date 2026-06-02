'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { authApi } from './api';
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
  confirmRegistration: (email: string, code: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Trích xuất token và lưu vào localStorage để gửi lên Backend
        const token = await firebaseUser.getIdToken();
        localStorage.setItem('access_token', token);
        
        try {
          const res = await authApi.me();
          setUser({
            id: res.data.userId || res.data.id || firebaseUser.uid,
            email: res.data.email || firebaseUser.email || '',
            name: firebaseUser.displayName || res.data.name
          });
        } catch {
          // Fallback nếu Backend chưa setup xong
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || undefined
          });
        }
      } else {
        setUser(null);
        localStorage.removeItem('access_token');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, name?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    if (name) {
      await updateProfile(userCredential.user, { displayName: name });
    }
    
    // Firebase auth auto-logins after register
    router.push('/dashboard');
  };

  const confirmRegistration = async (email: string, code: string, username?: string) => {
    // Firebase mặc định không yêu cầu nhập mã OTP code như Cognito trừ khi cấu hình Email Link
    // Ở mô hình Low Code, ta cho phép login ngay sau khi đăng ký thành công.
    router.push('/login?confirmed=true');
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem('access_token');
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(true); // Force refresh
      localStorage.setItem('access_token', token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, confirmRegistration, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
