import { useCallback, useEffect, useRef, useState } from "react";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { resolveMix, clampLayerGain } from "@/lib/voice/stackModel";
import { getAlignmentOffsetMs } from "@/lib/audio/alignmentStore";

/**
 * useStackPlayer — synchronized playback of a layered voice-memo stack.
 *
 * v2 (docs/features/VOICE-MEMO-STACKING-RESEARCH.md §5, decision 2): layers
 * are scheduled on ONE shared Web Audio clock — every audible layer is
 * decoded to an AudioBuffer and started in the same `ctx.currentTime`
 * tick, so a 3-layer 60s stack stays in time instead of accumulating the
 * drift that multiple <audio> elements do. Each layer runs through its own
 * GainNode, giving the quick mixer (volume + mute + solo — the ENTIRE
 * mixing surface) live, click-free ramps mid-playback.
 *
 * The SAFETY LADDER (never worse than before): if Web Audio is missing or
 * any decode fails, the engine falls back to the original multi-<audio>
 * scheme — same interface, everything still plays. Progress comes from the
 * context clock (or the base element on the fallback rung).
 *
 * Contract:
 *  - `prepare()` resolves + decodes ahead of time (call when the stack
 *    opens) so `playPause()` starts instantly inside a tap.
 *  - Mute/solo/gain resolve through the pure resolveMix() — solo wins.
 *  - `setGain(id, v)` ramps live; persistence is the CALLER's concern
 *    (MemoStack debounces to the seam) — the engine only sounds.
 *  - Per-layer start offsets: alignment (device store) + layer_offset_ms
 *    (server) both mean "start this far INTO the layer's audio."
 */

export interface StackPlayerState {
  isPlaying: boolean;
  /** 0–1, tracked from the shared clock (or the base element on fallback). */
  progress: number;
  loading: boolean;
  muted: Set<string>;
  soloId: string | null;
  /** Live per-id gain targets (persisted values seeded by the caller). */
  gains: Record<string, number>;
}

const EMPTY_MUTED: Set<string> = new Set();
/** Gain ramp time — long enough to never click, short enough to feel live. */
const RAMP_S = 0.03;

type WebAudioLayer = {
  id: string;
  buffer: AudioBuffer;
  gainNode: GainNode | null;
  source: AudioBufferSourceNode | null;
  /** Start this many seconds INTO the layer's audio (alignment + latency). */
  headOffsetS: number;
};

export function useStackPlayer(
  playIds: string[],
  opts: {
    /** Persisted per-layer gains (layer_gain) to seed the mixer. */
    initialGains?: Record<string, number>;
    /** Persisted per-layer mutes (layer_muted) to seed the mixer. */
    initialMuted?: string[];
    /** Persisted record-latency offsets (layer_offset_ms) per id. */
    serverOffsets?: Record<string, number>;
  } = {},
) {
  // ── Web Audio path ────────────────────────────────────────────────────
  const ctxRef = useRef<AudioContext | null>(null);
  const layersRef = useRef<Map<string, WebAudioLayer>>(new Map());
  const startedAtRef = useRef(0); // ctx.currentTime when playback started
  const pausedPosRef = useRef(0); // seconds into the stack while paused
  const progressRaf = useRef(0);
  const webAudioOk = useRef(true);

  // ── Fallback path (the original multi-<audio> engine) ─────────────────
  const elementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);

  const preparedRef = useRef(false);
  const freshStartRef = useRef(true);
  const idsKey = playIds.join("|");
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [state, setState] = useState<StackPlayerState>({
    isPlaying: false,
    progress: 0,
    loading: false,
    muted: EMPTY_MUTED,
    soloId: null,
    gains: {},
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const headOffsetS = useCallback((id: string): number => {
    const align = getAlignmentOffsetMs(id);
    const server = optsRef.current.serverOffsets?.[id] ?? 0;
    return Math.max(0, (align + server) / 1000);
  }, []);

  const stopSources = useCallback(() => {
    layersRef.current.forEach((l) => {
      try {
        l.source?.stop();
      } catch {
        /* already stopped */
      }
      l.source = null;
    });
    if (progressRaf.current) {
      cancelAnimationFrame(progressRaf.current);
      progressRaf.current = 0;
    }
  }, []);

  const releaseAll = useCallback(() => {
    stopSources();
    layersRef.current.clear();
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
    pausedPosRef.current = 0;
  }, [stopSources]);

  // Reset whenever the stack's membership changes; release on unmount.
  useEffect(() => {
    releaseAll();
    freshStartRef.current = true;
    setState({
      isPlaying: false,
      progress: 0,
      loading: false,
      muted: optsRef.current.initialMuted?.length
        ? new Set(optsRef.current.initialMuted)
        : EMPTY_MUTED,
      soloId: null,
      gains: optsRef.current.initialGains ?? {},
    });
    return releaseAll;
  }, [idsKey, releaseAll]);

  /** Total stack length in seconds (the longest layer incl. its head offset). */
  const stackDuration = useCallback((): number => {
    let d = 0;
    layersRef.current.forEach((l) => {
      d = Math.max(d, l.buffer.duration - l.headOffsetS);
    });
    return d || 1;
  }, []);

  /** Apply resolveMix to the live GainNodes (ramped — never a click). */
  const applyMix = useCallback(
    (muted: Set<string>, soloId: string | null, gains: Record<string, number>) => {
      const mix = resolveMix(playIds, gains, muted, soloId);
      const ctx = ctxRef.current;
      layersRef.current.forEach((l, id) => {
        if (l.gainNode && ctx) {
          l.gainNode.gain.setTargetAtTime(mix[id] ?? 1, ctx.currentTime, RAMP_S);
        }
      });
      // Fallback rung: element mute (no per-element gain ramps — the
      // original behavior, unchanged).
      elementsRef.current.forEach((el, id) => {
        el.muted = (mix[id] ?? 0) === 0;
        el.volume = Math.min(1, mix[id] ?? 1);
      });
    },
    [playIds],
  );

  const prepare = useCallback(async () => {
    if (preparedRef.current || playIds.length === 0) return;
    preparedRef.current = true;
    setState((s) => ({ ...s, loading: true }));

    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;

    await Promise.all(
      playIds.map(async (id) => {
        try {
          let blob = await audioCache.get(id);
          if (!blob) {
            const url = await getSignedUrl(id);
            blob = await (await fetch(url)).blob();
            await audioCache.set(id, blob).catch(() => {});
          }
          // Web Audio first: decode onto the shared clock.
          if (Ctor && webAudioOk.current) {
            try {
              if (!ctxRef.current || ctxRef.current.state === "closed") {
                ctxRef.current = new Ctor();
              }
              const buf = await ctxRef.current.decodeAudioData(await blob.arrayBuffer());
              layersRef.current.set(id, {
                id,
                buffer: buf,
                gainNode: null,
                source: null,
                headOffsetS: headOffsetS(id),
              });
              return;
            } catch {
              /* decode failed → this id (and the stack) uses the fallback */
            }
          }
          // Fallback rung: the original element scheme.
          webAudioOk.current = false;
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          const el = new Audio();
          el.preload = "auto";
          el.src = url;
          elementsRef.current.set(id, el);
        } catch {
          // A missing layer must not break the rest of the stack.
        }
      }),
    );

    // If ANY layer had to fall back, move them ALL to elements — a split
    // engine can't stay in sync. (Buffers already decoded just re-render
    // as elements from the cache.)
    if (!webAudioOk.current && layersRef.current.size > 0) {
      for (const [id] of layersRef.current) {
        if (elementsRef.current.has(id)) continue;
        try {
          const blob = await audioCache.get(id);
          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          const el = new Audio();
          el.preload = "auto";
          el.src = url;
          elementsRef.current.set(id, el);
        } catch {
          /* keep going */
        }
      }
      layersRef.current.clear();
    }

    // Base element wiring on the fallback rung (progress + end).
    const base = elementsRef.current.get(playIds[0]);
    if (base) {
      base.ontimeupdate = () => {
        setState((s) => ({ ...s, progress: base.currentTime / (base.duration || 1) }));
      };
      base.onended = () => {
        freshStartRef.current = true;
        setState((s) => ({ ...s, isPlaying: false, progress: 0 }));
      };
    }

    setState((s) => {
      applyMix(s.muted, s.soloId, s.gains);
      return { ...s, loading: false };
    });
  }, [idsKey, applyMix, headOffsetS]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Schedule every audible layer in ONE clock tick from `fromS` seconds. */
  const scheduleWebAudio = useCallback(
    (fromS: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const startAt = ctx.currentTime + 0.06; // one shared "when" for all
      const s = stateRef.current;
      const mix = resolveMix(playIds, s.gains, s.muted, s.soloId);
      layersRef.current.forEach((l, id) => {
        const offsetIntoBuffer = l.headOffsetS + fromS;
        if (offsetIntoBuffer >= l.buffer.duration) return; // layer already over
        const source = ctx.createBufferSource();
        source.buffer = l.buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = mix[id] ?? 1;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(startAt, offsetIntoBuffer);
        l.source = source;
        l.gainNode = gainNode;
      });
      startedAtRef.current = startAt - fromS;

      const dur = stackDuration();
      const tick = () => {
        const pos = ctx.currentTime - startedAtRef.current;
        if (pos >= dur) {
          stopSources();
          freshStartRef.current = true;
          pausedPosRef.current = 0;
          setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
          return;
        }
        setState((prev) => ({ ...prev, progress: Math.max(0, pos) / dur }));
        progressRaf.current = requestAnimationFrame(tick);
      };
      progressRaf.current = requestAnimationFrame(tick);
    },
    [playIds, stackDuration, stopSources],
  );

  /** Toggle group playback. MUST be called from a user gesture (iOS). */
  const playPause = useCallback(() => {
    const s = stateRef.current;
    if (s.isPlaying) {
      if (ctxRef.current && layersRef.current.size > 0) {
        pausedPosRef.current = ctxRef.current.currentTime - startedAtRef.current;
        stopSources();
      } else {
        elementsRef.current.forEach((el) => el.pause());
      }
      setState((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    if (ctxRef.current && layersRef.current.size > 0) {
      void ctxRef.current.resume().catch(() => {});
      const fromS = freshStartRef.current ? 0 : pausedPosRef.current;
      freshStartRef.current = false;
      scheduleWebAudio(fromS);
    } else {
      // Fallback rung — the original element start (alignment via seek).
      if (freshStartRef.current) {
        elementsRef.current.forEach((el, id) => {
          const offsetMs = getAlignmentOffsetMs(id) + (optsRef.current.serverOffsets?.[id] ?? 0);
          if (offsetMs > 0) el.currentTime = offsetMs / 1000;
        });
        freshStartRef.current = false;
      }
      elementsRef.current.forEach((el) => {
        void el.play().catch(() => {});
      });
    }
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, [scheduleWebAudio, stopSources]);

  const stop = useCallback(() => {
    stopSources();
    elementsRef.current.forEach((el) => {
      el.pause();
      el.currentTime = 0;
    });
    freshStartRef.current = true;
    pausedPosRef.current = 0;
    setState((s) => ({ ...s, isPlaying: false, progress: 0 }));
  }, [stopSources]);

  const toggleMute = useCallback(
    (id: string) => {
      setState((s) => {
        const muted = new Set(s.muted);
        if (muted.has(id)) muted.delete(id);
        else muted.add(id);
        applyMix(muted, s.soloId, s.gains);
        return { ...s, muted };
      });
    },
    [applyMix],
  );

  const toggleSolo = useCallback(
    (id: string) => {
      setState((s) => {
        const soloId = s.soloId === id ? null : id;
        applyMix(s.muted, soloId, s.gains);
        return { ...s, soloId };
      });
    },
    [applyMix],
  );

  /** Live per-layer volume — ramped, never interrupts playback. */
  const setGain = useCallback(
    (id: string, gain: number) => {
      setState((s) => {
        const gains = { ...s.gains, [id]: clampLayerGain(gain) };
        applyMix(s.muted, s.soloId, gains);
        return { ...s, gains };
      });
    },
    [applyMix],
  );

  const seek = useCallback(
    (pct: number) => {
      if (ctxRef.current && layersRef.current.size > 0) {
        const target = stackDuration() * Math.min(1, Math.max(0, pct));
        const wasPlaying = stateRef.current.isPlaying;
        stopSources();
        pausedPosRef.current = target;
        freshStartRef.current = false;
        if (wasPlaying) scheduleWebAudio(target);
        setState((s) => ({ ...s, progress: pct }));
        return;
      }
      const base = elementsRef.current.get(playIds[0]);
      const target = (base?.duration || 0) * pct;
      elementsRef.current.forEach((el, id) => {
        if (Number.isFinite(target)) el.currentTime = target + getAlignmentOffsetMs(id) / 1000;
      });
      freshStartRef.current = false;
      setState((s) => ({ ...s, progress: pct }));
    },
    [playIds, scheduleWebAudio, stackDuration, stopSources],
  );

  return { state, prepare, playPause, stop, toggleMute, toggleSolo, setGain, seek };
}
