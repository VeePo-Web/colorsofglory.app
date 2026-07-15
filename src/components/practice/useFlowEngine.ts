import { useCallback, useEffect, useRef, useState } from "react";
import {
  bpmToPixelsPerSecond,
  buildConstantKeyframes,
  buildSectionKeyframes,
  buildTimedKeyframes,
  clampFlowSpeed,
  loadFlowSpeed,
  positionAt,
  saveFlowSpeed,
  timeAt,
  totalDurationMs,
  type FlowKeyframe,
  type FlowLinePoint,
  type FlowSectionBlock,
  type FlowTier,
} from "@/lib/audio/flowScroll";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

/** Where a "now" line sits in the viewport — eyes rest a third down the stand. */
const READING_LINE_FRACTION = 0.35;
/** A press that moves less than this and ends quickly is a TAP (pause/resume). */
const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 400;
/** After a drag/momentum, wait for the scroll to settle before resuming. */
const SETTLE_MS = 180;

export interface FlowEngine {
  containerRef: React.RefObject<HTMLDivElement | null>;
  playing: boolean;
  countingIn: boolean;
  finished: boolean;
  tier: FlowTier;
  /** 0..1 through the chart — drives the progress ribbon. */
  progress: number;
  speed: number;
  /** The tap gesture: skip count-in / pause / resume. Wired by the shell. */
  handleTapToggle: () => void;
  nudgeSpeed: (delta: number) => void;
  restart: () => void;
  beginCountIn: () => void;
}

/**
 * useFlowEngine — the rAF scroll clock behind Flow.
 *
 * One monotonic keyframe timeline (time → scrollTop) built from the best data
 * the song has (Tier 3 timed lines → Tier 2 take durations → Tier 1 tempo/
 * default — see flowScroll.ts), advanced by a speed-multiplied clock. The
 * performer is ALWAYS in control: a grab pauses the clock, repositioning
 * re-derives it (timeAt inverse), release resumes once the scroll settles,
 * and a tap toggles pause. Nothing here can trap them — worst case the engine
 * idles and the container is a plain hand-scrolled chart.
 */
export function useFlowEngine(opts: {
  songId: string;
  bpm: number | null;
  sections: PracticeSection[];
  /** False while the stepped (reduced-motion) view owns the screen. */
  enabled: boolean;
}): FlowEngine {
  const { songId, bpm, sections, enabled } = opts;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [countingIn, setCountingIn] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tier, setTier] = useState<FlowTier>(1);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(() => loadFlowSpeed(songId));

  const framesRef = useRef<FlowKeyframe[]>([]);
  const elapsedRef = useRef(0);
  const speedRef = useRef(speed);
  const playingRef = useRef(false);
  const engineYRef = useRef(0);
  const lastProgressRef = useRef(0);
  const pointerRef = useRef<{ x: number; y: number; t: number; wasPlaying: boolean } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAfterSettleRef = useRef(false);
  const countInTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  speedRef.current = speed;
  playingRef.current = playing;

  /** Measure the rendered chart and build the best available timeline. */
  const rebuild = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const cRect = el.getBoundingClientRect();
    const readingOffset = el.clientHeight * READING_LINE_FRACTION;
    const contentTop = (node: Element) =>
      node.getBoundingClientRect().top - cRect.top + el.scrollTop;

    const blocks: FlowSectionBlock[] = Array.from(
      el.querySelectorAll<HTMLElement>("[data-flow-section]"),
    ).map((node, i) => ({
      top: contentTop(node),
      height: node.getBoundingClientRect().height,
      durationMs: sections[i]?.durationMs ?? 0,
    }));

    const sectionFrames = buildSectionKeyframes(blocks, maxScroll);

    // Timed line points need every section's duration (to place each section's
    // clock start) — partial data degrades to Tier 2/1 instead of guessing.
    let linePoints: FlowLinePoint[] = [];
    if (sectionFrames) {
      let sectionStart = 0;
      blocks.forEach((b, i) => {
        const node = el.querySelectorAll<HTMLElement>("[data-flow-section]")[i];
        node?.querySelectorAll<HTMLElement>("[data-flow-line-ms]").forEach((line) => {
          const lineMs = Number(line.dataset.flowLineMs);
          if (Number.isFinite(lineMs)) {
            linePoints.push({
              tMs: sectionStart + lineMs,
              y: Math.max(0, Math.min(maxScroll, contentTop(line) - readingOffset)),
            });
          }
        });
        sectionStart += b.durationMs;
      });
    } else {
      linePoints = [];
    }

    const timed = buildTimedKeyframes(linePoints, sectionFrames, maxScroll);
    if (timed) {
      framesRef.current = timed;
      setTier(3);
    } else if (sectionFrames) {
      framesRef.current = sectionFrames;
      setTier(2);
    } else {
      framesRef.current = buildConstantKeyframes(maxScroll, bpmToPixelsPerSecond(bpm));
      setTier(1);
    }
    // Keep continuity: wherever the chart currently sits stays "now".
    elapsedRef.current = timeAt(framesRef.current, el.scrollTop);
  }, [sections, bpm]);

  // Build after layout; rebuild when the viewport reflows (rotation, resize).
  useEffect(() => {
    if (!enabled) return;
    rebuild();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => rebuild());
    ro.observe(el);
    return () => ro.disconnect();
  }, [rebuild, enabled]);

  // The clock. Runs only while playing; scrollTop is the single output.
  useEffect(() => {
    if (!playing || !enabled) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const el = containerRef.current;
      if (!el) return;
      const dt = Math.min(now - last, 200); // a hung frame never teleports the chart
      last = now;
      elapsedRef.current += dt * speedRef.current;
      const y = positionAt(framesRef.current, elapsedRef.current);
      engineYRef.current = y;
      el.scrollTop = y;
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      const p = Math.min(1, y / maxScroll);
      if (Math.abs(p - lastProgressRef.current) > 0.003) {
        lastProgressRef.current = p;
        setProgress(p);
      }
      if (y >= maxScroll - 0.5 && totalDurationMs(framesRef.current) > 0) {
        setPlaying(false);
        setFinished(true);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, enabled]);

  // Interruption (call, tab switch): pause in place; the performer resumes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") setPlaying(false);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const clearCountIn = useCallback(() => {
    countInTimersRef.current.forEach(clearTimeout);
    countInTimersRef.current = [];
    setCountingIn(false);
  }, []);

  /** A short calm count-in (3 beats at the song's tempo) so the start never startles. */
  const beginCountIn = useCallback(() => {
    if (!enabled) return;
    clearCountIn();
    setFinished(false);
    setCountingIn(true);
    const beatMs = Math.min(900, Math.max(500, bpm ? 60_000 / bpm : 750));
    countInTimersRef.current.push(
      setTimeout(() => {
        setCountingIn(false);
        setPlaying(true);
      }, beatMs * 3),
    );
  }, [enabled, bpm, clearCountIn]);

  const syncClockToScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    elapsedRef.current = timeAt(framesRef.current, el.scrollTop);
    setFinished(false);
  }, []);

  const handleTapToggle = useCallback(() => {
    if (countingIn) {
      clearCountIn();
      setPlaying(true); // eager — the tap says "I'm ready"
      return;
    }
    if (playingRef.current) {
      setPlaying(false);
    } else {
      syncClockToScroll();
      setPlaying(true);
    }
  }, [countingIn, clearCountIn, syncClockToScroll]);

  // Grab / drag / tap semantics on the container itself.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        wasPlaying: playingRef.current || countingIn,
      };
      resumeAfterSettleRef.current = false;
      if (playingRef.current) setPlaying(false); // the grab pauses the clock
    };

    const onPointerUp = (e: PointerEvent) => {
      const down = pointerRef.current;
      pointerRef.current = null;
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      if (dist < TAP_SLOP_PX && dt < TAP_MAX_MS) {
        // A tap: toggle. (The grab above already paused; a tap while playing
        // therefore stays paused, a tap while paused resumes — one gesture.)
        if (countingIn) {
          clearCountIn();
          setPlaying(true);
        } else if (!down.wasPlaying) {
          syncClockToScroll();
          setPlaying(true);
        }
        return;
      }
      // A drag: they repositioned. Resume (if it was playing) once the
      // momentum settles, from exactly where they left the chart.
      if (down.wasPlaying) {
        resumeAfterSettleRef.current = true;
        scheduleSettle();
      } else {
        syncClockToScroll();
      }
    };

    const scheduleSettle = () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        if (resumeAfterSettleRef.current) {
          resumeAfterSettleRef.current = false;
          syncClockToScroll();
          setPlaying(true);
        }
      }, SETTLE_MS);
    };

    const onScroll = () => {
      // Engine writes land here too — only manual movement matters.
      if (Math.abs(el.scrollTop - engineYRef.current) < 1.5) return;
      if (resumeAfterSettleRef.current) scheduleSettle(); // momentum still moving
      else if (!playingRef.current) syncClockToScroll(); // hand-positioned while paused
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("scroll", onScroll);
    };
  }, [enabled, countingIn, clearCountIn, syncClockToScroll]);

  const nudgeSpeed = useCallback(
    (delta: number) => {
      setSpeed((s) => {
        const next = clampFlowSpeed(s + delta);
        saveFlowSpeed(songId, next); // remembered — the second run is exactly right
        return next;
      });
    },
    [songId],
  );

  const restart = useCallback(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
    elapsedRef.current = 0;
    engineYRef.current = 0;
    setProgress(0);
    setFinished(false);
    beginCountIn();
  }, [beginCountIn]);

  // Teardown: no timers left ticking after exit.
  useEffect(
    () => () => {
      clearCountIn();
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [clearCountIn],
  );

  return {
    containerRef,
    playing,
    countingIn,
    finished,
    tier,
    progress,
    speed,
    handleTapToggle,
    nudgeSpeed,
    restart,
    beginCountIn,
  };
}
