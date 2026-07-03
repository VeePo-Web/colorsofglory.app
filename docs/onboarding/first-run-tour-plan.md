# First-Run Tour — "Show Me Around"
## The Colors of Glory guided first-time experience · Onboarding lane plan
### Status: PLAN (approved scope: onboarding lane) · Owner: Onboarding Claude · 2026-07-02

---

## 0. The one-sentence spec

The first time a songwriter lands inside the app, a calm, five-beat tour points at **one thing at a time** — the way Logic Pro's coach tips do — teaching by *doing inside their real first song*, never by blocking the screen with a tutorial.

---

## 1. North Star + non-negotiables

From `master_onboarding_flow.pdf`: **"Do not onboard users into an app. Onboard them into their first song."** The tour must serve that — every beat points at something they can *do right now in their song*, not an abstract feature carousel.

**Non-negotiables (Church Center × faith-sanctuary rules):**
1. **Never block.** No full-screen takeover, no forced sequence, no "step 3 of 9" modal wall. Every beat is dismissible with one tap anywhere.
2. **One thing at a time.** A beat points at exactly one control and says one sentence. No multi-callout screens.
3. **Tour by doing.** Beats appear contextually — the first time the user *reaches* a surface — not front-loaded before they've seen anything.
4. **Always skippable, always re-enterable.** "Skip the tour" ends it silently forever; "Show me around" (Settings → Help) restarts it anytime.
5. **Calm motion only.** Gentle pulse on the target, tooltip fade+rise 250ms, `prefers-reduced-motion` = static. No confetti, no bouncing.
6. **Zero new taps for people who don't want it.** A user who ignores every tip completes onboarding exactly as today.

**Why not a carousel/walkthrough:** industry data is unambiguous — front-loaded product tours get skipped by the large majority of users and measurably increase abandonment when mandatory. Logic Pro itself doesn't tour; it drops you into a working project and offers **contextual coach tips** on the surface you're actually looking at. That's the model.

---

## 2. Research grounding (what the masters do)

| Product | First-run pattern | What we take |
|---|---|---|
| **Logic Pro / GarageBand** | Opens a real working project immediately; "Quick Help" coach tips appear on hover/tap per control; a persistent `?` re-opens them | Real-project-first; per-control tips; re-enterable help |
| **Church Center** | No tour at all — the IA is so simple the first screen *is* the explanation; one action per screen | Restraint bar: a beat must earn its place or be cut |
| **Duolingo** | Teaches inside the first real lesson; progress is felt, not announced | Teach inside the first real song |
| **Temu (subtle only)** | Momentum cues, "almost done" pull, variable small delights | A quiet "2 of 5" dot rail on tips; a single warm completion line — nothing louder |
| **Figma** | Contextual "?" tips + a named re-entry point in the help menu | "Show me around" re-entry |

---

## 3. Architecture

### 3.1 State — where "seen" lives
- **Source of truth:** `profiles.onboarding_steps` (existing monotonic step mechanism used by `updateOnboardingStep("referral_program_seen")`) — add step keys per beat: `tour_catalog_seen`, `tour_room_seen`, `tour_capture_seen`, `tour_lyrics_seen`, `tour_invite_seen`, `tour_done`, `tour_skipped`.
- **Fast local mirror:** `localStorage["cog:tour"]` so tips never flash for returning users while the profile loads. Profile wins on conflict.
- Server write is **best-effort** (existing pattern: `.catch(() => {})`) — a failed write never breaks the surface.

### 3.2 Components (all new, all onboarding-lane owned)
```
src/lib/onboarding/tour.ts          — step registry, seen/skip state, sequencing rules
src/components/onboarding/CoachMark.tsx — the tooltip: anchored, portal-rendered, COG-styled
src/components/onboarding/useCoachMark.ts — hook: useCoachMark("tour_capture_seen", ref)
```
- `CoachMark` renders in a **portal** anchored to a target ref → **zero edits inside other lanes' component internals**. Host surfaces only add a `ref` + one hook line at their page level.
- Anatomy: soft gold pulse dot on the target → tooltip (cream card, 1.5px gold border, serif-free body, max 2 lines) → single "Got it" + quiet "Skip tour" text link → tapping anywhere dismisses (counts as Got it).
- A 5-dot micro-rail at the tooltip's foot (the *only* gamification: filled dots = beats seen). No numbers screamed, no streaks.

### 3.3 Sequencing rules
- Max **one** coach mark visible at a time, app-wide (registry enforces).
- A beat shows only: (a) its surface is mounted ≥1.2s (user has oriented), (b) no modal/sheet open, (c) beat unseen, (d) tour not skipped/done.
- Beats are **independent** — seeing them out of order is fine (contextual, not linear). `tour_done` fires when all five are seen → one-time completion line.

---

## 4. The five beats (exact copy, exact placement)

> Copy discipline: ≤ 2 short lines each, verb-first, never "click here," faith-calm tone.

| # | Surface (first visit) | Anchor | Copy |
|---|---|---|---|
| 1 | **Song Catalog** (`/`) | The first song card | **This is your song's room.** Everything for it — lyrics, voice memos, people — lives inside. Tap to enter. |
| 2 | **Song Workspace/room** | The panel grid | **One song, one room.** Lyrics, voice, chords, notes, and your people — all connected here. |
| 3 | **Capture** (record button) | The record button | **Got a melody? Hum it.** One tap records. Your idea is saved the moment you stop. |
| 4 | **Lyrics/Canvas** | The add/lyrics affordance | **Write it down.** Add lyrics line by line — chords sit right on the words. |
| 5 | **Invite** (People panel / invite button) | The invite affordance | **Songs are better together.** Invite a co-writer — they join with just their phone number. |

**Completion (after 5th beat):** single warm line, inline where the last tip was, fades after 4s:
> *"That's the whole room. Go write something worth singing."* — with the 5-dot rail full.

**Skip:** the "Skip tour" link on any beat sets `tour_skipped`; nothing ever shows again. No confirmation, no guilt copy.

**Re-entry:** Settings → Help → **"Show me around"** clears seen-flags (not `tour_skipped` history) and re-arms the beats.

---

## 5. Lane boundaries + coordination

| Surface | Owner | Integration cost |
|---|---|---|
| Catalog, Settings/Help entry | shared/core | ref + 1 hook line — coordinate via handoff note |
| Workspace room | canvas/feature lane | same — handoff note before touching |
| Capture button | capture lane | same |
| Lyrics/canvas | canvas + songsheet lanes | same |
| Invite/People | **mine** | direct |

Rule: I ship the tour system + the beats on surfaces I own; for other lanes' surfaces I open a `docs/claude-handoffs/` note with the exact 2-line diff each lane applies (ref + hook). If a lane objects, that beat ships later — the tour degrades gracefully with any subset of beats.

---

## 6. Build slices (PR-sized, each independently green)

1. **Slice 1 — engine:** `tour.ts` + `CoachMark` + `useCoachMark` + localStorage/profile persistence + tests (seen/skip/sequencing).
2. **Slice 2 — beats 1 & 5** (catalog + invite — surfaces I can wire soonest) + "Show me around" re-entry in Settings Help + tests.
3. **Slice 3 — beats 2–4** via handoff notes to canvas/capture lanes; wire as each lane ACKs.
4. **Slice 4 — completion beat + polish:** dot rail, completion line, reduced-motion audit, 44px targets, aria-live announcements.

**Verification per slice:** vitest (state machine + render/dismiss/skip paths) · `tsc` · `vite build` · manual iPhone-width pass. The engine ships behind a single kill-switch flag (`tour_enabled` app setting or build const) so it can be dark-launched.

---

## 7. What this plan deliberately does NOT do

- No video, no multi-screen carousel, no "product tour" library dependency (they're heavy and off-brand; `CoachMark` is ~150 lines).
- No tooltips on every feature — five beats, then silence. Logic Pro's Quick Help covers *everything*; we cover the **spine of the flywheel** (enter room → capture → write → invite) and trust the UI for the rest.
- No gamification beyond the dot rail + one completion line. The song is the reward.
