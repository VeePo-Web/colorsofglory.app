# CF1 — CLAUDE: Mobile Detail Fixes (from the live audit)
## Fix pass · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. These are the concrete, high-visibility defects caught driving
> the app on a real iPhone viewport (`docs/MOBILE-AUDIT-FINDINGS.md`). Small surface,
> big "it finally feels right" payoff. Frontend only; tokens only; seam only.
> Re-verify by re-driving the mobile viewport after each fix.

## YOUR ROLE
Claude: all `src/` UI. No schema/auth-logic (Lovable) or tests-as-feature (Codex).
Meet `docs/MOBILE-UX-BENCHMARK.md`. Contract: `docs/BUILD-PATHWAY.md`.

---

## THE BUGS (with evidence)

### BUG 1 — Duplicate / leaking record FAB (Critical)
The global capture mic FAB renders on `/` (capture home) and `/songs/:id/room`,
**on top of / overlapping** the hero mic and the Notes card → two record affordances.
- Root cause: `src/components/capture/GlobalCaptureFlow.tsx` hide rule only matches
  `/canvas`, `*/voice`, `*/capture`. It does **not** catch `/` (CapturePage),
  `/songs/:id` (CapturePage), or `/songs/:id/room` (room has its own "Record memo").
- Routes (from `App.tsx`): CapturePage = `/`, `/capture`, `/songs/:id`,
  `/songs/:id/capture`; room = `/songs/:id/room`.
- **Fix:** the global FAB must only appear where there is **no** other record action.
  Recommended: hide it on the capture home (`/`), all capture variants, and the room —
  i.e. show it only on the catalog (`/songs`) and other non-capture screens. If, after
  C2/nav cohesion, capture is always one tab away, consider **retiring the global FAB
  entirely**. Confirm the choice in Phase 3, then implement a single, robust route rule
  (exact-match `/`, prefix `/songs/:id` capture + room) — no fragile `endsWith`.

### BUG 2 — Tap targets under 44px (High · Apple HIG)
Measured on iPhone 13:
- Capture header (`CaptureScene` header): "Songs" `76×37`, "Settings" `36×36`,
  "Import a voice memo" `163×36`.
- Canvas bottom nav (`SongTabBar` / `BottomNav`): Canvas/Lyrics/Voice/Chords/Notes/
  People all `~×32`.
- Auth (`EmailAuthPage`): inputs `278×24` (!), Sign in/Create `156×37`, links `~21`.
- **Fix:** every interactive control ≥ **44px** tall (48 preferred for inputs).
  Increase via padding/min-height, not font size. Keep the visual rhythm.

### BUG 3 — Inconsistent record gesture (High)
Capture standardized **tap-to-record** (`BigMic`), but the canvas first-idea card says
**"Hold to hum."** Pick one mental model.
- Source: `src/components/canvas/FirstActionPrompt.tsx` (or the canvas first-idea card).
- **Fix:** use **tap-to-record** language/behavior everywhere in the core flow. Reserve
  "hold to hum" exclusively for the dedicated F9 Instant Hum Capture feature, clearly
  labeled — not the generic record entry.

### BUG 4 — (Defer to C1) Canvas nav overload
Two nav systems (top tabs + 6-tab bottom nav) + extra action rows. This is **C1's**
restructure, not a quick fix. Out of scope here; note it and move on.

---

## PHASE 0 — REPRODUCE
With the preview auth bypass on (`RequireAuth.BYPASS_AUTH`), drive the iPhone viewport
and confirm each bug on `/`, `/songs/:id/room`, `/songs/:id/canvas`, `/auth/login`.

## PHASE 3 — SCOPE
Confirm the BUG 1 decision (hide-everywhere-with-a-mic vs retire the global FAB) and
whether auth-screen sizing is in this pass or a separate auth-polish prompt.

## PHASE 4 — FIX
1. Global FAB route rule (BUG 1) — single robust rule; no overlap with any record action.
2. Tap-target sizing (BUG 2) — header, nav tabs, import, (auth inputs if in scope).
3. Record-gesture consistency (BUG 3) — tap everywhere; hold only for F9.
4. Tokens, motion, reduced-motion preserved; nothing visual regresses.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green. **Re-drive the mobile viewport** and re-measure:
no duplicate FAB on `/` or room; all audited targets ≥44px; record copy consistent.
Paste before/after measurements.

## ACCEPTANCE CRITERIA
- [ ] No second record FAB on the capture home or the room (no overlap with Notes/mic).
- [ ] All audited controls ≥44px tall (inputs ~48px); re-measured on 390px.
- [ ] Record gesture/wording consistent (tap) across capture + canvas entry.
- [ ] `tsc`+`build`+tests green; no token/motion regressions; ≤250 lines per component.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/mobile-detail-fixes` →
merge → delete. Stage by path; don't touch collaborator WIP.

## REFERENCES
- `src/components/capture/GlobalCaptureFlow.tsx`, `src/components/capture/CaptureScene.tsx`
- `src/components/cog/SongTabBar.tsx`, `BottomNav.tsx`, `src/pages/auth/EmailAuthPage.tsx`
- `src/components/canvas/FirstActionPrompt.tsx`, `App.tsx` (routes)
- `docs/MOBILE-AUDIT-FINDINGS.md`, `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`
