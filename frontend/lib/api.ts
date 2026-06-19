import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ─────────────────────────────────────
import { auth } from './firebase';

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    try {
      let token = localStorage.getItem('access_token');
      // Thử lấy token mới nhất từ Firebase nếu user đang đăng nhập
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
        localStorage.setItem('access_token', token);
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Fallback
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// ─── Response interceptor ─────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        const publicPaths = ['/login', '/register', '/confirm'];
        const isPublicPath = publicPaths.some(p => window.location.pathname.startsWith(p));
        if (!isPublicPath) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

const localApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Thêm interceptor tương tự cho localApi
localApi.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    try {
      let token = localStorage.getItem('access_token');
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
        localStorage.setItem('access_token', token);
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

localApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        const publicPaths = ['/login', '/register', '/confirm'];
        const isPublicPath = publicPaths.some(p => window.location.pathname.startsWith(p));
        if (!isPublicPath) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth APIs ───────────────────────────────────────────────
export const authApi = {
  me: () => localApi.get('/auth/me'),
};

// ─── User APIs ───────────────────────────────────────────────
export const userApi = {
  getProfile: () => localApi.get('/user/profile'),
  updateProfile: (data: { name?: string }) => localApi.patch('/user/profile', data),
  getStats: () => api.get('/user/stats'), // Vẫn dùng N8N
};

// ─── Emails APIs ─────────────────────────────────────────────────────────────
export const emailsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    category?: string;
    priority?: string;
    search?: string;
    isRead?: boolean;
    isStarred?: boolean;
  }) => api.get('/emails', { params }),
  get: (id: string) => api.get(`/emails/${id}`),
  toggleStar: (id: string) => api.patch(`/emails/${id}/star`),
  markAsRead: (id: string, isRead: boolean) => api.patch(`/emails/${id}/read`, { isRead }),
  // Bug #3 fix: manual sync trigger (now uses incremental sync internally)
  sync: (limit?: number) => api.post('/emails/sync', {}, { params: limit ? { limit } : {} }),
  // Bug #4 fix: lightweight polling – only queries DB, no Gmail API call
  checkNew: (since?: string) => api.get('/emails/check-new', { params: since ? { since } : {} }),
};

// ─── AI APIs ─────────────────────────────────────────────────
export const aiApi = {
  chat: (data: { message: string; sessionId?: string }) => api.post('/ai/chat', data),
  generateDraft: (data: { instruction: string; emailId?: string; context?: string }) =>
    api.post('/ai/draft', data),
  sendEmail: (data: { to: string; subject: string; body: string; emailId?: string }) =>
    api.post('/ai/send', data),
  getSessions: () => api.get('/ai/sessions'),
  getSessionHistory: (sessionId: string) => api.get(`/ai/sessions/history?sessionId=${sessionId}`),
  // Bug #7 fix: add deleteSession so chat UI can remove sessions
  deleteSession: (sessionId: string) => api.delete(`/ai/sessions/${sessionId}`),
  deleteMessage: (messageId: string) => api.delete(`/ai/messages/${messageId}`),
};

// ─── Drafts APIs ──────────────────────────────────────────────
export const draftsApi = {
  save: (id: string, data: { to: string; subject: string; body: string }) =>
    api.patch(`/drafts/${id}`, data),
  send: (id: string) =>
    api.post(`/drafts/${id}/send`),
};

// ─── Connect APIs ─────────────────────────────────────────────
export const connectApi = {
  getAccounts: (userId: string) => localApi.get(`/connect/accounts?user_id=${userId}&t=${Date.now()}`),
  disconnectProvider: (provider: string) => localApi.delete(`/connect/${provider}`),
  getGmailUrl: (userId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.emailkhanh.freeddns.org';
    return `${base}/gmail/connect?token=${token}`;
  },
  getDiscordUrl: (userId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.emailkhanh.freeddns.org';
    return `${base}/discord/connect?token=${token}`;
  },
};

// ─── Discord APIs ─────────────────────────────────────────────
export const discordApi = {
  getStatus: () => api.get('/discord/status'),
  testNotification: (message?: string) => api.post('/discord/test', { message }),
};

// ─── Telegram APIs ────────────────────────────────────────────
export const telegramApi = {
  getToken: () => api.get('/telegram/token'),
  testNotification: (message?: string) => api.post('/telegram/test', { message }),
};

export default api;
