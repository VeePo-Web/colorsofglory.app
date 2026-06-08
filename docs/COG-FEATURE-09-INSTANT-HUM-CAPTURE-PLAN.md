# Colors of Glory — Feature 9: Instant Hum Capture
## Global Tap-to-Record Voice Capture · Implementation Plan
## Fantasy.co × Elite Engineering Methodology Standard
## 2026-06-07

---

## EXECUTIVE SUMMARY

A songwriter feels a melody arrive — in the car, walking, mid-conversation. They have one hand on a guitar neck or both hands occupied. The old workflow (open Voice Memos, find the right folder, name it later, remember to move it into the song) loses the idea before it's captured. Feature 9 collapses that into: **tap a floating mic, hum, tap again, done** — no song selection required up front. The memo lands in a global **Seed Ideas** shelf and gets filed into a song later, when there's time to think.

**This is a LOCKED SPEC.** The source PDF (`COG_Feature_09_Instant_Hum_Capture_Capture_Audio_UX_Build_Handoff.pdf`) describes a *hold-to-record* gesture. The user explicitly overrode this during design review:

> "It is tap and go. because most people will play an instrument while they are playing and singing. like voice memos."

**Locked interaction model: TAP-TO-START / TAP-TO-STOP** (mirrors iOS Voice Memos), not hold-to-record. This is a hard constraint — do not reintroduce hold gestures anywhere in this feature.

**Build sequence:** Backend handoff (flagged, not built by Claude) → A (engine adapter) → B (global shell + FAB) → C (review/save adapter) → D (Seed Ideas shelf) → E (polish + verification)

---

## ⚠️ CROSS-TEAM DEPENDENCY — FLAG FOR LOVABLE BEFORE STARTING TASK GROUP C

**This is a hard blocker for the save/upload step. Read before scheduling work.**

`src/lib/voice/voiceApi.ts` → `uploadVoiceMemo()` requires a non-null `songId: string`, and the `voice_memos` table (per `src/integrations/supabase/types.ts`) defines `song_id: string` (NOT NULL). A "seed idea" by definition has **no song yet** — that's the entire point of the feature (capture now, file later).

Per `CLAUDE.md` §0 (Team Structure), **Claude does not touch DB schema, RLS policies, or edge functions** — that is Lovable's domain. This plan builds the entire frontend capture shell against an **anticipated API contract** and stubs the upload call behind a single seam (`saveSeedIdea()` in `src/lib/voice/seedIdeaApi.ts`) so that swapping in the real backend later is a one-file change.

**Hand this requirement to Lovable verbatim:**

> Feature 9 (Instant Hum Capture) needs a way to persist a voice memo with **no song assigned**. Two options, your call on which fits the schema better:
> 1. **Make `voice_memos.song_id` nullable** and add a `source: 'seed' | 'linked'` (or similar) discriminator column, OR
> 2. **Add a new `seed_ideas` table** (`id, author_user_id, storage_path, mime_type, byte_size, duration_ms, title, status, waveform_peaks, created_at, claimed_song_id (nullable, set on filing), claimed_at`) with its own `seed-idea-upload-url`, `seed-idea-finalize`, `seed-idea-claim` (assign to a song later), and `seed-idea-delete` edge functions, mirroring the existing `voice-memo-*` function family.
>
> Frontend is being built against this anticipated contract in `src/lib/voice/seedIdeaApi.ts`:
> - `getSeedUploadUrl({ mimeType, durationMs, fileName? }) → { uploadUrl, seedId, storagePath }`
> - `finalizeSeedIdea({ seedId, storagePath, title }) → void`
> - `listSeedIdeas() → SeedIdeaRecord[]`
> - `claimSeedIdea({ seedId, songId, sectionLabel? }) → void` (files a seed into a song — likely just calls the existing finalize-into-song path with the cached blob, or re-points the row)
> - `deleteSeedIdea(seedId) → void`

**Until that contract exists, `saveSeedIdea()` writes the blob to `audioCache` (IndexedDB) under a locally-generated `seed-{timestamp}` id, marks the record `status: "local-only"`, and queues it for upload.** This means the feature is fully demoable and the "sacred promise" (local blob written instantly) holds true on day one — cloud sync activates the moment Lovable ships the endpoints, with no frontend rework beyond filling in three function bodies.

---

## LOCKED INTERACTION SPEC (do not deviate)

| Aspect | Decision |
|---|---|
| **Gesture** | Tap to start recording → tap again to stop. NEVER hold-to-record. Hands-free for instrument use. |
| **Entry point** | Persistent FAB (floating action button), mounted globally — visible from Song Catalog and inside any Song Workspace, not just the Canvas. |
| **No song required** | Tapping the FAB never asks "which song?" first. Captures instantly, files later. |
| **Destination** | New "Seed Ideas" shelf at the top of `SongCatalogPage.tsx` — a horizontal-scroll row of unfiled voice memo cards. |
| **Local-first** | Blob written to `audioCache` (IndexedDB) the instant recording stops — before any network call. This is non-negotiable; matches the existing `useVoiceRecorder` + `audioCache` pattern. |
| **No max length** | Web-first means no OS-imposed ceiling; rely on the existing `beforeunload` guard + chunk streaming already in `useVoiceRecorder`. |
| **Haptics** | Vibration API on start/stop (`navigator.vibrate`), wrapped in a feature-detected no-op — iOS Safari has no Vibration API; never throw, never block. |
| **Crash recovery** | If the tab/app dies mid-recording, the partial blob recovered from `audioCache`/chunk buffer reappears in Seed Ideas marked "Recovered — tap to review." (Stretch — see Task E3.) |
| **Origin tagging** | Every seed idea record carries an `origin: "global-capture"` field (vs. `"in-song"` for song-scoped memos) — sets up future native quick-action entry points without a schema migration later. |

---

## ARCHITECTURE OVERVIEW

```
src/
  components/
    capture/
      GlobalCaptureFab.tsx        ← NEW: persistent tap-to-record FAB, mounted in AppShell/layout
      CaptureShell.tsx            ← NEW: lightweight global recording sheet (no SectionChip — seeds have no section)
      SeedReviewSheet.tsx         ← NEW: thin wrapper around VoiceReviewSheet with section made optional/deferred
      SeedIdeaCard.tsx            ← NEW: horizontal-shelf card (waveform thumbnail, name, duration, "File into a song" affordance)
      SeedIdeasShelf.tsx          ← NEW: horizontal-scroll shelf container, mounted at top of SongCatalogPage

  hooks/
    useGlobalCapture.ts           ← NEW: orchestrates useVoiceRecorder + tap state machine + haptics for the global context
    useVibration.ts               ← NEW: tiny feature-detected wrapper around navigator.vibrate

  lib/
    voice/
      seedIdeaApi.ts              ← NEW: the API seam described above (local-first, swappable to real backend)
      haptics.ts                  ← NEW: vibration pattern constants (start: [10], stop: [10, 40, 10])

  pages/
    SongCatalogPage.tsx           ← MODIFIED: mount <SeedIdeasShelf /> above the song grid

  App.tsx (or AppShell/root layout — see Task A0)
                                  ← MODIFIED: mount <GlobalCaptureFab /> at the root so it persists across routes

REUSED AS-IS (zero modification):
  src/hooks/useVoiceRecorder.ts       ← recording engine — phase machine, MediaRecorder, AnalyserNode
  src/lib/voice/audioCache.ts         ← IndexedDB local-first cache
  src/components/voice/RecordingWaveform.tsx
  src/components/voice/RecordingTimer.tsx
  src/lib/voice/audioFormat.ts        ← getBestMimeType, formatDuration
```

---

## WHY THESE REUSE DECISIONS (cultural justification, per design-bible discipline)

- **`useVoiceRecorder` needs zero changes.** It already exposes `startRecording()` / `stopRecording()` as discrete async calls — the hook has no opinion about *what gesture* triggers them. The only thing that changes for Feature 9 is that a `pointerdown`/`pointerup` pair (used in `SongCanvasExperience.tsx` for hold-to-record) becomes two independent `onClick` taps. This is the cleanest possible reuse: same engine, different finger choreography.
- **`RecordingSheet` is NOT reused directly** — it's wired for song-scoped recording (`SectionChip`, `onSectionChange`). A seed idea has no section. Building `CaptureShell` as a sibling (not a fork-with-flags) keeps both components honest about what they're for — avoids the "one component, eleven boolean props" anti-pattern the engineering persona warns against.
- **`VoiceReviewSheet` is wrapped, not forked.** The user confirmed it's "pretty good how it is now." `SeedReviewSheet` passes it a `section` of `"Unfiled"` and intercepts `onSave` to route through `seedIdeaApi` instead of `voiceApi`. This is the minimal-surface-area choice — one new thin file vs. duplicating 368 lines.
- **`audioCache` is reused exactly as built.** It's already non-fatal-on-error and ID-keyed; seed ideas just use `seed-{timestamp}` as the key instead of a server-issued memo ID. No changes needed.

---

## TASK GROUP A — Capture Engine Adapter (no UI yet)

### A0 — Locate the global mount point
**File:** `src/App.tsx`
**Action:** Read the root layout/router to find where persistent, route-independent UI (e.g., `BottomNav`, toast provider) is currently mounted. Identify the exact JSX location for `<GlobalCaptureFab />` so it survives route changes (must NOT be inside a page component — it would unmount on navigation, killing an active recording).
**Verification:** Confirm by grep that `BottomNav` (or equivalent persistent chrome) is mounted once, above `<Routes>`, and note that file:line for the next task.
*Time: 3 min.*

### A1 — Vibration wrapper
**File (new):** `src/hooks/useVibration.ts`
```ts
export function useVibration() {
  const supported = typeof navigator !== "undefined" && "vibrate" in navigator;
  const vibrate = useCallback((pattern: number | number[]) => {
    if (supported) { try { navigator.vibrate(pattern); } catch {} }
  }, [supported]);
  return { vibrate, supported };
}
```
**Verification:** Write a 1-line smoke test or manual check: call `vibrate([10])` on a non-vibration browser (desktop Chrome) and confirm no throw, no console error.
*Time: 4 min.*

### A2 — Haptic pattern constants
**File (new):** `src/lib/voice/haptics.ts`
```ts
export const HAPTIC_RECORD_START = [10];
export const HAPTIC_RECORD_STOP = [10, 40, 10];
```
**Verification:** Import compiles; values are arrays of numbers (TS strict).
*Time: 2 min.*

### A3 — `useGlobalCapture` orchestration hook
**File (new):** `src/hooks/useGlobalCapture.ts`
**Spec:** Wraps `useVoiceRecorder`. Exposes a single `toggle()` function and a `phase` that the FAB and shell read. On `toggle()`:
- if `phase === "idle"` → `vibrate(HAPTIC_RECORD_START)`, call `startRecording()`
- if `phase === "recording"` → `vibrate(HAPTIC_RECORD_STOP)`, call `stopRecording()`, store result in local state for the review step

Returns: `{ phase, durationMs, analyserNode, error, pendingRecording, toggle, discard }`
**Why a wrapper and not raw `useVoiceRecorder` in the FAB:** keeps tap-state-machine logic (start vs. stop branch) and haptics out of the presentational FAB component — matches the project's existing separation (compare `SongCanvasExperience` keeping `recordingFlow` state separate from the recorder phase).
**Verification:** Write a quick manual test page or Storybook-less console check: render the hook in a throwaway component, tap-toggle twice, confirm `pendingRecording` populates with a `RecordingResult` after the second tap (no `pointerup`/hold needed).
*Time: 5 min.*

---

## TASK GROUP B — Global Shell + FAB

### B1 — `GlobalCaptureFab`
**File (new):** `src/components/capture/GlobalCaptureFab.tsx`
**Spec:**
- `position: fixed`, bottom-right, above `BottomNav` z-index, `min-width/height: 56px` (exceeds the 44×44 Apple HIG floor)
- Idle state: gold circle (`var(--cog-gold)`), `Mic` icon (Lucide)
- Recording state: red fill (`#E05440` — matches existing `RecordingSheet` stop-button color for consistency), `mic-pulse` animation reused verbatim from `SongCanvasExperience.tsx` (lines ~892-895 — copy the `@keyframes mic-pulse` block into this component's scoped `<style>` or promote it to a shared CSS module if a second consumer justifies it)
- Single `onClick` → `toggle()`. **No `onPointerDown`/`onPointerUp`. No hold logic. Tap only.**
- `aria-label`: "Start recording" / "Stop recording" (dynamic based on phase)
- `active:scale-[0.97]` press feedback (per motion system)
**Verification:** Mount in isolation, click once → fill changes to red + pulse animation starts + `navigator.vibrate` called with `[10]` (check via spy/console in dev). Click again → returns to gold, pulse stops, `pendingRecording` populates.
*Time: 5 min per state — do default, recording, and pressed states as 3 separate sub-tasks if working strictly TDD-bite-sized.*

### B2 — Mount the FAB globally
**File:** `src/App.tsx` (the location identified in A0)
**Action:** Add `<GlobalCaptureFab />` at the persistent-chrome level. Guard it from rendering on routes where it would visually collide with existing recording UI — specifically `/songs/:id/canvas` and `/songs/:id/voice`, which already have their own mic entry points (`SongCanvasExperience` FAB at line 752, `VoiceMemosPage` recorder). Use `useLocation()` + a route-prefix check, mirroring how `BottomNav` likely already hides itself on certain routes (check that pattern first — reuse it).
**Verification:** Navigate to `/`, `/songs/:id`, `/songs/:id/lyrics` → FAB visible. Navigate to `/songs/:id/canvas` and `/songs/:id/voice` → FAB hidden (no double mic buttons).
*Time: 5 min.*

### B3 — `CaptureShell` (active recording surface)
**File (new):** `src/components/capture/CaptureShell.tsx`
**Spec:** A pared-down sibling of `RecordingSheet` — same bottom-sheet visual chrome (frosted backdrop, slide-up, `border-radius: 24px 24px 0 0`), but:
- **No `SectionChip`** (seeds have no section)
- **No note input** (keep the capture moment to one decision: stop or keep going)
- Renders `RecordingWaveform` (reused) + `RecordingTimer` (reused) + a single tap-target stop affordance that mirrors the FAB's red circle (visual continuity: the thing you tapped to start is the thing you tap to stop — do not introduce a separate "Stop" button with different styling, that would break the gesture's mental model)
- Permission-denied state: reuse the calm, contained messaging pattern from `RecordingSheet` (lines ~? — the "Tap below to open Settings" block), but reframe copy for **web/browser** context per the locked spec: *"Colors of Glory needs your microphone. Click the 🔒 lock icon in your address bar → Site Settings → Microphone → Allow."* (matches the existing `openMicSettings` browser branch in `SongCanvasExperience.tsx` line 648 — reuse that exact copy string, don't write a new one)
**Verification:** Trigger via FAB tap → sheet slides up, waveform animates live, timer counts up. Tap the stop affordance → sheet transitions to `SeedReviewSheet` (Task C1). Deny mic permission in browser settings, retry → permission-denied state renders with correct browser-specific copy (test in Chrome and Safari — copy branches by `navigator.userAgent`).
*Time: ~20 min total across sub-states (active / permission-denied / requesting), broken into 5-min increments per state.*

---

## TASK GROUP C — Review, Save, and the API Seam

### C1 — `seedIdeaApi.ts` (the swappable seam)
**File (new):** `src/lib/voice/seedIdeaApi.ts`
**Spec:** Implements the anticipated contract from the dependency flag above, with a **local-first fallback** so the feature works end-to-end before Lovable ships the backend:

```ts
export interface SeedIdeaRecord {
  id: string;
  title: string;
  durationMs: number;
  storagePath: string | null;       // null while local-only
  status: "local-only" | "uploading" | "ready" | "claimed";
  origin: "global-capture";
  createdAt: string;
}

// Local-first save: write to audioCache immediately, attempt cloud sync,
// degrade gracefully to local-only on any network/endpoint failure.
export async function saveSeedIdea(params: {
  blob: Blob; mimeType: string; durationMs: number; title: string;
}): Promise<SeedIdeaRecord> { /* ... */ }

export async function listSeedIdeas(): Promise<SeedIdeaRecord[]> { /* merges local + remote */ }
export async function claimSeedIdea(params: { seedId: string; songId: string; sectionLabel?: string }): Promise<void> { /* files into a song */ }
export async function deleteSeedIdea(seedId: string): Promise<void> { /* ... */ }
```
**Critical implementation note:** `saveSeedIdea` MUST write to `audioCache.set(seedId, blob)` **synchronously in the call chain before** attempting any network request — this is the "local blob written instantly" non-negotiable from the locked spec. Network failure must never lose the recording.
**Verification:** Unit-style manual test: call `saveSeedIdea` with airplane mode / network throttled to "offline" in DevTools → confirm the blob is retrievable via `audioCache.get(seedId)` immediately, and `listSeedIdeas()` returns it with `status: "local-only"`.
*Time: 5 min per function — 4 functions = ~20 min, each independently testable.*

### C2 — `SeedReviewSheet`
**File (new):** `src/components/capture/SeedReviewSheet.tsx`
**Spec:** Thin wrapper around `VoiceReviewSheet`:
```tsx
<VoiceReviewSheet
  recording={pendingRecording}
  defaultName={`Idea — ${formatDate(new Date())}`}
  section="Unfiled"                          // no SectionChip interaction needed; pass-through default
  isPro={isPro}
  onSave={async ({ name, transcribe }) => {
    await saveSeedIdea({ blob: pendingRecording.blob, mimeType: pendingRecording.mimeType, durationMs: pendingRecording.durationMs, title: name });
    // toast: "Saved to Seed Ideas — file it into a song anytime"
  }}
  onDiscard={discard}
/>
```
**Note:** `VoiceReviewSheet`'s `SectionChip` will still render (it's not optional in the existing component). Per the "wrap, don't fork" decision, accept this for v1 — the chip simply won't be wired to anything meaningful for a seed (its value is discarded). **If this reads as confusing in a real device test (Task E2), promote `section` to an optional prop on `VoiceReviewSheet` in a follow-up task** — but do not preemptively modify a component the user said is "pretty good" without evidence it's actually a problem for this new context (YAGNI).
**Verification:** Complete a capture → review sheet appears with playback scrubber working (reused logic) → tap "Save memo" → toast confirms → sheet dismisses → FFmpeg/blob is in `audioCache`.
*Time: 8 min.*

### C3 — Wire `CaptureShell` → `SeedReviewSheet` → `seedIdeaApi`
**File:** `src/hooks/useGlobalCapture.ts` (extend) or a new orchestrating component `GlobalCaptureFlow.tsx` that owns the `idle → recording → reviewing` state machine — mirror the `recordingFlow` state pattern from `SongCanvasExperience.tsx` (lines 600-642) exactly, since that's the proven, working version of this exact flow.
**Verification (end-to-end):** Tap FAB anywhere in the app → record 5 seconds → tap to stop → review sheet → save → confirm a `SeedIdeaCard` appears in the shelf (Task D) within one render cycle, marked "local-only" if offline or "ready" if the backend contract is live.
*Time: 10 min.*

---

## TASK GROUP D — Seed Ideas Shelf (Song Catalog)

### D1 — `SeedIdeaCard`
**File (new):** `src/components/capture/SeedIdeaCard.tsx`
**Spec:** Matches the `--cog-cream-light` card system (`border-radius: 16px`, `var(--cog-border)`). Shows: small static waveform thumbnail (reuse `buildPreviewBars` pattern from `VoiceReviewSheet`), title, duration, relative timestamp ("2 hours ago"), and a gold-text affordance "File into a song →". Tapping the card opens a lightweight song-picker (reuse the song list already fetched for the catalog — do not build a new data fetch) that calls `claimSeedIdea`.
**Verification:** Renders with mock data at 3 different title lengths (test text truncation/ellipsis — no layout shift, per the Craft Test in the design bible).
*Time: 8 min.*

### D2 — `SeedIdeasShelf`
**File (new):** `src/components/capture/SeedIdeasShelf.tsx`
**Spec:** Horizontal `overflow-x: auto` scroll-snap row (per scroll-animation persona: `scroll-snap-type: x mandatory`), eyebrow label "SEED IDEAS" (uppercase, tracked, `var(--t-eyebrow)`), renders `SeedIdeaCard` per record from `listSeedIdeas()`. **Renders nothing (not even the eyebrow) when the list is empty** — an empty shelf with a label is clutter; per the Universal Avoid List, every element earns its presence.
**Verification:** Empty state → shelf doesn't render at all (confirm via DOM inspection, not just visual). Populated state → horizontal scroll works on touch + trackpad, snap points align, no horizontal overflow of the page itself.
*Time: 8 min.*

### D3 — Mount in `SongCatalogPage`
**File:** `src/pages/SongCatalogPage.tsx`
**Action:** Mount `<SeedIdeasShelf />` above the existing song grid, inside the page's scroll container (not sticky — it scrolls away with the rest of the catalog, keeping the song grid as the primary focus per the "the most important content gets visual gravity" principle).
**Verification:** Load `/` with at least one seed idea present → shelf renders above the grid, gold accents consistent with the rest of the page, no CLS when it mounts (reserve space or animate in with `clip-path` per the Resn reveal system — do not let it pop in and shove the grid down after first paint).
*Time: 5 min.*

---

## TASK GROUP E — Polish, Crash Recovery, Verification

### E1 — Reduced motion
**Action:** Confirm `mic-pulse` animation, `CaptureShell` slide transitions, and `SeedIdeaCard` entrance all respect `prefers-reduced-motion: reduce` (the global CSS rule from the design bible should already cover keyframe animations — verify it actually catches this specific `@keyframes mic-pulse` block since it's component-scoped, not global).
**Verification:** Toggle "Reduce Motion" in OS accessibility settings → re-test full capture flow → confirm pulse becomes a static state-color-change only, sheets cross-fade instead of sliding.
*Time: 5 min.*

### E2 — Real-device pass
**Action:** Test the full flow on: (a) iOS Safari (no Vibration API — confirm graceful no-op, confirm mic permission copy matches Safari's actual settings path), (b) Android Chrome (Vibration API present — confirm haptic fires), (c) desktop Chrome/Firefox (confirm FAB doesn't feel out of place on a non-touch surface — cursor states, hover feedback).
**Verification:** Written checklist of pass/fail per browser, attached as a comment on the PR or in the plan's changelog section (add one when this work begins).
*Time: 20 min — this is real device time, not estimable to the minute, but budget a session for it.*

### E3 — Crash recovery (stretch — flag as follow-up if time-boxed out)
**Action:** Extend `audioCache` or add chunk-level checkpointing so a killed tab mid-recording can be recovered on next launch, surfaced in the Seed Ideas shelf as "Recovered — tap to review."
**Decision point:** This is the most architecturally complex item in the plan and touches the recording engine's chunk lifecycle (`chunksRef` in `useVoiceRecorder`). **Do not start this until A–D are verified working** — per YAGNI, ship the core tap-and-go loop first, then decide if recovery is worth the complexity based on real usage/crash-rate data. If pursued, it requires modifying `useVoiceRecorder` (currently zero-touch) — flag that scope change explicitly before starting.
*Time: not estimated — separate planning pass required if greenlit.*

### E4 — Final verification gate (per Elite Engineering Methodology — evidence before completion claims)
Run and read full output of:
- [ ] `npm run build` — exit 0, no TypeScript errors
- [ ] `npm run lint` (or project's configured linter) — 0 errors
- [ ] Manual E2E: cold tap → record → stop → review → save → appears in shelf → file into song → disappears from shelf / appears in that song's voice memos
- [ ] Lighthouse mobile pass on `/` with shelf populated — confirm no CLS regression, confirm FAB doesn't tank INP (it's a fixed-position element; verify no layout thrash on scroll)
*Time: 15 min — do not claim this feature complete without every box checked and output read.*

---

## FILE MANIFEST (everything this plan creates or touches)

**New files (10):**
```
src/components/capture/GlobalCaptureFab.tsx
src/components/capture/CaptureShell.tsx
src/components/capture/SeedReviewSheet.tsx
src/components/capture/SeedIdeaCard.tsx
src/components/capture/SeedIdeasShelf.tsx
src/hooks/useGlobalCapture.ts
src/hooks/useVibration.ts
src/lib/voice/seedIdeaApi.ts
src/lib/voice/haptics.ts
src/components/capture/GlobalCaptureFlow.tsx   (only if C3 needs its own orchestrator component)
```

**Modified files (2):**
```
src/App.tsx                    — mount <GlobalCaptureFab />, route-aware visibility guard
src/pages/SongCatalogPage.tsx  — mount <SeedIdeasShelf />
```

**Reused with zero modification (6):**
```
src/hooks/useVoiceRecorder.ts
src/lib/voice/audioCache.ts
src/lib/voice/audioFormat.ts
src/components/voice/RecordingWaveform.tsx
src/components/voice/RecordingTimer.tsx
src/components/voice/VoiceReviewSheet.tsx
```

**Blocked on Lovable (backend handoff — see dependency flag above):**
```
voice_memos.song_id nullability OR new seed_ideas table
seed-idea-upload-url / seed-idea-finalize / seed-idea-claim / seed-idea-delete edge functions
```

---

## BUILD ORDER (strict — each group depends on the prior)

```
Backend handoff doc → Lovable        (parallel — does not block frontend start)
A0 → A1 → A2 → A3                    (engine adapter — no UI)
B1 → B2 → B3                         (FAB + shell — capture works, nothing saves yet)
C1 → C2 → C3                         (review + save — full loop works against local-first seam)
D1 → D2 → D3                         (shelf — captured ideas become visible/actionable)
E1 → E2 → (E3 deferred) → E4         (polish + verification gate — nothing ships without E4)
```

---

*This plan follows the Elite Engineering Methodology: design was brainstormed and locked across the prior session's 30-question review, this document is the written plan-on-disk gate before any implementation code is written, tasks are bite-sized (2-10 min) with named files and verification steps, and E4 enforces evidence-before-completion-claims. No implementation code has been written as part of producing this plan — that begins with Task A0 in a future session.*
