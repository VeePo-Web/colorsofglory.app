import { getPlaybackUrl } from "@/integrations/cog/memos";

/**
 * canvasAudio — the ONE audio element for canvas feature playback.
 *
 * Listen Path (F20) and Compare Mode (F21) both audition takes through this
 * singleton, so starting one always silences the other and nothing on the
 * canvas can double-play. Signed URLs are short-lived; they're cached briefly
 * and re-fetched past the TTL.
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

let el: HTMLAudioElement | null = null;
let playToken = 0;
let currentMemoId: string | null = null;

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
  }
  return el;
}

/** Hard stop: silence + drop the current source. Invalidates in-flight plays. */
export function stopCanvasAudio(): void {
  playToken++;
  currentMemoId = null;
  if (el) {
    el.pause();
    el.removeAttribute("src");
  }
}

/** Pause without dropping the source. Invalidates in-flight plays. */
export function pauseCanvasAudio(): void {
  playToken++;
  el?.pause();
}

export interface CanvasPlayHandlers {
  onEnded?: () => void;
  onError?: () => void;
}

/**
 * Warm the signed-URL cache for a memo BEFORE it's needed — the biggest gap
 * between listen-path tracks is the URL round-trip on advance. Fire-and-forget.
 */
export async function preloadMemo(memoId: string): Promise<void> {
  const cached = urlCache.get(memoId);
  if (cached && Date.now() - cached.fetchedAt < URL_TTL_MS) return;
  try {
    const url = await getPlaybackUrl(memoId);
    urlCache.set(memoId, { url, fetchedAt: Date.now() });
  } catch {
    // Preload is best-effort; playback will fetch on demand.
  }
}

/**
 * Play a memo through the shared element. Any previous canvas playback stops
 * first. Resolves true if this request is still the active one after start.
 */
export async function playMemoOnCanvas(
  memoId: string,
  handlers: CanvasPlayHandlers = {},
): Promise<boolean> {
  const token = ++playToken;
  const audio = element();
  // RESUME, don't restart: if this memo is already loaded and merely paused
  // mid-take, continue from where it stopped — every pause→play used to yank
  // the take back to 0:00.
  if (currentMemoId === memoId && audio.src && !audio.ended && audio.currentTime > 0) {
    audio.onended = () => { if (token === playToken) handlers.onEnded?.(); };
    audio.onerror = () => { if (token === playToken) handlers.onError?.(); };
    try {
      await audio.play();
      return token === playToken;
    } catch {
      if (token === playToken) handlers.onError?.();
      return false;
    }
  }
  audio.pause();
  try {
    let url: string;
    const cached = urlCache.get(memoId);
    if (cached && Date.now() - cached.fetchedAt < URL_TTL_MS) {
      url = cached.url;
    } else {
      url = await getPlaybackUrl(memoId);
      urlCache.set(memoId, { url, fetchedAt: Date.now() });
    }
    if (token !== playToken) return false;
    audio.src = url;
    currentMemoId = memoId;
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
