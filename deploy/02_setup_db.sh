#!/bin/bash
# =============================================================
# Script 02: Cài đặt Database PostgreSQL + pgvector
# Usage: sudo bash 02_setup_db.sh
# ⚠️  Chạy SAU 01_setup_server.sh
# =============================================================
set -e

# ── Cấu hình — THAY ĐỔI CÁC GIÁ TRỊ NÀY ──────────────────
DB_NAME="email_agent_db"
DB_USER="email_agent_user"
DB_PASSWORD="CHANGE_THIS_STRONG_PASSWORD"   # ← ĐỔI MẬT KHẨU MẠNH
# ───────────────────────────────────────────────────────────

echo "======================================"
echo " [1/4] Tạo PostgreSQL user và database..."
echo "======================================"
sudo -u postgres psql <<EOF
-- Tạo user với mật khẩu
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Tạo database và gán owner
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Cấp đầy đủ quyền
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Cho phép tạo extension (cần cho pgvector)
ALTER USER ${DB_USER} SUPERUSER;

\q
EOF

echo "======================================"
echo " [2/4] Bật pgvector extension..."
echo "======================================"
sudo -u postgres psql -d ${DB_NAME} <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
-- Kiểm tra pgvector đã cài chưa
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
\q
EOF

echo "======================================"
echo " [3/4] Cấu hình PostgreSQL cho phép kết nối local..."
echo "======================================"
# PostgreSQL mặc định chỉ cho localhost kết nối — giữ nguyên vì backend cùng máy
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | tr -d ' ')
echo "pg_hba.conf: $PG_HBA"

# Đảm bảo có dòng cho user mới (md5 auth)
echo "host  ${DB_NAME}  ${DB_USER}  127.0.0.1/32  md5" | sudo tee -a $PG_HBA
sudo systemctl reload postgresql

echo "======================================"
echo " [4/4] Kiểm tra kết nối..."
echo "======================================"
PGPASSWORD=${DB_PASSWORD} psql -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME} -c "\dt" || true

echo ""
echo "✅ Database setup hoàn tất!"
echo ""
echo "Thông tin kết nối:"
echo "  DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
echo ""
echo "⚠️  Lưu DATABASE_URL ở trên vào file .env của backend!"
echo ""
echo "Bước tiếp theo: Chạy script 03_deploy_backend.sh"
