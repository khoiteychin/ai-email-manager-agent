# Sử dụng Node.js 20 làm base để build Next.js
FROM node:20-slim AS builder

WORKDIR /app

# Copy file cấu hình package
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy code và build Next.js
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN npm run build

# Runner container để tối ưu hóa dung lượng image
FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start", "--", "--port", "3000"]
