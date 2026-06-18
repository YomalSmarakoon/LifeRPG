# Life RPG — Backend

NestJS + MongoDB API for the Life RPG MVP.

## Quick start

```bash
# Requires Node 22+ (use nvm)
nvm use 22.14.0

cp .env.example .env
# Edit .env — set MONGODB_URI to your running MongoDB instance

npm install
npm run start:dev
```

## Verify Phase 2

```bash
# Health check
curl http://localhost:3001/api/v1/health
# → { "status": "ok", "service": "liferpg-api", "timestamp": "..." }

# Swagger UI (dev only)
open http://localhost:3001/api/v1/docs

# Structured validation error
curl -X POST http://localhost:3001/api/v1/health \
  -H "Content-Type: application/json" \
  -d '{"bad": "field"}'
# → { "statusCode": 404, "message": "Cannot POST /api/v1/health", "path": "...", "timestamp": "..." }
```

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled output |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Jest) |

## Environment

See `.env.example` for all required variables.

## Phase status

- [x] Phase 1 — Frontend Shell
- [x] Phase 2 — NestJS Backend Skeleton ← **current**
- [ ] Phase 3 — Auth
- [ ] Phase 4 — User, Character, Default Habits
- [ ] Phase 5 — Habit CRUD and Daily Completion
- [ ] Phase 6 — Weekly Habits, Achievements, XP Feed
- [ ] Phase 7 — Dashboard and Frontend Integration
- [ ] Phase 8 — PWA and Deployment

See `docs/LIFE_RPG_MVP_FINAL_IMPLEMENTATION_SPEC.md` for full implementation details.
