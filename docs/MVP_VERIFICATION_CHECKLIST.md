# LifeRPG MVP Verification Checklist

Run these checks manually after any deployment or major change to verify end-to-end correctness.

---

## Prerequisites

- Backend running at `http://localhost:3001/api/v1`
- Frontend running at `http://localhost:5173`
- MongoDB replica set active (required for transactions)

---

## 1. Auth

### Register
- [ ] Visit `/register`
- [ ] Fill in username, email, password, timezone
- [ ] Submit → redirected to dashboard (auto-login after register)
- [ ] Character, habits, and achievements are created on first login

### Login
- [ ] Logout if logged in
- [ ] Visit `/login`
- [ ] Enter correct credentials → dashboard loads
- [ ] Wrong password → "Invalid email or password" (no user enumeration)
- [ ] Wrong email → same error message as wrong password

### Refresh (session persistence)
- [ ] Login successfully
- [ ] Close and reopen the browser tab
- [ ] App shows loading spinner briefly (⚔️)
- [ ] Session is restored — no redirect to login
- [ ] If cookie is expired or deleted, app redirects to login

### Logout
- [ ] Click "Log Out" in Settings
- [ ] Redirected to `/login`
- [ ] Refresh browser → stays on login (cookie cleared)

### Account lockout
- [ ] Enter wrong password 5 times
- [ ] 6th attempt returns "Invalid email or password" (lockout, same message)
- [ ] Wait 15 min (or clear `lockUntil` in DB) to unlock

---

## 2. Character

### Default character
- [ ] After register, dashboard shows character with Level 1
- [ ] Character has stats (STR, INT, CON, AGI, CHA, WIS)
- [ ] Gold = 0, XP = 0 (or default)

### Stats update on habit completion
- [ ] Complete a habit → character level/XP updates on dashboard
- [ ] Streak shown on dashboard increments if applicable

---

## 3. Daily Habits

### List habits
- [ ] Quests tab shows 10 default habits (daily + weekly)
- [ ] Daily habits have completion checkbox

### Complete daily habit
- [ ] Tap daily habit → checkmark appears
- [ ] Toast shows `+{XP} XP — {name} ✓`
- [ ] Dashboard daily progress bar increments
- [ ] Habit stays checked across page navigation

### Undo daily habit (same day)
- [ ] Tap completed daily habit → unchecked
- [ ] Toast shows `↩ {name} undone — {xpReverted} XP reverted`
- [ ] XP decrements correctly

### Duplicate completion protection
- [ ] Complete a habit, then immediately try again
- [ ] Second attempt returns toast "Already completed today" (409)

### Create custom habit
- [ ] (Not yet in frontend UI — available via API)
- [ ] `POST /api/v1/habits` with JWT creates a new habit

### Update habit
- [ ] `PATCH /api/v1/habits/:id` updates name/icon/category

### Soft delete habit
- [ ] `DELETE /api/v1/habits/:id` sets isActive=false
- [ ] Habit no longer appears in list

---

## 4. Weekly Habits

### Manual weekly complete
- [ ] Tap a manual weekly habit → marked complete for the week
- [ ] Toast shows weekly completion message with XP

### category_count auto-complete
- [ ] "Read 5 times" (or similar) completes when 5 matching daily habits are done in the week
- [ ] Achievement evaluates automatically after last completion

### habit_count auto-complete
- [ ] "5 LeetCodes" completes when all 5 specified habits are completed at any point in the week
- [ ] Completion works even if individual habits were completed on different days

### No undo for weekly manual after auto-complete
- [ ] Weekly completion is permanent once awarded

---

## 5. Achievements

### first_completion unlock
- [ ] Complete first-ever habit → "First Blood" achievement toast appears
- [ ] Achievement shows as unlocked in Achievements tab

### complete_10 unlock
- [ ] Complete 10 habits total → achievement unlocked

### Streak achievements
- [ ] Maintain a streak for the required days → streak achievement unlocks

### Achievements persist after undo
- [ ] Unlock an achievement by completing a habit
- [ ] Undo the habit
- [ ] Achievement remains unlocked (undo does not revoke achievements)

### Achievement list
- [ ] All achievements visible in Achievements tab
- [ ] Locked achievements show as grayed out
- [ ] Unlocked achievements show unlock date

---

## 6. XP Events

### XP events feed
- [ ] `GET /api/v1/xp/events` returns XP event history
- [ ] Each habit completion creates an XP event

### XP summary
- [ ] `GET /api/v1/xp/summary` returns total XP, level, rank

### Level up
- [ ] Accumulate enough XP → level-up overlay appears with new level and rank
- [ ] Stats boost message shown in overlay

---

## 7. Dashboard

### Dashboard loads
- [ ] Dashboard screen loads after login
- [ ] Character card shows level, rank, XP bar, gold
- [ ] "Today's Progress" shows completed / total daily habits
- [ ] Metrics grid shows: Total XP, Habits Done, Gold, Best Streak

### Counts correct
- [ ] After completing a daily habit, "Today's Progress" count increments immediately
- [ ] After undoing, count decrements

### Recent quests preview
- [ ] Up to 5 daily habits shown on dashboard
- [ ] Up to 3 weekly habits shown with progress

---

## 8. Progress Screen

### Heatmap
- [ ] 30-day activity heatmap shows real completion data
- [ ] Days with completions are highlighted (green = full, amber = partial)
- [ ] Today is marked
- [ ] Empty grid shows before any habits are completed

### Active Streaks
- [ ] Streak rows show current streak count for Gym, Code, Reading, Early Rise
- [ ] Streaks update after completing the linked habit

### Character Stats
- [ ] STR, INT, CON, AGI, CHA, WIS display with progress bars

---

## 9. Frontend UX

### Session restore on browser reload
- [ ] Login → reload tab → stays logged in (cookie valid)
- [ ] After token expires → app refreshes via cookie silently

### Cache invalidation after mutations
- [ ] Complete a habit → dashboard, quests, character, achievements all refresh

### Error states
- [ ] Turn off network → quests show error / loading state handled
- [ ] Turn on network → retry works

### Offline banner
- [ ] Enable airplane mode in browser DevTools (Network tab → Offline)
- [ ] Orange banner appears: "You are offline. Habit changes require a connection in this MVP."
- [ ] Tapping a habit shows warning toast, does not submit
- [ ] Go back online → banner disappears

### Data export
- [ ] Settings → Export → JSON file downloads
- [ ] File contains: user, character, habits, habitLogs, xpEvents, achievements

---

## 10. PWA

### Installable
- [ ] Open in Chrome → install prompt appears in address bar (or "Add to Home Screen" in mobile)
- [ ] Install app → launches as standalone window (no browser chrome)
- [ ] App name shows "LifeRPG" in launcher

### App shell loads
- [ ] App loads when opened from home screen
- [ ] Login screen appears if not authenticated

### API not cached unsafely
- [ ] Open DevTools → Application → Cache Storage → `workbox-precache-*`
- [ ] No entries with `/api/v1/` URLs should be in the cache
- [ ] API calls go to network (verify in Network tab — no "(from cache)" for API calls)

### Offline write guard
- [ ] While offline, tapping a habit shows the offline toast
- [ ] No optimistic update occurs — habit state unchanged

### Update prompt
- [ ] Deploy a new version of the frontend
- [ ] On next app open, an "⚡ New version available" banner appears at the bottom
- [ ] Tapping "Reload" updates the app
- [ ] Tapping "Later" dismisses the banner

---

## 11. Deployment

### Backend health check
```bash
curl http://localhost:3001/api/v1/health
# → {"status":"ok","service":"liferpg-api","timestamp":"..."}
```

### Frontend SPA fallback
```bash
# Direct navigation to a route should return index.html (not 404)
curl -I http://localhost:5173/quests
# → 200 OK with index.html content
```

### Production CORS
- [ ] Frontend origin matches `FRONTEND_URL` exactly
- [ ] Request from a different origin returns 403 on CORS preflight

### Production cookie settings
- [ ] In production (`NODE_ENV=production`), cookie has `Secure` flag
- [ ] Cookie has `HttpOnly` flag (not readable by JavaScript)
- [ ] Cookie scoped to `/api/v1/auth/refresh` path only

### Swagger disabled in production
```bash
curl http://your-api-domain.com/api/v1/docs
# → 404 (Swagger not served in production)
```

### No sensitive data in logs
- [ ] Backend logs do not contain passwords, tokens, or Authorization headers
- [ ] Error responses do not expose stack traces (only message + statusCode)

---

## Known Limitations (Post-MVP)

- **No offline write sync**: Habit completions while offline are discarded. Users must be online to complete habits.
- **No push notifications**: No background reminders implemented.
- **No account deletion**: The Reset button in Settings shows an explanatory modal.
- **No social features**: Leaderboards, friend challenges not implemented.
- **Heatmap totalCount**: The heatmap shows `completedCount` per day but not the total available habits for that day — so partial vs. full distinction reflects habit count only, not completion rate.
