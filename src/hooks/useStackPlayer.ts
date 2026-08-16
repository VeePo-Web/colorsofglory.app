import { useCallback, useEffect, useRef, useState } from "react";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { resolveMix, clampLayerGain } from "@/lib/voice/stackModel";
import { getAlignmentOffsetMs } from "@/lib/audio/alignmentStore";
import { memoKey } from "@/lib/canvas/features/canvasAudio";

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
  /** NOTHING resolved (offline, every URL failed) — Play must say so and
   *  stay honest, never flip to a Pause button over silence. */
  unavailable: boolean;
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
    unavailable: false,
    muted: EMPTY_MUTED,
    soloId: null,
    gains: {},
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  // ONE offset truth per layer. The measured guide latency lives in TWO
  // stores (the device alignmentStore AND the server's layer_offset_ms) —
  // they are the SAME measurement, so summing them double-shifted a layer by
  // exactly its latency the moment both were readable. max() takes whichever
  // side this session can see; memoKey reads the device store consistently
  // from either card-id space.
  const headOffsetS = useCallback((id: string): number => {
    const align = getAlignmentOffsetMs(memoKey(id));
    const server = optsRef.current.serverOffsets?.[id] ?? 0;
    return Math.max(0, Math.max(align, server) / 1000);
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

  // Ids the USER touched this session (by memoKey, so a rename can't forget
  // them) — persisted seeds must never overwrite a hand the writer just set.
  const touchedRef = useRef<Set<string>>(new Set());
  // Late resume after a mid-listen membership change (assigned below, after
  // prepare/playPause exist).
  const resumeRef = useRef<() => void>(() => {});

  // Membership changes DIFF, never nuke. A wholesale reset used to (a) wipe
  // the writer's just-set mix and hard-stop audio when their own upload flush
  // renamed the temp id, and (b) cut a listening session to silence the
  // moment a co-writer's layer arrived. Surviving ids (matched via memoKey)
  // carry the mixer across; new ids seed from the persisted room mix; and if
  // the ear was mid-song, playback resumes from the same position.
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevIdsRef.current;
    prevIdsRef.current = playIds;
    const s = stateRef.current;
    const wasPlaying = s.isPlaying;
    // Where the ear was, BEFORE teardown (web-audio clock or element time).
    let resumePos = 0;
    if (wasPlaying) {
      if (ctxRef.current && layersRef.current.size > 0) {
        resumePos = Math.max(0, ctxRef.current.currentTime - startedAtRef.current);
      } else {
        const el = elementsRef.current.get(prev[0]) ?? [...elementsRef.current.values()][0];
        resumePos = el ? Math.max(0, el.currentTime) : 0;
      }
    }
    releaseAll();
    freshStartRef.current = true;
    // A fresh membership earns a fresh shot at the Web Audio engine — one
    // transient decode failure used to pin this hook instance to the
    // drift-prone element rung for its whole lifetime.
    webAudioOk.current = true;

    const prevByKey = new Map(prev.map((id) => [memoKey(id), id]));
    const muted = new Set<string>();
    const gains: Record<string, number> = {};
    let soloId: string | null = null;
    for (const id of playIds) {
      const old = prevByKey.get(memoKey(id));
      if (old !== undefined) {
        if (s.muted.has(old)) muted.add(id);
        if (s.gains[old] !== undefined) gains[id] = s.gains[old];
        if (s.soloId === old) soloId = id;
      } else {
        if (optsRef.current.initialMuted?.includes(id)) muted.add(id);
        const g = optsRef.current.initialGains?.[id];
        if (g !== undefined) gains[id] = g;
      }
    }
    setState({
      isPlaying: false,
      progress: 0,
      loading: false,
      unavailable: false,
      muted: muted.size ? muted : EMPTY_MUTED,
      soloId,
      gains,
    });

    let resumeTimer = 0;
    if (wasPlaying && playIds.length > 0) {
      pausedPosRef.current = resumePos;
      freshStartRef.current = false;
      // After the state commit (stateRef must read isPlaying:false), pick the
      // song back up where the ear left it.
      resumeTimer = window.setTimeout(() => resumeRef.current(), 60);
    }
    return () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      releaseAll();
    };
  }, [idsKey, releaseAll]);

  // Unmount-only: give the AudioContext back to the OS. iOS caps live
  // contexts per page (~4) — a sheet opened and closed a few times used to
  // strand one context per mount until the whole page's audio went silent.
  // Membership changes deliberately KEEP the context (churning it would cost
  // a decode + user-gesture resume per change); prepare() already recreates
  // a closed one.
  useEffect(
    () => () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    },
    [],
  );

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
          // THE SEAM: hydrated cards are `db-voice-<uuid>` but the cache and
          // the signed-URL fn speak raw memo ids — unresolved, a hydrated
          // stack was completely SILENT (each miss swallowed by this catch).
          // The mixer stays keyed by the ORIGINAL id.
          const audioId = memoKey(id);
          let blob = await audioCache.get(audioId);
          if (!blob) {
            const url = await getSignedUrl(audioId);
            if (!url) throw new Error("no-playback-url");
            blob = await (await fetch(url)).blob();
            await audioCache.set(audioId, blob).catch(() => {});
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
          const blob = await audioCache.get(memoKey(id));
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

    // Transport wiring on the fallback rung (progress + end) — driven by the
    // first element that actually LOADED, not strictly playIds[0]: if the base
    // failed to resolve while layers succeeded, wiring only the base left
    // progress frozen at 0 and isPlaying stuck true forever.
    const driver =
      elementsRef.current.get(playIds[0]) ??
      playIds.map((id) => elementsRef.current.get(id)).find(Boolean);
    if (driver) {
      driver.ontimeupdate = () => {
        setState((s) => ({ ...s, progress: driver.currentTime / (driver.duration || 1) }));
      };
      driver.onended = () => {
        // The transport says stopped — so EVERYTHING stops. A layer that
        // outlasts the driver kept sounding behind a "stopped" UI, and the
        // next Play restarted the driver on top of it.
        elementsRef.current.forEach((el) => el.pause());
        freshStartRef.current = true;
        setState((s) => ({ ...s, isPlaying: false, progress: 0 }));
      };
    }

    // Honesty gate (P1-5): if NOTHING resolved (offline, every URL refused),
    // Play must say so — flipping to a Pause button over silence was a lie.
    const resolvedCount = layersRef.current.size + elementsRef.current.size;
    setState((s) => {
      applyMix(s.muted, s.soloId, s.gains);
      return { ...s, loading: false, unavailable: resolvedCount === 0 };
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
        // Offset read at SCHEDULE time, not decode time — a server
        // layer_offset_ms arriving after prepare (the room-mix refresh) must
        // shape the very next play, not the next sheet open.
        const offsetIntoBuffer = headOffsetS(id) + fromS;
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
    [playIds, stackDuration, stopSources, headOffsetS],
  );

  /** Toggle group playback. MUST be called from a user gesture (iOS). */
  const playPause = useCallback(() => {
    const s = stateRef.current;
    if (s.unavailable) return; // nothing resolved — the button is honest, not a toggle
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
          const offsetMs = headOffsetS(id) * 1000;
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
      touchedRef.current.add(memoKey(id)); // the writer's hand beats the seed
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
      touchedRef.current.add(memoKey(id)); // the writer's hand beats the seed
      setState((s) => {
        const gains = { ...s.gains, [id]: clampLayerGain(gain) };
        applyMix(s.muted, s.soloId, gains);
        return { ...s, gains };
      });
    },
    [applyMix],
  );

  // THE ROOM MIX REACHES THE EARS: persisted gain/mute seeds used to be
  // write-only past mount — a collaborator's mix landed in the UI (the slider
  // showed 0.3) while playback lied at 1.0. When seeds change under the SAME
  // membership (the sheet's server refresh), merge them for every id the
  // writer hasn't personally touched this session.
  const seedsKey = JSON.stringify([opts.initialGains ?? null, opts.initialMuted ?? null]);
  useEffect(() => {
    setState((s) => {
      let changed = false;
      const gains = { ...s.gains };
      const muted = new Set(s.muted);
      for (const id of playIds) {
        if (touchedRef.current.has(memoKey(id))) continue;
        const g = optsRef.current.initialGains?.[id];
        if (g !== undefined && gains[id] !== g) {
          gains[id] = g;
          changed = true;
        }
        const m = optsRef.current.initialMuted?.includes(id) ?? false;
        if (m !== muted.has(id)) {
          if (m) muted.add(id);
          else muted.delete(id);
          changed = true;
        }
      }
      if (!changed) return s;
      applyMix(muted, s.soloId, gains);
      return { ...s, gains, muted };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedsKey, applyMix]);

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
        // Same single-truth offset as the fresh start (headOffsetS).
        if (Number.isFinite(target)) el.currentTime = target + headOffsetS(id);
      });
      freshStartRef.current = false;
      setState((s) => ({ ...s, progress: pct }));
    },
    [playIds, scheduleWebAudio, stackDuration, stopSources],
  );

  // The mid-listen resume (membership changed while playing): re-resolve the
  // new membership's audio, then pick up from the held position. Assigned
  // here so the membership effect (defined earlier) can reach forward.
  resumeRef.current = () => {
    void prepare().then(() => {
      if (!stateRef.current.isPlaying) playPause();
    });
  };

  return { state, prepare, playPause, stop, toggleMute, toggleSolo, setGain, seek };
}
