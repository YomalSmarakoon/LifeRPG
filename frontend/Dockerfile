# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL must be passed as build arg for the API URL to be embedded
# e.g. docker build --build-arg VITE_API_URL=https://api.your-domain.com/api/v1 .
ARG VITE_API_URL=http://localhost:3001/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
