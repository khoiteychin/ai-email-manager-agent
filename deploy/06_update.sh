#!/bin/bash
# =============================================================
# Script 06: Cập nhật code (dùng khi push code mới lên GitHub)
# Usage: bash 06_update.sh
# Chạy từ EC2 bất kỳ lúc nào muốn deploy code mới
# =============================================================
set -e

APP_DIR="/home/ubuntu/app"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

echo "======================================"
echo " Pull code mới từ GitHub..."
echo "======================================"
cd $APP_DIR
git pull origin main

echo "======================================"
echo " Cập nhật Backend..."
echo "======================================"
cd $BACKEND_DIR
source venv/bin/activate

# Cài packages mới nếu có thay đổi requirements
pip install -r requirements.txt --quiet

# Chạy migrations nếu có migration mới
cd $APP_DIR
alembic upgrade head

deactivate

# Restart backend service
sudo systemctl restart email-agent-backend
echo "Backend restarted ✅"

echo "======================================"
echo " Cập nhật Frontend..."
echo "======================================"
cd $FRONTEND_DIR

# Build lại (giới hạn RAM cho t2.micro)
export NODE_OPTIONS="--max-old-space-size=768"
npm install --legacy-peer-deps --quiet
npm run build

# Restart frontend service
sudo systemctl restart email-agent-frontend
echo "Frontend restarted ✅"

echo "======================================"
echo " Reload Nginx..."
echo "======================================"
sudo systemctl reload nginx

echo ""
echo "✅ Update hoàn tất!"
echo ""
echo "Kiểm tra trạng thái:"
sudo systemctl status email-agent-backend --no-pager | tail -5
sudo systemctl status email-agent-frontend --no-pager | tail -5
