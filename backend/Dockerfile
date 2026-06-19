# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Non-root user for security
RUN addgroup -S liferpg && adduser -S liferpg -G liferpg

COPY --from=builder --chown=liferpg:liferpg /app/dist ./dist
COPY --from=builder --chown=liferpg:liferpg /app/node_modules ./node_modules
COPY --from=builder --chown=liferpg:liferpg /app/package.json ./package.json

USER liferpg

EXPOSE 3001

# NODE_ENV must be set via docker run -e or docker-compose env_file
CMD ["node", "dist/main"]
