import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { resolveMix, clampLayerGain } from "@/lib/voice/stackModel";
import { getAlignmentOffsetMs } from "@/lib/audio/alignmentStore";
import { memoKey } from "@/lib/canvas/features/canvasAudio";
import {
  buildSingItTimeline,
  partWindowFrom,
  sectionIndexAtMs,
  type SingItTimeline,
} from "@/lib/practice/singItEngine";
import { loadSingItMix, saveSingItMix } from "@/lib/practice/singItMix";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

/**
 * useSingItPlayer — the Practice Room's engine: the WHOLE song, every voice,
 * one continuous timeline on ONE shared Web Audio clock.
 *
 * The architecture is useStackPlayer's, generalized from "one stack" to "a
 * section-ordered list of stacks": every part (each section's base + its
 * layers) decodes to an AudioBuffer on one AudioContext; play() schedules
 * each part at its section's timeline offset in the same `ctx.currentTime`
 * tick — gapless by construction. Each part runs through its own GainNode
 * (the Parts mixer: live 30ms ramps, never a click). Sources hard-stop at
 * their section boundary, so a long harmony tail never double-voices the
 * next section.
 *
 * Reliability covenants:
 *  - Cache-first (audioCache) with resp.ok-guarded fetch — never poisons.
 *  - A part that fails to resolve is a HOLE, never a wall: the song plays on
 *    without it, and `unavailable` names it for honest UI.
 *  - Parts that finish decoding while the song is already playing join
 *    mid-flight at their exact spot.
 *  - No Web Audio (or a base decode failure) → the honest fallback rung:
 *    bases play sequentially through one <audio> element; `basesOnly` tells
 *    the surface to say so in human words.
 *  - visibility hidden ⇒ pause in place; resume is one tap (Flow invariant).
 *  - ONE AudioContext for the whole session (iOS caps ~4 per page).
 */

export interface SingItPlayerHandle {
  timeline: SingItTimeline;
  status: "loading" | "ready" | "playing" | "paused" | "ended";
  positionMs: number;
  sectionIndex: number;
  gains: Record<string, number>;
  muted: Set<string>;
  /** Parts that could not be resolved (offline/cold cache). */
  unavailable: Set<string>;
  /** True when NOTHING resolved — Play must say so, never pause over silence. */
  nothingPlayable: boolean;
  /** True on the element fallback rung — layers are silent, narrate it. */
  basesOnly: boolean;
  playPause: () => void;
  seekMs: (ms: number) => void;
  setGain: (memoId: string, gain: number) => void;
  toggleMute: (memoId: string) => void;
}

const RAMP_S = 0.03;

type PartAudio = {
  buffer: AudioBuffer | null;
  gainNode: GainNode | null;
  source: AudioBufferSourceNode | null;
  failed: boolean;
};

export function useSingItPlayer(
  sections: PracticeSection[],
  songId: string,
): SingItPlayerHandle {
  const timeline = useMemo(() => buildSingItTimeline(sections), [sections]);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const ctxRef = useRef<AudioContext | null>(null);
  const partsRef = useRef<Map<string, PartAudio>>(new Map());
  const startedAtRef = useRef(0); // ctx seconds at song position 0
  const pausedPosMsRef = useRef(0);
  const rafRef = useRef(0);
  const webAudioOk = useRef(true);

  // Fallback rung: ONE element, bases in sequence.
  const fallbackElRef = useRef<HTMLAudioElement | null>(null);
  const fallbackUrlsRef = useRef<Map<string, string>>(new Map());
  const fallbackSectionRef = useRef(0);

  const [status, setStatus] = useState<SingItPlayerHandle["status"]>("loading");
  const [positionMs, setPositionMs] = useState(0);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [basesOnly, setBasesOnly] = useState(false);
  const [nothingPlayable, setNothingPlayable] = useState(false);

  // The mix: room-shared seeds (layer_gain/layer_muted) under the writer's
  // own device-local practice mix. persistMix saves the FULL snapshot, so a
  // saved entry for a part fully overrides its seed (including an unmute of
  // a room-muted layer); a part with no saved entry stands on its seed.
  const seedEntry = useCallback(
    (
      part: { memoId: string; seedGain: number; seedMuted: boolean },
      saved: { gains: Record<string, number>; muted: string[] },
    ): { gain: number; muted: boolean } => {
      const hasSaved =
        saved.gains[part.memoId] !== undefined || saved.muted.includes(part.memoId);
      return {
        gain: saved.gains[part.memoId] ?? part.seedGain,
        muted: hasSaved ? saved.muted.includes(part.memoId) : part.seedMuted,
      };
    },
    [],
  );

  const [mix, setMix] = useState(() => {
    const saved = loadSingItMix(songId);
    const gains: Record<string, number> = {};
    const muted = new Set<string>();
    for (const p of timeline.parts) {
      const e = seedEntry(p, saved);
      gains[p.memoId] = e.gain;
      if (e.muted) muted.add(p.memoId);
    }
    return { gains, muted };
  });
  const mixRef = useRef(mix);
  mixRef.current = mix;

  const statusRef = useRef(status);
  statusRef.current = status;

  const persistTimer = useRef(0);
  const persistMix = useCallback(
    (gains: Record<string, number>, muted: Set<string>) => {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        saveSingItMix(songId, { gains, muted: [...muted] });
      }, 300);
    },
    [songId],
  );

  const allPartIds = useMemo(() => timeline.parts.map((p) => p.memoId), [timeline]);

  // Parts that arrive AFTER mount (the nav-state fast path starts layerless;
  // the bundle enrichment merges the family in) seed into the live mix.
  useEffect(() => {
    setMix((m) => {
      const saved = loadSingItMix(songId);
      let changed = false;
      const gains = { ...m.gains };
      const muted = new Set(m.muted);
      for (const p of timeline.parts) {
        if (gains[p.memoId] !== undefined) continue;
        const e = seedEntry(p, saved);
        gains[p.memoId] = e.gain;
        if (e.muted) muted.add(p.memoId);
        changed = true;
      }
      if (!changed) return m;
      return { gains, muted };
    });
  }, [timeline, songId, seedEntry]);

  /** ONE offset truth (the stack player's law): device alignment and the
   *  server offset are the SAME measurement — max(), never summed. */
  const deviceOffsetMs = useCallback(
    (id: string) => getAlignmentOffsetMs(memoKey(id)),
    [],
  );

  const stopSources = useCallback(() => {
    partsRef.current.forEach((p) => {
      try {
        p.source?.stop();
      } catch {
        /* already stopped */
      }
      p.source = null;
    });
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  /** Apply the resolved mix to every live GainNode (ramped). */
  const applyMix = useCallback(
    (gains: Record<string, number>, muted: Set<string>) => {
      const resolved = resolveMix(allPartIds, gains, muted, null);
      const ctx = ctxRef.current;
      partsRef.current.forEach((p, id) => {
        if (p.gainNode && ctx) {
          p.gainNode.gain.setTargetAtTime(resolved[id] ?? 1, ctx.currentTime, RAMP_S);
        }
      });
      const el = fallbackElRef.current;
      if (el) {
        const currentBase = timelineRef.current.parts.find(
          (p) => p.isBase && p.sectionIndex === fallbackSectionRef.current,
        );
        if (currentBase) {
          const g = resolved[currentBase.memoId] ?? 1;
          el.muted = g === 0;
          el.volume = Math.min(1, g);
        }
      }
    },
    [allPartIds],
  );

  /** Schedule ONE part from `fromMs` on the shared clock. */
  const schedulePart = useCallback(
    (id: string, fromMs: number, startAtCtxS: number) => {
      const ctx = ctxRef.current;
      const part = timelineRef.current.parts.find((p) => p.memoId === id);
      const audio = partsRef.current.get(id);
      if (!ctx || !part || !audio?.buffer) return;
      const win = partWindowFrom(timelineRef.current, part, fromMs, deviceOffsetMs(id));
      if (!win) return;
      const intoS = win.intoPartMs / 1000;
      if (intoS >= audio.buffer.duration) return; // audio shorter than its slot

      const resolved = resolveMix(allPartIds, mixRef.current.gains, mixRef.current.muted, null);
      const source = ctx.createBufferSource();
      source.buffer = audio.buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = resolved[id] ?? 1;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      const when = startAtCtxS + win.delayMs / 1000;
      source.start(when, intoS);
      source.stop(when + win.playMs / 1000); // the section boundary is law
      audio.source = source;
      audio.gainNode = gainNode;
    },
    [allPartIds, deviceOffsetMs],
  );

  /** Schedule every decoded part from `fromMs` in one shared tick. */
  const scheduleAll = useCallback(
    (fromMs: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const startAt = ctx.currentTime + 0.06; // one shared "when" for all
      partsRef.current.forEach((_p, id) => schedulePart(id, fromMs, startAt));
      startedAtRef.current = startAt - fromMs / 1000;

      const totalS = timelineRef.current.totalMs / 1000;
      const tick = () => {
        const posS = ctx.currentTime - startedAtRef.current;
        if (posS >= totalS) {
          stopSources();
          pausedPosMsRef.current = 0;
          setPositionMs(timelineRef.current.totalMs);
          setStatus("ended");
          return;
        }
        setPositionMs(Math.max(0, posS * 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [schedulePart, stopSources],
  );

  // ── Fallback rung: bases in sequence through one element ────────────────
  const fallbackPlaySection = useCallback(
    (sectionIndex: number, intoMs = 0) => {
      const tl = timelineRef.current;
      const el = fallbackElRef.current;
      if (!el) return;
      if (sectionIndex >= tl.sections.length) {
        el.pause();
        pausedPosMsRef.current = 0;
        setPositionMs(tl.totalMs);
        setStatus("ended");
        return;
      }
      const base = tl.parts.find((p) => p.isBase && p.sectionIndex === sectionIndex);
      const url = base ? fallbackUrlsRef.current.get(base.memoId) : undefined;
      if (!base || !url) {
        // A hole, not a wall — skip to the next section.
        fallbackPlaySection(sectionIndex + 1, 0);
        return;
      }
      fallbackSectionRef.current = sectionIndex;
      el.src = url;
      el.currentTime = intoMs / 1000;
      el.onended = () => fallbackPlaySection(sectionIndex + 1, 0);
      el.ontimeupdate = () => {
        const sec = tl.sections[sectionIndex];
        if (sec) setPositionMs(sec.startMs + el.currentTime * 1000);
      };
      applyMix(mixRef.current.gains, mixRef.current.muted);
      void el.play().catch(() => {});
    },
    [applyMix],
  );

  // ── Prepare: resolve + decode every part, first section first ───────────
  useEffect(() => {
    let cancelled = false;
    const parts = timeline.parts;
    if (parts.length === 0) {
      setStatus("ready");
      setNothingPlayable(true);
      return;
    }

    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;

    const failed = new Set<string>();
    let resolvedAny = false;

    const resolveBlob = async (id: string): Promise<Blob> => {
      const audioId = memoKey(id);
      let blob = await audioCache.get(audioId);
      if (!blob) {
        const url = await getSignedUrl(audioId);
        if (!url) throw new Error("no-playback-url");
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`fetch-${resp.status}`);
        blob = await resp.blob();
        await audioCache.set(audioId, blob).catch(() => {});
      }
      return blob;
    };

    const loadPart = async (id: string) => {
      // Already decoded (a timeline enrichment re-ran this effect) — keep it.
      if (partsRef.current.get(id)?.buffer) {
        resolvedAny = true;
        return;
      }
      try {
        const blob = await resolveBlob(id);
        if (cancelled) return;
        if (Ctor && webAudioOk.current) {
          try {
            if (!ctxRef.current || ctxRef.current.state === "closed") {
              ctxRef.current = new Ctor();
            }
            const buf = await ctxRef.current.decodeAudioData(await blob.arrayBuffer());
            if (cancelled) return;
            partsRef.current.set(id, {
              buffer: buf,
              gainNode: null,
              source: null,
              failed: false,
            });
            resolvedAny = true;
            // Joined mid-song? Take the seat at the exact spot.
            if (statusRef.current === "playing" && ctxRef.current) {
              const fromMs = (ctxRef.current.currentTime - startedAtRef.current) * 1000;
              schedulePart(id, fromMs, ctxRef.current.currentTime + 0.06);
            }
            return;
          } catch {
            /* decode failed → the element rung below */
          }
        }
        // Fallback rung (bases only — layers can't stay in sync on elements).
        webAudioOk.current = false;
        const part = timelineRef.current.parts.find((p) => p.memoId === id);
        if (part?.isBase) {
          const url = URL.createObjectURL(blob);
          fallbackUrlsRef.current.set(id, url);
          resolvedAny = true;
        }
      } catch {
        failed.add(id);
      }
    };

    // Never regress a working room to "loading": the practice state churns
    // this effect (per-section cacheStatus updates + bundle enrichment
    // rebuild the sections array), and a ready→loading flip would disable
    // the play circle at the exact moment of the tap. "loading" only while
    // NOTHING is decoded yet.
    setStatus((s) =>
      s === "playing" || s === "paused" || s === "ended"
        ? s
        : partsRef.current.size > 0 || fallbackUrlsRef.current.size > 0
          ? "ready"
          : "loading",
    );
    // First section's parts first — one tap to sound; the rest fill in behind.
    const first = parts.filter((p) => p.sectionIndex === 0).map((p) => p.memoId);
    const rest = parts.filter((p) => p.sectionIndex > 0).map((p) => p.memoId);

    void (async () => {
      await Promise.all(first.map(loadPart));
      if (cancelled) return;
      if (resolvedAny) setStatus((s) => (s === "loading" ? "ready" : s));
      await Promise.all(rest.map(loadPart));
      if (cancelled) return;
      if (!webAudioOk.current) {
        // Any decode failure moves EVERYTHING to the element rung — a split
        // engine can't stay in sync. Re-render decoded bases as element URLs.
        for (const p of timelineRef.current.parts) {
          if (!p.isBase || fallbackUrlsRef.current.has(p.memoId)) continue;
          try {
            const blob = await audioCache.get(memoKey(p.memoId));
            if (blob) {
              fallbackUrlsRef.current.set(p.memoId, URL.createObjectURL(blob));
              resolvedAny = true;
            }
          } catch {
            /* keep going */
          }
        }
        partsRef.current.forEach((p) => {
          try {
            p.source?.stop();
          } catch {
            /* fine */
          }
        });
        partsRef.current.clear();
        if (!fallbackElRef.current) {
          const el = new Audio();
          el.preload = "auto";
          fallbackElRef.current = el;
        }
        setBasesOnly(true);
      }
      setUnavailable(new Set(failed));
      setNothingPlayable(!resolvedAny);
      setStatus((s) => (s === "loading" ? "ready" : s));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  // Unmount: stop everything, give the AudioContext back to the OS (iOS caps
  // live contexts per page), revoke fallback URLs.
  useEffect(() => {
    const urls = fallbackUrlsRef.current;
    return () => {
      stopSources();
      const el = fallbackElRef.current;
      if (el) {
        el.pause();
        el.src = "";
        el.onended = null;
        el.ontimeupdate = null;
      }
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      window.clearTimeout(persistTimer.current);
    };
  }, [stopSources]);

  // Backgrounded tab ⇒ pause in place; resume is one tap (the Flow invariant).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && statusRef.current === "playing") {
        pauseInternalRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const pauseInternal = useCallback(() => {
    if (ctxRef.current && partsRef.current.size > 0) {
      pausedPosMsRef.current = Math.max(
        0,
        (ctxRef.current.currentTime - startedAtRef.current) * 1000,
      );
      stopSources();
    } else if (fallbackElRef.current) {
      const sec = timelineRef.current.sections[fallbackSectionRef.current];
      pausedPosMsRef.current =
        (sec?.startMs ?? 0) + fallbackElRef.current.currentTime * 1000;
      fallbackElRef.current.pause();
    }
    setStatus("paused");
  }, [stopSources]);
  const pauseInternalRef = useRef(pauseInternal);
  pauseInternalRef.current = pauseInternal;

  /** Toggle playback. MUST be called from a user gesture (iOS). */
  const playPause = useCallback(() => {
    const s = statusRef.current;
    if (s === "loading" || nothingPlayable) return;
    if (s === "playing") {
      pauseInternal();
      return;
    }
    const fromMs = s === "ended" ? 0 : pausedPosMsRef.current;
    if (ctxRef.current && partsRef.current.size > 0) {
      void ctxRef.current.resume().catch(() => {});
      scheduleAll(fromMs);
    } else if (fallbackElRef.current) {
      const idx = sectionIndexAtMs(timelineRef.current, fromMs);
      const sec = timelineRef.current.sections[idx];
      fallbackPlaySection(idx, Math.max(0, fromMs - (sec?.startMs ?? 0)));
    } else {
      return;
    }
    setStatus("playing");
  }, [fallbackPlaySection, nothingPlayable, pauseInternal, scheduleAll]);

  const seekMs = useCallback(
    (ms: number) => {
      const clamped = Math.min(
        Math.max(0, ms),
        Math.max(0, timelineRef.current.totalMs - 1),
      );
      const wasPlaying = statusRef.current === "playing";
      if (ctxRef.current && partsRef.current.size > 0) {
        stopSources();
        pausedPosMsRef.current = clamped;
        setPositionMs(clamped);
        if (wasPlaying) {
          scheduleAll(clamped);
        } else if (statusRef.current === "ended") {
          setStatus("paused");
        }
        return;
      }
      if (fallbackElRef.current) {
        pausedPosMsRef.current = clamped;
        setPositionMs(clamped);
        if (wasPlaying) {
          const idx = sectionIndexAtMs(timelineRef.current, clamped);
          const sec = timelineRef.current.sections[idx];
          fallbackPlaySection(idx, Math.max(0, clamped - (sec?.startMs ?? 0)));
        } else if (statusRef.current === "ended") {
          setStatus("paused");
        }
      }
    },
    [fallbackPlaySection, scheduleAll, stopSources],
  );

  const setGain = useCallback(
    (memoId: string, gain: number) => {
      setMix((m) => {
        const gains = { ...m.gains, [memoId]: clampLayerGain(gain) };
        applyMix(gains, m.muted);
        persistMix(gains, m.muted);
        return { gains, muted: m.muted };
      });
    },
    [applyMix, persistMix],
  );

  const toggleMute = useCallback(
    (memoId: string) => {
      setMix((m) => {
        const muted = new Set(m.muted);
        if (muted.has(memoId)) muted.delete(memoId);
        else muted.add(memoId);
        applyMix(m.gains, muted);
        persistMix(m.gains, muted);
        return { gains: m.gains, muted };
      });
    },
    [applyMix, persistMix],
  );

  const sectionIndex = sectionIndexAtMs(timeline, positionMs);

  return {
    timeline,
    status,
    positionMs,
    sectionIndex,
    gains: mix.gains,
    muted: mix.muted,
    unavailable,
    nothingPlayable,
    basesOnly,
    playPause,
    seekMs,
    setGain,
    toggleMute,
  };
}
