import { useMemo } from "react";
import type { TranscriptLine } from "@/lib/audio/practiceTypes";

interface KaraokeLyricsProps {
  /** Full lyrics text (fallback when no transcript) */
  lyrics: string | null;
  /** Timestamped lines — when present, shows one line at a time */
  transcriptLines: TranscriptLine[] | null;
  /** Current playback position in ms */
  currentPositionMs: number;
  /** Whether to show lyrics at all (user toggle) */
  show: boolean;
  /** In Drive Mode: larger, higher contrast */
  driveMode?: boolean;
  /**
   * THE PRACTICE ROOM register (pass 7): the words OWN the screen — fluid
   * sing-along type you can read from a music stand or a lap, the Apple
   * Music Sing scale. Additive: absent = every existing surface unchanged.
   */
  sing?: boolean;
}

function useSyncedLine(
  transcriptLines: TranscriptLine[] | null,
  positionMs: number,
): { current: string; next: string | null } {
  return useMemo(() => {
    if (!transcriptLines || transcriptLines.length === 0) {
      return { current: "", next: null };
    }

    // Find the active line (last line whose startMs <= positionMs)
    let activeIndex = -1;
    for (let i = 0; i < transcriptLines.length; i++) {
      if (transcriptLines[i].startMs <= positionMs) {
        activeIndex = i;
      } else {
        break;
      }
    }

    if (activeIndex === -1) {
      // Before any line starts — show first line dimmed
      return { current: transcriptLines[0].text, next: transcriptLines[1]?.text ?? null };
    }

    const current = transcriptLines[activeIndex].text;
    const next    = transcriptLines[activeIndex + 1]?.text ?? null;
    return { current, next };
  }, [transcriptLines, positionMs]);
}

/** One-line-at-a-time karaoke display. Falls back to full text when no transcript. */
export function KaraokeLyrics({
  lyrics,
  transcriptLines,
  currentPositionMs,
  show,
  driveMode = false,
  sing = false,
}: KaraokeLyricsProps) {
  const { current, next } = useSyncedLine(transcriptLines, currentPositionMs);

  if (!show) return null;

  // No data at all
  if (!lyrics && (!transcriptLines || transcriptLines.length === 0)) {
    return (
      <div
        className="flex items-center justify-center px-6"
        style={{ minHeight: driveMode ? 96 : 72 }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: driveMode ? "1rem" : "0.875rem",
            color: "var(--cog-muted)",
            textAlign: "center",
          }}
        >
          No lyrics for this section
        </p>
      </div>
    );
  }

  // Full-text fallback (no transcript timestamps)
  if (!transcriptLines || transcriptLines.length === 0) {
    return (
      <div
        className="px-6 overflow-y-auto"
        style={{ maxHeight: sing ? 300 : driveMode ? 160 : 120 }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: sing
              ? "clamp(1.125rem, 5vw, 1.5rem)"
              : driveMode
                ? "1.125rem"
                : "0.9375rem",
            lineHeight: 1.7,
            color: "var(--cog-charcoal)",
            whiteSpace: "pre-wrap",
            textAlign: "center",
          }}
        >
          {lyrics}
        </p>
      </div>
    );
  }

  // Karaoke mode — one line highlighted, next line dimmed below
  const activeFontSize = sing
    ? "clamp(1.5rem, 7.2vw, 2.25rem)"
    : driveMode
      ? "1.5rem"
      : "1.125rem";
  const nextFontSize = sing
    ? "clamp(1rem, 4.4vw, 1.375rem)"
    : driveMode
      ? "1rem"
      : "0.875rem";

  return (
    <div
      className="flex flex-col items-center justify-center px-6 text-center"
      style={{ minHeight: sing ? 168 : driveMode ? 120 : 88, gap: sing ? 14 : 8 }}
    >
      {/* Current line */}
      <p
        key={current}
        className="transition-all cog-karaoke-line"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: activeFontSize,
          fontWeight: 600,
          lineHeight: 1.35,
          color: "var(--cog-charcoal)",
        }}
      >
        {current}
      </p>

      {/* Upcoming line — dimmed hint */}
      {next && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: nextFontSize,
            lineHeight: 1.4,
            color: "var(--cog-muted)",
            transition: "opacity 200ms",
          }}
        >
          {next}
        </p>
      )}

      <style>{`
        @keyframes karaoke-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cog-karaoke-line { animation: karaoke-in 200ms var(--cog-ease-reveal) both; }
        @media (prefers-reduced-motion: reduce) {
          .cog-karaoke-line { animation: none; }
        }
      `}</style>
    </div>
  );
}
