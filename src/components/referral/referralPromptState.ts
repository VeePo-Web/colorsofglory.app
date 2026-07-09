/**
 * F3 · Referral prompt trigger + frequency-cap state.
 *
 * Product Vision 14: collaboration IS the referral moment. Host surfaces
 * (People screen, invite flow, milestone moments) call triggerReferralPrompt()
 * and this module decides whether the calm nudge may actually appear.
 *
 * Calm rules (docs/REFERRAL-CONTRACT.md is the canonical spec):
 *  - Each moment fires AT MOST ONCE per song, ever.
 *  - Globally, at most one prompt every 7 days — collaboration keeps happening;
 *    the nudge doesn't.
 *  - "Don't show this again" is a permanent, global opt-out.
 *  - State persists across sessions in localStorage (per device).
 *
 * The prompt itself is rendered by <ReferralPromptHost/>; this module is only
 * the decision + persistence layer plus a tiny event bus so hosts never import
 * UI to fire a moment.
 */

export type ReferralMoment =
  | "invite_sent" // owner just sent/created an invite — they're already in sharing mode
  | "collaborator_joined" // someone accepted and appeared in the song
  | "milestone"; // a warm milestone (first collaborative song, credits exported…)

export type ReferralPromptRequest = {
  moment: ReferralMoment;
  songId: string;
};

const STORAGE_KEY = "cog:referral-prompt:v1";
/** Global calm cap — at most one nudge per week, across all songs + moments. */
const GLOBAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type PromptState = {
  /** Permanent global opt-out ("Don't show this again"). */
  optedOut: boolean;
  /** Epoch ms of the last prompt actually shown (drives the 7-day cap). */
  lastShownAt: number | null;
  /** `${moment}:${songId}` keys that have already fired once. */
  seen: string[];
};

// Always a FRESH object (and fresh seen array) — callers mutate the result,
// so a shared default would corrupt the caps when storage is unavailable.
function defaultState(): PromptState {
  return { optedOut: false, lastShownAt: null, seen: [] };
}

function readState(): PromptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PromptState>;
    return {
      optedOut: parsed.optedOut === true,
      lastShownAt: typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : null,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((s) => typeof s === "string") : [],
    };
  } catch {
    return defaultState();
  }
}

function writeState(state: PromptState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — the prompt just won't persist its cap; still calm
    // within the session because the host also debounces per mount.
  }
}

function seenKey(moment: ReferralMoment, songId: string): string {
  return `${moment}:${songId}`;
}

/** Pure decision: may a prompt for this moment show right now? */
export function canShowReferralPrompt(moment: ReferralMoment, songId: string): boolean {
  const state = readState();
  if (state.optedOut) return false;
  if (state.seen.includes(seenKey(moment, songId))) return false;
  if (state.lastShownAt !== null && Date.now() - state.lastShownAt < GLOBAL_COOLDOWN_MS) return false;
  return true;
}

/** Record that the prompt was actually shown (starts the 7-day cooldown). */
export function markReferralPromptShown(moment: ReferralMoment, songId: string) {
  const state = readState();
  const key = seenKey(moment, songId);
  if (!state.seen.includes(key)) state.seen.push(key);
  state.lastShownAt = Date.now();
  writeState(state);
}

/** Permanent global opt-out — honored forever, across all songs. */
export function optOutOfReferralPrompts() {
  const state = readState();
  state.optedOut = true;
  writeState(state);
}

// ── Trigger bus ─────────────────────────────────────────────────────────────
// Host surfaces fire moments; the mounted <ReferralPromptHost/> listens. If no
// host is mounted the trigger is a no-op — firing is always safe.

type Listener = (req: ReferralPromptRequest) => void;
const listeners = new Set<Listener>();

export function subscribeReferralPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The one call host surfaces make. Checks the caps; if the moment may show,
 * notifies the mounted host (which marks it shown when it actually renders).
 */
export function triggerReferralPrompt(moment: ReferralMoment, songId: string) {
  if (!canShowReferralPrompt(moment, songId)) return;
  for (const listener of listeners) listener({ moment, songId });
}
