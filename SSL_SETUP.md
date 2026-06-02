# SSL Setup - Let's Encrypt cho api.emailkhanh.freeddns.org

## Yêu cầu
- Server Linux (VPS / máy chủ đang chạy n8n)
- Domain `api.emailkhanh.freeddns.org` phải trỏ đúng IP public của server
- Port 80 và 443 phải mở trên firewall

---

## Bước 1: Trỏ subdomain trong FreeDNS

Vào https://freedns.afraid.org:
1. Thêm record mới: `api.emailkhanh.freeddns.org` → IP server của bạn
2. Hoặc dùng wildcard `*.emailkhanh.freeddns.org` nếu muốn dùng nhiều subdomain

---

## Bước 2: Cài Certbot trên server

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot -y

# Hoặc dùng snap
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

---

## Bước 3: Lấy SSL Certificate

```bash
# Standalone mode (tạm dừng nginx nếu đang chạy)
sudo certbot certonly --standalone \
  -d api.emailkhanh.freeddns.org \
  --email your-email@gmail.com \
  --agree-tos \
  --non-interactive
```

Cert sẽ được lưu tại:
- Certificate: `/etc/letsencrypt/live/api.emailkhanh.freeddns.org/fullchain.pem`
- Private key: `/etc/letsencrypt/live/api.emailkhanh.freeddns.org/privkey.pem`

---

## Bước 4: Cấu hình Nginx

Copy file `nginx.backend.conf` vào server:
```bash
sudo cp nginx.backend.conf /etc/nginx/sites-available/api.emailkhanh.freeddns.org
sudo ln -s /etc/nginx/sites-available/api.emailkhanh.freeddns.org \
           /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Bước 5: Chạy Backend Python

```bash
cd /path/to/n8n/backend

# Cài dependencies
pip install -r requirements.txt

# Cấu hình .env
cp .env.example .env
nano .env  # Điền các API keys

# Chạy với systemd (production)
sudo nano /etc/systemd/system/ai-email-backend.service
```

Nội dung service file:
```ini
[Unit]
Description=AI Email Manager Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/n8n/backend
ExecStart=/usr/bin/python3 run.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ai-email-backend
sudo systemctl start ai-email-backend
sudo systemctl status ai-email-backend
```

---

## Bước 6: Tự động renew SSL

Certbot tự động renew qua cron:
```bash
sudo crontab -e
# Thêm dòng sau:
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

---

## Bước 7: Cấu hình Google Cloud Console

Để Gmail OAuth hoạt động với HTTPS:

1. Vào https://console.cloud.google.com/apis/credentials
2. Tạo OAuth 2.0 Client ID → Web Application
3. Thêm Authorized Redirect URIs:
   - `https://api.emailkhanh.freeddns.org/gmail/callback`
4. Lưu `Client ID` và `Client Secret` vào `backend/.env`
5. Bật API:
   - Gmail API
   - Google+ API (for userinfo)
   - Cloud Pub/Sub API (for Gmail push)

---

## Bước 8: Cấu hình Discord App

1. Vào https://discord.com/developers/applications
2. Tạo New Application → OAuth2
3. Thêm Redirect: `https://api.emailkhanh.freeddns.org/discord/callback`
4. Lưu `Client ID` và `Client Secret` vào `backend/.env`
5. Tạo Bot → lấy `Bot Token`

---

## Kiểm tra

```bash
curl https://api.emailkhanh.freeddns.org/health
# Expected: {"status": "ok", ...}

curl https://api.emailkhanh.freeddns.org/docs
# Swagger UI
```
