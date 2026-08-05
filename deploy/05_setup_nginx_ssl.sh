#!/bin/bash
# =============================================================
# Script 05: Cấu hình Nginx + SSL (Let's Encrypt)
# Usage: sudo bash 05_setup_nginx_ssl.sh
# ⚠️  QUAN TRỌNG: Trỏ DNS về IP EC2 TRƯỚC KHI chạy script này!
#    - emailkhanh.freeddns.org        → <EC2_IP>
#    - api.emailkhanh.freeddns.org    → <EC2_IP>
# =============================================================
set -e

APP_DIR="/home/ubuntu/app"
DOMAIN_FRONTEND="emailkhanh.freeddns.org"
DOMAIN_BACKEND="api.emailkhanh.freeddns.org"
EMAIL_SSL="your-email@gmail.com"   # ← ĐỔI EMAIL ĐỂ NHẬN THÔNG BÁO SSL

echo "======================================"
echo " [1/4] Kiểm tra DNS đã trỏ đúng chưa..."
echo "======================================"
EC2_IP=$(curl -s http://checkip.amazonaws.com)
echo "IP EC2 hiện tại: $EC2_IP"

DNS_FRONTEND=$(dig +short $DOMAIN_FRONTEND | head -1)
DNS_BACKEND=$(dig +short $DOMAIN_BACKEND | head -1)

echo "DNS $DOMAIN_FRONTEND → $DNS_FRONTEND"
echo "DNS $DOMAIN_BACKEND  → $DNS_BACKEND"

if [ "$DNS_FRONTEND" != "$EC2_IP" ] || [ "$DNS_BACKEND" != "$EC2_IP" ]; then
    echo ""
    echo "⚠️  CẢNH BÁO: DNS chưa trỏ về IP EC2!"
    echo "Hãy cập nhật DNS trên freeddns.org trước."
    echo "Tiếp tục sẽ làm cho certbot thất bại."
    read -p "Bạn có muốn tiếp tục không? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        exit 1
    fi
fi

echo "======================================"
echo " [2/4] Copy cấu hình Nginx..."
echo "======================================"
# Copy file nginx.conf từ repo
sudo cp ${APP_DIR}/nginx.conf /etc/nginx/sites-available/email-agent

# Kích hoạt site
sudo ln -sf /etc/nginx/sites-available/email-agent /etc/nginx/sites-enabled/email-agent

# Xóa default site nếu có
sudo rm -f /etc/nginx/sites-enabled/default

# Tạo thư mục cho certbot challenge
sudo mkdir -p /var/www/certbot

# Tạm thời dùng nginx config đơn giản để certbot có thể lấy cert
# (vì nginx.conf gốc yêu cầu SSL cert đã tồn tại)
sudo tee /etc/nginx/sites-available/email-agent-temp > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name emailkhanh.freeddns.org api.emailkhanh.freeddns.org;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Server is up - SSL setup in progress';
        add_header Content-Type text/plain;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/email-agent-temp /etc/nginx/sites-enabled/email-agent
sudo nginx -t && sudo systemctl reload nginx

echo "======================================"
echo " [3/4] Lấy SSL Certificate từ Let's Encrypt..."
echo "======================================"
sudo certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email ${EMAIL_SSL} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN_FRONTEND} \
    -d ${DOMAIN_BACKEND}

echo "✅ SSL Certificate đã được lấy thành công!"
ls -la /etc/letsencrypt/live/${DOMAIN_FRONTEND}/

echo "======================================"
echo " [4/4] Áp dụng cấu hình Nginx chính thức (HTTPS)..."
echo "======================================"
# Xóa config tạm, dùng config chính thức từ repo
sudo ln -sf /etc/nginx/sites-available/email-agent /etc/nginx/sites-enabled/email-agent

# Kiểm tra cú pháp nginx
sudo nginx -t

# Reload nginx với config HTTPS
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager

# Tự động gia hạn SSL (thêm vào crontab)
echo "Cấu hình tự động gia hạn SSL..."
(sudo crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | sudo crontab -

echo ""
echo "✅ Nginx + SSL setup hoàn tất!"
echo ""
echo "🌐 Frontend: https://${DOMAIN_FRONTEND}"
echo "🔌 Backend:  https://${DOMAIN_BACKEND}/docs"
echo ""
echo "Kiểm tra SSL: curl -I https://${DOMAIN_FRONTEND}"
echo "SSL sẽ tự động gia hạn mỗi ngày lúc 3:00 AM"
