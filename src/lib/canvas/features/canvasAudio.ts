import { getPlaybackUrl } from "@/integrations/cog/memos";

/**
 * canvasAudio — the ONE audio voice for canvas feature playback.
 *
 * Listen Path (F20) and Compare Mode (F21) both audition takes through this
 * singleton, so starting one always silences the other and nothing on the
 * canvas can double-play.
 *
 * Two-element pool for GAPLESS advance: while a take sounds through the
 * ACTIVE element, the next take is fully primed (src set, buffering) on the
 * SPARE. Advancing swaps elements instead of re-fetching — the seam between
 * listen-path stops drops from a network round-trip to a frame.
 *
 * Positional switching for Compare: `startAt` begins a take mid-stream, so
 * flipping Chorus A → Chorus B lands on the SAME bar instead of restarting —
 * the tap-tap-tap rhythm of real take-picking.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a canvas card id to a playable voice-memo id.
 * DB-hydrated cards are `db-voice-<memoId>`; freshly flushed uploads carry the
 * raw memo uuid. Mock/local ids (no backing audio) resolve to null.
 */
export function memoIdForCard(cardId: string): string | null {
  if (cardId.startsWith("db-voice-")) {
    const id = cardId.slice("db-voice-".length);
    return UUID_RE.test(id) ? id : null;
  }
  return UUID_RE.test(cardId) ? cardId : null;
}

const URL_TTL_MS = 4 * 60 * 1000;
const urlCache = new Map<string, { url: string; fetchedAt: number }>();

async function resolveUrl(memoId: string): Promise<string> {
  const cached = urlCache.get(memoId);
  if (cached && Date.now() - cached.fetchedAt < URL_TTL_MS) return cached.url;
  const url = await getPlaybackUrl(memoId);
  urlCache.set(memoId, { url, fetchedAt: Date.now() });
  return url;
}

/**
 * Tapping a card's play button: if that card is the one already auditioning,
 * stop it (a play button that can't pause is half a control); otherwise play it
 * — which, through this singleton, silences whatever else was sounding.
 */
export function soloPlayAction(tappedId: string, currentSoloId: string | null): "stop" | "play" {
  return currentSoloId === tappedId ? "stop" : "play";
}

let active: HTMLAudioElement | null = null;
let spare: HTMLAudioElement | null = null;
/** What the spare element is primed with (null = cold). */
let spareMemoId: string | null = null;
let currentMemoId: string | null = null;
let playToken = 0;

function makeEl(): HTMLAudioElement {
  const el = new Audio();
  el.preload = "auto";
  return el;
}

function activeEl(): HTMLAudioElement {
  if (!active) active = makeEl();
  return active;
}

function spareEl(): HTMLAudioElement {
  if (!spare) spare = makeEl();
  return spare;
}

function clearHandlers(el: HTMLAudioElement) {
  el.onended = null;
  el.onerror = null;
}

/** Hard stop: silence + drop the current source. Invalidates in-flight plays. */
export function stopCanvasAudio(): void {
  playToken++;
  currentMemoId = null;
  if (active) {
    clearHandlers(active);
    active.pause();
    active.removeAttribute("src");
  }
}

/** Pause without dropping the source. Invalidates in-flight plays. */
export function pauseCanvasAudio(): void {
  playToken++;
  active?.pause();
}

/** What is sounding (or paused mid-take) right now — Compare's same-playhead
 *  switch reads the position here before flipping sides. */
export function getCanvasPlayback(): { memoId: string | null; position: number } {
  return {
    memoId: currentMemoId,
    position: active && Number.isFinite(active.currentTime) ? active.currentTime : 0,
  };
}

export interface CanvasPlayHandlers {
  onEnded?: () => void;
  onError?: () => void;
  /** Begin this many seconds in (Compare's same-bar switch). */
  startAt?: number;
}

/**
 * Fully prime the NEXT take on the spare element (URL + buffering) while the
 * current one sounds — the gapless seam. Fire-and-forget.
 */
export async function preloadMemo(memoId: string): Promise<void> {
  try {
    const url = await resolveUrl(memoId);
    const el = spareEl();
    if (spareMemoId === memoId && el.src) return; // already primed
    clearHandlers(el);
    el.src = url;
    el.load();
    spareMemoId = memoId;
  } catch {
    // Preload is best-effort; playback will fetch on demand.
  }
}

/**
 * Play a memo through the shared voice. Any previous canvas playback stops
 * first. Resumes mid-take when the same memo is merely paused (no startAt);
 * swaps to the primed spare element when the memo was preloaded (gapless).
 * Resolves true if this request is still the active one after start.
 */
export async function playMemoOnCanvas(
  memoId: string,
  handlers: CanvasPlayHandlers = {},
): Promise<boolean> {
  const token = ++playToken;

  // RESUME, don't restart: same memo, merely paused mid-take, no explicit seek.
  const el0 = activeEl();
  if (
    handlers.startAt == null &&
    currentMemoId === memoId &&
    el0.src &&
    !el0.ended &&
    el0.currentTime > 0
  ) {
    el0.onended = () => { if (token === playToken) handlers.onEnded?.(); };
    el0.onerror = () => { if (token === playToken) handlers.onError?.(); };
    try {
      await el0.play();
      return token === playToken;
    } catch {
      if (token === playToken) handlers.onError?.();
      return false;
    }
  }

  // GAPLESS swap: the spare was primed with exactly this memo.
  if (spareMemoId === memoId && spare?.src) {
    const old = activeEl();
    clearHandlers(old);
    old.pause();
    const next = spare;
    spare = old;
    spareMemoId = null;
    old.removeAttribute("src");
    active = next;
    currentMemoId = memoId;
    if (handlers.startAt != null) {
      try { next.currentTime = handlers.startAt; } catch { /* not seekable yet */ }
    }
    next.onended = () => { if (token === playToken) handlers.onEnded?.(); };
    next.onerror = () => { if (token === playToken) handlers.onError?.(); };
    try {
      await next.play();
      return token === playToken;
    } catch {
      if (token === playToken) handlers.onError?.();
      return false;
    }
  }

  // Cold start: fetch + load on the active element.
  const audio = activeEl();
  clearHandlers(audio);
  audio.pause();
  try {
    const url = await resolveUrl(memoId);
    if (token !== playToken) return false;
    audio.src = url;
    currentMemoId = memoId;
    if (handlers.startAt != null) {
      const at = handlers.startAt;
      const seek = () => {
        try { audio.currentTime = at; } catch { /* best effort */ }
      };
      if (audio.readyState >= 1) seek();
      else audio.addEventListener("loadedmetadata", seek, { once: true });
    }
    audio.onended = () => {
      if (token === playToken) handlers.onEnded?.();
    };
    audio.onerror = () => {
      if (token === playToken) handlers.onError?.();
    };
    await audio.play();
    return token === playToken;
  } catch {
    if (token === playToken) handlers.onError?.();
    return false;
  }
}
