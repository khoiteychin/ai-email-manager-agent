# Sử dụng Python 3.11 ổn định làm base
FROM python:3.11-slim

WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết cho PostgreSQL
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code backend vào container
COPY . .

# Chạy FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
