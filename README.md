# LifeRPG

A gamified productivity app for software engineers. Complete daily habits — coding, gym, reading, job applications — and watch your character level up, earn gold, improve stats, and unlock achievements.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Zustand, TanStack Query, React Router, PWA |
| Backend | NestJS 10 + TypeScript (strict), Passport JWT, Mongoose |
| Database | MongoDB 7 |
| Runtime | Node 22 |

---

## Prerequisites

- [nvm](https://github.com/nvm-sh/nvm) (or Node 22 installed directly)
- [Docker](https://docs.docker.com/get-docker/) (for MongoDB)

---

## Quick Start

### 1. Use correct Node version

```bash
nvm install 22
nvm use 22
```

### 2. Start MongoDB

```bash
docker run --rm -d -p 27017:27017 --name liferpg-mongo mongo:7
```

### 3. Set up backend environment

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and set a real `JWT_ACCESS_SECRET` (minimum 32 characters):

```env
JWT_ACCESS_SECRET=change-this-to-a-secure-random-string-min-32-chars
```

All other defaults work out of the box for local development.

### 4. Install dependencies and start backend

```bash
# from backend/
npm install
npm run start:dev
```

Backend starts at `http://localhost:3001`.

### 5. Install dependencies and start frontend

```bash
# from frontend/
npm install
npm run dev
```

Frontend starts at `http://localhost:5173`.

---

## Environment Variables

All variables live in `backend/.env`. Copy from `backend/.env.example`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `MONGODB_URI` | `mongodb://localhost:27017/liferpg` | MongoDB connection string |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `API_PREFIX` | `api/v1` | URL prefix for all routes |
| `SWAGGER_ENABLED` | `true` | Enable Swagger UI (dev only) |
| `JWT_ACCESS_SECRET` | — | **Required.** Min 32 chars. |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Refresh token lifetime in days |
| `REFRESH_COOKIE_NAME` | `rt` | HttpOnly cookie name |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor (10–14) |

---

## API Reference

Base URL: `http://localhost:3001/api/v1`

Interactive Swagger docs: `http://localhost:3001/api/v1/docs` (when `SWAGGER_ENABLED=true`)

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Service health check |

### Auth

| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | `/auth/register` | — | 5 / 15 min | Register new user |
| POST | `/auth/login` | — | 10 / 15 min | Login, sets HttpOnly refresh cookie |
| POST | `/auth/refresh` | Cookie | 20 / 15 min | Rotate refresh token, return new access token |
| POST | `/auth/logout` | Cookie | — | Revoke current session, clear cookie |
| POST | `/auth/logout-all` | Bearer | — | Revoke all sessions for current user |

### Character

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/character` | Bearer | Get character (level, XP, rank, stats, streaks) |
| PATCH | `/character` | Bearer | Update `avatarEmoji` or `className` |

---

## Manual Verification

Use these `curl` commands to confirm the stack is working after setup.

**Health check**
```bash
curl http://localhost:3001/api/v1/health
# → {"status":"ok","service":"liferpg-api","timestamp":"..."}
```

**Register**
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","username":"devuser","password":"SecurePass123!","timezone":"America/New_York"}' | jq .
# → {"userId":"...","email":"dev@example.com","username":"devuser"}
```

**Login**
```bash
curl -s -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"SecurePass123!"}' | jq .
# → {"accessToken":"eyJ..."}
```

**Get character** (replace `<token>` with the `accessToken` from login)
```bash
curl -s http://localhost:3001/api/v1/character \
  -H "Authorization: Bearer <token>" | jq .
# → {"level":1,"totalXp":0,"rank":"Bronze","stats":{...},"streaks":{...}}
```

**Refresh token**
```bash
curl -s -b cookies.txt -c cookies.txt -X POST \
  http://localhost:3001/api/v1/auth/refresh | jq .
# → {"accessToken":"eyJ..."}
```

---

## What Happens on Registration

After a successful `POST /auth/register`, the backend automatically creates:

- **1 Character** — level 1, Bronze rank, all stats at 10, zero streaks
- **10 Daily habits** — Gym Session, LeetCode Easy/Medium/Hard, Read 30 Min, Study Java/Spring/Angular (1h each), System Design 1h, Apply to Job, Wake Up On Time, Plan Tomorrow
- **5 Weekly habits** — including "5 LeetCodes" which links to the three daily LeetCode habits
- **7 Achievement definitions** — seeded globally on server startup

---

## Project Structure

```
LifeRPG/
├── backend/                  NestJS API
│   ├── src/
│   │   ├── auth/             Register, login, refresh, logout (JWT + HttpOnly cookies)
│   │   ├── characters/       Character schema, XP calculator, GET/PATCH endpoints
│   │   ├── habits/           Habit schema + default seeding (no CRUD yet)
│   │   ├── achievements/     Achievement definitions + startup seeding
│   │   ├── users/            User schema, lockout logic
│   │   ├── common/           Exception filter, logging interceptor, decorators
│   │   ├── config/           Configuration + Joi env validation
│   │   ├── database/         MongooseModule setup
│   │   └── health/           GET /health
│   └── .env.example
├── frontend/                 React + Vite PWA (shell only — API integration pending)
│   └── src/
│       ├── features/         Dashboard, habits, character, auth screens
│       ├── stores/           Zustand stores
│       └── utils/            XP calculator (mirrors backend)
└── docs/                     Implementation spec and design docs
```

---

## Security Notes

- Refresh tokens are stored as SHA-256 hashes in MongoDB; the plain token only travels in an HttpOnly cookie scoped to the `/auth/refresh` path
- Token rotation is active — each refresh issues a new token pair; replaying a revoked token revokes the entire session family (theft detection)
- Account lockout: 5 failed login attempts locks the account for 15 minutes
- Passwords, tokens, and cookies are never logged
- The same error message (`"Invalid email or password"`) is returned for wrong email and wrong password to prevent user enumeration

---

## Development Scripts

```bash
# Backend
npm run start:dev     # watch mode
npm run build         # compile TypeScript
npm run lint          # eslint --fix
npm run test          # jest unit tests
npm run test:cov      # coverage report

# Frontend
npm run dev           # vite dev server
npm run build         # type-check + vite build
npm run lint          # eslint
```

---

## Roadmap

- [ ] Phase 5 — Habit CRUD + daily completion (POST `/habits/:id/complete`) with XP gain, streak tracking, and undo
- [ ] Phase 6 — Weekly habit completion, achievement evaluation, XP feed
- [ ] Phase 7 — Dashboard endpoint, frontend ↔ API integration
- [ ] Phase 8 — PWA finalization, deployment
