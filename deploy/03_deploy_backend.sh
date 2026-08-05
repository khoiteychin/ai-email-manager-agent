#!/bin/bash
# =============================================================
# Script 03: Deploy Backend FastAPI
# Usage: sudo bash 03_deploy_backend.sh
# ⚠️  Chạy SAU 02_setup_db.sh
# =============================================================
set -e

# ── Cấu hình — THAY ĐỔI CÁC GIÁ TRỊ NÀY ──────────────────
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"   # ← ĐỔI THÀNH REPO CỦA BẠN
APP_DIR="/home/ubuntu/app"
BACKEND_DIR="${APP_DIR}/backend"
SERVICE_NAME="email-agent-backend"
# ───────────────────────────────────────────────────────────

echo "======================================"
echo " [1/5] Clone hoặc cập nhật code..."
echo "======================================"
if [ -d "$APP_DIR/.git" ]; then
    echo "Repo đã tồn tại, pulling code mới..."
    cd $APP_DIR && git pull origin main
else
    echo "Clone repo lần đầu..."
    git clone $REPO_URL $APP_DIR
fi

echo "======================================"
echo " [2/5] Cài đặt Python dependencies..."
echo "======================================"
cd $BACKEND_DIR

# Tạo virtual environment nếu chưa có
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Kích hoạt venv và cài packages
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "======================================"
echo " [3/5] Tạo file .env cho backend..."
echo "======================================"
# Kiểm tra file .env đã có chưa
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo "⚠️  File .env chưa có! Tạo template..."
    cat > ${BACKEND_DIR}/.env << 'ENVEOF'
# ── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://email_agent_user:CHANGE_PASSWORD@127.0.0.1:5432/email_agent_db

# ── OpenAI ─────────────────────────────────────────────────
OPENAI_API_KEY=sk-CHANGE_THIS
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# ── Security ───────────────────────────────────────────────
SECRET_KEY=CHANGE_THIS_TO_RANDOM_32_CHAR_STRING

# ── Firebase Admin SDK ─────────────────────────────────────
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/home/ubuntu/app/backend/firebase-service-account.json

# ── Google OAuth ───────────────────────────────────────────
GOOGLE_CLIENT_ID=CHANGE_THIS
GOOGLE_CLIENT_SECRET=CHANGE_THIS
GOOGLE_REDIRECT_URI=https://api.emailkhanh.freeddns.org/api/gmail/callback

# ── App ────────────────────────────────────────────────────
FRONTEND_URL=https://emailkhanh.freeddns.org

# ── Discord (Optional) ─────────────────────────────────────
DISCORD_BOT_TOKEN=CHANGE_THIS
ENVEOF
    echo ""
    echo "⚠️  QUAN TRỌNG: Điền đầy đủ giá trị vào ${BACKEND_DIR}/.env trước khi tiếp tục!"
    echo "Chạy: nano ${BACKEND_DIR}/.env"
    echo ""
    read -p "Nhấn ENTER sau khi đã điền .env để tiếp tục..."
else
    echo ".env đã tồn tại, bỏ qua bước này."
fi

echo "======================================"
echo " [4/5] Chạy migrations database..."
echo "======================================"
cd $BACKEND_DIR
source venv/bin/activate

# Kiểm tra thư mục migrations
if [ -d "/home/ubuntu/app/migrations" ]; then
    echo "Chạy Alembic migrations..."
    cd /home/ubuntu/app
    alembic upgrade head
else
    echo "⚠️  Không tìm thấy thư mục migrations, bỏ qua."
fi

deactivate

echo "======================================"
echo " [5/5] Cấu hình systemd service..."
echo "======================================"
# Tạo file service để backend tự khởi động khi reboot
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << SERVICEEOF
[Unit]
Description=Email Agent FastAPI Backend
After=network.target postgresql.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=${BACKEND_DIR}
ExecStart=${BACKEND_DIR}/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 3001 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Load biến môi trường từ file .env
EnvironmentFile=${BACKEND_DIR}/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Kích hoạt và khởi động service
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

# Kiểm tra trạng thái
sleep 2
sudo systemctl status ${SERVICE_NAME} --no-pager

echo ""
echo "✅ Backend deploy hoàn tất!"
echo ""
echo "Kiểm tra logs: sudo journalctl -u ${SERVICE_NAME} -f"
echo "Kiểm tra health: curl http://127.0.0.1:3001/health"
echo ""
echo "Bước tiếp theo: Chạy script 04_deploy_frontend.sh"
