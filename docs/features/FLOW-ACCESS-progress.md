# Lift — Flow Access · Progress

## 2026-07-22 (later) — Pass 2: one gesture family, one feel

Deep audit against the horizontal pager (the Snapchat standard) found five
gaps; all closed:
1. Constants drifted from the tuned family → NEW `liftDecision.ts`
   mirrors `swipeDecision.ts` exactly (7 unit tests, incl. one that
   asserts the two constant sets never diverge).
2. The flick could commit on velocity alone (no min-travel/sign guards) —
   the same regression class the horizontal tests exist for → fixed in
   the pure decision.
3. No armed haptic at the commit line → added (5ms tick, matching).
4. Commits hard-cut → now the pager's velocity-responsive fly-out + fade
   (150/90 flick · 220/150 slow), route changing into the fade.
5. The set-down only moved the grabber → `visualTarget` + the fixed
   inset-0 wrapper (containing-block technique): the WHOLE practice/Flow
   page now rides the finger down and slides off — the Apple-Music sheet
   dismissal. Reduced motion commits instantly with no visuals.
Horizontal sweep: all four peer surfaces already share `useSwipeNav` —
no drift found. Two gesture hooks in the app, ever.
Verified: 31 practice+nav tests (incl. 7 new) · 10 practice regressions ·
tsc clean · build green.

## 2026-07-22 — Shipped

**What changed**
- NEW `src/components/practice/useLiftGesture.ts` — the handle-anchored
  vertical drag: listeners on the element itself (structurally cannot
  fight canvas pan / list scroll / the horizontal pager), finger-tracking
  with damped resistance, 56px/flick commit, spring-back, latched
  callbacks (a re-render mid-drag never drops the gesture), reduced-motion
  = thresholds without visuals.
- `MiniPracticePlayer` evolved into the **Flow handle**: a calm centered
  "▲ Flow · lift to play" ENTRY pill on room/sheet/lyrics/chords/voice/
  canvas (capture stays sacred) at bottom:104 (clears every surface's
  bottom bar); the ACTIVE now-playing bar keeps its exact 80px slot and
  behavior, gaining a grabber cue + swipe-up re-lift. Both states: tap =
  the contract, swipe = the accelerator. The entry pill hides while any
  text input has focus (the sheet's keyboard case — the trance guard).
- `PracticePlayerExperience`: arrives in Flow when lifted
  (`{ flow: true }` nav state); a top-center **SetDownGrabber** (pull down
  or tap → back exactly where you were) over the full player AND Flow;
  Drive Mode deliberately exempt (driver mis-tap hazard).
- Canvas's `handleLaunchPractice` now rises (`setNavDirection("up")`) —
  one launch grammar everywhere.

**Audit findings closed during the build**
- All four entry surfaces have ~96px bottom bars (room dock, sheet's
  Add-section bar, voice recorder panel, canvas z-800 dock) → the entry
  pill sits at 104px, not the active bar's 80px.
- The sheet's keyboard would have put a fixed pill over the active line →
  the trance guard hides it on text focus.
- The gesture hook's callbacks originally latched INSIDE the effect →
  moved to a ref (stale-closure bug caught before ship).

**What was verified**
- `tsc` clean · `vite build` green · practice suites 10/10 · nav +
  routing suites 42/42. Conflict-freedom is structural (element-anchored
  listeners), not probabilistic.

**Needs a phone**
- The lift's felt weight (56px / 0.55 flick), keyboard-hide on the sheet,
  104px clearance at 390px on all four surfaces, VoiceOver tap path.

**Next candidates**
- A true shared-element morph (bar grows into the stage) via Framer
  layoutId once the router transition story allows it — the rise entrance
  carries the depth motion today.
- Entry pill on /notes + /activity if writers reach for it there.
