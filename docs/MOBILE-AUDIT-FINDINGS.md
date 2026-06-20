# MOBILE AUDIT — live findings (iPhone 13 / 390×844)
## Driven in-app on a real mobile viewport, screen by screen, against `MOBILE-UX-BENCHMARK.md`

> Method: Playwright on the iPhone 13 device profile, password gate passed, auth wall
> temporarily bypassed (`RequireAuth.BYPASS_AUTH`), fake mic granted. Screens captured
> and inspected visually + measured (tap targets, overflow, type). Re-run after fixes.

---

## ✅ What's strong
- **Capture home:** big gold mic, serif time-of-day prompt ("One quiet thought before
  bed?"), side rail (Lyrics/Chords/Section/Scripture/Idea), radial glow, transcript
  placeholder, import fallback. Genuinely on-benchmark hero.
- **Room:** serif song title ("Grace in the Waiting"), "Private song room", warm copy
  ("Start anywhere…"), clean 2×2 panel grid (Lyrics/Voice/Chords/Notes). Close to the
  mockup; calm.
- **Onboarding intent:** clean — 0 small targets, no overflow.
- No horizontal overflow anywhere; 16px body (no iOS zoom-on-focus).

---

## 🔴 Top issues (the details)

### 1. Duplicate / leaking record button (Critical UX)
The **global capture mic FAB** appears on `/` (capture home) *and* `/songs/:id/room`,
**on top of** the hero mic / overlapping the Notes card. Two record affordances on one
screen = "which one do I tap?" The hide rule only matches `/capture` + `/canvas`, not
`/` or the room. **Fix:** hide the global FAB on any screen that already has a record
action (capture home, room) — or only show it where there's no other mic.

### 2. Canvas concept overload (Critical — confirms C1)
The canvas screen stacks **four** navigation/action layers at once: top tabs
(Canvas/Lyrics/Voice…), the first-idea card, a "Practice / Record memo / Add idea"
row, **and** a 6-item bottom nav (Lyrics/Voice/Chords/Notes/People/Canvas). Plus the
"Colors of Glory" logo renders cramped on 3 lines. Overwhelming; violates "one primary
action" + calm. → This is exactly what **C1** restructures.

### 3. Inconsistent record gesture (High)
Capture standardized **tap-to-record** (BigMic), but the canvas first-idea card says
**"Hold to hum."** One record mental model across the app. Pick tap; reserve hold for
the dedicated F9 hum feature only, clearly.

### 4. Tap targets under 44px (High — Apple HIG)
- Capture header: Songs `76×37`, Settings `36×36`, "Import a voice memo" `163×36`.
- Canvas bottom nav tabs: Canvas/Lyrics/Voice/Chords/Notes/People all `~×32`.
- Auth login (separate): Sign in/Create `156×37`, inputs `278×24` (!), links ~21px.
→ Bump nav/header controls to ≥44px tall; inputs to ~48px.

### 5. Two competing nav systems (High — confirms C1)
The canvas top tabs and the bottom nav expose the **same destinations** twice. Decide
one model (recommend: bottom nav for room↔layers, canvas as its own focused board).

### 6. Room panels show no live glance (Medium — C2)
Lyrics/Voice/Chords/Notes cards are empty shells; they should preview live data (last
line, # memos, key/BPM, # notes) per C2. "People" is missing from the grid.

---

## Fix ownership
- **#1, #4(header/nav), #6** → Claude (C-lane): global-FAB hide rule, tap-target sizes, room panel previews.
- **#2, #3, #5** → Claude **C1** (canvas cleanup) — already scoped.
- **#4(auth inputs)** → Claude (auth-screen polish, a future C prompt).
- A repeatable version of this audit (seeded user + screenshots in CI) → Codex (Q-lane harness).

*Captured 2026-06-19 via live mobile drive. The auth wall is temporarily bypassed
(`RequireAuth.BYPASS_AUTH = true`) — 🔒 re-enable before launch.*
