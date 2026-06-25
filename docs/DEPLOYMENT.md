# LifeRPG — Deployment Guide

## Table of Contents
1. [Local Development](#local-development)
2. [Local Production-like Docker Run](#local-production-like-docker-run)
3. [Backend Environment Variables](#backend-environment-variables)
4. [Frontend Environment Variables](#frontend-environment-variables)
5. [MongoDB Requirements](#mongodb-requirements)
6. [Frontend Deployment](#frontend-deployment)
7. [Backend Deployment](#backend-deployment)
8. [Cookie & CORS Configuration](#cookie--cors-configuration)
9. [Health Check](#health-check)
10. [Swagger / API Docs](#swagger--api-docs)
11. [Security Checklist](#security-checklist)
12. [Rollback Notes](#rollback-notes)

---

## Local Development

**Prerequisites**: Node 22+, MongoDB 7 (replica set required for transactions)

### Start MongoDB with replica set

```bash
# Start MongoDB in single-node replica set mode
docker run --rm -d -p 27017:27017 --name liferpg-mongo \
  mongo:7 mongod --replSet rs0

# Initialise the replica set (once after first start)
docker exec liferpg-mongo mongosh --eval \
  "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

### Start backend

```bash
cd backend
cp .env.example .env        # fill in JWT_ACCESS_SECRET
npm install
npm run start:dev
# API → http://localhost:3001/api/v1
# Swagger → http://localhost:3001/api/v1/docs (when SWAGGER_ENABLED=true)
```

### Start frontend

```bash
cd frontend
cp .env.example .env.local  # or set VITE_API_URL
npm install
npm run dev
# App → http://localhost:5173
```

---

## Local Production-like Docker Run

Uses Docker Compose to spin up MongoDB + backend + frontend together.

```bash
# 1. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_ACCESS_SECRET to something strong (min 32 chars)

# 2. Build and start all services
docker compose up --build

# 3. If transactions fail on first run, initialise the replica set
docker exec liferpg-mongo mongosh --eval \
  "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})"

# Then restart the backend:
docker compose restart backend
```

Service URLs:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api/v1
- Health: http://localhost:3001/api/v1/health

---

## Backend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `production` enables secure cookies + trust proxy |
| `PORT` | No | `3001` | TCP port the API listens on |
| `API_PREFIX` | No | `api/v1` | URL prefix for all routes |
| `FRONTEND_URL` | No | `http://localhost:5173` | Exact frontend origin for CORS (no trailing slash) |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string (must include replica set for transactions) |
| `JWT_ACCESS_SECRET` | **Yes** | — | Min 32 chars. Generate: `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_DAYS` | No | `7` | Refresh cookie lifetime in days |
| `REFRESH_COOKIE_NAME` | No | `rt` | Name of the HttpOnly refresh cookie |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt cost factor (10–14) |
| `SWAGGER_ENABLED` | No | `true` | Set to `false` in production (Swagger never loads when NODE_ENV=production regardless) |

### Production `.env` example

```env
NODE_ENV=production
PORT=3001
API_PREFIX=api/v1
FRONTEND_URL=https://app.your-domain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/liferpg?retryWrites=true&w=majority
JWT_ACCESS_SECRET=<openssl rand -hex 32 output>
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
REFRESH_COOKIE_NAME=rt
BCRYPT_ROUNDS=12
SWAGGER_ENABLED=false
```

---

## Frontend Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api/v1` | Base URL of the backend API |

Vite bakes environment variables at build time. Pass the production URL as a build argument:

```bash
# Direct build
VITE_API_URL=https://api.your-domain.com/api/v1 npm run build

# Docker build
docker build \
  --build-arg VITE_API_URL=https://api.your-domain.com/api/v1 \
  -t liferpg-frontend ./frontend
```

---

## MongoDB Requirements

**Transactions are required** for habit completion and achievement unlocks. MongoDB must run as a replica set (even a single-node one).

### Local (Docker)
The `docker-compose.yml` starts MongoDB in `--replSet rs0` mode and runs a one-shot `mongo-init` container to initialise it.

### Atlas (Recommended for Production)
MongoDB Atlas clusters are always replica sets — no extra configuration needed. Use an M0 free tier cluster for MVP.

Connection string format:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/liferpg?retryWrites=true&w=majority
```

### Self-hosted
Add `--replSet rs0` to your mongod startup flags and run `rs.initiate()` once.

---

## Frontend Deployment

The frontend builds to a static directory (`frontend/dist/`). Deploy to any static host.

### Recommended platforms
- **Vercel**: Connect GitHub repo, set `VITE_API_URL` env var in project settings, set root directory to `frontend/`, build command `npm run build`, output `dist/`.
- **Netlify**: Same as Vercel. Add a `_redirects` file with `/* /index.html 200` for SPA routing (already handled if using the Netlify React preset).
- **Cloudflare Pages**: Build command `npm run build`, output `dist/`.

### SPA routing
All routes must fall back to `index.html`. The nginx config in `frontend/nginx.conf` handles this with `try_files $uri $uri/ /index.html`.

### PWA notes
- The service worker (`sw.js`) is auto-generated by Vite PWA plugin at build time.
- `sw.js` should never be cached by the browser (nginx config sets `Cache-Control: no-cache` for it).
- API calls are `NetworkOnly` — the service worker never caches authenticated data.
- Static assets use content-hashed filenames and are cached immutably.

---

## Backend Deployment

### Recommended platforms
- **Railway**: Connect GitHub, set env vars in the service dashboard, deploy the `backend/` directory.
- **Render**: Web service, Docker runtime, set env vars, use the backend Dockerfile.
- **Fly.io**: `fly launch` from `backend/`, set secrets with `fly secrets set`.

### Build and run

```bash
cd backend
npm run build        # compiles to dist/
npm run start:prod   # node dist/main
```

The backend Dockerfile handles this automatically.

### Health check
`GET /api/v1/health` returns `{ status: "ok", service: "liferpg-api", timestamp: "..." }` without authentication. Use this as the liveness/readiness probe.

---

## Cookie & CORS Configuration

### How the refresh cookie works

The refresh token is stored in an `HttpOnly` cookie scoped to `/<api-prefix>/auth/refresh`. This means:
- JavaScript cannot read it (`HttpOnly: true`)
- It is only sent for the exact refresh endpoint path (minimal surface area)
- In production (`NODE_ENV=production`), the `Secure` flag is set — the cookie is only sent over HTTPS

### SameSite policy

The current setting is `SameSite=Strict`. This works when:
- **Same eTLD+1**: Frontend `app.mysite.com` + Backend `api.mysite.com` → same site ✅
- **Localhost dev**: Both on localhost → same site ✅

It does **not** work when:
- Frontend is on `app.vercel.app` and backend is on `app.railway.app` → different eTLD+1s ❌

**If you deploy to different-domain platforms**, change the cookie to `SameSite=None; Secure`:

In `backend/src/auth/auth.service.ts`, update `createRefreshSession()`:
```typescript
res.cookie(cookieName, plainToken, {
  httpOnly: true,
  secure: true,           // always true for SameSite=None
  sameSite: 'none',       // cross-site cookies require Secure
  path: `/${apiPrefix}/auth/refresh`,
  maxAge: expiresDays * 24 * 60 * 60 * 1000,
});
```

Also update `clearRefreshCookie()` to match.

**CORS**: `FRONTEND_URL` must be set to the exact frontend origin (no trailing slash, no wildcard). CORS in production allows only this one origin.

### Troubleshooting cookies

1. Check browser DevTools → Application → Cookies. The `rt` cookie should appear after login.
2. Verify `Secure` is set in production (only visible on HTTPS).
3. Verify the backend and frontend are served from the same eTLD+1, or switch to `SameSite=None; Secure`.
4. Check that `withCredentials: true` is set in the Axios client (`frontend/src/lib/api-client.ts`).

---

## Health Check

```
GET /api/v1/health
```

Response:
```json
{
  "status": "ok",
  "service": "liferpg-api",
  "timestamp": "2026-06-19T12:00:00.000Z"
}
```

No authentication required. Use as:
- Docker healthcheck
- Kubernetes liveness probe
- Uptime monitoring endpoint

---

## Swagger / API Docs

Swagger UI is available at `GET /api/v1/docs` **only when**:
- `SWAGGER_ENABLED=true` **and**
- `NODE_ENV` is not `production`

In production, Swagger is never served regardless of `SWAGGER_ENABLED`. This prevents API schema exposure in production.

---

## Security Checklist

- [ ] `JWT_ACCESS_SECRET` is at least 32 random characters (never a dictionary word)
- [ ] `NODE_ENV=production` is set in production
- [ ] `SWAGGER_ENABLED=false` is set in production
- [ ] `FRONTEND_URL` matches the exact deployed frontend origin
- [ ] HTTPS is enforced for both frontend and backend (required for `Secure` cookies)
- [ ] MongoDB URI credentials are not committed to source control
- [ ] `.env` files are in `.gitignore` and `.dockerignore`
- [ ] Refresh cookie is `HttpOnly` and `Secure` in production
- [ ] `SameSite` policy matches your deployment topology (see above)
- [ ] Backend logs do not contain: passwords, password hashes, access tokens, refresh tokens, Authorization headers, or cookie values
- [ ] `passwordHash`, `failedLoginAttempts`, `lockUntil`, `tokenHash` are never returned to clients

---

## Rollback Notes

Backend is stateless (no local filesystem writes). Rolling back a bad deployment:

1. Redeploy the previous Docker image tag or git commit.
2. MongoDB schema changes are additive (new optional fields only). Rollback does not require DB migration for the MVP.
3. If a JWT secret is rotated, all active access tokens are immediately invalidated. Users must re-authenticate. Refresh tokens in the DB remain valid until they expire.
4. Refresh sessions in MongoDB are independent of backend restarts — users stay logged in across redeployments.
