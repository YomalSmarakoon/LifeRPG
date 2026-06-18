# Life RPG — MVP Implementation Spec

**Version:** 1.0  
**Date:** 2026-06-17  
**Purpose:** Implementation-ready reference. Use this before asking Claude to write code.  
**Supersedes:** `LIFE_RPG_MVP_DESIGN.md` (kept for architecture context)

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
| Same-day habit undo | Reverts XP, marks log as undone |
| Weekly habit completion | Manual, category-count, and habit-count modes |
| XP event log | Append-only; every XP change recorded |
| Level and rank calculation | Server-authoritative, derived from totalXp |
| Streak tracking | Incremental cache in `character.streaks`, updated on completion |
| Streak shields | Earned every 7 days, max 3 |
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
| XP inactivity penalties | Discourages new users; adds debuff multiplier complexity; removed entirely from MVP |
| Offline write sync | Needs IndexedDB queue + BackgroundSync + conflict resolution — MVP+1 |
| IndexedDB mutation queue | Deferred with offline write sync |
| Workbox BackgroundSync | Deferred with offline write sync |
| Boss battles | Not part of core daily loop; slots in later |
| Push notifications | VAPID + iOS 16.4+ complexity; retention feature, deliver value first |
| Email verification | No email provider dependency in MVP |
| Password reset | Same email provider dependency; personal-use app |
| Data import | Needs schema validation + XP reconciliation; too risky for MVP |
| Skill tree state | Purely informational in current app; keep read-only display |
| Social / leaderboards | Out of scope |
| Multiple characters | One per user is correct for MVP |
| Complex achievements (boss_kill, perfect_week, shield_use, rank_in, habit-name-based) | Deferred |

### 1.3 Data Source of Truth Map

| Data | Source of Truth | Cache / Materialized View |
|---|---|---|
| Habit completions | `habit_logs` | — |
| XP history | `xp_events` | `character.totalXp` |
| Character level | Derived from `character.totalXp` | `character.level`, `character.rank` |
| Current streak per key | `character.streaks[key]` (incremental) | Reconcilable from `habit_logs` if needed |
| Weekly progress (auto) | Derived from `habit_logs` at read time | — |
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

**Total: 8 collections. No `streaks` collection in MVP.**

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
- `email` never changes after registration (MVP)
- `passwordHash` is never selected in any response projection
- `lockUntil` checked before `bcrypt.compare` — if `lockUntil > now`, return `401` immediately without comparing password

---

### 2.2 `refresh_sessions`

```js
{
  _id: ObjectId,
  userId: ObjectId,                   // ref: users._id
  tokenHash: "sha256hexstring",       // SHA-256(plainRefreshToken); unique
  familyId: "uuid-v4",               // all rotations from one login share a family
  userAgent: "Mozilla/5.0 ...",
  ipAddress: "203.0.113.1",           // audit only; never used for authz
  expiresAt: ISODate,                 // TTL index deletes this automatically
  revoked: false,                     // set true immediately on rotation or logout
  revokedAt: null,                    // Date | null
  createdAt: ISODate,
}
```

**Invariants:**
- Never store the plain refresh token anywhere except the `HttpOnly` cookie
- On rotation: mark old session `revoked: true`, insert new session (same `familyId`)
- On theft detection (revoked token replayed): `db.refresh_sessions.updateMany({ familyId }, { revoked: true })`

---

### 2.3 `characters`

```js
{
  _id: ObjectId,
  userId: ObjectId,                   // unique; one character per user

  // XP state — totalXp is a cached value; xp_events is source of truth
  totalXp: 0,                         // int >= 0; sum(xp_events.delta) for this user
  level: 1,                           // derived from totalXp; cached
  currentLevelXp: 0,                  // totalXp - xpFloorForLevel(level); cached
  xpToNextLevel: 500,                 // level * 500; cached
  rank: "Bronze",                     // derived from level; cached

  gold: 0,                            // int >= 0; awarded on level-up
  stats: {
    STR: 10, INT: 10, WIS: 10,
    DEX: 10, CHA: 10, END: 10,
  },
  avatarEmoji: "⚔️",                  // max 4 chars
  className: "Software Engineer",     // max 60 chars

  // Streak cache — incremental; reconcilable from habit_logs if needed
  // Key = habit.streakKey value (e.g. "gym", "code", "reading", "earlyRise")
  streaks: {
    gym:       { current: 0, shields: 0, lastDateKey: null },
    code:      { current: 0, shields: 0, lastDateKey: null },
    reading:   { current: 0, shields: 0, lastDateKey: null },
    earlyRise: { current: 0, shields: 0, lastDateKey: null },
  },

  // Achievement helpers — cached counters for cheap achievement evaluation
  totalHabitsCompleted: 0,            // incremented on completion, decremented on undo

  lastActiveDate: null,               // "YYYY-MM-DD" in user's timezone; updated on completion

  createdAt: ISODate,
  updatedAt: ISODate,
}
```

**What is NOT on the character (removed from previous design):**
- `penaltyMultiplier` — no penalties in MVP
- `penaltyExpiresAt` — no penalties in MVP
- `perfectDayStreak` — achievement removed from MVP

---

### 2.4 `habits`

```js
{
  _id: ObjectId,
  userId: ObjectId,

  name: "Gym Session",                // 1–100 chars; no HTML tags
  icon: "🏋️",                        // emoji; 1–4 chars
  category: "fitness",               // enum: fitness | coding | reading | career | wellness | custom
  frequency: "daily",                // enum: daily | weekly
  xpReward: 50,                      // int; 1–500 for daily, 1–1000 for weekly
  difficulty: "medium",              // enum: easy | medium | hard | legendary
  streakKey: "gym",                  // string | null; for daily habits only

  // Weekly habit fields — only used when frequency == "weekly"
  weeklyTarget: null,                // int | null; e.g. 3 for "3 gym sessions"
  weeklyTrackingMode: null,          // null | "manual" | "category_count" | "habit_count"
  weeklyCategory: null,              // string | null; used with category_count mode
  weeklyHabitIds: [],                // ObjectId[] | []; used with habit_count mode

  isActive: true,                    // false = soft-deleted
  sortOrder: 0,                      // int; user-defined display order
  createdAt: ISODate,
  updatedAt: ISODate,
}
```

**Weekly tracking mode semantics — see Section 9 for full algorithm.**

| `weeklyTrackingMode` | Meaning | `weeklyTarget` | `weeklyCategory` | `weeklyHabitIds` |
|---|---|---|---|---|
| `null` | Not weekly | — | — | — |
| `"manual"` | User taps complete once per week | null | — | — |
| `"category_count"` | Auto when N logs from category | required | required | — |
| `"habit_count"` | Auto when N logs from specific habits | required | — | required |

**Validation rules:**
- `frequency == "weekly"` requires `weeklyTrackingMode` to be set
- `weeklyTrackingMode == "category_count"` requires `weeklyCategory` and `weeklyTarget`
- `weeklyTrackingMode == "habit_count"` requires `weeklyHabitIds` (non-empty) and `weeklyTarget`
- `weeklyHabitIds` entries must be `ObjectId` of daily habits owned by the same user
- `frequency` cannot change after creation

**Default seeded habits (from current app):**

| Name | Category | Frequency | XP | streakKey | weeklyMode | weeklyTarget | weeklyCategory | weeklyHabitIds |
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

> **Seed implementation note:** The "5 LeetCodes" weekly habit references the ObjectIds of the three LeetCode daily habits. The seed script must insert daily habits first, then weekly habits referencing their IDs.

---

### 2.5 `habit_logs`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  habitId: ObjectId,                  // ref: habits._id

  // Date keys
  dateKey: "2026-06-17",             // "YYYY-MM-DD" in user's timezone; for daily habits
  weekKey: "2026-W25",               // ISO week "YYYY-Www"; for weekly manual habits only
  completedAt: ISODate,              // UTC server timestamp

  xpAwarded: 50,                     // actual XP credited (no multiplier in MVP)

  // Snapshot of habit at completion time — survives habit edits/renames
  habitSnapshot: {
    name: "Gym Session",
    category: "fitness",
    difficulty: "medium",
    xpReward: 50,
  },

  // Future-proofing for offline sync — include now, enforce later
  syncId: "uuid-v4",                 // client-generated UUID v4; unique sparse index

  undone: false,                     // true = completion was reversed
  undoneAt: null,                    // Date | null
  createdAt: ISODate,
}
```

**Fields by habit type:**

| Field | Daily habit | Weekly manual habit | Weekly auto habit |
|---|---|---|---|
| `dateKey` | The completion date | The completion date | Not stored (auto-completions have no log) |
| `weekKey` | null | ISO week string | — |
| `syncId` | Client UUID | Client UUID | — |

**Auto-completion note:** Weekly `category_count` and `habit_count` habits never have a `habit_log`. Their completion status is derived at read time from daily `habit_logs`. No XP is awarded for auto-completed weekly habits in MVP v1 — see Section 9.

---

### 2.6 `xp_events`

```js
{
  _id: ObjectId,
  userId: ObjectId,

  delta: 50,                          // positive = gain; negative = loss; never 0
  source: "habit_complete",           // see enum below
  contextType: "habit_logs",          // collection name of the triggering document
  contextId: ObjectId,                // _id of the triggering document

  balanceBefore: 1200,               // character.totalXp before this event
  balanceAfter: 1250,                // character.totalXp after this event

  timestamp: ISODate,                // server time; set inside transaction
}
```

**`source` enum (MVP):**

| Value | When |
|---|---|
| `habit_complete` | Daily or manual weekly habit completed |
| `habit_undo` | Habit completion reversed |
| `achievement_unlock` | Achievement awarded |

**Invariants:**
- Append-only. Never update or delete.
- `balanceAfter` must equal `character.totalXp` after the transaction commits.
- XP can never go below 0: `delta = -min(abs(delta), balanceBefore)`

---

### 2.7 `achievement_definitions`

```js
{
  _id: ObjectId,
  code: "streak_7",                   // unique; used as stable identifier
  name: "Week Warrior",
  icon: "🗓️",
  description: "Maintain a 7-day streak on any habit",
  xpReward: 150,
  category: "general",               // general | fitness | coding | career | milestone
  condition: {                        // structured; evaluated server-side
    type: "anyStreakCurrent_gte",
    threshold: 7,
  },
}
```

**7 MVP achievement definitions — see Section 10 for full list.**

---

### 2.8 `user_achievements`

```js
{
  _id: ObjectId,
  userId: ObjectId,
  achievementDefinitionId: ObjectId,  // ref: achievement_definitions._id
  achievementCode: "streak_7",        // denormalized; fast lookup without join
  unlockedAt: ISODate,
  xpAwarded: 150,                     // snapshot of xpReward at unlock time
}
```

**Invariant:** Unique per `(userId, achievementDefinitionId)`. Enforced by unique index. The `achievementCode` denormalization means `GET /achievements` never needs a join.

---

## 3. Final Index Strategy

### 3.1 `users`

```js
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ username: 1 }, { unique: true })
```

### 3.2 `refresh_sessions`

```js
// Token lookup on every /auth/refresh call
db.refresh_sessions.createIndex({ tokenHash: 1 }, { unique: true })

// Revoke all sessions for a user (/auth/logout-all)
db.refresh_sessions.createIndex({ userId: 1, revoked: 1 })

// Theft detection — revoke entire family
db.refresh_sessions.createIndex({ familyId: 1 })

// Auto-delete expired sessions
db.refresh_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

### 3.3 `characters`

```js
// One character per user
db.characters.createIndex({ userId: 1 }, { unique: true })
```

### 3.4 `habits`

```js
// Primary query: user's active habits by frequency
db.habits.createIndex({ userId: 1, frequency: 1, isActive: 1 })

// Weekly auto habits that reference a category
db.habits.createIndex({ userId: 1, weeklyCategory: 1, isActive: 1 })
```

### 3.5 `habit_logs`

```js
// Dashboard: today's completions for a user
db.habit_logs.createIndex({ userId: 1, dateKey: 1 })

// Per-habit log history (progress screen, heatmap)
db.habit_logs.createIndex({ userId: 1, habitId: 1, dateKey: -1 })

// Weekly category-count/habit-count progress queries
db.habit_logs.createIndex({ userId: 1, 'habitSnapshot.category': 1, dateKey: 1 })

// CRITICAL: Prevent duplicate daily completions
// Partial: only active (undone: false) logs participate
db.habit_logs.createIndex(
  { userId: 1, habitId: 1, dateKey: 1 },
  {
    unique: true,
    partialFilterExpression: { undone: false, weekKey: null },
    name: "habit_logs_daily_no_duplicate"
  }
)

// CRITICAL: Prevent duplicate weekly manual completions
// Partial: only active weekly logs participate
db.habit_logs.createIndex(
  { userId: 1, habitId: 1, weekKey: 1 },
  {
    unique: true,
    partialFilterExpression: { undone: false, weekKey: { $ne: null } },
    name: "habit_logs_weekly_no_duplicate"
  }
)

// Idempotency key for future offline sync
db.habit_logs.createIndex(
  { syncId: 1 },
  { unique: true, sparse: true }
)
```

### 3.6 `xp_events`

```js
// XP history feed (most recent first)
db.xp_events.createIndex({ userId: 1, timestamp: -1 })
```

### 3.7 `achievement_definitions`

```js
db.achievement_definitions.createIndex({ code: 1 }, { unique: true })
```

### 3.8 `user_achievements`

```js
// Prevent duplicate unlock
db.user_achievements.createIndex(
  { userId: 1, achievementDefinitionId: 1 },
  { unique: true }
)

// Fetch user's achievements ordered by unlock time
db.user_achievements.createIndex({ userId: 1, unlockedAt: -1 })
```

---

## 4. Final API Contracts

### 4.1 Global Conventions

```
Base path:     /api/v1
Auth required: Authorization: Bearer <accessToken>   (all protected routes)
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
{
  "email": "yomal@example.com",
  "password": "MinEight1!",
  "username": "TheArchitect",
  "timezone": "Asia/Colombo"
}
```
Response `201`:
```json
{ "userId": "...", "email": "yomal@example.com", "username": "TheArchitect" }
```
Side effects: inserts user, character (level 1), seeds 15 default habits, seeds achievement definitions (if not seeded).  
Errors: `400` validation, `409` email or username already taken.

---

#### `POST /api/v1/auth/login`
**Rate limit:** 10 / 15 min / IP

Request:
```json
{ "email": "yomal@example.com", "password": "MinEight1!" }
```
Response `200` + cookie:
```json
{ "accessToken": "<15min JWT>" }
```
Cookie set: `rt=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800`

Errors: `401 "Invalid email or password"` (same message for wrong email AND wrong password). `429` if account locked.  
Lockout: 5 failures → `lockUntil = now + 15min`.

---

#### `POST /api/v1/auth/refresh`
**Auth:** cookie only (no Bearer token)

Request: none (cookie sent automatically by browser)  
Response `200` + rotated cookie:
```json
{ "accessToken": "<new 15min JWT>" }
```
Rotation: revoke old session, insert new session (same `familyId`).  
Theft detection: if the session is already revoked when presented → revoke entire family → `401`.  
Errors: `401` if cookie missing, invalid, expired, or revoked.

---

#### `POST /api/v1/auth/logout`
**Auth:** cookie only

Response `200` + cookie cleared:  
`Set-Cookie: rt=; Max-Age=0; Path=/api/v1/auth/refresh`

---

#### `POST /api/v1/auth/logout-all`
**Auth:** Bearer

Response `200`:
```json
{ "sessionsRevoked": 3 }
```

---

### 4.3 Users

#### `GET /api/v1/users/me`
**Auth:** Bearer

Response `200`:
```json
{
  "userId": "...",
  "email": "yomal@example.com",
  "username": "TheArchitect",
  "timezone": "Asia/Colombo",
  "createdAt": "2026-06-17T06:00:00Z"
}
```
**Never returns:** `passwordHash`, `failedLoginAttempts`, `lockUntil`

---

#### `PATCH /api/v1/users/me`
**Auth:** Bearer

Request (all optional):
```json
{ "username": "NewName", "timezone": "America/New_York" }
```
Validation: username 3–30 alphanum+underscore; timezone must be valid IANA string (validate against `Intl.supportedValuesOf('timeZone')`).  
Response `200`: same shape as GET.

**Timezone change side effect:** Sets `character.lastActiveDate = null` to prevent stale date comparisons.

---

### 4.4 Character

#### `GET /api/v1/character`
**Auth:** Bearer

Response `200`:
```json
{
  "level": 3,
  "totalXp": 2150,
  "currentLevelXp": 650,
  "xpToNextLevel": 1500,
  "rank": "Bronze",
  "gold": 60,
  "stats": { "STR": 12, "INT": 11, "WIS": 10, "DEX": 10, "CHA": 10, "END": 10 },
  "avatarEmoji": "⚔️",
  "className": "Software Engineer",
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
**Auth:** Bearer

Request (all optional):
```json
{ "avatarEmoji": "🧙", "className": "Backend Engineer" }
```
Validation: `avatarEmoji` max 4 chars; `className` max 60 chars.  
Response `200`: same shape as GET.

---

### 4.5 Habits CRUD

#### `GET /api/v1/habits`
**Auth:** Bearer  
**Query:** `?frequency=daily&active=true`

Response `200`:
```json
{
  "habits": [
    {
      "id": "...",
      "name": "Gym Session",
      "icon": "🏋️",
      "category": "fitness",
      "frequency": "daily",
      "xpReward": 50,
      "difficulty": "medium",
      "streakKey": "gym",
      "isActive": true,
      "sortOrder": 0,
      "weeklyTarget": null,
      "weeklyTrackingMode": null,
      "weeklyCategory": null,
      "weeklyHabitIds": [],
      "completedToday": false
    }
  ]
}
```
`completedToday`: server joins `habit_logs` for today's `dateKey` per habit. Avoids a second client request.

---

#### `POST /api/v1/habits`
**Auth:** Bearer  
**Limit:** max 50 active habits per user → `422` if exceeded.

Request:
```json
{
  "name": "Gym Session",
  "icon": "🏋️",
  "category": "fitness",
  "frequency": "daily",
  "xpReward": 50,
  "difficulty": "medium",
  "streakKey": "gym"
}
```
For weekly habits, include `weeklyTrackingMode`, `weeklyTarget`, and either `weeklyCategory` or `weeklyHabitIds`.

Validation:
- `name`: 1–100 chars, no `<>{}` HTML characters
- `xpReward`: 1–500 (daily), 1–1000 (weekly)
- `category`, `frequency`, `difficulty`: must match enum
- `timezone` on IANA list for user
- See Section 2.4 for weekly field requirements

Response `201`: full habit object.

---

#### `GET /api/v1/habits/:id`
**Auth:** Bearer  
Returns `404` if habit doesn't exist OR belongs to another user (no resource disclosure).

---

#### `PATCH /api/v1/habits/:id`
**Auth:** Bearer

Updatable fields: `name`, `icon`, `xpReward`, `difficulty`, `streakKey`, `isActive`, `sortOrder`  
**Cannot change:** `frequency` (would orphan historical logs), `weeklyTrackingMode`, `weeklyHabitIds`

Response `200`: updated habit.

---

#### `DELETE /api/v1/habits/:id`
**Auth:** Bearer  
Behavior: soft-delete (`isActive: false`). `habit_logs` and `xp_events` for this habit are preserved.  
Response `204`.

---

### 4.6 Habit Completion

#### `POST /api/v1/habits/:id/complete`
**Auth:** Bearer

Request:
```json
{
  "syncId": "550e8400-e29b-41d4-a716-446655440000",
  "completedAt": "2026-06-17T08:30:00.000Z"
}
```
- `syncId`: required; UUID v4; client generates before sending; used for future idempotent offline sync
- `completedAt`: optional; defaults to server `now`; must be within 48 hours of server time

Response `200`:
```json
{
  "habitLogId": "...",
  "xpAwarded": 50,
  "newTotalXp": 1250,
  "previousLevel": 3,
  "newLevel": 3,
  "levelUp": false,
  "newRank": "Bronze",
  "streakUpdate": {
    "streakKey": "gym",
    "newCount": 9,
    "shieldEarned": false
  },
  "unlockedAchievements": [],
  "weeklyAutoCompleted": []
}
```

`weeklyAutoCompleted`: array of weekly habits that auto-completed as a result of this daily completion. Frontend shows a toast for each.

Error cases:
- `404` if habit not found or belongs to another user
- `409` if `(userId, habitId, dateKey, undone:false)` already exists (duplicate)
- `200` idempotent if `syncId` already exists — returns original result
- `422` if `completedAt` is older than 48 hours

---

#### `POST /api/v1/habits/:id/undo`
**Auth:** Bearer

Request:
```json
{ "dateKey": "2026-06-17" }
```

Rules:
- `dateKey` must equal today's date in the user's timezone → `422` otherwise
- Finds `habit_log` where `{ userId, habitId, dateKey, undone: false }` → `404` if not found
- Weekly manual habits: provide `dateKey` of the day they were completed (within current week)

Response `200`:
```json
{
  "xpReverted": 50,
  "newTotalXp": 1200,
  "newLevel": 3
}
```

---

#### `GET /api/v1/habits/:id/logs`
**Auth:** Bearer  
**Query:** `?from=2026-06-01&to=2026-06-17&limit=60`

Response `200`:
```json
{
  "logs": [
    {
      "id": "...",
      "dateKey": "2026-06-17",
      "completedAt": "2026-06-17T08:30:00Z",
      "xpAwarded": 50,
      "undone": false,
      "habitSnapshot": { "name": "Gym Session", "xpReward": 50 }
    }
  ]
}
```

---

### 4.7 XP

#### `GET /api/v1/xp/events`
**Auth:** Bearer  
**Query:** `?limit=50&cursor=<ObjectId>`

Response `200`:
```json
{
  "events": [
    {
      "id": "...",
      "delta": 50,
      "source": "habit_complete",
      "contextType": "habit_logs",
      "contextId": "...",
      "balanceBefore": 1200,
      "balanceAfter": 1250,
      "timestamp": "2026-06-17T08:30:00Z"
    }
  ],
  "nextCursor": "..."
}
```

---

#### `GET /api/v1/xp/summary`
**Auth:** Bearer

Response `200`:
```json
{
  "today": 95,
  "thisWeek": 420,
  "total": 12450,
  "bySource": {
    "habit_complete": 12100,
    "achievement_unlock": 350
  }
}
```

---

### 4.8 Achievements

#### `GET /api/v1/achievements`
**Auth:** Bearer

Response `200`:
```json
{
  "definitions": [
    {
      "code": "first_completion",
      "name": "First Blood",
      "icon": "⚔️",
      "description": "Complete your first habit",
      "xpReward": 50,
      "category": "general"
    }
  ],
  "unlocked": [
    {
      "code": "first_completion",
      "unlockedAt": "2026-06-17T08:30:00Z",
      "xpAwarded": 50
    }
  ]
}
```

---

### 4.9 Dashboard

#### `GET /api/v1/dashboard`
**Auth:** Bearer  
**Called on every app open. Returns all data needed to render the initial screen.**

Response `200`:
```json
{
  "character": {
    "level": 3,
    "totalXp": 1250,
    "currentLevelXp": 250,
    "xpToNextLevel": 1500,
    "rank": "Bronze",
    "gold": 30,
    "stats": { "STR": 11, "INT": 10, "WIS": 10, "DEX": 10, "CHA": 10, "END": 10 },
    "avatarEmoji": "⚔️",
    "className": "Software Engineer",
    "streaks": {
      "gym":       { "current": 8, "shields": 1 },
      "code":      { "current": 3, "shields": 0 },
      "reading":   { "current": 0, "shields": 0 },
      "earlyRise": { "current": 14, "shields": 2 }
    }
  },
  "todayHabits": [
    {
      "id": "...",
      "name": "Gym Session",
      "icon": "🏋️",
      "xpReward": 50,
      "difficulty": "medium",
      "category": "fitness",
      "streakKey": "gym",
      "completedToday": false
    }
  ],
  "weeklyHabits": [
    {
      "id": "...",
      "name": "3 Gym Sessions",
      "xpReward": 150,
      "weeklyTrackingMode": "category_count",
      "weeklyTarget": 3,
      "progress": 1,
      "completed": false
    }
  ],
  "xpToday": 95,
  "completedTodayCount": 4,
  "totalHabitsToday": 10,
  "recentUnlockedAchievements": [
    { "code": "streak_7", "name": "Week Warrior", "icon": "🗓️", "unlockedAt": "..." }
  ]
}
```

**Server build steps (run in parallel with `Promise.all`):**
1. Load character
2. Load active daily habits + join today's `habit_logs`
3. Load active weekly habits + derive progress from `habit_logs`
4. Load recent 3 unlocked achievements
5. Merge and return

---

### 4.10 Data Export

#### `GET /api/v1/data/export`
**Auth:** Bearer  
**Rate limit:** 5 / 24 hours / user

Response `200` with headers:
```
Content-Type: application/json
Content-Disposition: attachment; filename="liferpg-backup-2026-06-17.json"
```

Body:
```json
{
  "exportedAt": "2026-06-17T06:00:00Z",
  "schemaVersion": "mvp-1.0",
  "user": {
    "username": "TheArchitect",
    "timezone": "Asia/Colombo",
    "createdAt": "2026-06-17T06:00:00Z"
  },
  "character": {
    "level": 3, "totalXp": 1250, "rank": "Bronze", "gold": 30,
    "stats": { "STR": 11, "INT": 10, "WIS": 10, "DEX": 10, "CHA": 10, "END": 10 }
  },
  "habits": [ ...habit objects (no userId, no _id internals) ],
  "habitLogs": [ ...log objects (dateKey, xpAwarded, habitSnapshot, undone) ],
  "xpEvents": [ ...event objects (delta, source, balanceBefore, balanceAfter, timestamp) ],
  "achievements": [ ...unlocked achievement codes and unlockedAt ]
}
```

**Strips:** `passwordHash`, `tokenHash`, `ipAddress`, `userAgent`, all `_id` internals, `userId` fields.

---

### 4.11 Summary Table

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | 5/15min/IP |
| POST | `/auth/login` | none | 10/15min/IP |
| POST | `/auth/refresh` | cookie | rotates token |
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
| GET | `/data/export` | Bearer | 5/day rate limit |

**Total: 22 endpoints.**

---

## 5. Final Backend Service Responsibilities

### Module structure

```
src/
├── auth/          register, login, refresh, logout, logout-all
├── users/         GET/PATCH /users/me
├── characters/    GET/PATCH /character; XP + level + streak cache updates
├── habits/        CRUD + complete + undo + logs
├── xp/            addXpEvent() utility; GET /xp/events; GET /xp/summary
├── achievements/  evaluateAchievements(); GET /achievements
├── dashboard/     GET /dashboard (aggregation only, no mutations)
├── data-export/   GET /data/export
├── common/        JwtAuthGuard, CurrentUser decorator, ParseObjectIdPipe,
│                  HttpExceptionFilter, LoggingInterceptor
├── database/      MongooseModule.forRootAsync
└── config/        ConfigModule, typed env
```

### Dependency rules

- `habits.service` calls `xp.service.addXpEvent()` and `achievements.service.evaluate()`
- `xp.service` calls `characters.service.updateXpCache()` inside the same transaction
- `achievements.service` calls `xp.service.addXpEvent()` for achievement XP (separate event, same request)
- `dashboard.service` has read-only access to all modules; makes no mutations
- `auth.service` calls `habits.service.seedDefaults()` and `characters.service.create()` on register

### Key service method signatures

```typescript
// xp.service.ts
async addXpEvent(
  userId: ObjectId,
  delta: number,
  source: 'habit_complete' | 'habit_undo' | 'achievement_unlock',
  contextType: string,
  contextId: ObjectId,
  session: ClientSession,  // MongoDB session for transaction participation
): Promise<{ newTotalXp: number; levelBefore: number; levelAfter: number; rankBefore: string; rankAfter: string }>

// characters.service.ts
async updateXpCache(
  userId: ObjectId,
  newTotalXp: number,
  session: ClientSession,
): Promise<void>

async updateStreakCache(
  userId: ObjectId,
  streakKey: string,
  dateKey: string,   // today in user's timezone
  session: ClientSession,
): Promise<{ newCount: number; shieldEarned: boolean }>

// habits.service.ts
async completeHabit(
  userId: ObjectId,
  habitId: ObjectId,
  dto: CompleteHabitDto,
): Promise<CompleteHabitResponseDto>

// achievements.service.ts
async evaluate(
  userId: ObjectId,
  characterSnapshot: CharacterDoc,  // already loaded; avoids extra query
): Promise<AchievementDefinitionDoc[]>  // newly unlocked
```

---

## 6. Final Habit Completion Algorithm

This is the core write path. Every step in the same MongoDB transaction.

```
POST /habits/:id/complete
Input: userId, habitId, syncId, completedAt (or server now)

1. LOAD user (timezone)

2. dateKey = formatInTimeZone(completedAt, user.timezone, 'yyyy-MM-dd')

3. FIND one refresh_sessions (noop — just illustrating load order)
   LOAD habit WHERE { _id: habitId, userId, isActive: true }
   → 404 if not found

4. IF syncId exists in habit_logs (sparse unique index lookup):
   → 200 idempotent — return stored result

5. CHECK habit_logs WHERE { userId, habitId, dateKey, undone: false }
   → 409 if already completed today

6. LOAD character WHERE { userId }

7. xpAwarded = habit.xpReward
   // No penalty multiplier in MVP

8. START MongoDB session + transaction

9.  INSERT habit_log {
      userId, habitId,
      dateKey,
      weekKey: null,   // daily habit
      completedAt,
      xpAwarded,
      habitSnapshot: { name, category, difficulty, xpReward },
      syncId,
      undone: false,
    }

10. balanceBefore = character.totalXp
    balanceAfter = balanceBefore + xpAwarded

11. INSERT xp_event {
      userId,
      delta: xpAwarded,
      source: 'habit_complete',
      contextType: 'habit_logs',
      contextId: habitLog._id,
      balanceBefore,
      balanceAfter,
      timestamp: now,
    }

12. newLevel = levelFromTotalXp(balanceAfter)
    newRank  = rankFromLevel(newLevel)
    newGold  = character.gold + (levelsGained * newLevel * 10)  // each level-up awards level*10
    newStats = applyStatBoosts(character.stats, oldLevel, newLevel)

    UPDATE character {
      totalXp:         balanceAfter,
      currentLevelXp:  balanceAfter - xpFloorForLevel(newLevel),
      xpToNextLevel:   newLevel * 500,
      level:           newLevel,
      rank:            newRank,
      gold:            newGold,
      stats:           newStats,
      totalHabitsCompleted: character.totalHabitsCompleted + 1,
      lastActiveDate:  dateKey,
    }

13. IF habit.streakKey is not null:
      streakResult = updateStreakCache(userId, habit.streakKey, dateKey, session)
      // See Section 8 for algorithm

14. COMMIT transaction

15. (Outside transaction — read-only check, no writes needed in transaction)
    IF habit.frequency == 'daily':
      weeklyAutoCompleted = checkWeeklyAutoCompletion(userId, habit, dateKey)
      // For each matching weekly auto habit: if progress just hit target, award XP
      // See Section 9 for algorithm

16. newAchievements = evaluateAchievements(userId, updatedCharacter)
    // See Section 10 for algorithm

17. RETURN {
      habitLogId,
      xpAwarded,
      newTotalXp:    balanceAfter,
      previousLevel: oldLevel,
      newLevel,
      levelUp:       newLevel > oldLevel,
      newRank,
      streakUpdate:  { streakKey, newCount, shieldEarned },
      unlockedAchievements: newAchievements,
      weeklyAutoCompleted,
    }
```

---

### 6.1 Undo Habit Completion

```
POST /habits/:id/undo
Input: userId, habitId, dateKey

1. todayKey = formatInTimeZone(now, user.timezone, 'yyyy-MM-dd')
   IF dateKey != todayKey:
   → 422 "Can only undo today's completions"

2. LOAD habit WHERE { _id: habitId, userId }
   → 404 if not found

3. FIND habit_log WHERE { userId, habitId, dateKey, undone: false }
   → 404 if not found

4. START transaction

5. UPDATE habit_log { undone: true, undoneAt: now }

6. xpToRevert = habitLog.xpAwarded
   newTotalXp = max(0, character.totalXp - xpToRevert)
   actualDelta = -(character.totalXp - newTotalXp)  // <= 0

7. INSERT xp_event {
     userId, delta: actualDelta, source: 'habit_undo',
     contextType: 'habit_logs', contextId: habitLog._id,
     balanceBefore: character.totalXp, balanceAfter: newTotalXp,
     timestamp: now,
   }

8. newLevel = levelFromTotalXp(newTotalXp)
   UPDATE character {
     totalXp: newTotalXp,
     currentLevelXp: newTotalXp - xpFloorForLevel(newLevel),
     xpToNextLevel: newLevel * 500,
     level: newLevel,
     rank: rankFromLevel(newLevel),
     totalHabitsCompleted: max(0, character.totalHabitsCompleted - 1),
   }

   // Note: undoing a completion CAN lower a level. This is intentional.
   // Gold and stat boosts are NOT reversed (too complex for MVP).

9. COMMIT transaction

10. RETURN { xpReverted: xpToRevert, newTotalXp, newLevel }
```

---

## 7. Final XP Calculation

All XP math lives in `src/characters/utils/xp-calculator.ts`. Used on both frontend and backend.

```typescript
// XP required to advance from level N to level N+1
export function xpForLevel(level: number): number {
  return level * 500;
}

// Total cumulative XP at the START of level N (the XP floor)
// Sum of 500*i for i = 1..N-1  =  500 * N * (N-1) / 2
export function xpFloorForLevel(level: number): number {
  return (500 * level * (level - 1)) / 2;
}

// Derive level from a totalXp value
export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  while (xpFloorForLevel(level + 1) <= totalXp) level++;
  return level;
}

// XP within the current level (what the UI progress bar shows)
export function currentLevelXpFromTotal(totalXp: number): number {
  return totalXp - xpFloorForLevel(levelFromTotalXp(totalXp));
}
```

**Level thresholds for reference:**

| Level | Total XP floor | XP needed for next level |
|---|---|---|
| 1 | 0 | 500 |
| 2 | 500 | 1,000 |
| 3 | 1,500 | 1,500 |
| 4 | 3,000 | 2,000 |
| 5 | 5,000 | 2,500 |
| 10 | 22,500 | 5,000 |
| 20 | 95,000 | 10,000 |

**Rank thresholds (by level):**

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
  { name: 'Bronze',    min: 1  },
  { name: 'Iron',      min: 5  },
  { name: 'Silver',    min: 10 },
  { name: 'Gold',      min: 20 },
  { name: 'Platinum',  min: 35 },
  { name: 'Diamond',   min: 50 },
  { name: 'Legendary', min: 75 },
];

export function rankFromLevel(level: number): string {
  let rank = RANKS[0].name;
  for (const r of RANKS) { if (level >= r.min) rank = r.name; }
  return rank;
}
```

**Stat boosts on level-up:**
- Every level: `stats[level % 6]++` (cycles through STR, INT, WIS, DEX, CHA, END)
- Every 5th level (5, 10, 15...): `+2 to ALL stats` instead

```typescript
export function applyStatBoosts(
  stats: Record<string, number>,
  oldLevel: number,
  newLevel: number,
): Record<string, number> {
  const keys = ['STR', 'INT', 'WIS', 'DEX', 'CHA', 'END'];
  const result = { ...stats };
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    if (lvl % 5 === 0) {
      keys.forEach(k => result[k] += 2);
    } else {
      result[keys[lvl % keys.length]]++;
    }
  }
  return result;
}
```

**Gold on level-up:** When advancing from level N to N+1, award `(N+1) * 10` gold. Recalculate correctly when multiple levels are gained at once.

---

## 8. Final Streak Cache Strategy

### Design decision

Streaks are stored as an embedded object in `characters.streaks`. The key is the `habit.streakKey` string. The streak state is updated **incrementally** on each relevant habit completion.

`habit_logs` is the source of truth in the sense that the streak state can be fully recomputed from habit_logs if the cache ever drifts. For MVP, implement the incremental update only — no reconciliation endpoint needed yet.

### Streak cache schema (embedded in character)

```typescript
// character.streaks[streakKey]
{
  current: number;    // current consecutive-day count
  shields: number;    // available streak shields (max 3)
  lastDateKey: string | null;  // "YYYY-MM-DD" of last completion
}
```

### Update algorithm (runs inside the habit completion transaction)

```
function updateStreakCache(character, streakKey, todayDateKey, userTimezone):

  sk = character.streaks[streakKey]
  if not sk:
    sk = { current: 0, shields: 0, lastDateKey: null }

  IF sk.lastDateKey == todayDateKey:
    return { newCount: sk.current, shieldEarned: false }  // already updated today

  yesterdayKey = formatInTimeZone(yesterday, userTimezone, 'yyyy-MM-dd')
  gapDays = calendarDaysBetween(sk.lastDateKey, todayDateKey)  // null lastDateKey = infinity gap

  IF sk.lastDateKey == null OR gapDays > 2:
    sk.current = 1              // streak broken or first ever
    sk.lastDateKey = todayDateKey

  ELSE IF sk.lastDateKey == yesterdayKey:
    sk.current++                // consecutive day
    sk.lastDateKey = todayDateKey

  ELSE IF gapDays == 2 AND sk.shields > 0:
    sk.shields--                // shield bridges the 1-day gap
    sk.current++
    sk.lastDateKey = todayDateKey
    // Note: character.totalShieldsUsed++ for future achievement tracking

  shieldEarned = false
  IF sk.current > 0 AND sk.current % 7 == 0:
    sk.shields = min(sk.shields + 1, 3)
    shieldEarned = true

  character.streaks[streakKey] = sk

  return { newCount: sk.current, shieldEarned }
```

### Which habits update streaks?

Only habits where `habit.streakKey` is not null. Multiple habits can share a `streakKey` (e.g., `lc_easy`, `lc_med`, `lc_hard` all use `"code"`). Any one of them completing advances the streak.

**Implication:** If the user completes both LeetCode Easy and LeetCode Medium on the same day, the first updates the streak (yesterday → today = +1) and the second hits the `lastDateKey == todayDateKey` guard and skips — correct behavior.

---

## 9. Final Weekly Habit Strategy

### Three tracking modes

| Mode | How it completes | XP awarded | Stored in habit_logs? |
|---|---|---|---|
| `manual` | User taps "complete" once per week | On tap, same as daily | Yes, with `weekKey` |
| `category_count` | Auto when N daily habits from category are logged this week | On auto-completion detection | No direct log |
| `habit_count` | Auto when N logs from specific daily habit IDs exist this week | On auto-completion detection | No direct log |

### Week key format

```typescript
import { format, startOfISOWeek, getISOWeek, getISOWeekYear } from 'date-fns';

function toWeekKey(date: Date, userTimezone: string): string {
  // "2026-W25"
  const localDate = toZonedTime(date, userTimezone);
  const year = getISOWeekYear(localDate);
  const week = getISOWeek(localDate);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function weekStartDateKey(weekKey: string, userTimezone: string): string {
  // Returns "YYYY-MM-DD" of Monday of that week in user's timezone
  // Used to query habit_logs for the week range
}
```

Week always starts on **Monday** (ISO week). Not user-configurable in MVP.

### Manual weekly habit completion

Uses `POST /habits/:id/complete` with the same request shape as daily habits.

```
dateKey = today's dateKey (the day they're tapping complete)
weekKey = toWeekKey(completedAt, user.timezone)

Unique constraint: (userId, habitId, weekKey, undone: false)
→ enforced by "habit_logs_weekly_no_duplicate" partial index
```

XP is awarded immediately, same as daily habits.

### Auto-completion check (category_count and habit_count)

Called after every daily habit completion. Runs **outside** the main transaction (read-only queries).

```
function checkWeeklyAutoCompletion(userId, completedDailyHabit, dateKey, character):

  weekKey = toWeekKey(dateKey, user.timezone)
  weekStartKey = weekStartDateKey(weekKey, user.timezone)

  weeklyAutoHabits = habits.find({ userId, frequency: 'weekly', isActive: true,
    weeklyTrackingMode: { $in: ['category_count', 'habit_count'] } })

  autoCompleted = []

  FOR EACH weeklyHabit IN weeklyAutoHabits:

    // Check if already marked complete this week (we track this via a flag on character or a separate check)
    IF weeklyHabit already in character.completedWeeklyHabitIds[weekKey]:
      continue  // already done

    progress = 0
    IF weeklyHabit.weeklyTrackingMode == 'category_count':
      progress = habit_logs.countDocuments({
        userId,
        'habitSnapshot.category': weeklyHabit.weeklyCategory,
        dateKey: { $gte: weekStartKey, $lte: dateKey },
        undone: false,
      })

    IF weeklyHabit.weeklyTrackingMode == 'habit_count':
      progress = habit_logs.countDocuments({
        userId,
        habitId: { $in: weeklyHabit.weeklyHabitIds },
        dateKey: { $gte: weekStartKey, $lte: dateKey },
        undone: false,
      })

    IF progress >= weeklyHabit.weeklyTarget:
      // Award XP for this weekly habit
      START inner transaction:
        INSERT xp_event { delta: weeklyHabit.xpReward, source: 'habit_complete', ... }
        UPDATE character.totalXp += weeklyHabit.xpReward
        Recalculate level/rank
        Record this weekKey as completed for this habit on character
      COMMIT inner transaction
      autoCompleted.push(weeklyHabit)

  return autoCompleted
```

**Tracking auto-completion to prevent double-award:**

Add to the character document:
```js
// character document
weeklyCompletions: {
  "2026-W25": ["habitId1", "habitId2"],
  "2026-W26": [],
}
```

Check before awarding: if `weeklyHabit._id` is already in `character.weeklyCompletions[weekKey]`, skip. After awarding, add to the set.

Prune old week keys from `weeklyCompletions` on dashboard load (keep only current + previous week).

### Weekly progress in dashboard

For the `GET /dashboard` response, compute progress for each weekly habit:

```typescript
// For manual habits:
const manualCompleted = await habitLogModel.exists({
  userId, habitId: weeklyHabit._id, weekKey, undone: false
});

// For category_count:
const progress = await habitLogModel.countDocuments({
  userId,
  'habitSnapshot.category': weeklyHabit.weeklyCategory,
  dateKey: { $gte: weekStartKey, $lte: todayKey },
  undone: false,
});

// For habit_count:
const progress = await habitLogModel.countDocuments({
  userId,
  habitId: { $in: weeklyHabit.weeklyHabitIds },
  dateKey: { $gte: weekStartKey, $lte: todayKey },
  undone: false,
});
```

---

## 10. Final Achievement Strategy

### MVP achievements (7 only)

| Code | Name | Icon | Description | XP | Condition |
|---|---|---|---|---|---|
| `first_completion` | First Blood | ⚔️ | Complete your first habit | 50 | `totalHabitsCompleted >= 1` |
| `complete_10` | Dedicated | 🌱 | Complete 10 habits | 75 | `totalHabitsCompleted >= 10` |
| `complete_50` | Committed | 🔥 | Complete 50 habits | 150 | `totalHabitsCompleted >= 50` |
| `reach_level_5` | Apprentice | ⭐ | Reach Level 5 | 100 | `level >= 5` |
| `reach_level_10` | Journeyman | 🌟 | Reach Level 10 | 200 | `level >= 10` |
| `streak_3` | On a Roll | 🔥 | 3-day streak on any habit | 75 | `any streak.current >= 3` |
| `streak_7` | Week Warrior | 🗓️ | 7-day streak on any habit | 150 | `any streak.current >= 7` |

### Condition structures for DB

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

Called after every habit completion and undo. All data comes from the already-loaded character document — **no additional DB queries required**.

```typescript
async function evaluateAchievements(
  userId: ObjectId,
  character: CharacterDoc,
): Promise<AchievementDefinitionDoc[]> {

  const definitions = await achievementDefinitionModel.find();  // tiny collection; cache in-process
  const unlocked = await userAchievementModel.find({ userId }, { achievementCode: 1 });
  const unlockedCodes = new Set(unlocked.map(u => u.achievementCode));

  const newUnlocks: AchievementDefinitionDoc[] = [];

  for (const def of definitions) {
    if (unlockedCodes.has(def.code)) continue;
    if (conditionMet(def.condition, character)) {
      newUnlocks.push(def);
    }
  }

  for (const def of newUnlocks) {
    await userAchievementModel.create({
      userId,
      achievementDefinitionId: def._id,
      achievementCode: def.code,
      unlockedAt: new Date(),
      xpAwarded: def.xpReward,
    });
    await xpService.addXpEvent(userId, def.xpReward, 'achievement_unlock', 'achievement_definitions', def._id);
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

**Key property:** Achievement evaluation is O(7) with zero DB queries beyond loading the character and the achievement list (which is 7 documents — keep in-process cache after first load).

### Deferred achievements (post-MVP)

These are excluded from MVP because they require queries or complex tracking:
- `boss_kill` — bosses not in MVP
- `perfect_week` — needs `perfectDayStreak` tracking on character + consecutive-day verification
- `shield_use` — needs `totalShieldsUsed` counter (easy to add later)
- `gold_rank` (rank_in) — depends on condition type not implemented in MVP
- Habit-name-based achievements — requires text matching on habit logs

---

## 11. Final Security Rules

### Non-negotiable rules

1. **Access token:** Store in React memory only (Zustand, never persisted). On page reload, call `POST /auth/refresh` to restore.
2. **Refresh token:** `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh`. Never accessible from JavaScript.
3. **Refresh token in DB:** Store only `SHA-256(plainToken)`. Never the plain token.
4. **Authorization:** Every query for user-owned data includes `{ ..., userId: currentUser.id }`. Never load-then-check.
5. **IDOR response:** Return `404`, not `403`, for resources that exist but belong to another user.
6. **Password hash:** bcrypt cost 12. Never returned in any response. Project it out at the query level.
7. **Tokens never logged:** No password, hash, access token, or refresh token in any log line.
8. **CSRF:** Not needed. Access token is in `Authorization: Bearer` header (not a cookie). Refresh token cookie is `SameSite=Strict` and path-scoped to `/api/v1/auth/refresh` only.
9. **CORS:** `origin: [FRONTEND_URL]`, `credentials: true`. Never `origin: '*'` with `credentials: true`.
10. **Validation:** Two layers. Frontend (Zod) for UX. Backend (class-validator + NestJS `ValidationPipe`) as the security boundary. `whitelist: true` strips unknown fields. `forbidNonWhitelisted: true` rejects them.

### NestJS configuration

```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "blob:"],
      connectSrc:  ["'self'", process.env.FRONTEND_URL],
      objectSrc:   ["'none'"],
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

After 5 consecutive failed login attempts for an email: set `lockUntil = now + 15 min`. Return `401 "Invalid email or password"` (not `429` — don't reveal lockout status). On every login attempt, check `lockUntil > now` before password comparison.

### What never goes in localStorage

- Access tokens
- Refresh tokens
- Email or PII
- Any security-sensitive data

What can go in localStorage (via Zustand persist):
- Theme preference
- UI preferences (sort order, active tab preference)

---

## 12. Final Build Order

### Phase 1 — Frontend Shell (Week 1, ~3 days)

**Goal:** React app with routing, all screens, design tokens, and static mock data.

Tasks:
- `npm create vite@latest frontend -- --template react-ts`
- Install: `react-router-dom`, `@tanstack/react-query`, `zustand`, `axios`, `vite-plugin-pwa`
- Port CSS custom properties from `index.html` (`:root` variables, `[data-theme="light"]`)
- Build components: `BottomNav`, `Card`, `Button`, `ProgressBar`, `Badge`, `Toast`, `Modal`, `LevelUpOverlay`
- Build all screens with static hardcoded props — no API calls yet
- Set up `QueryClient` + `authStore` (Zustand, not persisted)

Done when: app runs locally, all 7 tabs navigate, components match current app visually, TypeScript strict mode with zero errors.

---

### Phase 2 — NestJS Backend Skeleton (Week 1, ~2 days)

**Goal:** Running NestJS with MongoDB, global middleware, health check, Swagger.

Tasks:
- `nest new backend`
- Install all libraries (see Section 5)
- Wire `MongooseModule.forRootAsync` with `ConfigModule`
- Apply global: `helmet()`, `cors()`, `ValidationPipe`, `HttpExceptionFilter`, `ThrottlerModule`
- `GET /health → 200 { status: 'ok' }`
- Swagger at `/docs` (dev only)

Done when: `GET /api/v1/health` returns 200; sending invalid JSON body returns structured 400.

---

### Phase 3 — Auth (Week 2, ~3 days)

**Goal:** Register, login, refresh, logout, logout-all all working and tested.

Tasks:
- Create `User` + `RefreshSession` schemas
- Implement `AuthService.register` with bcrypt hash
- Implement `AuthService.login` with lockout logic
- Implement `AuthService.refresh` with rotation + theft detection
- Implement `AuthService.logout` + `logout-all`
- Create `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser()` decorator
- Wire rate limits on auth routes

Done when: full login → refresh → logout cycle passes E2E test via supertest.

---

### Phase 4 — User, Character, Default Habits (Week 2, ~2 days)

**Goal:** Registration creates all seed data. Profile endpoints work.

Tasks:
- `Character` schema + `characters.service.create()`
- `HabitsService.seedDefaults(userId)` — creates 15 habits from constants
- Call both from `AuthService.register`
- `AchievementDefinitionService.seedIfEmpty()` — idempotent seed on startup
- `GET /users/me`, `PATCH /users/me`
- `GET /character`, `PATCH /character`

Done when: after register, DB has 1 user + 1 character + 15 habits + 7 achievement definitions.

---

### Phase 5 — Habit CRUD and Daily Completion (Week 3, ~4 days)

**Goal:** Full habits lifecycle + daily completion with transactions.

Tasks:
- All 5 habit CRUD endpoints
- Create all MongoDB indexes (especially the two partial unique indexes)
- `POST /habits/:id/complete` — full algorithm from Section 6
- `POST /habits/:id/undo`
- `GET /habits/:id/logs`
- `toDateKey()` utility with `date-fns-tz`
- `levelFromTotalXp()`, `rankFromLevel()`, `applyStatBoosts()` in `xp-calculator.ts`
- MongoDB transaction for completion (habit_log + xp_event + character update)
- Streak cache update in transaction

Done when: completing a habit → XP increases → level recalculates → streak increments. Completing same habit twice → 409. Undo → XP reverts.

---

### Phase 6 — Weekly Habits, Achievements, XP Feed (Week 3, ~3 days)

**Goal:** Weekly habit tracking, all 7 achievements, XP event feed.

Tasks:
- `checkWeeklyAutoCompletion()` called after daily habit completion
- Manual weekly habit completion (same endpoint, different unique key)
- `evaluateAchievements()` called after every completion and undo
- `GET /xp/events` cursor-paginated
- `GET /xp/summary`
- `GET /achievements`

Done when: completing 3 gym sessions this week → weekly auto-completes → XP awarded. Reaching level 5 → "Apprentice" achievement unlocks.

---

### Phase 7 — Dashboard and Frontend Integration (Week 4, ~4 days)

**Goal:** Frontend talks to real backend on all screens.

Tasks:
- `GET /dashboard` (5 parallel queries, merge)
- Replace all static mock data in frontend with API calls
- Wire Axios auto-refresh interceptor
- Wire `useCompleteHabit` with optimistic update
- Wire level-up overlay (trigger on `levelUp: true` in response)
- Wire achievement toast (trigger on `unlockedAchievements: [...]`)
- Wire page load → `POST /auth/refresh` → set token → fetch dashboard
- Wire login/register screens to auth API
- `GET /data/export` → file download

Done when: complete a habit → instant optimistic check → server confirms → XP animates. Page refresh → auto-login via cookie → dashboard loads without login screen.

---

### Phase 8 — PWA and Deployment (Week 5, ~3 days)

**Goal:** Installable PWA, correct icons, deployed.

Tasks:
- Generate PNG icons from `icon.svg`: 192×192, 512×512, 512×512 maskable (safe zone), 180×180 apple-touch-icon
- Configure `vite-plugin-pwa` with Workbox `NetworkFirst` for API GET routes
- Add `<link rel="apple-touch-icon">` to `index.html`
- `registerSW.ts` with "update available" banner
- Deploy backend to Railway/Render with env vars
- Deploy frontend to Vercel with `VITE_API_URL` set
- Verify refresh cookie `Secure` + `SameSite=Strict` in production
- Verify CORS headers in production (not just localhost)
- MongoDB Atlas: set IP allowlist to Railway/Render IPs + dev IP
- Verify Lighthouse PWA score ≥ 90
- Install as PWA on an actual iPhone — verify correct icon, no generic placeholder

Done when: app is live on production URL, installable on iPhone with correct icon, and the cookie refresh flow works in standalone mode on a physical device.

---

### Build order rationale

```
Phase 1 (Frontend shell) + Phase 2 (Backend skeleton) → parallel, no dependency
Phase 3 (Auth) → must come before any authenticated feature
Phase 4 (Seeds) → must come before habits or character work
Phase 5 (Daily completion) → core write path; everything else builds on it
Phase 6 (Weekly + achievements) → builds on completion
Phase 7 (Integration) → frontend + backend must both be ready
Phase 8 (PWA + deploy) → last, after product is feature-complete
```

---

*End of implementation spec.*
