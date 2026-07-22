# Lift — Reaching Flow via the Swipe-Up Handle · Contract

**Owner:** F2 practice lane (`MiniPracticePlayer` — now the Flow handle,
`useLiftGesture`, the `SetDownGrabber` in `PracticePlayerExperience`).
**Consumes:** the spatial nav direction system (`setNavDirection("up")` —
the app's established depth motion), `usePracticeContext`, the practice
page's self-loading deep-link path, `FlowPlayer` (mounted, never rebuilt).
**Never:** makes Flow a horizontal peer, hides the gesture, ships
gesture-only affordances, or edits the song from Flow.

## The grammar (one rule, everywhere)

```
HORIZONTAL          = lateral (Library ← Capture → Circle; peer surfaces)
VERTICAL, ON HANDLE = mode/depth (swipe UP = lift into Flow; DOWN = set down)
```

Benchmark: the Apple Music / Spotify now-playing pull-up — the most
understood "reach the player" interaction on earth, worship-framed as
"lift the song up to play it."

## The handle states

- **ENTRY** — on a song's surfaces (`/songs/:id/(room|sheet|lyrics|chords|
  voice|canvas)`; capture stays sacred): a centered pill at `bottom: 104px`
  (clears every surface's bottom bar — room dock, sheet's Add-section bar,
  voice's recorder panel, the canvas dock) with a grabber + "▲ Flow ·
  lift to play." Swipe up on it **or tap** → `setNavDirection("up")` +
  navigate to the practice route with `{ flow: true }` — the page rises
  (the app's existing depth entrance), self-loads the song's sections, and
  arrives **in Flow**. A song with nothing to perform lands on the honest
  "record a take" screen — the handle never lies, it just leads.
- **ACTIVE** — a session is live, anywhere in the app: the established
  48px now-playing bar (its 80px slot, behavior unchanged: section ·
  play/pause · skip · ✕ end) plus a grabber cue; swipe up **or tap**
  re-lifts into the full player with the same rise.
- **SET-DOWN** — inside the practice page (full player AND Flow): a
  top-center grabber (44px target, safe-area aware). Pull down **or tap**
  → `handleClose()` returns exactly where you were (history back, canvas
  fallback on cold deep links). Drive Mode deliberately has NO grabber — a
  small top target is a mis-tap hazard for a driver; its own big exit
  stands.

## The gesture layering (why it can't conflict)

`useLiftGesture` attaches its listeners **to the handle/grabber element
itself** — anchored by construction. Canvas pan, list scroll, and the
top-level horizontal pager live in the content, which the handle floats
above; there is no shared surface to fight over. Within the gesture:
horizontal-dominant movement stands down immediately (the pager/pan wins).
Callbacks are latched in a ref (the useSwipeNav lesson) so a re-render
mid-drag never drops the gesture. Reduced motion: every visual skipped,
thresholds intact, tap always works.

## One family, one feel (the pass-2 audit)

The vertical gesture is now the exact sibling of the horizontal pager:

- **`liftDecision.ts` mirrors `swipeDecision.ts`** — a pure, unit-tested
  commit function with the SAME family constants (INTENT 14 · TRIGGER 64 ·
  MIN_FLICK 24 · FLICK_VELOCITY 0.4 · AXIS_RATIO 1.6 · RESIST 0.22). A
  test asserts the constants never drift apart. The flick carries the
  min-travel + sign-match guards, so a jittery tap can never commit on
  velocity alone (the same regression class the horizontal tests catch).
- **The armed haptic** — crossing the commit line gives the same soft
  Android tick (5ms) as the pager; release gives the same 8ms.
- **The commit choreography** — the visual flies the rest of the way in
  the drag direction AND fades, with the pager's velocity-responsive
  timing (flick: 150ms fly / 90ms to route; slow drag: 220/150), the
  route changing into the fade.
- **`visualTarget`** — what follows the finger. The entry pill rides its
  own drag; the SET-DOWN passes the practice page's wrapper (a fixed
  inset-0 div with no transform at rest — the moment the drag applies a
  transform it becomes the players' containing block at identical
  geometry), so the WHOLE surface rides the finger down and slides off —
  the Apple-Music sheet dismissal, not a lone pill sliding.
- **The horizontal sweep** — all four peer surfaces (Capture, Songs,
  Circle, the song room) already share the one `useSwipeNav` engine;
  nothing drifted. Two hooks total: horizontal `useSwipeNav`, vertical
  `useLiftGesture`. Never a third.

## The trance guard

While any text input/textarea/contenteditable has focus (the sheet's
keyboard is up), the ENTRY handle vanishes (`useTextInputFocused`) — it
can never float over the active line on iOS's shifted visual viewport.
The writing trance is sacred.

## One launch grammar

The canvas's existing Practice button now rises too
(`setNavDirection("up")` before navigate) — every path into the perform
mode shares the same depth motion: **it always rises; it always sets back
down.**

## Verification (2026-07-22)

- `tsc` clean · build green · practice suites 10/10 · nav + routing 42/42.
- Structural gesture-conflict proof: the drag zone is the handle element —
  content gestures physically cannot reach it (no document/content
  listeners exist in `useLiftGesture`).
- **Needs a phone:** the felt weight of the lift (56px/flick tuning), the
  keyboard-hide on the sheet, the pill's 104px clearance on all four
  surfaces at 390px, and VoiceOver walking the tap path (entry pill →
  Flow → set-down grabber).
