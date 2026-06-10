FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .


# Build Next.js
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
# COPY --from=builder /app/public ./public
COPY next.config.* ./

EXPOSE 3000

CMD ["npm", "start"]
