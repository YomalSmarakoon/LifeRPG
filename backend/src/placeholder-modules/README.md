# Placeholder Modules

The following NestJS modules will be implemented in later phases, strictly following
`docs/LIFE_RPG_MVP_FINAL_IMPLEMENTATION_SPEC.md`.

| Module | Phase | Purpose |
|---|---|---|
| `auth` | Phase 3 | JWT auth, register, login, refresh-token rotation, logout |
| `users` | Phase 4 | User profile read/update (`GET/PATCH /users/me`) |
| `characters` | Phase 4 | Character read/update, XP/level/rank cache |
| `habits` | Phase 5 | Habit CRUD, daily completion, undo, habit logs |
| `xp` | Phase 5–6 | XP event log, XP summary feed |
| `achievements` | Phase 6 | Achievement evaluation, unlock, list |
| `dashboard` | Phase 7 | Single-request dashboard aggregation |
| `data-export` | Phase 7 | Full JSON export, rate-limited |

**Do not implement any of these until the corresponding phase is started.**
Each module will be created via `nest g module`, `nest g controller`, `nest g service`
and wired into `AppModule`.
