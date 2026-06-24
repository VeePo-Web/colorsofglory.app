import { useCallback, useEffect, useRef, useState } from "react";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { resolveAudible } from "@/lib/voice/stackModel";

/**
 * useStackPlayer — synchronized playback of a layered voice-memo stack.
 *
 * The single-track useAudioPlayer cannot play a base memo and its harmony
 * layers together, so a stack needs its own engine. This hook loads N memos,
 * starts them in the same tick (so iOS lets the gesture-initiated playback
 * begin), and lets the songwriter mute/solo individual layers live — the
 * essence of "I like that idea, here's mine on top."
 *
 * Contract:
 *  - `prepare()` resolves audio for every id ahead of time (call when the stack
 *    opens) so `playPause()` can start instantly from inside a tap.
 *  - Solo/mute resolve through the pure resolveAudible() — base is index 0.
 *  - Elements + object URLs are released on unmount/id change to spare
 *    decoders on low-end devices.
 */
export interface StackPlayerState {
  isPlaying: boolean;
  /** 0–1, tracked from the base (first) layer. */
  progress: number;
  loading: boolean;
  muted: Set<string>;
  soloId: string | null;
}

const EMPTY_MUTED: Set<string> = new Set();

export function useStackPlayer(playIds: string[]) {
  const elementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);
  const preparedRef = useRef(false);
  const idsKey = playIds.join("|");

  const [state, setState] = useState<StackPlayerState>({
    isPlaying: false,
    progress: 0,
    loading: false,
    muted: EMPTY_MUTED,
    soloId: null,
  });

  const releaseAll = useCallback(() => {
    elementsRef.current.forEach((el) => {
      el.pause();
      el.src = "";
      el.ontimeupdate = null;
      el.onended = null;
    });
    elementsRef.current.clear();
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
    preparedRef.current = false;
  }, []);

  // Reset whenever the stack's membership changes; release on unmount.
  useEffect(() => {
    releaseAll();
    setState({ isPlaying: false, progress: 0, loading: false, muted: EMPTY_MUTED, soloId: null });
    return releaseAll;
  }, [idsKey, releaseAll]);

  /** Apply current mute/solo to every live element. Cheap; safe to call often. */
  const applyAudible = useCallback((muted: Set<string>, soloId: string | null) => {
    const audible = resolveAudible(playIds, muted, soloId);
    elementsRef.current.forEach((el, id) => {
      el.muted = !audible.has(id);
    });
  }, [playIds]);

  const stopInternal = useCallback(() => {
    elementsRef.current.forEach((el) => {
      el.pause();
      el.currentTime = 0;
    });
    setState((s) => ({ ...s, isPlaying: false, progress: 0 }));
  }, []);

  const prepare = useCallback(async () => {
    if (preparedRef.current || playIds.length === 0) return;
    preparedRef.current = true;
    setState((s) => ({ ...s, loading: true }));
    const base = playIds[0];

    await Promise.all(
      playIds.map(async (id) => {
        try {
          let url: string;
          const cached = await audioCache.get(id);
          if (cached) {
            url = URL.createObjectURL(cached);
            objectUrlsRef.current.push(url);
          } else {
            url = await getSignedUrl(id);
            audioCache.prefetch(id, url); // warm cache for next time
          }
          const el = new Audio();
          el.preload = "auto";
          el.src = url;
          if (id === base) {
            el.ontimeupdate = () => {
              setState((s) => ({ ...s, progress: el.currentTime / (el.duration || 1) }));
            };
            el.onended = () => stopInternal();
          }
          elementsRef.current.set(id, el);
        } catch {
          // A missing layer must not break the rest of the stack.
        }
      }),
    );

    setState((s) => {
      applyAudible(s.muted, s.soloId);
      return { ...s, loading: false };
    });
  }, [idsKey, applyAudible]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Toggle group playback. MUST be called from a user gesture (iOS autoplay). */
  const playPause = useCallback(() => {
    if (state.isPlaying) {
      elementsRef.current.forEach((el) => el.pause());
      setState((s) => ({ ...s, isPlaying: false }));
      return;
    }
    // Start every element in the same tick so the gesture activation covers all.
    elementsRef.current.forEach((el) => {
      void el.play().catch(() => {});
    });
    setState((s) => ({ ...s, isPlaying: true }));
  }, [state.isPlaying]);

  const stop = useCallback(() => stopInternal(), [stopInternal]);

  const toggleMute = useCallback((id: string) => {
    setState((s) => {
      const muted = new Set(s.muted);
      if (muted.has(id)) muted.delete(id);
      else muted.add(id);
      applyAudible(muted, s.soloId);
      return { ...s, muted };
    });
  }, [applyAudible]);

  const toggleSolo = useCallback((id: string) => {
    setState((s) => {
      const soloId = s.soloId === id ? null : id;
      applyAudible(s.muted, soloId);
      return { ...s, soloId };
    });
  }, [applyAudible]);

  const seek = useCallback((pct: number) => {
    const base = elementsRef.current.get(playIds[0]);
    const target = (base?.duration || 0) * pct;
    elementsRef.current.forEach((el) => {
      if (Number.isFinite(target)) el.currentTime = target;
    });
    setState((s) => ({ ...s, progress: pct }));
  }, [playIds]);

  return { state, prepare, playPause, stop, toggleMute, toggleSolo, seek };
}
