# Giải Thích Code Frontend — Từng Dòng

> Tài liệu này giải thích **từng dòng code** phần Frontend (Next.js/TypeScript) bằng ngôn ngữ thường ngày, không cần nền tảng lập trình để hiểu.

---

## 📁 Cấu trúc Frontend

```
frontend/
├── app/                          ← Các trang của ứng dụng (Next.js App Router)
│   ├── layout.tsx               ← Khung chung bọc TOÀN BỘ trang
│   ├── globals.css              ← CSS toàn cục (màu sắc, font, animations)
│   ├── page.tsx                 ← Trang "/" (root) → redirect → /dashboard
│   ├── login/                   ← Trang đăng nhập
│   ├── register/                ← Trang đăng ký
│   └── (dashboard)/             ← Nhóm trang khi đã đăng nhập
│       ├── layout.tsx           ← Kiểm tra đăng nhập + Sidebar
│       ├── emails/              ← Trang danh sách email
│       │   ├── page.tsx         ← /emails
│       │   └── [id]/page.tsx    ← /emails/abc123 (chi tiết)
│       ├── chat/page.tsx        ← /chat (AI Chatbot)
│       ├── dashboard/page.tsx   ← /dashboard (Tổng quan)
│       └── settings/page.tsx   ← /settings (Cài đặt kết nối)
├── components/
│   ├── ui/                      ← Các component tái sử dụng (Button, Card, Badge...)
│   └── sidebar/Sidebar.tsx     ← Thanh điều hướng bên trái
└── lib/
    ├── firebase.ts              ← Khởi động Firebase
    ├── auth-context.tsx         ← Quản lý trạng thái đăng nhập toàn app
    └── api.ts                   ← Tất cả hàm gọi Backend API
```

---

# PHẦN 1: lib/firebase.ts — Khởi động Firebase

> **Giải thích đơn giản**: File này giống như **bật công tắc kết nối** đến Firebase. Phải làm việc này một lần, trước khi dùng bất kỳ tính năng Firebase nào.

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
// initializeApp = hàm tạo kết nối Firebase lần đầu
// getApps() = kiểm tra xem đã có kết nối nào chưa
// getApp() = lấy kết nối đang có (không tạo mới)

import { getAuth } from 'firebase/auth';
// getAuth = lấy dịch vụ Authentication từ Firebase app

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // process.env = đọc biến môi trường từ file .env.local
  // NEXT_PUBLIC_ = prefix bắt buộc để Next.js cho phép dùng ở phía trình duyệt
  // Không có NEXT_PUBLIC_ → biến này chỉ tồn tại ở server, trình duyệt không thấy

  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // authDomain = domain xử lý đăng nhập: "ten-project.firebaseapp.com"

  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // projectId = ID duy nhất của Firebase project

  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Khởi tạo Firebase — KHÔNG khởi tạo lại nếu đã có
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// !getApps().length = "nếu chưa có app nào" → tạo mới
// : getApp() = "nếu đã có" → lấy cái cũ ra dùng
// Kỹ thuật này tránh lỗi "Firebase App named '[DEFAULT]' already exists"
// (Next.js đôi khi render module nhiều lần trong quá trình build)

const auth = getAuth(app);
// auth = đối tượng dịch vụ xác thực
// Dùng để: đăng nhập, đăng ký, đăng xuất, lấy token JWT

export { app, auth };
// Export để các file khác import và dùng
```

---

# PHẦN 2: lib/auth-context.tsx — Quản lý đăng nhập toàn app

> **Giải thích đơn giản**: File này giống như **nhà quản lý chìa khóa** của tòa nhà. Nó biết ai đang ở bên trong (đã đăng nhập), ai chưa, và cung cấp chìa khóa (hàm login/logout) cho tất cả các phòng (component) cần dùng.

## Dòng 1–3: Khai báo "use client"

```typescript
'use client';
// Dòng này BẮT BUỘC ở đầu file nếu dùng React hooks (useState, useEffect...)
// Next.js 14 mặc định render ở Server (nhanh hơn cho SEO)
// 'use client' = "file này chạy ở trình duyệt, có thể dùng hooks và sự kiện DOM"
```

## Dòng 3–11: Import

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// createContext = tạo "hộp chứa" dữ liệu dùng chung (Context)
// useContext = lấy dữ liệu từ hộp đó trong bất kỳ component nào
// useEffect = chạy code phụ (side effect) khi component mount/update
// useState = tạo biến có thể thay đổi, mỗi lần đổi → re-render
// ReactNode = kiểu TypeScript cho "bất kỳ nội dung React nào" (component, text, số...)

import {
  signInWithEmailAndPassword,    // Đăng nhập bằng email + password
  createUserWithEmailAndPassword, // Tạo tài khoản mới
  signOut as firebaseSignOut,    // Đăng xuất (đặt tên lại tránh trùng)
  onAuthStateChanged,            // Lắng nghe sự thay đổi trạng thái đăng nhập
  updateProfile,                 // Cập nhật tên hiển thị
  User as FirebaseUser           // Kiểu dữ liệu User của Firebase
} from 'firebase/auth';
```

## Dòng 16–31: Định nghĩa kiểu dữ liệu (TypeScript Interface)

```typescript
interface User {
  // Interface = "hợp đồng" định nghĩa cấu trúc dữ liệu
  // Giống như bản mô tả "User phải có những trường này"
  id: string;        // uid Firebase
  email: string;     // Địa chỉ email
  name?: string;     // Tên hiển thị — dấu ? = tùy chọn (có thể không có)
  avatarUrl?: string;// URL ảnh đại diện
}

interface AuthContextType {
  user: User | null;          // User hiện tại hoặc null (chưa đăng nhập)
  loading: boolean;           // Đang kiểm tra trạng thái đăng nhập hay không
  login: (email: string, password: string) => Promise<void>;
  // login = hàm nhận email+password, trả về Promise<void>
  // Promise = kết quả bất đồng bộ, void = không có giá trị trả về
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

## Dòng 33–74: Tạo Context và AuthProvider

```typescript
const AuthContext = createContext<AuthContextType | null>(null);
// Tạo "hộp chứa" với kiểu AuthContextType, giá trị ban đầu là null
// null = chưa được cung cấp bởi Provider

export function AuthProvider({ children }: { children: ReactNode }) {
  // AuthProvider = component "bao bọc" toàn bộ app, cung cấp dữ liệu auth
  // children = nội dung bên trong <AuthProvider>...</AuthProvider>

  const [user, setUser] = useState<User | null>(null);
  // user = trạng thái người dùng hiện tại
  // setUser = hàm để cập nhật giá trị user
  // Mỗi lần setUser() được gọi → React re-render toàn bộ component dùng user

  const [loading, setLoading] = useState(true);
  // loading = true khi đang kiểm tra xem có token cũ không
  // Ban đầu true vì chưa biết user có đăng nhập hay không

  const router = useRouter();
  // router = đối tượng điều hướng trang (thay vì window.location.href)

  useEffect(() => {
    // useEffect(() => {...}, []) = chạy 1 lần duy nhất sau khi component mount
    // [] = mảng dependencies rỗng = chỉ chạy lần đầu

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // onAuthStateChanged = "lắng nghe" sự thay đổi trạng thái Firebase
      // Tự động gọi callback này khi: đăng nhập, đăng xuất, token refresh
      // firebaseUser = User của Firebase (hoặc null nếu chưa đăng nhập)

      if (firebaseUser) {
        // Có user → đã đăng nhập
        const token = await firebaseUser.getIdToken();
        // Lấy JWT token mới nhất từ Firebase
        localStorage.setItem('access_token', token);
        // Lưu vào localStorage để api.ts dùng cho mọi request

        try {
          const res = await authApi.me();
          // Gọi backend /api/auth/me để lấy thông tin user từ DB nội bộ
          setUser({
            id: res.data.userId || res.data.id || firebaseUser.uid,
            email: res.data.email || firebaseUser.email || '',
            name: firebaseUser.displayName || res.data.name,
            // Ưu tiên dùng displayName từ Firebase (cập nhật real-time hơn)
          });
        } catch {
          // Nếu backend lỗi → dùng thông tin từ Firebase trực tiếp
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || undefined,
          });
        }

        // Nếu đang ở trang login/register → chuyển sang dashboard
        const publicPaths = ['/login', '/register'];
        if (publicPaths.some((p) => window.location.pathname.startsWith(p))) {
          router.push('/dashboard');
        }
      } else {
        // Không có user → chưa đăng nhập hoặc vừa đăng xuất
        setUser(null);
        localStorage.removeItem('access_token');
        // Xóa token cũ khỏi localStorage
      }
      setLoading(false);
      // Dù đăng nhập hay không → đã kiểm tra xong, tắt loading
    });

    return () => unsubscribe();
    // Cleanup = hủy đăng ký listener khi component bị unmount
    // Tránh memory leak (rò rỉ bộ nhớ)
  }, []);
  // [] = dependency rỗng → chỉ chạy 1 lần khi app khởi động
```

## Dòng 76–101: Các hàm xác thực

```typescript
const login = async (email: string, password: string) => {
  await signInWithEmailAndPassword(auth, email, password);
  // Gọi Firebase để xác thực email + password
  // Nếu thành công → onAuthStateChanged tự động kích hoạt, xử lý redirect
  // Nếu thất bại → throw Error (component gọi hàm này tự catch)
};

const register = async (email: string, password: string, name?: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  // Tạo tài khoản Firebase mới

  if (name) {
    await updateProfile(userCredential.user, { displayName: name });
    // Cập nhật tên hiển thị ngay sau khi tạo tài khoản
  }
  // onAuthStateChanged tự động xử lý redirect → /dashboard
};

const logout = async () => {
  await firebaseSignOut(auth);
  // Hủy phiên đăng nhập trên Firebase
  localStorage.removeItem('access_token');
  // Xóa token khỏi trình duyệt
  setUser(null);
  router.push('/login');
  // Chuyển về trang đăng nhập
};

const refreshUser = async () => {
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken(true);
    // true = force refresh: bỏ qua cache, lấy token mới từ Firebase
    localStorage.setItem('access_token', token);
  }
};
```

## Dòng 110–121: Cung cấp Context cho toàn app

```typescript
return (
  <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
    {children}
    {/* Tất cả component con đều có thể dùng useAuth() để lấy dữ liệu này */}
  </AuthContext.Provider>
);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  // Nếu gọi useAuth() bên ngoài <AuthProvider> → báo lỗi rõ ràng
  return ctx;
  // Trả về: { user, loading, login, logout, ... }
}
```

---

# PHẦN 3: lib/api.ts — Trung tâm gọi API

> **Giải thích đơn giản**: File này là **tổng đài** của frontend. Mọi yêu cầu gửi đến backend đều phải đi qua đây. Nó tự động đính kèm token xác thực vào mọi request, và tự xử lý khi token hết hạn.

## Dòng 1–7: Tạo Axios instance

```typescript
import axios from 'axios';
// axios = thư viện gọi HTTP request (thay thế fetch() gốc của browser)
// Ưu điểm: interceptors, auto JSON parse, timeout, error handling tốt hơn

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  // baseURL = địa chỉ gốc của backend
  // Nếu có biến môi trường → dùng (vd: "https://api.emailkhanh.freeddns.org")
  // Nếu không có → dùng '/api' (Next.js proxy routes tại /api/...)

  withCredentials: true,
  // Cho phép gửi kèm cookies trong request (cần cho CORS với credentials)

  headers: { 'Content-Type': 'application/json' },
  // Mọi request đều gửi dữ liệu dưới dạng JSON
});
```

## Dòng 12–34: Request Interceptor — Tự động đính kèm token

```typescript
api.interceptors.request.use(async (config) => {
  // interceptors.request = "chặn" mọi request TRƯỚC khi gửi đi
  // config = cấu hình của request (url, method, headers, body...)
  // Đây giống như nhân viên bảo vệ: mỗi lần ai muốn ra ngoài → kiểm tra thẻ trước

  if (typeof window !== 'undefined') {
    // typeof window !== 'undefined' = "đang chạy trên trình duyệt"
    // (không phải trên server khi Next.js render)
    // Cần kiểm tra vì localStorage chỉ tồn tại ở browser

    try {
      let token = localStorage.getItem('access_token');
      // Lấy token đã lưu từ lần login/refresh gần nhất

      if (auth.currentUser) {
        // Nếu Firebase đang có user đăng nhập
        token = await auth.currentUser.getIdToken();
        // Lấy token mới nhất (Firebase tự refresh nếu token gần hết hạn)
        localStorage.setItem('access_token', token);
        // Lưu token mới vào localStorage
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Thêm header "Authorization: Bearer abc123..."
        // Backend đọc header này để xác thực người dùng
      }
    } catch (e) {
      // Nếu getIdToken() lỗi (Firebase chưa sẵn sàng...)
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Fallback: dùng token cũ từ localStorage
      }
    }
  }
  return config;
  // BẮT BUỘC trả về config → request mới được gửi đi
});
```

## Dòng 37–52: Response Interceptor — Xử lý lỗi 401

```typescript
api.interceptors.response.use(
  (response) => response,
  // Nếu response thành công (2xx) → trả về nguyên vẹn

  (error) => {
    // Nếu response lỗi → xử lý ở đây
    if (error.response?.status === 401) {
      // 401 = Unauthorized = token không hợp lệ hoặc hết hạn
      // ?. = optional chaining: tránh crash nếu error.response là null

      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        // Xóa token cũ (không còn giá trị)

        const publicPaths = ['/login', '/register', '/confirm'];
        const isPublicPath = publicPaths.some(p => window.location.pathname.startsWith(p));
        // Kiểm tra xem đang ở trang công khai chưa (login, register)

        if (!isPublicPath) {
          window.location.href = '/login';
          // Nếu đang ở trang cần đăng nhập → tự động redirect về login
        }
      }
    }
    return Promise.reject(error);
    // BẮT BUỘC reject lỗi để component gọi API tự xử lý (try/catch)
  },
);
```

## Dòng 100–180: Các nhóm API

```typescript
// ─── Emails APIs ───────────────────────────────────────────────
export const emailsApi = {
  list: (params?: {                  // ? = params tùy chọn
    page?: number;                   // Trang thứ mấy (phân trang)
    limit?: number;                  // Số email mỗi trang
    category?: string;               // Lọc theo danh mục
    priority?: string;               // Lọc theo ưu tiên
    search?: string;                 // Tìm kiếm theo từ khóa
    isRead?: boolean;                // Lọc email đã đọc/chưa đọc
  }) => api.get('/emails', { params }),
  // api.get('/emails', {params}) = GET /emails?page=1&limit=20&category=work
  // { params } = axios tự chuyển object thành query string

  get: (id: string) => api.get(`/emails/${id}`),
  // Template literal: backtick + ${} = nội suy chuỗi
  // api.get('/emails/abc-123') = GET /emails/abc-123

  toggleStar: (id: string) => api.patch(`/emails/${id}/star`),
  // PATCH = cập nhật một phần (chỉ trường star)

  markAsRead: (id: string, isRead: boolean) => api.patch(`/emails/${id}/read`, { isRead }),
  // Gửi body { isRead: true } hoặc { isRead: false }

  sync: () => api.post('/emails/sync'),
  // POST = gửi lệnh đồng bộ (không có body)

  checkNew: (since?: string) => api.get('/emails/check-new', { params: since ? { since } : {} }),
  // since ? { since } : {} = nếu since có giá trị → gửi kèm, không thì gửi object rỗng
  // { since } = shorthand của { since: since }
};

// ─── AI APIs ───────────────────────────────────────────────────
export const aiApi = {
  chat: (data: { message: string; sessionId?: string }) => api.post('/ai/chat', data),
  // Gửi tin nhắn chatbot, kèm theo sessionId để tiếp tục hội thoại cũ

  generateDraft: (data: { instruction: string; emailId?: string; context?: string }) =>
    api.post('/ai/draft', data),
  // Tạo thư nháp AI

  sendEmail: (data: { to: string; subject: string; body: string; emailId?: string }) =>
    api.post('/ai/send', data),
  // Gửi email qua Gmail API

  getSessions: () => api.get('/ai/sessions'),
  // Lấy danh sách phiên chat

  getSessionHistory: (sessionId: string) => api.get(`/ai/sessions/history?sessionId=${sessionId}`),
  // Lấy lịch sử tin nhắn của 1 phiên

  deleteSession: (sessionId: string) => api.delete(`/ai/sessions/${sessionId}`),
  // Xóa phiên chat

  deleteMessage: (messageId: string) => api.delete(`/ai/messages/${messageId}`),
  // Xóa 1 tin nhắn
};

// ─── Drafts APIs ───────────────────────────────────────────────
export const draftsApi = {
  save: (id: string, data: { to: string; subject: string; body: string }) =>
    api.patch(`/drafts/${id}`, data),
  // Cập nhật nội dung bản nháp đã tạo trên Gmail

  send: (id: string) => api.post(`/drafts/${id}/send`),
  // Gửi bản nháp Gmail đi (gửi thực sự)
};

// ─── Connect APIs ──────────────────────────────────────────────
export const connectApi = {
  getGmailUrl: (userId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.emailkhanh.freeddns.org';
    return `${base}/gmail/connect?token=${token}`;
    // Trả về URL để redirect người dùng đến trang OAuth của Google
    // Kèm token trong URL vì đây là redirect (không thể dùng header)
  },
};
```

---

# PHẦN 4: app/layout.tsx — Khung chung toàn trang

> **Giải thích đơn giản**: Đây là "bộ khung" bọc ngoài mọi trang. Giống như mọi trang trong sách đều có bìa chung và số trang — khung này bọc xung quanh mọi thứ.

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
// Toaster = component hiển thị thông báo nhỏ (toast) góc màn hình

const inter = Inter({ subsets: ['latin'] });
// Inter = font chữ hiện đại từ Google Fonts
// subsets: ['latin'] = chỉ tải ký tự Latin (tiết kiệm băng thông)

export const metadata: Metadata = {
  title: 'AI Email Manager — Smart Email Assistant',
  // <title> trong HTML head → hiển thị trên tab trình duyệt + SEO
  description: 'AI-powered email management...',
  // <meta name="description"> → Google dùng cho kết quả tìm kiếm
  keywords: ['email', 'AI', 'Gmail', 'email manager', 'productivity'],
  // Từ khóa SEO (ít quan trọng hơn với Google ngày nay)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // RootLayout = component bố cục gốc, bọc TOÀN BỘ ứng dụng
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* preconnect = trình duyệt kết nối sẵn đến Google Fonts để tải nhanh hơn */}

        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.theme === 'light' || ...) {
              document.documentElement.classList.add('light');
            } else {
              document.documentElement.classList.add('dark');
            }
          } catch (_) {}
        `}} />
        {/* Script này chạy TRƯỚC KHI React load → tránh "flash" giao diện sáng khi dark mode */}
        {/* dangerouslySetInnerHTML = cách React nhúng HTML/JS thuần (tránh XSS bình thường) */}
        {/* Tên "dangerously" nhắc nhở: chỉ dùng với code đáng tin cậy */}
      </head>
      <body
        className={inter.className}
        // className của Inter font → áp dụng font cho toàn body
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        // CSS variables → thay đổi khi chuyển dark/light mode
      >
        <AuthProvider>
          {/* AuthProvider bọc toàn bộ app → mọi component con đều gọi useAuth() được */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                // Toast cũng theo theme dark/light mode
              },
            }}
          />
          {children}
          {/* children = nội dung của trang hiện tại */}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

# PHẦN 5: app/(dashboard)/layout.tsx — Bảo vệ route dashboard

> **Giải thích đơn giản**: Đây là **cửa bảo vệ** cho toàn bộ khu vực dashboard. Ai chưa đăng nhập → bị chặn lại và đưa về trang login. Ai đã đăng nhập → được vào và thấy Sidebar.

```typescript
'use client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // Lấy trạng thái user từ AuthContext
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // loading=false: đã kiểm tra xong
      // !user: không có user (chưa đăng nhập)
      router.push('/login');
      // Redirect về trang login
    }
  }, [user, loading, router]);
  // [user, loading, router] = dependencies: chạy lại khi các giá trị này thay đổi

  if (loading) {
    // Đang kiểm tra trạng thái đăng nhập → hiển thị spinner
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;
  // Nếu không có user (và không loading) → không render gì
  // useEffect đã gọi router.push('/login') ở trên, đây chỉ là "phòng thủ thêm"

  return (
    <div className="flex h-screen overflow-hidden">
      {/* flex = flexbox layout: đặt các con cạnh nhau theo hàng ngang */}
      {/* h-screen = chiều cao bằng viewport (cửa sổ trình duyệt) */}
      {/* overflow-hidden = ẩn scrollbar ngoài cùng */}
      <Sidebar />
      {/* Sidebar = thanh điều hướng bên trái, cố định chiều rộng */}
      <main className="flex-1 overflow-auto">
        {/* flex-1 = chiếm phần còn lại sau Sidebar */}
        {/* overflow-auto = cho phép cuộn trong vùng nội dung */}
        {children}
        {/* Nội dung của trang cụ thể (email list, chat, settings...) */}
      </main>
    </div>
  );
}
```

---

# PHẦN 6: app/(dashboard)/emails/page.tsx — Danh sách Email

> **Giải thích đơn giản**: Đây là **trang chính** hiển thị danh sách email. Nó tự động tải email, hỗ trợ tìm kiếm, lọc theo danh mục, phân trang, và polling 30 giây để thông báo email mới.

## Dòng 1–54: Khai báo state

```typescript
'use client';

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  // emails = danh sách email hiện tại đang hiển thị
  // useState<Email[]>([]) = khởi tạo là mảng rỗng

  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  // meta = thông tin phân trang từ backend: tổng số, trang hiện tại, tổng số trang

  const [loading, setLoading] = useState(true);
  // loading = đang tải email không?

  const [syncing, setSyncing] = useState(false);
  // syncing = đang đồng bộ Gmail không? (hiển thị spinner trên nút Sync)

  const [search, setSearch] = useState('');
  // search = từ khóa tìm kiếm hiện tại

  const [category, setCategory] = useState('All');
  // category = danh mục đang lọc: 'All', 'Work', 'Personal'...

  const [page, setPage] = useState(1);
  // page = trang hiện tại (phân trang)

  const [lastFetchTime, setLastFetchTime] = useState<string>(new Date().toISOString());
  // lastFetchTime = thời điểm lần cuối tải email (để polling so sánh)

  const [newEmailBanner, setNewEmailBanner] = useState<{...} | null>(null);
  // newEmailBanner = thông báo "Có X email mới" hiện ở đầu trang
  // null = không có email mới

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // useRef = lưu giá trị KHÔNG gây re-render khi thay đổi
  // Dùng cho timer ID → để có thể clearInterval khi component unmount
```

## Dòng 65–91: Hàm tải email và Debounce

```typescript
const fetchEmails = useCallback(async () => {
  // useCallback = ghi nhớ hàm, chỉ tạo lại khi [page, search, category] thay đổi
  // Tránh tạo hàm mới mỗi lần re-render (tối ưu hiệu năng)

  setLoading(true);
  try {
    const res = await emailsApi.list({
      page,
      limit: 20,
      search: search || undefined,
      // search || undefined = nếu search rỗng ('') → gửi undefined (không gửi param)
      // undefined trong params → axios không đưa vào query string
      category: category !== 'All' ? category.toLowerCase() : undefined,
      // Nếu category = 'All' → không lọc (gửi undefined)
      // Nếu category = 'Work' → gửi 'work' (lowercase)
    });
    setEmails(res.data.data);          // Mảng email
    setMeta(res.data.meta);            // Thông tin phân trang
    setLastFetchTime(new Date().toISOString()); // Cập nhật thời gian lần cuối tải
    setNewEmailBanner(null);           // Xóa banner "có email mới"
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
    // finally = luôn chạy dù thành công hay thất bại
  }
}, [page, search, category]);
// Dependencies: hàm này sẽ được tạo lại khi page, search, hoặc category thay đổi

useEffect(() => {
  const timer = setTimeout(fetchEmails, 300);
  // Debounce: chờ 300ms sau khi người dùng gõ xong mới tải
  // Nếu gõ nhanh → mỗi ký tự sẽ bị reset timer → chỉ gọi API sau 300ms không gõ
  return () => clearTimeout(timer);
  // Cleanup: xóa timer cũ khi dependency thay đổi (trước khi set timer mới)
}, [fetchEmails]);
// Mỗi lần fetchEmails thay đổi (= page/search/category thay đổi) → chạy lại
```

## Dòng 94–112: Polling 30 giây kiểm tra email mới

```typescript
useEffect(() => {
  pollingRef.current = setInterval(async () => {
    // setInterval = lặp lại sau mỗi X milliseconds
    try {
      const res = await emailsApi.checkNew(lastFetchTime);
      // Gọi /emails/check-new?since=2026-06-12T... → backend chỉ đếm email mới
      // Nhẹ hơn tải toàn bộ danh sách

      const { count, emails: newEmails } = res.data;
      // Destructuring: lấy count và emails từ res.data

      if (count > 0) {
        setNewEmailBanner({ count, emails: newEmails.slice(0, 3) });
        // Hiển thị banner thay vì tự động reload
        // .slice(0, 3) = chỉ lấy tối đa 3 email để preview trong banner
      }
    } catch {
      // Polling errors là không quan trọng → bỏ qua không báo lỗi
    }
  }, 30_000); // 30 giây (30_000ms, dấu _ giúp dễ đọc số lớn)

  return () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    // Cleanup: xóa interval khi component unmount (tránh memory leak)
  };
}, [lastFetchTime]);
// Chạy lại khi lastFetchTime thay đổi (= sau mỗi lần tải email)
```

## Dòng 115–147: Sync thủ công và Toggle Star

```typescript
const handleSync = async () => {
  setSyncing(true);                  // Bật spinner nút Sync
  try {
    const res = await emailsApi.sync();
    const newCount = res.data.newEmails ?? 0;
    // ?? = Nullish coalescing: nếu newEmails là null/undefined → dùng 0
    // Khác với ||: newEmails = 0 sẽ giữ nguyên 0 (không dùng fallback)

    if (newCount > 0) {
      toast.success(`✨ ${newCount} new email${newCount > 1 ? 's' : ''} synced!`);
      // Template literal + ternary: nếu >1 → "emails", nếu =1 → "email"
      await fetchEmails();           // Tải lại danh sách
    } else {
      toast.success('Inbox is up to date');
    }
  } catch {
    toast.error('Sync failed. Please try again.');
  } finally {
    setSyncing(false);               // Tắt spinner
  }
};

const toggleStar = async (e: React.MouseEvent, emailId: string) => {
  e.preventDefault();
  // Ngăn Link (thẻ <a>) điều hướng khi click vào nút sao
  e.stopPropagation();
  // Ngăn sự kiện click "lan ra" đến phần tử cha

  setEmails((prev) =>
    prev.map((em) => (em.id === emailId ? { ...em, isStarred: !em.isStarred } : em))
  );
  // Optimistic Update: cập nhật UI NGAY lập tức (không chờ backend)
  // { ...em, isStarred: !em.isStarred } = spread operator: copy email, đổi isStarred
  // Nếu backend lỗi → state sẽ không được rollback (chấp nhận được cho UX nhanh)

  await emailsApi.toggleStar(emailId);
  // Gửi request thực sự lên backend sau
};
```

---

# PHẦN 7: app/(dashboard)/emails/[id]/page.tsx — Chi tiết Email

> **Giải thích đơn giản**: Trang này hiển thị nội dung đầy đủ của một email, kèm tính năng AI: tạo thư trả lời, chỉnh sửa draft, và gửi email.

## Dòng 1: Routing động `[id]`

```
Thư mục [id] có dấu ngoặc vuông = route động
/emails/abc-123 → params.id = "abc-123"
/emails/xyz-456 → params.id = "xyz-456"
Next.js tự động lấy giá trị từ URL và đưa vào params
```

## Dòng 22–45: Interface — Khuôn dữ liệu

```typescript
interface Email {
  id: string;
  subject: string;
  sender: string;      // Tên + email đầy đủ: "Nguyễn A <a@gmail.com>"
  fromAddress: string; // Chỉ địa chỉ email: "a@gmail.com" (fallback)
  receiver: string;
  bodyText: string;    // Nội dung thuần văn bản
  bodyPreview: string; // Preview ngắn (200 ký tự đầu)
  summary: string;     // Tóm tắt AI
  category: string;
  priority: string;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;  // ISO string: "2026-06-12T08:30:00Z"
}

interface DraftResult {
  id?: string;       // Gmail draft ID (có thể null nếu tạo draft lỗi)
  subject?: string;
  body?: string;
  to?: string;
}
```

## Dòng 47–76: Khởi tạo State và Load Email

```typescript
export default function EmailDetailPage({ params }: { params: { id: string } }) {
  // params = { id: "abc-123" } — lấy từ URL

  const [email, setEmail] = useState<Email | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  // draft = bản nháp AI vừa tạo (hoặc null nếu chưa tạo)

  const [generating, setGenerating] = useState(false);
  // generating = đang gọi AI tạo draft chưa? (hiển thị spinner)

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  // isEditingDraft = đang trong chế độ chỉnh sửa draft không?

  const [editTo, setEditTo] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  // Các state này lưu nội dung đang chỉnh sửa trong form edit draft

  // Tải email khi component mount
  useEffect(() => {
    emailsApi.get(params.id)
      .then((res) => {
        setEmail(res.data);
        // Lưu email vào state

        if (res.data && !res.data.isRead) {
          // Nếu chưa đọc → tự động đánh dấu đã đọc
          emailsApi.markAsRead(params.id, true)
            .then(() => {
              setEmail((prev) => prev ? { ...prev, isRead: true } : null);
              // Cập nhật state local mà không cần tải lại toàn bộ email
              // prev = giá trị email cũ, { ...prev, isRead: true } = copy + đổi isRead
            })
            .catch(console.error);
            // .catch = xử lý lỗi (chỉ log ra console, không hiện lỗi cho user)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);
  // Chỉ chạy khi params.id thay đổi (= khi vào email khác)
```

## Dòng 78–98: Hàm tạo thư trả lời AI

```typescript
const generateReply = async () => {
  if (!email) return;
  // Guard clause: nếu email chưa load → không làm gì

  setGenerating(true);
  try {
    const senderName = email.sender || email.fromAddress || 'the sender';
    // Lấy tên/địa chỉ người gửi, có fallback

    const res = await aiApi.generateDraft({
      instruction: `Generate a professional reply to this email from ${senderName} with subject: "${email.subject}"`,
      // Lệnh cho AI: mô tả rõ yêu cầu
      emailId: email.id,
      // Để backend đọc nội dung email gốc
      context: email.summary || email.bodyPreview,
      // Thêm tóm tắt/preview làm ngữ cảnh
    });

    setDraft(res.data);
    // Lưu kết quả draft vào state (hiển thị lên UI)

    setEditTo(res.data.to || email.sender || email.fromAddress || '');
    // Điền địa chỉ người nhận vào form edit
    // Ưu tiên: AI đề xuất → sender email gốc → fromAddress → rỗng

    setEditSubject(res.data.subject || `Re: ${email.subject}`);
    // Điền tiêu đề: AI đề xuất → "Re: <tiêu đề gốc>"

    setEditBody(res.data.body || '');
    // Điền nội dung

    toast.success('Draft generated!');
  } catch {
    toast.error('Failed to generate draft');
  } finally {
    setGenerating(false);
    // Tắt spinner dù thành công hay thất bại
  }
};
```

## Dòng 109–134: Hàm lưu draft

```typescript
const saveDraft = async () => {
  if (!draft?.id) {
    // draft?.id = optional chaining: không crash nếu draft là null
    toast.error('No draft to save');
    return;
    // Không thể lưu nếu không có draft ID (draft chưa được tạo trên Gmail)
  }
  setSavingDraft(true);
  try {
    await draftsApi.save(draft.id, {
      to: editTo,
      subject: editSubject,
      body: editBody,
      // Gửi nội dung đã chỉnh sửa lên backend
    });
    setDraft({
      ...draft,           // Spread: copy draft cũ
      to: editTo,         // Ghi đè các trường đã chỉnh sửa
      subject: editSubject,
      body: editBody,
    });
    setIsEditingDraft(false);  // Thoát chế độ edit
    toast.success('Draft saved');
  } catch (err: any) {
    // err: any = cho phép truy cập bất kỳ thuộc tính nào của err
    toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save draft');
    // Ưu tiên: lỗi cụ thể từ backend → message backend → message mặc định
  } finally {
    setSavingDraft(false);
  }
};
```

## Dòng 136–176: Gửi email — 2 luồng khác nhau

```typescript
// LUỒNG 1: Gửi bản nháp đã được tạo trên Gmail (có draft.id)
const sendDraftEmail = async () => {
  if (!draft?.id) {
    toast.error('No draft ID found');
    return;
  }
  await draftsApi.send(draft.id);
  // Gọi /drafts/{id}/send → backend dùng Gmail API để gửi draft đó đi
  toast.success('Email sent successfully! ✨');
  setDraft(null);        // Xóa draft khỏi UI sau khi gửi
};

// LUỒNG 2: Gửi trực tiếp qua /ai/send (không có draft.id)
const sendEmail = async () => {
  if (!email || !draft?.body) return;
  // Cần có email gốc và nội dung draft

  // Chuyển plain text thành HTML cho Gmail API
  const htmlBody = draft.body
    .split('\n\n')
    // split('\n\n') = tách văn bản tại dòng trống (= ranh giới đoạn)
    .map((para: string) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    // Mỗi đoạn → thẻ <p>
    // /\n/g = regex tìm tất cả ký tự xuống dòng, g = global (tìm hết, không dừng đầu tiên)
    // .replace = thay \n bằng <br/>
    .join('');
    // Nối tất cả lại (không có dấu ngăn cách)

  await aiApi.sendEmail({
    to: email.sender || email.fromAddress,
    subject: draft.subject || `Re: ${email.subject}`,
    body: htmlBody,
    emailId: email.id,
  });
  setDraft(null);
};
```

## Dòng 200–422: Phần render giao diện (JSX)

```typescript
return (
  <div className="p-8 max-w-4xl mx-auto space-y-6">
    {/* p-8 = padding 8 (32px) tất cả phía */}
    {/* max-w-4xl = chiều rộng tối đa 56rem */}
    {/* mx-auto = căn giữa theo chiều ngang */}
    {/* space-y-6 = khoảng cách dọc 24px giữa các phần tử con */}

    {/* Nút Back */}
    <Link href="/emails">
      <ArrowLeft /> Back to Emails
    </Link>

    {/* Email Card với animation */}
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    {/* initial = trạng thái ban đầu khi render: trong suốt, dịch xuống 10px */}
    {/* animate = trạng thái đích: hiện ra, về vị trí 0 */}
    {/* → Hiệu ứng fade-in + slide-up khi trang load */}

      <Card className="p-6">
        {/* Tiêu đề + thời gian */}
        <h1>{email.subject || '(No subject)'}</h1>
        {/* A || B = nếu A falsy (null, '', undefined) → hiển thị B */}

        <span>From: {email.sender || email.fromAddress || 'Unknown'}</span>
        {/* Fallback chain: sender → fromAddress → 'Unknown' */}

        <span>
          {email.receivedAt
            ? formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })
            : '—'}
        </span>
        {/* formatDistanceToNow = "3 hours ago", "2 days ago" */}
        {/* new Date('2026-06-12T08:30:00Z') = chuyển string thành Date object */}
        {/* addSuffix: true = thêm "ago" vào cuối */}

        {/* Nút sao */}
        <button onClick={toggleStar}>
          {email.isStarred ? (
            <Star className="text-yellow-400 fill-yellow-400" />
            // Sao vàng đặc khi đã gắn
          ) : (
            <StarOff />
            // Sao rỗng khi chưa gắn
          )}
        </button>

        {/* AI Summary - chỉ hiển thị khi có */}
        {email.summary && (
          <div>
            🤖 AI Summary
            <p>{email.summary}</p>
          </div>
        )}
        {/* email.summary && (...) = short-circuit: chỉ render nếu summary có giá trị */}
      </Card>
    </motion.div>

    {/* AI Actions */}
    <Card>
      <Button onClick={generateReply} loading={generating}>
        <Reply /> Generate Reply
      </Button>

      {/* Draft hiển thị sau khi tạo xong */}
      {draft && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Ternary: Edit mode hay View mode? */}
          {isEditingDraft ? (
            // EDIT MODE: Form chỉnh sửa
            <div>
              <input value={editTo} onChange={(e) => setEditTo(e.target.value)} />
              {/* e.target.value = giá trị của input tại thời điểm gõ */}
              {/* setEditTo(e.target.value) = cập nhật state theo mỗi ký tự gõ */}
              <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} />
            </div>
          ) : (
            // VIEW MODE: Hiển thị draft
            <div>
              <p>Subject: {draft.subject}</p>
              <p>To: {draft.to}</p>
              <p className="whitespace-pre-wrap">{draft.body}</p>
              {/* whitespace-pre-wrap = giữ nguyên dòng xuống và khoảng trắng */}
            </div>
          )}

          {/* Buttons */}
          {isEditingDraft ? (
            <>
              <Button onClick={saveDraft} loading={savingDraft}>Save Draft</Button>
              <Button onClick={sendDraftEmail} loading={sendingEmail}>Send Email</Button>
              <Button onClick={() => setIsEditingDraft(false)}>Cancel</Button>
            </>
            {/* <> </> = React Fragment: nhóm nhiều element không thêm node DOM */}
          ) : (
            <>
              <Button onClick={() => setIsEditingDraft(true)}>Edit Draft</Button>
              {draft.id ? (
                <Button onClick={sendDraftEmail}>Send Email</Button>
                // Có draft.id (tạo thành công trên Gmail) → dùng sendDraftEmail
              ) : (
                <Button onClick={sendEmail}>Send Email</Button>
                // Không có draft.id → fallback dùng sendEmail trực tiếp
              )}
              <Button onClick={() => setDraft(null)}>Discard</Button>
            </>
          )}
        </motion.div>
      )}
    </Card>
  </div>
);
```

---

# PHẦN 8: Tổng kết — Dữ liệu chảy như thế nào trong Frontend

## Khi bạn mở trang email detail `/emails/abc-123`:

```
URL: /emails/abc-123
        │
        ▼
Next.js Router
→ Tìm file: app/(dashboard)/emails/[id]/page.tsx
→ params = { id: "abc-123" }
        │
        ▼
Dashboard Layout (layout.tsx)
→ useAuth() kiểm tra: user có không?
  → Không: redirect /login
  → Có: render Sidebar + children
        │
        ▼
EmailDetailPage component mount
→ useEffect() chạy ngay
→ emailsApi.get("abc-123")
  → axios gửi: GET /emails/abc-123
     + Header: Authorization: Bearer <token>
        │
        ▼
Backend trả response
→ setEmail(res.data)  → React re-render → hiển thị nội dung email
→ Nếu chưa đọc → emailsApi.markAsRead() → backend cập nhật DB
        │
        ▼
User bấm "Generate Reply"
→ generateReply()
→ aiApi.generateDraft({instruction:..., emailId:..., context:...})
  → POST /ai/draft
        │
        ▼
Backend xử lý, trả draft
→ setDraft(res.data)   → React re-render → hiển thị draft
→ setEditTo/Subject/Body → điền sẵn form
        │
        ▼
User chỉnh sửa, bấm "Send Email"
→ sendDraftEmail() hoặc sendEmail()
→ Backend gửi email qua Gmail API
→ toast.success('Email sent!')
→ setDraft(null) → UI ẩn draft đi
```

---

## Quy tắc vàng của React Frontend

| Khái niệm | Giải thích thực tế |
| :--- | :--- |
| **useState** | Biến có thể thay đổi. Mỗi lần thay đổi → UI tự cập nhật |
| **useEffect** | "Làm gì đó" sau khi render: tải data, đặt timer, đăng ký sự kiện |
| **useCallback** | Ghi nhớ hàm, chỉ tạo lại khi dependencies thay đổi |
| **useRef** | Lưu giá trị không cần re-render (timer ID, DOM element) |
| **Context** | "Kho chứa" dùng chung cho nhiều component (auth, theme) |
| **Interceptor** | Middleware của axios: chặn request/response để xử lý chung |
| **Optional chaining `?.`** | Truy cập thuộc tính an toàn, không crash nếu null |
| **Nullish coalescing `??`** | Fallback khi null/undefined (khác `\|\|` ở chỗ: 0 và '' không trigger) |
| **Short-circuit `&&`** | `A && B` = chỉ render B khi A là truthy |
| **Ternary `? :`** | `A ? B : C` = nếu A → hiển thị B, không thì C |
| **Spread `...`** | Copy object/array và ghi đè một phần |
| **Template literal** | Chuỗi có biến: `\`Hello ${name}!\`` |
