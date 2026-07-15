import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, RotateCcw, Footprints, Waves } from "lucide-react";
import { useFlowEngine } from "./useFlowEngine";
import FlowDocument from "./FlowDocument";
import FlowStepped from "./FlowStepped";
import { FLOW_SPEED_STEP } from "@/lib/audio/flowScroll";
import type { PracticePlayerHook } from "@/hooks/usePracticePlayer";

interface FlowPlayerProps {
  hook: PracticePlayerHook;
  onExit: () => void;
}

const STEPPED_PREF_KEY = "cog-flow-stepped";

function readSteppedPref(): boolean | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STEPPED_PREF_KEY) : null;
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

/**
 * FlowPlayer — the hands-free perform mode: the WHOLE song's lyrics + chord
 * chips glide by in big bold Playfair while the performer plays live along.
 * Self-paced (no recording plays), read-only (C3's chart, never edited), and
 * unfailable: the engine degrades Tier 3 → 2 → 1 (see flowScroll.ts) and the
 * performer always has tap-pause, drag-scroll, and the speed nudge. The
 * screen never sleeps — the practice route already holds the session Wake
 * Lock (usePracticeWakeLock) for every mode rendered inside it, Flow included.
 */
export function FlowPlayer({ hook, onExit }: FlowPlayerProps) {
  const { state, pause } = hook;
  const { sections, songTitle, songId, bpm, bpmFromSong } = state;

  // Flow is a live performance, not playback — silence any playing take once.
  useEffect(() => {
    pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reduced-motion prefers the stepped view by default; the performer's own
  // toggle is an explicit override in either direction (standard a11y).
  const prefersReduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [steppedChoice, setSteppedChoice] = useState<boolean | null>(() => readSteppedPref());
  const stepped = steppedChoice ?? prefersReduced;
  const setStepped = (on: boolean) => {
    setSteppedChoice(on);
    try {
      localStorage.setItem(STEPPED_PREF_KEY, on ? "1" : "0");
    } catch {
      /* preference only */
    }
  };

  const engine = useFlowEngine({
    songId,
    bpm: bpmFromSong ? bpm : null,
    sections,
    enabled: !stepped,
  });

  // Controls fade away while performing; any tap brings them back.
  const [controlsVisible, setControlsVisible] = useState(true);
  useEffect(() => {
    if (!engine.playing || stepped) return;
    const t = setTimeout(() => setControlsVisible(false), 2600);
    return () => clearTimeout(t);
  }, [engine.playing, stepped, controlsVisible]);

  // The gentle start — begin the count-in once the chart is on screen.
  useEffect(() => {
    if (!stepped) engine.beginCountIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepped]);

  // Keyboard: Space toggles, Escape exits (stand-side laptop / pedal safety).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      else if (e.key === " " && !stepped) {
        e.preventDefault();
        setControlsVisible(true);
        engine.handleTapToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, stepped, onExit]);

  const hasAnyContent = sections.some(
    (s) => s.lyrics || s.chordLines?.length || s.transcriptLines?.length,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: "var(--cog-cream)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* The brand's warm glow, behind everything */}
      <div className="cog-glow absolute inset-0 pointer-events-none" aria-hidden />

      {/* Progress ribbon — always visible, whisper-thin */}
      <div
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(28,26,23,0.08)", zIndex: 2 }}
      >
        <div
          style={{
            height: "100%",
            width: `${engine.progress * 100}%`,
            background: "var(--cog-gold)",
            transition: "width 300ms linear",
          }}
        />
      </div>

      {/* Header — fades while performing */}
      <div
        className="relative flex items-center justify-between px-4 pt-3 pb-2"
        style={{
          zIndex: 3,
          opacity: controlsVisible || stepped ? 1 : 0,
          pointerEvents: controlsVisible || stepped ? "auto" : "none",
          transition: "opacity 400ms var(--cog-ease)",
        }}
      >
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-full px-4"
          style={{
            minHeight: 44,
            backgroundColor: "rgba(28,26,23,0.07)",
            color: "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            fontWeight: 600,
            border: "none",
          }}
        >
          <X size={16} />
          Exit Flow
        </button>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cog-charcoal)",
            maxWidth: "40%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {songTitle}
        </div>

        <div className="flex items-center gap-2">
          {!stepped && (
            <div
              className="flex items-center rounded-full"
              style={{ backgroundColor: "rgba(28,26,23,0.07)" }}
              aria-label="Scroll speed"
            >
              <button
                onClick={() => engine.nudgeSpeed(-FLOW_SPEED_STEP)}
                aria-label="Slower"
                className="flex items-center justify-center"
                style={{ width: 44, height: 44, color: "var(--cog-warm-gray)", background: "transparent", border: "none" }}
              >
                <Minus size={16} />
              </button>
              <span
                aria-live="polite"
                style={{ minWidth: 46, textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--cog-charcoal)" }}
              >
                {Math.round(engine.speed * 100)}%
              </span>
              <button
                onClick={() => engine.nudgeSpeed(FLOW_SPEED_STEP)}
                aria-label="Faster"
                className="flex items-center justify-center"
                style={{ width: 44, height: 44, color: "var(--cog-warm-gray)", background: "transparent", border: "none" }}
              >
                <Plus size={16} />
              </button>
            </div>
          )}
          <button
            onClick={() => setStepped(!stepped)}
            aria-pressed={stepped}
            aria-label={stepped ? "Switch to continuous scroll" : "Switch to stepped mode (tap or pedal to advance)"}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              backgroundColor: stepped ? "var(--cog-gold-pale)" : "rgba(28,26,23,0.07)",
              color: stepped ? "var(--cog-charcoal)" : "var(--cog-warm-gray)",
              border: "none",
            }}
          >
            {stepped ? <Waves size={18} /> : <Footprints size={18} />}
          </button>
        </div>
      </div>

      {!hasAnyContent ? (
        <div className="relative flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center" style={{ zIndex: 1 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.375rem", color: "var(--cog-charcoal)", margin: 0 }}>
            Nothing to Flow yet
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-warm-gray)", maxWidth: 300, margin: 0 }}>
            Add lyrics or chords to this song and Flow will carry them by while you play.
          </p>
        </div>
      ) : stepped ? (
        <FlowStepped sections={sections} />
      ) : (
        <div
          ref={engine.containerRef}
          className="relative flex-1 min-h-0 overflow-y-auto"
          role="region"
          aria-label="Song chart — auto-scrolling. Tap to pause or resume; drag to reposition."
          onPointerUp={() => setControlsVisible(true)}
          style={{ zIndex: 1, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {/* Spacers seat the first line at the reading line and let the last roll past */}
          <div style={{ height: "38vh" }} aria-hidden />
          <FlowDocument sections={sections} />
          <div style={{ height: "58vh" }} aria-hidden />
        </div>
      )}

      {/* Count-in overlay — calm, reduced-motion safe (a static swap, no scaling) */}
      {engine.countingIn && !stepped && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 4 }}>
          <div
            aria-live="polite"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              color: "var(--cog-warm-gray)",
              background: "rgba(245,240,232,0.86)",
              borderRadius: 9999,
              padding: "10px 22px",
            }}
          >
            Flow begins in a breath…
          </div>
        </div>
      )}

      {/* Finished — the song rolled past its last line */}
      {engine.finished && !stepped && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ zIndex: 4, background: "rgba(245,240,232,0.72)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--cog-charcoal)", margin: 0 }}>
            That's the song.
          </p>
          <button
            onClick={engine.restart}
            className="flex items-center gap-2 rounded-full px-6"
            style={{ minHeight: 48, backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 600, border: "none" }}
          >
            <RotateCcw size={16} />
            From the top
          </button>
          <button
            onClick={onExit}
            className="rounded-full px-5 underline underline-offset-2"
            style={{ minHeight: 44, background: "transparent", border: "none", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", fontSize: "0.875rem" }}
          >
            Exit Flow
          </button>
        </div>
      )}

      {/* Paused hint — barely there, only when idle mid-song */}
      {!engine.playing && !engine.countingIn && !engine.finished && !stepped && hasAnyContent && (
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ bottom: 28, zIndex: 3 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--cog-warm-gray)",
              background: "rgba(245,240,232,0.86)",
              borderRadius: 9999,
              padding: "8px 16px",
            }}
          >
            Paused — tap to flow
          </span>
        </div>
      )}
    </div>
  );
}

export default FlowPlayer;
