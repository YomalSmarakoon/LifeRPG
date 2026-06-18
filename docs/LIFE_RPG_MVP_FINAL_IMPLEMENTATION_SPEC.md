# Life RPG — MVP Final Implementation Spec

**Version:** 2.0  
**Date:** 2026-06-17  
**Purpose:** Implementation-ready reference. Use this before writing any code.  
**Supersedes:** `LIFE_RPG_MVP_IMPLEMENTATION_SPEC.md`

---

## Table of Contents

1. [Final MVP Feature Scope](#1-final-mvp-feature-scope)
2. [Final MongoDB Collections and Schemas](#2-final-mongodb-collections-and-schemas)
3. [Final Index Strategy](#3-final-index-strategy)
4. [Final API Contracts](#4-final-api-contracts)
5. [Final Backend Service Responsibilities](#5-final-backend-service-responsibilities)
6. [Final Habit Completion Algorithm](#6-final-habit-completion-algorithm)
7. [Final XP Calculation](#7-final-xp-calculation)
8. [Final Streak Cache Strategy](#8-final-streak-cache-strategy)
9. [Final Weekly Habit Strategy](#9-final-weekly-habit-strategy)
10. [Final Achievement Strategy](#10-final-achievement-strategy)
11. [Final Security Rules](#11-final-security-rules)
12. [Final Build Order](#12-final-build-order)

---

## 1. Final MVP Feature Scope

### 1.1 Included

| Feature | Notes |
|---|---|
| User registration | Email + password + username + timezone |
| User login / logout | JWT in memory + refresh token in HttpOnly cookie |
| Refresh token rotation | Family-based theft detection |
| User profile read/update | Username, timezone |
| Character read/update | Level, XP, rank, stats, gold, avatar emoji, class name |
| Default seeded habits on register | 10 daily + 5 weekly from current app constants |
| Custom habit CRUD | Create, read, update, soft-delete |
| Daily habit completion | XP award, streak update, achievement check |
| Same-day habit undo | Reverts XP, marks log as undone, recomputes streak |
| Weekly habit completion | Manual, category-count, and habit-count modes |
| XP event log | Append-only; every XP change has a corresponding habit_log and xp_event |
| Level and rank calculation | Server-authoritative, derived from totalXp |
| Streak tracking | Incremental cache in `character.streaks`, updated on completion |
| Streak shields | Earned automatically every 7 streak days, max 3; used automatically |
| 7 simple achievements | See Section 10 |
| Dashboard endpoint | Single request for all app-open data |
| Activity heatmap data | Derived from habit_logs by dateKey |
| Data export | Full JSON dump, rate-limited |
| PWA installability | vite-plugin-pwa, real PNG icons |
| Offline read cache | TanStack Query stale-while-revalidate + Workbox NetworkFirst for API GET routes |
| Account lockout | 5 failed logins → 15-minute lock |

### 1.2 Excluded (and Why)

| Excluded | Reason |
|---|---|
| XP inactivity penalties | Removed entirely — discourages new users, adds complexity |
| Offline write sync | Needs IndexedDB queue + BackgroundSync + conflict resolution — MVP+1 |
| Boss battles | Not part of core daily loop |
| Push notifications | Retention feature; deliver value first |
| Email verification | No email provider dependency in MVP |
| Password reset | Same email provider dependency |
| Data import | Needs schema validation + XP reconciliation — too risky for MVP |
| Manual shield-use endpoint | Shields are used automatically; no manual invocation needed |
| Complex achievements (boss_kill, perfect_week, shield_use, rank_in) | Deferred |

### 1.3 Data Source of Truth Map

| Data | Source of Truth | Cache |
|---|---|---|
| All habit completions (daily + weekly) | `habit_logs` | — |
| XP history | `xp_events` | `character.totalXp` |
| Character level / rank | Derived from `character.totalXp` | `character.level`, `character.rank` |
| Character stats | Derived from `character.level` via `statsForLevel()` | `character.stats` |
| Gold | `character.gold` (append-only; never decremented in MVP) | — |
| Current streak per key | `character.streaks[key]` (incremental) | Recomputable from `habit_logs` |
| Weekly auto-completion state | `habit_logs` (logType: "weekly_auto") | — |
| Achievement unlocks | `user_achievements` | — |

---

## 2. Final MongoDB Collections and Schemas

### Collections summary

```
users
refresh_sessions
characters
habits
habit_logs
xp_events
achievement_definitions
user_achievements
```

**Total: 8 collections. No `streaks` collection. No `weeklyCompletions` on character.**

---

### 2.1 `users`

```js
{
  _id: ObjectId,
  email: "yomal@example.com",        // lowercase, trimmed; unique
  passwordHash: "$2b$12$...",         // bcrypt cost 12; NEVER returned to client
  username: "TheArchitect",           // 3–30 chars, alphanum + underscore; unique
  timezone: "Asia/Colombo",           // IANA timezone string; default "UTC"
  failedLoginAttempts: 0,             // int; reset on successful login
  lockUntil: null,                    // Date | null; null = not locked
  createdAt: ISODate,
  updatedAt: ISODate,
}
```

**Invariants:**
- `email` never changes after registration
- `passwordHash` projected out of every response
- Check `lockUntil > now` before `bcrypt.compare` — return `401` immediately if locked

---

### 2.2 `refresh_sessions`

```js
{
  _id: ObjectId,
  userId: ObjectId,                   // ref: users._id
  tokenHash: "sha256hexstring",       // SHA-256(plainRefreshToken); unique
  familyId: "uuid-v4",               // all rotations from one login share a family
  userAgent: "Mozilla/5.0 ...",
  ipAddress: "203.0.113.1",           // audit only
  expiresAt: ISODate,                 // TTL index auto-deletes
  revoked: false,
  revokedAt: null,
  createdAt: ISODate,
}
```

**Invariants:**
- Plain refresh token stored only in the `HttpOnly` cookie, never in DB
- On rotation: mark old `revoked: true`, insert new session with same `familyId`
- Theft detection (revoked token replayed): `updateMany({ familyId }, { revoked: true })`

---

### 2.3 `characters`

```js
{
  _id: ObjectId,
  userId: ObjectId,                   // unique; one character per user

  // XP — totalXp is a cache; xp_events is the source of truth
  totalXp: 0,
  level: 1,                           // derived from totalXp
  currentLevelXp: 0,                  // totalXp - xpFloorForLevel(level)
  xpToNextLevel: 500,                 // level * 500
  rank: "Bronze",                     // derived from level

  gold: 0,                            // permanently earned on level-up; never decremented
  stats: {                            // cache of statsForLevel(level); see Section 7
    STR: 10, INT: 10, WIS: 10,
    DEX: 10, CHA: 10, END: 10,
  },
  avatarEmoji: "⚔️",                  // max 4 chars
  className: "Software Engineer",     // max 60 chars

  // Streak cache — incremental; recomputable from habit_logs if needed
  streaks: {
    gym:       { current: 0, shields: 0, lastDateKey: null },
    code:      { current: 0, shields: 0, lastDateKey: null },
    reading:   { current: 0, shields: 0, lastDateKey: null },
    earlyRise: { current: 0, shields: 0, lastDateKey: null },
  },

  // Counter for achievement evaluation — incremented only by daily completions
  totalHabitsCompleted: 0,

  lastActiveDate: null,               // "YYYY-MM-DD" in user's timezone

  createdAt: ISODate,
  updatedAt: ISODate,
}
```

**Not on character:**
- `penaltyMultiplier`, `penaltyExpiresAt` — no penalties in MVP
- `perfectDayStreak` — deferred achievement
- `weeklyCompletions` — weekly completion state is derived from `habit_logs`

---

### 2.4 `habits`

```js
{
  _id: ObjectId,
  userId: ObjectId,

  name: "Gym Session",
  icon: "🏋️",
  category: "fitness",               // enum: fitness | coding | reading | career | wellness | custom
  frequency: "daily",                // enum: daily | weekly
  xpReward: 50,                      // 1–500 (daily), 1–1000 (weekly)
  difficulty: "medium",              // enum: easy | medium | hard | legendary
  streakKey: "gym",                  // string | null; daily habits only

  // Weekly fields — null unless frequency == "weekly"
  weeklyTarget: null,                // int | null
  weeklyTrackingMode: null,          // null | "manual" | "category_count" | "habit_count"
  weeklyCategory: null,              // string | null; category_count mode
  weeklyHabitIds: [],                // ObjectId[]; habit_count mode

  isActive: true,
  sortOrder: 0,
  createdAt: ISODate,
  updatedAt: ISODate,
}
```

**Weekly tracking mode semantics:**

| `weeklyTrackingMode` | Completion trigger | `weeklyTarget` | `weeklyCategory` | `weeklyHabitIds` |
|---|---|---|---|---|
| `"manual"` | User taps complete | null | — | — |
| `"category_count"` | Auto: N logs from category this week | required | required | — |
| `"habit_count"` | Auto: N logs from specific habit IDs this week | required | — | required |

**Validation rules:**
- `frequency == "weekly"` requires `weeklyTrackingMode` to be non-null
- `category_count` requires `weeklyCategory` + `weeklyTarget`
- `habit_count` requires `weeklyHabitIds` (non-empty) + `weeklyTarget`
- `weeklyHabitIds` entries must be `_id` of daily habits owned by the same user
- `frequency` cannot change after creation

**Default seeded habits:**

| Name | Category | Freq | XP | streakKey | weeklyMode | weeklyTarget | weeklyCategory | weeklyHabitIds |
|---|---|---|---|---|---|---|---|---|
| Gym Session | fitness | daily | 50 | gym | — | — | — | — |
| LeetCode Easy | coding | daily | 30 | code | — | — | — | — |
| LeetCode Medium | coding | daily | 60 | code | — | — | — | — |
| LeetCode Hard | coding | daily | 120 | code | — | — | — | — |
| Read 30 Min | reading | daily | 25 | reading | — | — | — | — |
| Study Java/Spring/Angular 1h | coding | daily | 40 | null | — | — | — | — |
| System Design 1h | coding | daily | 60 | null | — | — | — | — |
| Apply to Job | career | daily | 35 | null | — | — | — | — |
| Wake Up On Time | wellness | daily | 10 | earlyRise | — | — | — | — |
| Plan Tomorrow | wellness | daily | 10 | null | — | — | — | — |
| 3 Gym Sessions | fitness | weekly | 150 | null | category_count | 3 | fitness | — |
| 5 LeetCodes | coding | weekly | 200 | null | habit_count | 5 | — | [lc_easy, lc_med, lc_hard IDs] |
| 3 Job Applications | career | weekly | 105 | null | category_count | 3 | career | — |
| 1 Book Chapter | reading | weekly | 50 | null | category_count | 1 | reading | — |
| 1 Mock Interview | career | weekly | 80 | null | manual | null | — | — |

> **Seed order:** Insert daily habits first, then weekly habits (so `weeklyHabitIds` references exist).

---

### 2.5 `habit_logs`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  habitId: ObjectId,

  // Log classification
  logType: "daily",                  // "daily" | "weekly_manual" | "weekly_auto"
  source: "manual",                  // "manual" | "auto"

  // Date keys
  dateKey: "2026-06-17",            // "YYYY-MM-DD" in user's timezone; always present
  weekKey: null,                     // "YYYY-Www" ISO week; present on weekly_manual and weekly_auto only

  completedAt: ISODate,              // UTC server timestamp
  xpAwarded: 50,

  habitSnapshot: {                   // snapshot at completion time
    name: "Gym Session",
    category: "fitness",
    difficulty: "medium",
    xpReward: 50,
  },

  // Client-generated UUID v4 for future offline sync idempotency
  // null for server-generated weekly_auto logs
  syncId: "uuid-v4" | null,

  undone: false,
  undoneAt: null,
  createdAt: ISODate,
}
```

**Field rules by log type:**

| Field | `daily` | `weekly_manual` | `weekly_auto` |
|---|---|---|---|
| `logType` | `"daily"` | `"weekly_manual"` | `"weekly_auto"` |
| `source` | `"manual"` | `"manual"` | `"auto"` |
| `dateKey` | Day completed | Day tapped complete | Day weekly target was reached |
| `weekKey` | `null` | ISO week string | ISO week string |
| `syncId` | Client UUID | Client UUID | `null` |
| `undone` | Can be undone (same day only) | Can be undone (current week only) | Never undone (MVP rule) |

**Invariant:** Every XP-awarding action must have a corresponding `habit_log` and `xp_event`. No XP event exists without a context `habit_log`.

---

### 2.6 `xp_events`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  delta: 50,                          // positive = gain; negative = loss; never 0
  source: "habit_complete",           // "habit_complete" | "habit_undo" | "achievement_unlock"
  contextType: "habit_logs",          // collection name of the triggering document
  contextId: ObjectId,                // _id of the triggering document

  balanceBefore: 1200,               // character.totalXp before this event
  balanceAfter: 1250,                // character.totalXp after this event

  timestamp: ISODate,
}
```

**Invariants:**
- Append-only. Never update or delete.
- `balanceAfter` must equal `character.totalXp` after the surrounding transaction commits.
- XP can never go below 0: `actualDelta = max(delta, -balanceBefore)` before inserting.

---

### 2.7 `achievement_definitions`

```js
{
  _id: ObjectId,
  code: "streak_7",                   // unique stable identifier
  name: "Week Warrior",
  icon: "🗓️",
  description: "Maintain a 7-day streak on any habit",
  xpReward: 150,
  category: "general",
  condition: { type: "anyStreakCurrent_gte", threshold: 7 },
}
```

---

### 2.8 `user_achievements`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  achievementDefinitionId: ObjectId,
  achievementCode: "streak_7",        // denormalized; no join needed for GET /achievements
  unlockedAt: ISODate,
  xpAwarded: 150,
}
```

Unique per `(userId, achievementDefinitionId)`.

---

## 3. Final Index Strategy

### 3.1 `users`

```js
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ username: 1 }, { unique: true })
```

### 3.2 `refresh_sessions`

```js
db.refresh_sessions.createIndex({ tokenHash: 1 }, { unique: true })
db.refresh_sessions.createIndex({ userId: 1, revoked: 1 })
db.refresh_sessions.createIndex({ familyId: 1 })
db.refresh_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

### 3.3 `characters`

```js
db.characters.createIndex({ userId: 1 }, { unique: true })
```

### 3.4 `habits`

```js
db.habits.createIndex({ userId: 1, frequency: 1, isActive: 1 })
db.habits.createIndex({ userId: 1, weeklyCategory: 1, isActive: 1 })
```

### 3.5 `habit_logs`

```js
// Dashboard: today's completions for a user
db.habit_logs.createIndex({ userId: 1, dateKey: 1 })

// Per-habit log history
db.habit_logs.createIndex({ userId: 1, habitId: 1, dateKey: -1 })

// Weekly category-count and habit-count progress queries
db.habit_logs.createIndex({ userId: 1, 'habitSnapshot.category': 1, dateKey: 1 })

// CRITICAL: One active daily completion per user/habit/date
// Only daily logs participate (logType: "daily")
db.habit_logs.createIndex(
  { userId: 1, habitId: 1, dateKey: 1 },
  {
    unique: true,
    partialFilterExpression: { undone: false, logType: "daily" },
    name: "habit_logs_daily_no_duplicate"
  }
)

// CRITICAL: One active weekly completion per user/habit/week
// Covers both weekly_manual and weekly_auto (all non-daily logs have weekKey)
db.habit_logs.createIndex(
  { userId: 1, habitId: 1, weekKey: 1 },
  {
    unique: true,
    partialFilterExpression: { undone: false, weekKey: { $type: "string" } },
    name: "habit_logs_weekly_no_duplicate"
  }
)

// Idempotency key for future offline sync (null for server-generated weekly_auto logs)
db.habit_logs.createIndex(
  { syncId: 1 },
  { unique: true, sparse: true }
)
```

**Note on weekly dedup index:** The `(userId, habitId, weekKey)` index with `{ undone: false, weekKey: { $type: "string" } }` prevents both duplicate manual completions and duplicate auto-completions for the same habit/week. A race condition where two concurrent requests both try to auto-complete the same weekly habit resolves by the second insert failing with a duplicate key error — catch it and skip silently (the first transaction already awarded the XP).

### 3.6 `xp_events`

```js
db.xp_events.createIndex({ userId: 1, timestamp: -1 })
```

### 3.7 `achievement_definitions`

```js
db.achievement_definitions.createIndex({ code: 1 }, { unique: true })
```

### 3.8 `user_achievements`

```js
db.user_achievements.createIndex(
  { userId: 1, achievementDefinitionId: 1 },
  { unique: true }
)
db.user_achievements.createIndex({ userId: 1, unlockedAt: -1 })
```

---

## 4. Final API Contracts

### 4.1 Global Conventions

```
Base path:     /api/v1
Auth:          Authorization: Bearer <accessToken>   (all protected routes)
Content-Type:  application/json

Error shape:
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "must be a valid email" }],
  "path": "/api/v1/auth/register",
  "timestamp": "2026-06-17T06:00:00Z"
}
```

---

### 4.2 Auth

#### `POST /api/v1/auth/register`
**Rate limit:** 5 / 15 min / IP

Request:
```json
{ "email": "yomal@example.com", "password": "MinEight1!", "username": "TheArchitect", "timezone": "Asia/Colombo" }
```
Response `201`:
```json
{ "userId": "...", "email": "yomal@example.com", "username": "TheArchitect" }
```
Side effects: user + character (level 1) + 15 default habits + achievement definitions (idempotent seed).  
Errors: `400` validation, `409` email or username taken.

---

#### `POST /api/v1/auth/login`
**Rate limit:** 10 / 15 min / IP

Request:
```json
{ "email": "yomal@example.com", "password": "MinEight1!" }
```
Response `200` + sets cookie `rt`:
```json
{ "accessToken": "<15min JWT>" }
```
`Set-Cookie: rt=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800`

Errors: `401 "Invalid email or password"` (same message for both wrong email and wrong password). Lockout: 5 failures → `lockUntil = now + 15min`.

---

#### `POST /api/v1/auth/refresh`
**Auth:** cookie only

Response `200` + rotated cookie:
```json
{ "accessToken": "<new 15min JWT>" }
```
Theft detection: revoked token presented → revoke entire family → `401`.

---

#### `POST /api/v1/auth/logout`
**Auth:** cookie only  
Response `200` + `Set-Cookie: rt=; Max-Age=0; Path=/api/v1/auth/refresh`

---

#### `POST /api/v1/auth/logout-all`
**Auth:** Bearer  
Response `200`: `{ "sessionsRevoked": 3 }`

---

### 4.3 Users

#### `GET /api/v1/users/me`
Response `200`:
```json
{ "userId": "...", "email": "...", "username": "TheArchitect", "timezone": "Asia/Colombo", "createdAt": "..." }
```
Never returns `passwordHash`, `failedLoginAttempts`, `lockUntil`.

---

#### `PATCH /api/v1/users/me`
Request (all optional): `{ "username": "NewName", "timezone": "America/New_York" }`  
Validation: username 3–30 alphanum+underscore; timezone valid IANA string.  
**Timezone change side effect:** Sets `character.lastActiveDate = null`.  
Response `200`: same shape as GET.

---

### 4.4 Character

#### `GET /api/v1/character`
Response `200`:
```json
{
  "level": 3, "totalXp": 2150, "currentLevelXp": 650, "xpToNextLevel": 1500,
  "rank": "Bronze", "gold": 60,
  "stats": { "STR": 12, "INT": 11, "WIS": 10, "DEX": 10, "CHA": 10, "END": 10 },
  "avatarEmoji": "⚔️", "className": "Software Engineer",
  "streaks": {
    "gym":       { "current": 8, "shields": 1 },
    "code":      { "current": 3, "shields": 0 },
    "reading":   { "current": 0, "shields": 0 },
    "earlyRise": { "current": 14, "shields": 2 }
  }
}
```

---

#### `PATCH /api/v1/character`
Request (all optional): `{ "avatarEmoji": "🧙", "className": "Backend Engineer" }`  
Response `200`: same shape as GET.

---

### 4.5 Habits CRUD

#### `GET /api/v1/habits`
**Query:** `?frequency=daily&active=true`

Response `200` — daily habit shape:
```json
{
  "habits": [{
    "id": "...",
    "name": "Gym Session", "icon": "🏋️", "category": "fitness",
    "frequency": "daily", "xpReward": 50, "difficulty": "medium",
    "streakKey": "gym", "isActive": true, "sortOrder": 0,
    "dateKey": "2026-06-17",
    "completedToday": false
  }]
}
```

Response `200` — weekly habit shape:
```json
{
  "habits": [{
    "id": "...",
    "name": "3 Gym Sessions", "icon": "🏋️", "category": "fitness",
    "frequency": "weekly", "xpReward": 150, "difficulty": "medium",
    "isActive": true, "sortOrder": 0,
    "weeklyTrackingMode": "category_count",
    "weeklyTarget": 3,
    "weekKey": "2026-W25",
    "progress": 1,
    "completedThisWeek": false
  }]
}
```

- `dateKey`: today's date key in user's timezone
- `completedToday`: true if an active `habit_log` with `logType: "daily"` exists for this habit + dateKey
- `weekKey`: current ISO week in user's timezone
- `progress`: count of contributing daily logs this week (0 for manual habits — use `completedThisWeek`)
- `completedThisWeek`: true if an active `habit_log` with `logType: "weekly_manual"` or `"weekly_auto"` exists for this habit + weekKey

---

#### `POST /api/v1/habits`
**Limit:** max 50 active habits per user.

Request:
```json
{
  "name": "Gym Session", "icon": "🏋️", "category": "fitness",
  "frequency": "daily", "xpReward": 50, "difficulty": "medium", "streakKey": "gym"
}
```
For weekly habits, include `weeklyTrackingMode` + `weeklyTarget` + (`weeklyCategory` or `weeklyHabitIds`).  
Response `201`: full habit object.

---

#### `GET /api/v1/habits/:id`
Returns `404` if not found or belongs to another user.

---

#### `PATCH /api/v1/habits/:id`
Updatable: `name`, `icon`, `xpReward`, `difficulty`, `streakKey`, `isActive`, `sortOrder`.  
**Cannot change:** `frequency`, `weeklyTrackingMode`, `weeklyHabitIds` (would orphan historical logs).  
Response `200`: updated habit.

---

#### `DELETE /api/v1/habits/:id`
Soft-delete (`isActive: false`). Logs and events preserved. Response `204`.

---

### 4.6 Habit Completion

#### `POST /api/v1/habits/:id/complete`

Request:
```json
{
  "syncId": "550e8400-e29b-41d4-a716-446655440000",
  "completedAt": "2026-06-17T08:30:00.000Z"
}
```
- `syncId`: required for daily and manual weekly habits; UUID v4; client-generated
- `completedAt`: optional; defaults to server now; must be within 48 hours

Response `200`:
```json
{
  "habitLogId": "...",
  "xpAwarded": 50,
  "newTotalXp": 1250,
  "previousLevel": 3, "newLevel": 3, "levelUp": false, "newRank": "Bronze",
  "streakUpdate": { "streakKey": "gym", "newCount": 9, "shieldEarned": false },
  "unlockedAchievements": [],
  "weeklyAutoCompleted": [
    { "habitId": "...", "name": "3 Gym Sessions", "xpAwarded": 150 }
  ]
}
```

Errors:
- `404` — habit not found or belongs to another user
- `409` — already completed today (daily) or this week (manual weekly); duplicate key on `habit_logs` index
- `200` idempotent — if `syncId` already exists in `habit_logs`, return original result
- `422` — `completedAt` older than 48 hours

---

#### `POST /api/v1/habits/:id/undo`

Request:
```json
{ "dateKey": "2026-06-17" }
```

Rules:
- `dateKey` must equal today in user's timezone → `422` otherwise
- Finds `habit_log` where `{ userId, habitId, dateKey, logType: "daily", undone: false }` → `404` if not found
- Weekly auto-completions are **never** undone (see Section 6.1)

Response `200`:
```json
{ "xpReverted": 50, "newTotalXp": 1200, "newLevel": 3, "newRank": "Bronze" }
```

---

#### `GET /api/v1/habits/:id/logs`
**Query:** `?from=2026-06-01&to=2026-06-17&limit=60`

Response `200`:
```json
{
  "logs": [{
    "id": "...", "logType": "daily", "dateKey": "2026-06-17",
    "completedAt": "...", "xpAwarded": 50, "undone": false,
    "habitSnapshot": { "name": "Gym Session", "xpReward": 50 }
  }]
}
```

---

### 4.7 XP

#### `GET /api/v1/xp/events`
**Query:** `?limit=50&cursor=<ObjectId>`

Response `200`:
```json
{
  "events": [{
    "id": "...", "delta": 50, "source": "habit_complete",
    "contextType": "habit_logs", "contextId": "...",
    "balanceBefore": 1200, "balanceAfter": 1250, "timestamp": "..."
  }],
  "nextCursor": "..."
}
```

---

#### `GET /api/v1/xp/summary`
Response `200`:
```json
{ "today": 95, "thisWeek": 420, "total": 12450, "bySource": { "habit_complete": 12100, "achievement_unlock": 350 } }
```

---

### 4.8 Achievements

#### `GET /api/v1/achievements`
Response `200`:
```json
{
  "definitions": [{ "code": "first_completion", "name": "First Blood", "icon": "⚔️", "description": "...", "xpReward": 50 }],
  "unlocked": [{ "code": "first_completion", "unlockedAt": "...", "xpAwarded": 50 }]
}
```

---

### 4.9 Dashboard

#### `GET /api/v1/dashboard`
Called on every app open.

Response `200`:
```json
{
  "character": {
    "level": 3, "totalXp": 1250, "currentLevelXp": 250, "xpToNextLevel": 1500,
    "rank": "Bronze", "gold": 30,
    "stats": { "STR": 11, "INT": 10, "WIS": 10, "DEX": 10, "CHA": 10, "END": 10 },
    "avatarEmoji": "⚔️", "className": "Software Engineer",
    "streaks": {
      "gym": { "current": 8, "shields": 1 },
      "code": { "current": 3, "shields": 0 },
      "reading": { "current": 0, "shields": 0 },
      "earlyRise": { "current": 14, "shields": 2 }
    }
  },
  "todayHabits": [{
    "id": "...", "name": "Gym Session", "icon": "🏋️",
    "xpReward": 50, "difficulty": "medium", "category": "fitness", "streakKey": "gym",
    "dateKey": "2026-06-17",
    "completedToday": false
  }],
  "weeklyHabits": [{
    "id": "...", "name": "3 Gym Sessions", "xpReward": 150,
    "weeklyTrackingMode": "category_count", "weeklyTarget": 3,
    "weekKey": "2026-W25",
    "progress": 1,
    "completedThisWeek": false
  }],
  "xpToday": 95,
  "completedTodayCount": 4,
  "totalHabitsToday": 10,
  "recentUnlockedAchievements": [{ "code": "streak_7", "name": "Week Warrior", "icon": "🗓️", "unlockedAt": "..." }]
}
```

**Server: run in parallel with `Promise.all`:**
1. Load character
2. Load active daily habits + join today's daily `habit_logs`
3. Load active weekly habits + derive progress + check weekly `habit_logs`
4. Load recent 3 unlocked achievements

---

### 4.10 Data Export

#### `GET /api/v1/data/export`
**Rate limit:** 5 / 24 hours / user

Response `200`:
```
Content-Type: application/json
Content-Disposition: attachment; filename="liferpg-backup-2026-06-17.json"
```
```json
{
  "exportedAt": "...", "schemaVersion": "mvp-1.0",
  "user": { "username": "...", "timezone": "...", "createdAt": "..." },
  "character": { "level": 3, "totalXp": 1250, "rank": "Bronze", "gold": 30, "stats": {...} },
  "habits": [...],
  "habitLogs": [...],
  "xpEvents": [...],
  "achievements": [...]
}
```
Strips: `passwordHash`, `tokenHash`, `ipAddress`, `userAgent`, `_id` fields, `userId` fields.

---

### 4.11 Summary Table

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | 5/15min/IP |
| POST | `/auth/login` | none | 10/15min/IP |
| POST | `/auth/refresh` | cookie | token rotation |
| POST | `/auth/logout` | cookie | — |
| POST | `/auth/logout-all` | Bearer | — |
| GET | `/users/me` | Bearer | — |
| PATCH | `/users/me` | Bearer | — |
| GET | `/character` | Bearer | — |
| PATCH | `/character` | Bearer | — |
| GET | `/habits` | Bearer | ?frequency&active |
| POST | `/habits` | Bearer | max 50 |
| GET | `/habits/:id` | Bearer | — |
| PATCH | `/habits/:id` | Bearer | — |
| DELETE | `/habits/:id` | Bearer | soft-delete |
| POST | `/habits/:id/complete` | Bearer | syncId required |
| POST | `/habits/:id/undo` | Bearer | same-day only |
| GET | `/habits/:id/logs` | Bearer | date range |
| GET | `/xp/events` | Bearer | cursor paginated |
| GET | `/xp/summary` | Bearer | — |
| GET | `/achievements` | Bearer | — |
| GET | `/dashboard` | Bearer | app-open endpoint |
| GET | `/data/export` | Bearer | 5/day/user |

**Total: 22 endpoints.**

---

## 5. Final Backend Service Responsibilities

### Module structure

```
src/
├── auth/          register, login, refresh, logout, logout-all
├── users/         GET/PATCH /users/me
├── characters/    GET/PATCH /character; updateStreakCache(); statsForLevel()
├── habits/        CRUD + complete + undo + logs; weekly auto-completion check
├── xp/            addXpEvent(); GET /xp/events; GET /xp/summary
├── achievements/  evaluateAchievements(); GET /achievements
├── dashboard/     GET /dashboard (read-only aggregation, no mutations)
├── data-export/   GET /data/export
├── common/        JwtAuthGuard, @CurrentUser(), ParseObjectIdPipe,
│                  HttpExceptionFilter, LoggingInterceptor
├── database/      MongooseModule.forRootAsync
└── config/        ConfigModule, typed env
```

### Dependency rules

- `habits.service` orchestrates the full completion transaction; calls `xp.service.addXpEvent()`, `characters.service.updateStreakCache()`, `achievements.service.evaluate()`
- `xp.service.addXpEvent()` is the single owner of all XP update logic — reads character, inserts event, updates character cache; nothing else duplicates this
- `achievements.service.evaluate()` calls `xp.service.addXpEvent()` for each unlock
- `dashboard.service` is read-only; no mutations
- `auth.service` calls `habits.service.seedDefaults()` + `characters.service.create()` on register

### Key service method signatures

```typescript
// xp.service.ts
// Single owner of all XP state mutations.
// Reads character from DB using session (sees in-transaction writes),
// inserts xp_event, updates character XP/level/rank/gold/stats, returns change info.
async addXpEvent(
  userId: ObjectId,
  delta: number,                   // positive for gains, negative for reversals
  source: 'habit_complete' | 'habit_undo' | 'achievement_unlock',
  contextType: string,
  contextId: ObjectId,
  session: ClientSession,
): Promise<{
  newTotalXp: number;
  levelBefore: number;
  levelAfter: number;
  rankBefore: string;
  rankAfter: string;
  goldBefore: number;
  goldAfter: number;
}>

// characters.service.ts
// Recomputes one streak key from habit_logs — used by undo only.
async recomputeStreakFromLogs(
  userId: ObjectId,
  streakKey: string,
  userTimezone: string,
  session: ClientSession,
): Promise<void>

// Incremental streak update — used by daily completion.
async updateStreakCache(
  userId: ObjectId,
  streakKey: string,
  dateKey: string,
  userTimezone: string,
  session: ClientSession,
): Promise<{ newCount: number; shieldEarned: boolean }>

// habits.service.ts
async completeHabit(userId: ObjectId, habitId: ObjectId, dto: CompleteHabitDto): Promise<CompleteHabitResponseDto>
async undoHabit(userId: ObjectId, habitId: ObjectId, dto: UndoHabitDto): Promise<UndoHabitResponseDto>

// achievements.service.ts
async evaluate(
  userId: ObjectId,
  characterSnapshot: CharacterDoc,  // already loaded within session
  session: ClientSession,
): Promise<AchievementDefinitionDoc[]>
```

---

## 6. Final Habit Completion Algorithm

**All write operations for a daily habit completion happen in a single MongoDB transaction.**

```
POST /habits/:id/complete
Input: userId, habitId, syncId, completedAt (or server now)

── Pre-transaction checks (reads only) ──────────────────────────

1. LOAD user (timezone)

2. dateKey = formatInTimeZone(completedAt, user.timezone, 'yyyy-MM-dd')

3. LOAD habit WHERE { _id: habitId, userId, isActive: true }
   → 404 if not found

4. IF syncId already exists in habit_logs (sparse index lookup):
   → 200 idempotent — return stored result

5. CHECK habit_logs WHERE { userId, habitId, dateKey, logType: "daily", undone: false }
   → 409 if already completed today

6. LOAD character WHERE { userId }

── Transaction START ─────────────────────────────────────────────

7. INSERT daily habit_log {
     userId, habitId,
     logType: "daily", source: "manual",
     dateKey, weekKey: null,
     completedAt, xpAwarded: habit.xpReward,
     habitSnapshot: { name, category, difficulty, xpReward },
     syncId, undone: false,
   }

8. CALL xp.service.addXpEvent(
     userId, habit.xpReward, 'habit_complete',
     'habit_logs', dailyLog._id, session
   )
   → reads character via session, inserts xp_event, updates character XP + level + rank + gold + stats
   → returns { newTotalXp, levelBefore, levelAfter, rankBefore, rankAfter }

9. UPDATE character (via session) {
     totalHabitsCompleted: character.totalHabitsCompleted + 1,
     lastActiveDate: dateKey,
   }
   // Note: XP/level/rank/gold/stats already updated inside addXpEvent

10. IF habit.streakKey != null:
      streakResult = characters.service.updateStreakCache(
        userId, habit.streakKey, dateKey, user.timezone, session
      )

11. weeklyAutoCompleted = []
    IF habit.frequency == 'daily':
      weekKey = toWeekKey(dateKey, user.timezone)
      weekStartKey = weekStartDateKey(weekKey, user.timezone)

      LOAD weekly auto habits WHERE {
        userId, frequency: 'weekly', isActive: true,
        weeklyTrackingMode: { $in: ['category_count', 'habit_count'] }
      }

      FOR EACH weeklyHabit:
        // Check if already completed this week (query uses session — sees all in-tx writes)
        alreadyDone = habit_logs.exists({
          userId, habitId: weeklyHabit._id,
          weekKey, undone: false,
          logType: { $in: ["weekly_manual", "weekly_auto"] }
        }, session)
        IF alreadyDone: continue

        progress = countDocuments({ session, ...weekly progress query })
        // See Section 9 for query

        IF progress >= weeklyHabit.weeklyTarget:
          TRY:
            INSERT weekly_auto habit_log {
              userId, habitId: weeklyHabit._id,
              logType: "weekly_auto", source: "auto",
              dateKey, weekKey,
              completedAt: now,
              xpAwarded: weeklyHabit.xpReward,
              habitSnapshot: { ... },
              syncId: null, undone: false,
            }
            CALL xp.service.addXpEvent(
              userId, weeklyHabit.xpReward, 'habit_complete',
              'habit_logs', weeklyAutoLog._id, session
            )
            weeklyAutoCompleted.push({ habitId, name, xpAwarded })
          CATCH duplicate key error:
            continue  // race condition: another request already completed it

12. // Re-read updated character (reflects all addXpEvent calls via session)
    updatedCharacter = characters.findOne({ userId }, session)
    newAchievements = achievements.service.evaluate(userId, updatedCharacter, session)

── Transaction COMMIT ────────────────────────────────────────────

13. RETURN {
      habitLogId,
      xpAwarded: habit.xpReward,
      newTotalXp: updatedCharacter.totalXp,
      previousLevel: levelBefore,
      newLevel: levelAfter,
      levelUp: levelAfter > levelBefore,
      newRank: rankAfter,
      streakUpdate: { streakKey: habit.streakKey, ...streakResult },
      unlockedAchievements: newAchievements,
      weeklyAutoCompleted,
    }
```

---

### 6.1 Undo Habit Completion

Only daily (`logType: "daily"`) habit completions can be undone, same-day only.

**MVP rule for weekly auto-completions:** When a daily habit is undone that previously triggered a weekly auto-completion, the weekly auto-completion is **not reversed**. The weekly XP is permanently awarded once when the target was first reached. This prevents complex rollback logic. Document this behaviour clearly in the undo response.

```
POST /habits/:id/undo
Input: userId, habitId, dateKey

── Pre-transaction ───────────────────────────────────────────────

1. todayKey = formatInTimeZone(now, user.timezone, 'yyyy-MM-dd')
   IF dateKey != todayKey → 422 "Can only undo today's completions"

2. LOAD habit WHERE { _id: habitId, userId }
   → 404 if not found

3. FIND habit_log WHERE { userId, habitId, dateKey, logType: "daily", undone: false }
   → 404 if not found

── Transaction START ─────────────────────────────────────────────

4. UPDATE habit_log { undone: true, undoneAt: now }

5. xpToRevert = habitLog.xpAwarded
   CALL xp.service.addXpEvent(
     userId, -xpToRevert, 'habit_undo',
     'habit_logs', habitLog._id, session
   )
   // addXpEvent clamps to prevent XP going below 0
   // addXpEvent updates character XP, level, rank, stats (via statsForLevel)
   // Gold is NOT changed — gold is permanently earned on level-up

6. UPDATE character (via session) {
     totalHabitsCompleted: max(0, character.totalHabitsCompleted - 1),
   }

7. IF habit.streakKey != null:
     // Recompute from habit_logs rather than using the incremental algorithm.
     // The daily log was just set undone, so habit_logs now reflects the correct state.
     characters.service.recomputeStreakFromLogs(
       userId, habit.streakKey, user.timezone, session
     )

── Transaction COMMIT ────────────────────────────────────────────

8. RETURN {
     xpReverted: actual delta from addXpEvent (may be < xpToRevert if XP was near 0),
     newTotalXp, newLevel, newRank,
     weeklyAutoNote: "Weekly auto-completions triggered by this habit are not reversed",
   }
```

**`recomputeStreakFromLogs` algorithm:**

```
1. LOAD all active daily habit_logs for this user where:
   { userId, 'habitSnapshot.streakKey': streakKey, undone: false }
   ... but habits don't embed streakKey in snapshot.
   
   Preferred approach: load all active daily habit_logs for the streakKey habits:
   streakHabitIds = habits where { userId, streakKey: targetKey, isActive: true }
   logs = habit_logs where { userId, habitId: { $in: streakHabitIds },
                              logType: "daily", undone: false }
          order by dateKey DESC, limit 90  // 90 days is enough for streak recompute

2. Build a Set<dateKey> of all active completion dates for this streakKey.

3. Walk backwards from today:
   current = 0
   d = today
   WHILE Set.has(d):
     current++
     d = previousDay(d)

4. UPDATE character.streaks[streakKey] = {
     current: current,
     shields: character.streaks[streakKey].shields,  // preserve shields
     lastDateKey: current > 0 ? mostRecentDateKey : null,
   }
```

---

## 7. Final XP Calculation

All XP and stat math lives in `src/common/utils/xp-calculator.ts`. Shared by frontend and backend.

```typescript
// XP required to advance from level N to N+1
export function xpForLevel(level: number): number {
  return level * 500;
}

// Total XP at the start of level N (floor)
export function xpFloorForLevel(level: number): number {
  return (500 * level * (level - 1)) / 2;
}

// Derive level from totalXp
export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  while (xpFloorForLevel(level + 1) <= totalXp) level++;
  return level;
}

// XP progress within current level
export function currentLevelXpFromTotal(totalXp: number): number {
  return totalXp - xpFloorForLevel(levelFromTotalXp(totalXp));
}
```

**Level thresholds:**

| Level | XP floor | XP to next level |
|---|---|---|
| 1 | 0 | 500 |
| 2 | 500 | 1,000 |
| 3 | 1,500 | 1,500 |
| 5 | 5,000 | 2,500 |
| 10 | 22,500 | 5,000 |
| 20 | 95,000 | 10,000 |

**Rank thresholds:**

| Rank | Min Level |
|---|---|
| Bronze | 1 |
| Iron | 5 |
| Silver | 10 |
| Gold | 20 |
| Platinum | 35 |
| Diamond | 50 |
| Legendary | 75 |

```typescript
const RANKS = [
  { name: 'Bronze', min: 1 }, { name: 'Iron', min: 5 },
  { name: 'Silver', min: 10 }, { name: 'Gold', min: 20 },
  { name: 'Platinum', min: 35 }, { name: 'Diamond', min: 50 },
  { name: 'Legendary', min: 75 },
];

export function rankFromLevel(level: number): string {
  let rank = RANKS[0].name;
  for (const r of RANKS) { if (level >= r.min) rank = r.name; }
  return rank;
}
```

### Stats: deterministic derivation from level

**Rule:** `character.stats` is always `statsForLevel(character.level)`. Stats are never independently mutated. When level changes (up or down), call `statsForLevel(newLevel)` and store the result. This makes undo correct automatically — level drops, stats drop deterministically.

```typescript
export function statsForLevel(level: number): Record<string, number> {
  const keys = ['STR', 'INT', 'WIS', 'DEX', 'CHA', 'END'];
  const stats = { STR: 10, INT: 10, WIS: 10, DEX: 10, CHA: 10, END: 10 };
  for (let lvl = 2; lvl <= level; lvl++) {
    if (lvl % 5 === 0) {
      keys.forEach(k => stats[k] += 2);
    } else {
      stats[keys[lvl % keys.length]]++;
    }
  }
  return stats;
}
```

### Gold: permanently earned on level-up

**Rule:** Gold accumulates from level-up events. It is **never decremented**, even on undo. When a level-up occurs, award `(newLevel * 10)` gold per level gained:

```typescript
export function goldGainedFromLevels(levelBefore: number, levelAfter: number): number {
  let gold = 0;
  for (let lvl = levelBefore + 1; lvl <= levelAfter; lvl++) {
    gold += lvl * 10;
  }
  return gold;
}
```

`addXpEvent` adds gold on level gain. On level loss (undo), gold stays unchanged.

### `addXpEvent` internals

```
INSIDE addXpEvent(userId, delta, source, contextType, contextId, session):

  character = characters.findOne({ userId }, { session })
  
  actualDelta = (delta < 0) ? max(delta, -character.totalXp) : delta
  balanceBefore = character.totalXp
  balanceAfter = balanceBefore + actualDelta

  INSERT xp_event { userId, delta: actualDelta, source, contextType, contextId,
                    balanceBefore, balanceAfter, timestamp: now }

  newLevel = levelFromTotalXp(balanceAfter)
  oldLevel = character.level

  UPDATE character (session) {
    totalXp:        balanceAfter,
    currentLevelXp: currentLevelXpFromTotal(balanceAfter),
    xpToNextLevel:  newLevel * 500,
    level:          newLevel,
    rank:           rankFromLevel(newLevel),
    stats:          statsForLevel(newLevel),    // always recomputed from level
    gold:           character.gold + goldGainedFromLevels(oldLevel, newLevel),
    // gold unchanged on level loss
  }

  RETURN { newTotalXp: balanceAfter, levelBefore: oldLevel, levelAfter: newLevel,
           rankBefore: character.rank, rankAfter: rankFromLevel(newLevel),
           goldBefore: character.gold, goldAfter: updatedGold }
```

---

## 8. Final Streak Cache Strategy

### Design

Streaks are stored as an embedded map in `characters.streaks[streakKey]`. Updated **incrementally** on completion via `updateStreakCache()`. Recomputed from `habit_logs` on undo via `recomputeStreakFromLogs()`.

```typescript
// character.streaks[streakKey]
interface StreakState {
  current: number;           // consecutive-day count
  shields: number;           // available shields, max 3
  lastDateKey: string | null;
}
```

### Shield behaviour (MVP final rules)

- Shields are earned **automatically**: when `streak.current` reaches a multiple of 7, `shields = min(shields + 1, 3)`. No endpoint needed.
- Shields are used **automatically**: when the gap between `lastDateKey` and today is exactly 2 calendar days and `shields > 0`, one shield is consumed to bridge the miss.
- No manual shield-use endpoint in MVP.
- Maximum 3 shields held at any time.

### Incremental update algorithm

Called inside the daily completion transaction.

```
function updateStreakCache(character, streakKey, todayDateKey, userTimezone, session):

  sk = character.streaks[streakKey] ?? { current: 0, shields: 0, lastDateKey: null }

  // Guard: already updated today (e.g. two habits share the same streakKey)
  IF sk.lastDateKey == todayDateKey:
    return { newCount: sk.current, shieldEarned: false }

  yesterdayKey = formatInTimeZone(yesterday, userTimezone, 'yyyy-MM-dd')
  gapDays = calendarDaysBetween(sk.lastDateKey, todayDateKey)
             // null lastDateKey → treat as infinite gap

  IF sk.lastDateKey == null OR gapDays > 2:
    sk.current = 1              // broken or first ever
    sk.lastDateKey = todayDateKey

  ELSE IF sk.lastDateKey == yesterdayKey:
    sk.current++                // consecutive
    sk.lastDateKey = todayDateKey

  ELSE IF gapDays == 2 AND sk.shields > 0:
    sk.shields--                // shield bridges the one-day gap
    sk.current++
    sk.lastDateKey = todayDateKey

  ELSE:
    sk.current = 1              // gap > 1 day, no shields — reset
    sk.lastDateKey = todayDateKey

  shieldEarned = false
  IF sk.current % 7 == 0:
    sk.shields = min(sk.shields + 1, 3)
    shieldEarned = true

  UPDATE character.streaks[streakKey] = sk (via session)
  RETURN { newCount: sk.current, shieldEarned }
```

### Which habits update streaks?

Only `logType: "daily"` habits where `habit.streakKey != null`. Multiple habits can share a `streakKey` — any one completing advances the streak. The `lastDateKey == todayDateKey` guard prevents double-advancing when multiple habits share a key.

---

## 9. Final Weekly Habit Strategy

### Three tracking modes

| Mode | Completion trigger | XP | `habit_log` created |
|---|---|---|---|
| `manual` | User taps complete | Immediately on tap | Yes — `logType: "weekly_manual"` |
| `category_count` | Auto when N daily logs from category this week | When target first reached | Yes — `logType: "weekly_auto"` |
| `habit_count` | Auto when N logs from specific habit IDs this week | When target first reached | Yes — `logType: "weekly_auto"` |

**Invariant:** Every XP award has a `habit_log`. No exceptions.

### Week key

```typescript
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

function toWeekKey(utcDate: Date, timezone: string): string {
  const local = toZonedTime(utcDate, timezone);
  const year = getISOWeekYear(local);
  const week = getISOWeek(local);
  return `${year}-W${String(week).padStart(2, '0')}`;   // e.g. "2026-W25"
}

function weekStartDateKey(weekKey: string, timezone: string): string {
  // Returns "YYYY-MM-DD" of Monday of that ISO week in the user's timezone
  // Parse weekKey, construct the Monday date, format in timezone
}
```

Week starts **Monday** (ISO 8601). Not user-configurable in MVP.

### Manual weekly completion

Same endpoint (`POST /habits/:id/complete`) as daily. Backend detects `habit.frequency == "weekly"` and `habit.weeklyTrackingMode == "manual"`.

```
dateKey = today in user's timezone
weekKey = toWeekKey(completedAt, user.timezone)

INSERT habit_log {
  logType: "weekly_manual", source: "manual",
  dateKey, weekKey,
  syncId: <client UUID>,
  ...
}
```

Unique constraint `(userId, habitId, weekKey)` with `undone: false` and `weekKey: { $type: "string" }` prevents duplicate.

### Auto-completion check (inside the main completion transaction)

```typescript
// Inside step 11 of the completion algorithm (Section 6)

// Progress query for category_count mode:
const progress = await habitLogModel.countDocuments({
  userId,
  'habitSnapshot.category': weeklyHabit.weeklyCategory,
  dateKey: { $gte: weekStartKey, $lte: dateKey },
  logType: 'daily',
  undone: false,
}, { session });

// Progress query for habit_count mode:
const progress = await habitLogModel.countDocuments({
  userId,
  habitId: { $in: weeklyHabit.weeklyHabitIds },
  dateKey: { $gte: weekStartKey, $lte: dateKey },
  logType: 'daily',
  undone: false,
}, { session });
```

**Dedup check:** Instead of `character.weeklyCompletions` (removed), query `habit_logs` directly using the session:

```typescript
const alreadyCompleted = await habitLogModel.exists({
  userId,
  habitId: weeklyHabit._id,
  weekKey,
  undone: false,
}, { session });
if (alreadyCompleted) continue;
```

The unique index on `(userId, habitId, weekKey)` enforces this at the DB level. The `alreadyCompleted` check avoids a wasted insert attempt in the normal case.

### Undo and weekly auto-completions

When a daily habit is undone: its daily `habit_log` is marked `undone: true`. If that undo drops the weekly category/habit-count below the target, the weekly `weekly_auto` log **is not reversed**. The weekly XP award is permanent once earned.

This is the correct MVP simplification: the XP was legitimately earned when the target was hit. Complex rollback is deferred.

### Weekly progress in dashboard / GET /habits response

```typescript
const todayKey = formatInTimeZone(new Date(), user.timezone, 'yyyy-MM-dd');
const weekKey = toWeekKey(new Date(), user.timezone);
const weekStartKey = weekStartDateKey(weekKey, user.timezone);

// completedThisWeek (all modes):
const completedThisWeek = await habitLogModel.exists({
  userId, habitId: weeklyHabit._id,
  weekKey, undone: false,
});

// progress (category_count and habit_count modes):
const progress = await habitLogModel.countDocuments({ ...query above });
// For manual mode: progress = completedThisWeek ? 1 : 0
```

---

## 10. Final Achievement Strategy

### 7 MVP achievements

| Code | Name | Icon | Description | XP | Condition |
|---|---|---|---|---|---|
| `first_completion` | First Blood | ⚔️ | Complete your first habit | 50 | `totalHabitsCompleted >= 1` |
| `complete_10` | Dedicated | 🌱 | Complete 10 habits | 75 | `totalHabitsCompleted >= 10` |
| `complete_50` | Committed | 🔥 | Complete 50 habits | 150 | `totalHabitsCompleted >= 50` |
| `reach_level_5` | Apprentice | ⭐ | Reach Level 5 | 100 | `level >= 5` |
| `reach_level_10` | Journeyman | 🌟 | Reach Level 10 | 200 | `level >= 10` |
| `streak_3` | On a Roll | 🔥 | 3-day streak on any habit | 75 | `any streaks[*].current >= 3` |
| `streak_7` | Week Warrior | 🗓️ | 7-day streak on any habit | 150 | `any streaks[*].current >= 7` |

`totalHabitsCompleted` counts only **daily** habit completions (not weekly auto-completions).

### Condition structures for `achievement_definitions`

```js
{ type: "totalHabitsCompleted_gte", threshold: 1 }
{ type: "totalHabitsCompleted_gte", threshold: 10 }
{ type: "totalHabitsCompleted_gte", threshold: 50 }
{ type: "level_gte", threshold: 5 }
{ type: "level_gte", threshold: 10 }
{ type: "anyStreakCurrent_gte", threshold: 3 }
{ type: "anyStreakCurrent_gte", threshold: 7 }
```

### Evaluation algorithm

Called inside the completion transaction with the already-updated `character` snapshot.

```typescript
async function evaluateAchievements(
  userId: ObjectId,
  character: CharacterDoc,
  session: ClientSession,
): Promise<AchievementDefinitionDoc[]> {

  const definitions = getDefinitionsFromCache();  // 7 docs; loaded once at startup
  const unlocked = await userAchievementModel.find({ userId }, { achievementCode: 1 }, { session });
  const unlockedCodes = new Set(unlocked.map(u => u.achievementCode));

  const newUnlocks = definitions.filter(d =>
    !unlockedCodes.has(d.code) && conditionMet(d.condition, character)
  );

  for (const def of newUnlocks) {
    await userAchievementModel.create([{
      userId, achievementDefinitionId: def._id,
      achievementCode: def.code,
      unlockedAt: new Date(), xpAwarded: def.xpReward,
    }], { session });

    // Creates xp_event + updates character XP cache inside the same transaction
    await xpService.addXpEvent(
      userId, def.xpReward, 'achievement_unlock',
      'achievement_definitions', def._id, session
    );
  }

  return newUnlocks;
}

function conditionMet(condition: AchievementCondition, character: CharacterDoc): boolean {
  switch (condition.type) {
    case 'totalHabitsCompleted_gte':
      return character.totalHabitsCompleted >= condition.threshold;
    case 'level_gte':
      return character.level >= condition.threshold;
    case 'anyStreakCurrent_gte':
      return Object.values(character.streaks).some(s => s.current >= condition.threshold);
    default:
      return false;
  }
}
```

**All data comes from the in-transaction character snapshot — zero extra DB reads.**

### Deferred achievements

`boss_kill`, `perfect_week`, `shield_use` (needs `totalShieldsUsed` counter), `rank_in`, habit-name-based.

---

## 11. Final Security Rules

### Non-negotiable rules

1. **Access token:** React memory only (Zustand, not persisted). On page reload, call `POST /auth/refresh` to restore.
2. **Refresh token cookie:** `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh`. Never JS-accessible.
3. **Refresh token in DB:** Store only `SHA-256(plainToken)`. Never the plain token.
4. **Authorization:** Every user-data query includes `{ ..., userId: currentUser.id }`. Never load-then-check.
5. **IDOR response:** Return `404`, not `403`, for resources that exist but belong to another user.
6. **Password hash:** bcrypt cost 12. Projected out of every query result before returning.
7. **Tokens never logged:** No password, token, or hash in any log line.
8. **CSRF:** No CSRF protection needed. Access token is in `Authorization: Bearer` header. Refresh cookie is `SameSite=Strict` + path-scoped to `/api/v1/auth/refresh`.
9. **CORS:** `origin: [FRONTEND_URL]`, `credentials: true`. Never `origin: '*'` with `credentials: true`.
10. **Validation:** Frontend Zod (UX only). Backend `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` (security boundary).

### NestJS `main.ts` configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL],
      objectSrc:  ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

app.enableCors({
  origin: [process.env.FRONTEND_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));

app.useGlobalFilters(new HttpExceptionFilter());
```

### Rate limits

| Endpoint | Limit | Window |
|---|---|---|
| `POST /auth/register` | 5 | 15 min / IP |
| `POST /auth/login` | 10 | 15 min / IP |
| `POST /auth/refresh` | 20 | 15 min / IP |
| `GET /data/export` | 5 | 24 hours / user |
| All other routes | 500 | 15 min / user |

### Account lockout

5 consecutive failures for an email → `lockUntil = now + 15 min`. Return `401 "Invalid email or password"` (same wording for both wrong email and wrong password — do not reveal which). Check `lockUntil > now` before `bcrypt.compare`.

### localStorage rules

Never: access tokens, refresh tokens, email, PII, security-sensitive data.  
Allowed (via Zustand persist): theme preference, UI layout preferences.

---

## 12. Final Build Order

### Phase 1 — Frontend Shell (Week 1, ~3 days)

Goal: React app, routing, design tokens, all screens with static props.

- `npm create vite@latest frontend -- --template react-ts`
- Install: `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `vite-plugin-pwa`
- Port CSS custom properties (`:root` variables, `[data-theme="light"]`)
- Components: `BottomNav`, `Card`, `Button`, `ProgressBar`, `Badge`, `Toast`, `Modal`, `LevelUpOverlay`
- All screens with hardcoded static props; set up `QueryClient` + `authStore` (Zustand, not persisted)

Done when: 7 tabs navigate, TypeScript strict mode zero errors.

---

### Phase 2 — NestJS Backend Skeleton (Week 1, ~2 days)

Goal: NestJS + MongoDB running with global middleware.

- `nest new backend`
- Wire `MongooseModule.forRootAsync`, `ConfigModule`, `ThrottlerModule`
- Apply: `helmet()`, `cors()`, `ValidationPipe`, `HttpExceptionFilter`
- `GET /health → 200 { status: 'ok' }`
- Swagger at `/docs` (dev only)

Done when: health returns 200; invalid JSON body returns structured 400.

---

### Phase 3 — Auth (Week 2, ~3 days)

Goal: Full auth flow.

- `User` + `RefreshSession` schemas + all indexes
- `register` (bcrypt), `login` (lockout), `refresh` (rotation + theft detection), `logout`, `logout-all`
- `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser()` decorator
- Rate limits on auth routes

Done when: full login → refresh → logout cycle passes E2E via supertest.

---

### Phase 4 — User, Character, Default Habits (Week 2, ~2 days)

Goal: Registration creates all seed data.

- `Character` schema + `characters.service.create()`
- `xp-calculator.ts` with all functions including `statsForLevel()`, `goldGainedFromLevels()`
- `HabitsService.seedDefaults(userId)`
- `AchievementDefinitionService.seedIfEmpty()` (idempotent on startup)
- `GET/PATCH /users/me`, `GET/PATCH /character`

Done when: after register → 1 user + 1 character + 15 habits + 7 achievement definitions in DB.

---

### Phase 5 — Habit CRUD and Daily Completion (Week 3, ~4 days)

Goal: Core write path.

- Habit CRUD (5 endpoints) + all `habit_logs` indexes (both partial unique indexes)
- `xp.service.addXpEvent()` (loads character via session, updates XP/level/rank/gold/stats)
- `POST /habits/:id/complete` — full algorithm from Section 6 (one transaction)
- `POST /habits/:id/undo` — with `recomputeStreakFromLogs()`
- `GET /habits/:id/logs`
- `toDateKey()` + `toWeekKey()` + `weekStartDateKey()` utilities

Done when: complete daily → XP + level + streak update atomically. Complete same habit twice → 409. Undo → XP reverts + streak recomputed. All inside single transaction.

---

### Phase 6 — Weekly Habits, Achievements, XP Feed (Week 3, ~3 days)

Goal: Weekly auto-completion, all 7 achievements, XP feed.

- Weekly auto-completion check inside the daily completion transaction (step 11)
- `weekly_auto` habit_log insertion + XP event
- Manual weekly habit completion (same endpoint, different `logType`)
- `achievements.service.evaluate()` inside transaction
- `GET /xp/events`, `GET /xp/summary`, `GET /achievements`

Done when: 3 gym sessions → weekly_auto habit_log inserted → XP awarded → `habit_logs` is the proof. Level 5 → achievement unlocks inside same transaction.

---

### Phase 7 — Dashboard and Frontend Integration (Week 4, ~4 days)

Goal: Frontend talks to real backend.

- `GET /dashboard` (5 parallel queries)
- Replace all static mock data with API calls
- Axios auto-refresh interceptor
- `useCompleteHabit` with optimistic update
- Level-up overlay on `levelUp: true`
- Achievement toast on `unlockedAchievements: [...]`
- Weekly auto-complete toast on `weeklyAutoCompleted: [...]`
- Page load → `POST /auth/refresh` → set token → dashboard
- `GET /data/export` → file download

Done when: complete a habit → optimistic check → server confirms → XP animates. Refresh page → auto-login → dashboard loads.

---

### Phase 8 — PWA and Deployment (Week 5, ~3 days)

Goal: Installable PWA, deployed.

- Generate PNG icons from `icon.svg`: 192×192, 512×512, 512×512 maskable (safe zone), 180×180 apple-touch-icon
- Configure `vite-plugin-pwa` with Workbox `NetworkFirst` for API GET routes
- `<link rel="apple-touch-icon">` in `index.html`
- `registerSW.ts` with "update available" banner
- Deploy backend to Railway/Render; frontend to Vercel
- Verify: `Secure` + `SameSite=Strict` cookie in production; CORS in production
- MongoDB Atlas IP allowlist; Lighthouse PWA ≥ 90
- Install on a physical iPhone; verify icon + cookie refresh flow in standalone mode

Done when: live URL, iPhone-installable, cookie refresh works in standalone mode.

---

### Build order rationale

```
Phase 1 (Frontend shell) + Phase 2 (Backend skeleton) → parallel
Phase 3 (Auth) → prerequisite for all authenticated endpoints
Phase 4 (Seeds + xp-calculator) → prerequisite for completion logic
Phase 5 (Daily completion) → core path; everything else builds on it
Phase 6 (Weekly + achievements) → extends completion path
Phase 7 (Integration) → requires both frontend and backend complete
Phase 8 (PWA + deploy) → final; requires feature-complete product
```

---

*End of final implementation spec.*
