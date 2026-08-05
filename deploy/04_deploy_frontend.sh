#!/bin/bash
# =============================================================
# Script 04: Deploy Frontend Next.js
# Usage: sudo bash 04_deploy_frontend.sh
# ⚠️  Chạy SAU 03_deploy_backend.sh
# =============================================================
set -e

# ── Cấu hình ───────────────────────────────────────────────
APP_DIR="/home/ubuntu/app"
FRONTEND_DIR="${APP_DIR}/frontend"
SERVICE_NAME="email-agent-frontend"
# ───────────────────────────────────────────────────────────

echo "======================================"
echo " [1/4] Tạo file .env cho frontend..."
echo "======================================"
if [ ! -f "${FRONTEND_DIR}/.env" ]; then
    echo "⚠️  File .env chưa có! Tạo template..."
    cat > ${FRONTEND_DIR}/.env << 'ENVEOF'
# Firebase Config (lấy từ Firebase Console > Project Settings > Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=CHANGE_THIS
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=CHANGE_THIS
NEXT_PUBLIC_FIREBASE_APP_ID=CHANGE_THIS

# Backend API URL
NEXT_PUBLIC_API_URL=https://api.emailkhanh.freeddns.org
ENVEOF
    echo ""
    echo "⚠️  QUAN TRỌNG: Điền đầy đủ giá trị vào ${FRONTEND_DIR}/.env trước khi tiếp tục!"
    echo "Chạy: nano ${FRONTEND_DIR}/.env"
    echo ""
    read -p "Nhấn ENTER sau khi đã điền .env để tiếp tục..."
else
    echo ".env đã tồn tại, bỏ qua bước này."
fi

echo "======================================"
echo " [2/4] Cài đặt Node.js dependencies và build..."
echo "======================================"
cd $FRONTEND_DIR

# t2.micro chỉ có 1GB RAM — cần giới hạn memory cho Node build
export NODE_OPTIONS="--max-old-space-size=768"

npm install --legacy-peer-deps
npm run build

echo "======================================"
echo " [3/4] Cấu hình systemd service..."
echo "======================================"
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << SERVICEEOF
[Unit]
Description=Email Agent Next.js Frontend
After=network.target ${EMAIL_BACKEND_SERVICE:-email-agent-backend}.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=${FRONTEND_DIR}
ExecStart=/usr/bin/npm start -- --port 3000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=${FRONTEND_DIR}/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

# Kiểm tra trạng thái
sleep 3
sudo systemctl status ${SERVICE_NAME} --no-pager

echo ""
echo "✅ Frontend deploy hoàn tất!"
echo ""
echo "Kiểm tra logs: sudo journalctl -u ${SERVICE_NAME} -f"
echo "Kiểm tra trực tiếp: curl http://127.0.0.1:3000"
echo ""
echo "Bước tiếp theo: Chạy script 05_setup_nginx_ssl.sh"
