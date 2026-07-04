/**
 * First-run tour engine — "Show Me Around".
 * See docs/onboarding/first-run-tour-plan.md (Slice 1).
 *
 * Five contextual coach-mark beats on the user's real first song (Logic Pro
 * Quick Help model). This module is the tour's brain: which beats exist,
 * which have been seen, whether the tour was skipped, and the app-wide
 * one-tip-at-a-time lock.
 *
 * Persistence: localStorage (per device). Deliberately NOT wired to
 * profiles.onboarding_step — that column is a monotonic single-step funnel
 * position; these five flags are unordered. When Lovable adds a `tour_steps`
 * jsonb column, sync it inside `persist()` below (best-effort, never throw).
 */

/** Kill switch — flip to false to dark-launch the tour system. */
export const TOUR_ENABLED = true;

// The registry lists exactly the beats that are WIRED to a surface. The dot
// rail sizes off it, so an unwired beat would leave the rail permanently
// incomplete (reads as broken) — and safeParse only persists keys listed here.
// When the canvas lane wires the lyrics + invite beats, register them below so
// the rail stays honest and the tour still completes.
export const TOUR_STEPS = [
  "tour_catalog_seen", // SongCatalogPage — the song card
  "tour_room_seen",    // BrainstormPage — the song header
  "tour_capture_seen", // BrainstormPage — the record button
  // "tour_lyrics_seen",  // canvas lane — the lyrics affordance (plan §4)
  // "tour_invite_seen",  // canvas lane — the invite/People affordance (plan §4)
] as const;

export type TourStep = (typeof TOUR_STEPS)[number];

export interface TourState {
  seen: TourStep[];
  skipped: boolean;
}

const STORAGE_KEY = "cog:tour";

// ── State ─────────────────────────────────────────────────────────────────────

function safeParse(raw: string | null): TourState {
  if (!raw) return { seen: [], skipped: false };
  try {
    const parsed = JSON.parse(raw) as Partial<TourState>;
    const seen = Array.isArray(parsed.seen)
      ? (parsed.seen.filter((s): s is TourStep => (TOUR_STEPS as readonly string[]).includes(s)))
      : [];
    return { seen, skipped: parsed.skipped === true };
  } catch {
    // Corrupted storage — start fresh rather than crash a first impression.
    return { seen: [], skipped: false };
  }
}

export function getTourState(): TourState {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage unavailable (private mode edge cases) — tour simply won't persist.
    return { seen: [], skipped: false };
  }
}

function persist(state: TourState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort only; never let persistence break a surface.
  }
  // Future: best-effort sync to a profiles.tour_steps jsonb column here.
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Beats seen so far (0–5) — drives the dot rail. */
export function seenCount(): number {
  return getTourState().seen.length;
}

export function isTourDone(): boolean {
  const s = getTourState();
  return s.skipped || s.seen.length >= TOUR_STEPS.length;
}

/** Should this beat's coach mark arm on its surface right now? */
export function isStepPending(step: TourStep): boolean {
  if (!TOUR_ENABLED) return false;
  const s = getTourState();
  return !s.skipped && !s.seen.includes(step);
}

// ── Transitions ───────────────────────────────────────────────────────────────

/** Returns true when this markSeen completed the tour (fire the warm line once). */
export function markSeen(step: TourStep): boolean {
  const s = getTourState();
  if (s.skipped || s.seen.includes(step)) return false;
  const seen = [...s.seen, step];
  persist({ ...s, seen });
  return seen.length >= TOUR_STEPS.length;
}

/** "Skip tour" — silent, permanent, no guilt copy. */
export function skipTour(): void {
  const s = getTourState();
  persist({ ...s, skipped: true });
  releaseActive(null);
}

/** Settings → Help → "Show me around": re-arm every beat. */
export function resetTour(): void {
  persist({ seen: [], skipped: false });
}

// ── One-tip-at-a-time lock (app-wide) ────────────────────────────────────────
// Never two coach marks on screen. First claimant wins; others stay silent and
// re-try when the active tip releases (subscribers re-check pending state).

let activeStep: TourStep | null = null;
const listeners = new Set<() => void>();

export function claimActive(step: TourStep): boolean {
  if (activeStep !== null && activeStep !== step) return false;
  activeStep = step;
  return true;
}

/** Release the lock. Pass the owning step (or null to force-clear on skip). */
export function releaseActive(step: TourStep | null): void {
  if (step === null || activeStep === step) {
    activeStep = null;
    listeners.forEach((fn) => fn());
  }
}

export function getActiveStep(): TourStep | null {
  return activeStep;
}

/** Subscribe to lock releases so a waiting beat can arm. Returns unsubscribe. */
export function onLockReleased(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test-only: reset module lock state between tests. */
export function __resetLockForTests(): void {
  activeStep = null;
  listeners.clear();
}
