import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ─────────────────────────────────────
api.interceptors.request.use((config) => {
  // Token is stored in httpOnly cookie — browser sends automatically
  // But also check localStorage for access_token (fallback)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response interceptor (auto refresh) ────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post('/auth/refresh');
        const { accessToken } = res.data;
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
        }
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth APIs ───────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ─── User APIs ───────────────────────────────────────────────
export const userApi = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: { name?: string }) => api.patch('/user/profile', data),
  getStats: () => api.get('/user/stats'),
};

// ─── Emails APIs ─────────────────────────────────────────────
export const emailsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    category?: string;
    priority?: string;
    search?: string;
    isRead?: boolean;
  }) => api.get('/emails', { params }),
  get: (id: string) => api.get(`/emails/${id}`),
  toggleStar: (id: string) => api.patch(`/emails/${id}/star`),
  markAsRead: (id: string, isRead: boolean) => api.patch(`/emails/${id}/read`, { isRead }),
};

// ─── AI APIs ─────────────────────────────────────────────────
export const aiApi = {
  chat: (data: { message: string; sessionId?: string }) => api.post('/ai/chat', data),
  generateDraft: (data: { instruction: string; emailId?: string; context?: string }) =>
    api.post('/ai/draft', data),
  sendEmail: (data: { to: string; subject: string; body: string; emailId?: string }) =>
    api.post('/ai/send', data),
  getSessions: () => api.get('/ai/sessions'),
  getSessionHistory: (sessionId: string) => api.get(`/ai/sessions/${sessionId}`),
};

// ─── Connect APIs ─────────────────────────────────────────────
export const connectApi = {
  getAccounts: () => api.get('/connect/accounts'),
  disconnectProvider: (provider: string) => api.delete(`/connect/${provider}`),
  getGmailUrl: () => `/api/connect/gmail`,
  getDiscordUrl: () => `/api/connect/discord`,
};

export default api;
