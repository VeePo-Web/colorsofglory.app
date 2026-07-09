import { useEffect, useMemo, useRef, useState } from "react";
import type { PracticeChordLine } from "@/lib/audio/practiceTypes";

/**
 * ChordScroll — the music stand that turns its own pages (F2 mandate #1).
 *
 * Renders a section's full lyric+chord chart (C3's sheet, read-only): every
 * line of the section with its chords sitting exactly over the right words,
 * auto-scrolling in sync with playback and highlighting the current line.
 *
 * Positioning: each chord is bonded to a character index (C3's syllable
 * anchors). The line is split at those anchors into inline segments; each
 * segment carries its chord absolutely positioned above its first character —
 * so alignment survives proportional fonts, wrapping, and any screen width.
 *
 * Sync: sheet lines carry no timestamps (transcripts do; charts don't), so
 * the active line maps proportionally from playback position → line index.
 * Honest, stable, and right far more often than not for sung sections.
 *
 * Manual scroll wins: touching/wheeling the chart suspends auto-scroll for a
 * few seconds, then re-syncs gently. Reduced motion = instant jumps, no
 * animated highlight.
 */

interface ChordScrollProps {
  chordLines: PracticeChordLine[];
  currentPositionMs: number;
  durationMs: number;
  /** Display key from the sheet, shown as a small eyebrow ("Key of G"). */
  songKey: string | null;
  show: boolean;
  driveMode?: boolean;
}

const MANUAL_SCROLL_HOLD_MS = 4000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export function ChordScroll({
  chordLines,
  currentPositionMs,
  durationMs,
  songKey,
  show,
  driveMode = false,
}: ChordScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const manualUntilRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  // Proportional position → active line (charts carry no timestamps).
  const activeIndex = useMemo(() => {
    if (chordLines.length === 0 || durationMs <= 0) return 0;
    const fraction = Math.min(Math.max(currentPositionMs / durationMs, 0), 0.999);
    return Math.floor(fraction * chordLines.length);
  }, [chordLines.length, currentPositionMs, durationMs]);

  // Auto-scroll the active line to the vertical center — unless the reader
  // has taken over scrolling, in which case wait out the hold and re-sync.
  useEffect(() => {
    if (!show) return;
    if (Date.now() < manualUntilRef.current) return;
    const container = containerRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;
    if (typeof container.scrollTo !== "function") return; // older WebKit / jsdom
    const target = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: reducedMotion ? "auto" : "smooth" });
  }, [activeIndex, show, reducedMotion]);

  if (!show || chordLines.length === 0) return null;

  const lyricSize = driveMode ? "1.375rem" : "1.125rem";
  const chordSize = driveMode ? "0.9375rem" : "0.8125rem";
  // Room above each line for its chord row.
  const chordRow = driveMode ? "1.5rem" : "1.25rem";

  const markManual = () => { manualUntilRef.current = Date.now() + MANUAL_SCROLL_HOLD_MS; };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {songKey && (
        <div
          className="px-6 pb-1"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--cog-gold)",
            textAlign: "center",
          }}
        >
          Key of {songKey}
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-6"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        onTouchStart={markManual}
        onWheel={markManual}
        onPointerDown={markManual}
        aria-label="Lyrics and chords"
      >
        {/* Top/bottom spacers so the first and last lines can center. */}
        <div style={{ height: "30%" }} aria-hidden />

        {chordLines.map((line, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              className="py-1"
              style={{
                textAlign: "center",
                opacity: isActive ? 1 : 0.45,
                transition: reducedMotion ? "none" : "opacity 250ms var(--cog-ease)",
              }}
            >
              <ChordLine
                line={line}
                lyricSize={lyricSize}
                chordSize={chordSize}
                chordRow={chordRow}
                emphasized={isActive}
              />
            </div>
          );
        })}

        <div style={{ height: "40%" }} aria-hidden />
      </div>
    </div>
  );
}

/**
 * One lyric line with chords over the right words. The text is split at the
 * chord anchors; each segment is an inline-block with its chord absolutely
 * positioned above its first character.
 */
function ChordLine({
  line,
  lyricSize,
  chordSize,
  chordRow,
  emphasized,
}: {
  line: PracticeChordLine;
  lyricSize: string;
  chordSize: string;
  chordRow: string;
  emphasized: boolean;
}) {
  const hasChords = line.chords.length > 0;

  // Split the text at anchor indices: plain spans between anchors, and one
  // chord-bearing span per anchor running to the next anchor (or line end).
  const segments = useMemo(() => {
    const anchors = [...line.chords].sort((a, b) => a.at - b.at);
    const out: Array<{ chord: string | null; text: string }> = [];
    let pos = 0;
    for (let i = 0; i < anchors.length; i++) {
      const at = Math.max(0, Math.min(line.text.length, anchors[i].at));
      if (at > pos) out.push({ chord: null, text: line.text.slice(pos, at) });
      const end = i + 1 < anchors.length
        ? Math.max(at, Math.min(line.text.length, anchors[i + 1].at))
        : line.text.length;
      out.push({ chord: anchors[i].glyph, text: line.text.slice(at, end) });
      pos = end;
    }
    if (pos < line.text.length) out.push({ chord: null, text: line.text.slice(pos) });
    if (out.length === 0) out.push({ chord: null, text: line.text });
    return out;
  }, [line]);

  return (
    <p
      style={{
        fontFamily: "var(--font-display)",
        fontSize: lyricSize,
        fontWeight: emphasized ? 600 : 500,
        lineHeight: 1.4,
        color: "var(--cog-charcoal)",
        margin: 0,
        paddingTop: hasChords ? chordRow : 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {segments.map((seg, i) =>
        seg.chord ? (
          <span key={i} style={{ position: "relative", display: "inline-block" }}>
            <span
              aria-hidden={!emphasized}
              style={{
                position: "absolute",
                top: `calc(-1 * ${chordRow} + 0.2em)`,
                left: 0,
                fontFamily: "var(--font-body)",
                fontSize: chordSize,
                fontWeight: 700,
                color: "var(--cog-gold)",
                whiteSpace: "nowrap",
                letterSpacing: "0.01em",
              }}
            >
              {seg.chord}
            </span>
            {seg.text || " "}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
