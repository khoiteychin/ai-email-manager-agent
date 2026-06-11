# Hướng dẫn và Nhật ký lệnh triển khai (Deployment Guide & Command Log) 🚀

Tài liệu này lưu trữ toàn bộ các lệnh hữu ích và quy trình đã sử dụng để triển khai dự án **AI Email Manager SaaS** trên GCP VM Instance (Ubuntu).

---

## 📁 1. Khởi tạo & Cập nhật Code mới nhất (Git)

Mỗi khi đẩy code mới từ máy local lên GitHub, chạy các lệnh sau trên Server để cập nhật:
```bash
cd ~/ai-email-manager-agent
git pull origin main
```

---

## ⚙️ 2. Triển khai Backend (FastAPI)

Backend chạy ở cổng **3001**.

### Cách 1: Chạy thủ công bằng `nohup` (Tạm thời)
```bash
cd ~/ai-email-manager-agent/backend
source venv/bin/activate
pip install -r requirements.txt

# Tắt backend cũ đang chiếm cổng 3001 (nếu có)
sudo fuser -k 3001/tcp

# Chạy backend ở chế độ background
nohup python run.py > backend.log 2>&1 &
```

### Cách 2: Chạy ổn định chống crash bằng `PM2` (Khuyên dùng)
```bash
cd ~/ai-email-manager-agent/backend
source venv/bin/activate

# Khởi chạy bằng PM2
pm2 start "venv/bin/python run.py" --name "email-backend"
```

---

## 🖥️ 3. Triển khai Frontend (Next.js)

Frontend chạy ở cổng **3000**.

### Cách 1: Chạy thủ công bằng `nohup` (Tạm thời)
```bash
cd ~/ai-email-manager-agent/frontend
npm install --legacy-peer-deps
npm run build

# Tắt frontend cũ đang chiếm cổng 3000 (nếu có)
sudo fuser -k 3000/tcp

# Chạy frontend ở chế độ background
nohup npm run start > frontend.log 2>&1 &
```

### Cách 2: Chạy ổn định chống crash bằng `PM2` (Khuyên dùng)
```bash
cd ~/ai-email-manager-agent/frontend
npm run build

# Khởi chạy bằng PM2
pm2 start npm --name "email-frontend" -- run start
```

---

## 🤖 4. Quản lý tiến trình bằng PM2

Lệnh quản lý các dịch vụ đã khởi chạy qua PM2 để đảm bảo không bị tắt/sập:

```bash
# Cài đặt PM2 toàn cục (nếu chưa cài)
sudo npm install -g pm2

# Xem danh sách các app đang chạy và tình trạng RAM/CPU
pm2 list

# Xem log trực tiếp của các app (rất hữu ích để debug)
pm2 logs
pm2 logs email-backend
pm2 logs email-frontend

# Khởi động lại hoặc dừng app
pm2 restart email-backend
pm2 restart email-frontend
pm2 stop all

# Thiết lập tự động khởi động cùng hệ thống khi server reboot
pm2 startup
# (Sau khi chạy lệnh trên, copy dòng lệnh sudo màu xanh nó cung cấp và chạy nó)
pm2 save
```

---

## 🌐 5. Cấu hình Nginx Reverse Proxy & SSL (HTTPS)

Dự án sử dụng Nginx để chuyển hướng truy cập từ tên miền HTTPS vào cổng 3000 và 3001.

*   Tên miền Frontend: `emailkhanh.freeddns.org` -> Port 3000
*   Tên miền API Backend: `api.emailkhanh.freeddns.org` -> Port 3001

### Khởi động lại dịch vụ Nginx
```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```

### Cấp và Gia hạn chứng chỉ SSL Let's Encrypt
```bash
sudo certbot --nginx -d emailkhanh.freeddns.org -d api.emailkhanh.freeddns.org --force-renewal
```

---

## 🔍 6. Lệnh Kiểm tra Hệ Thống nhanh

```bash
# Kiểm tra các cổng đang lắng nghe (để xem port 3000, 3001 và 80/443 có hoạt động không)
sudo netstat -tulpn | grep LISTEN

# Xem log lỗi của Nginx (nếu trang web bị lỗi 502 Bad Gateway)
sudo tail -n 50 /var/log/nginx/error.log
```
