# 📧 AI Email Manager SaaS

Hệ thống quản lý và tối ưu hóa Email thông minh ứng dụng Trí tuệ nhân tạo (AI), được xây dựng trên mô hình Full-stack hiện đại.

---

## 🚀 Tính năng nổi bật

- 🔐 **Đăng nhập & Bảo mật**: Tích hợp OAuth2 (Gmail, Discord) và JWT xác thực người dùng.
- 🤖 **Xử lý Email bằng AI (qua n8n)**: 
  - Phân loại email tự động (Công việc, Cá nhân, Quảng cáo, Hóa đơn...).
  - Tóm tắt nội dung email thông minh.
  - Chatbot hỗ trợ trả lời và soạn thảo email theo ngữ cảnh (RAG).
- 🛡️ **Bảo mật tuyệt đối**: 
  - Lưu trữ token OAuth2 dưới dạng mã hóa AES-256.
  - Quản lý cấu hình nhạy cảm tập trung bằng **AWS Secrets Manager**.

---

## 🛠️ Công nghệ sử dụng

### Backend (NestJS API)
- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database ORM**: [Prisma](https://www.prisma.io/)
- **Cơ sở dữ liệu**: PostgreSQL
- **Bảo mật**: Helmet, Throttler (Rate limiting), Passport JWT
- **Cloud integration**: AWS SDK (@aws-sdk/client-secrets-manager)

### Frontend (Next.js)
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Giao diện**: Tailwind CSS

### Automation Engine
- **Workflow**: [n8n](https://n8n.io/)

---

## 📂 Cấu trúc dự án

Dự án được tổ chức theo dạng Monorepo tiện lợi:
```
ai-email-manager/
├── backend/          # REST API xử lý logic (NestJS)
├── frontend/         # Giao diện người dùng (Next.js)
├── discord-bot/      # Bot tích hợp thông báo (nếu có)
├── init-db.sql       # File khởi tạo database PostgreSQL
└── start-dev.bat     # Script khởi động nhanh môi trường dev (Windows)
```

---

## ⚙️ Hướng dẫn cài đặt nhanh (Local Setup)

### 📋 Yêu cầu hệ thống
- Node.js (v18+)
- PostgreSQL Database
- Tài khoản AWS (Nếu sử dụng AWS Secrets Manager)

### 1. Cài đặt Backend
```bash
cd backend
npm install
```
Tạo file `.env` dựa trên `.env.example`, cấu hình các biến cơ bản và AWS Secrets Manager:
```env
PORT=3001
NODE_ENV=development
AWS_REGION="ap-southeast-1"
AWS_APP_SECRET_NAME="prod/ai-email-manager"
```

### 2. Cài đặt Frontend
```bash
cd frontend
npm install
```

### 3. Đồng bộ Database (Prisma)
Chạy lệnh khởi tạo các bảng dữ liệu:
```bash
cd backend
npm run prisma:push
```

### 4. Khởi chạy dự án
- **Cách 1 (Windows)**: Click đúp vào file `start-dev.bat` ở thư mục gốc.
- **Cách 2**: Chạy `npm run start:dev` ở folder `backend` và `npm run dev` ở folder `frontend`.

---

## 🔐 Quản lý Secret (AWS Secrets Manager)

Toàn bộ thông tin nhạy cảm được cấu hình thông qua AWS Secrets Manager. Vui lòng tham khảo cấu trúc JSON chuẩn tại file `backend/aws-secret.template.json` để đưa lên AWS.

---

## 📄 Bản quyền
Dự án được bảo hộ và phát triển nội bộ.
