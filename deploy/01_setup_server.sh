#!/bin/bash
# =============================================================
# Script 01: Cài đặt môi trường máy chủ (Ubuntu 22.04)
# Chạy một lần duy nhất trên EC2 mới
# Usage: sudo bash 01_setup_server.sh
# =============================================================
set -e  # Dừng ngay nếu có lỗi

echo "======================================"
echo " [1/6] Cập nhật hệ thống..."
echo "======================================"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "======================================"
echo " [2/6] Cài đặt các công cụ cơ bản..."
echo "======================================"
sudo apt-get install -y \
    curl wget git unzip \
    build-essential \
    software-properties-common \
    ca-certificates gnupg \
    ufw fail2ban

# ── Python 3 ──────────────────────────────────────────────────
echo "======================================"
echo " [3/6] Cài đặt Python 3..."
echo "======================================"
# Cập nhật repository và cài đặt bản python3 mặc định của OS kèm venv, dev và pip
sudo apt-get install -y python3 python3-pip python3-venv python3-dev

# Đăng ký deadsnakes PPA để thử cài riêng python3.11 nếu OS hiện tại chưa có sẵn 3.11
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)" 2>/dev/null; then
    echo "Phiên bản Python hiện tại thấp hơn 3.11. Đang thử cài đặt Python 3.11 từ PPA..."
    sudo add-apt-repository ppa:deadsnakes/ppa -y || true
    sudo apt-get update -y || true
    sudo apt-get install -y python3.11 python3.11-venv python3.11-dev || echo "Không cài được Python 3.11, sử dụng bản python3 mặc định của hệ thống."
    if dpkg -s python3.11 >/dev/null 2>&1; then
        sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 || true
    fi
fi
python3 --version


# ── Node.js 20 LTS ───────────────────────────────────────────
echo "======================================"
echo " [4/6] Cài đặt Node.js 20 LTS..."
echo "======================================"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version

# ── PostgreSQL 15 ────────────────────────────────────────────
echo "======================================"
echo " [5/6] Cài đặt PostgreSQL 15..."
echo "======================================"
sudo apt-get install -y postgresql postgresql-contrib postgresql-server-dev-all

# Cài pgvector extension (tìm kiếm vector cho RAG)
sudo apt-get install -y git
cd /tmp
git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
cd ~

# Khởi động PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
echo "PostgreSQL status:"
sudo systemctl status postgresql --no-pager

# ── Nginx ────────────────────────────────────────────────────
echo "======================================"
echo " [6/6] Cài đặt Nginx + Certbot (SSL)..."
echo "======================================"
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Certbot để lấy SSL miễn phí từ Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx

# ── Firewall cơ bản ──────────────────────────────────────────
echo "======================================"
echo " Cấu hình Firewall (UFW)..."
echo "======================================"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh       # Port 22
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
sudo ufw status

echo ""
echo "✅ Cài đặt môi trường hoàn tất!"
echo ""
echo "Bước tiếp theo: Chạy script 02_setup_db.sh"
