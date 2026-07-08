import type { CSSProperties } from "react";
import { chordToLetters, chordToNumbers } from "@/lib/chords/nashville";
import type { SheetLine } from "@/lib/chords/sheet";

/**
 * One lyric line with chords stacked over their syllables — as a WRAPPING
 * word-column layout (OnSong / Ultimate Guitar / CCLI lead-sheet style), not a
 * monospace row. Each word is a column with a reserved chord slot above it, so
 * the line wraps gracefully on a narrow phone instead of horizontally scrolling.
 *
 * A word claims every anchor from its own start up to the next word's start, so
 * leading / trailing / between-word chords are never dropped. Shared by the
 * Read view and the Performance (stage) view; `lyricRem`/`chordRem` let the
 * stage view scale type up. Lyric text is always --font-body (Inter) — the
 * locked design law; chords render as the Screen 10 gold-pale "pencil-mark"
 * pill floating just above their syllable.
 */
export default function ChordLine({
  line,
  displayKey,
  display,
  lyricRem = 0.9375,
  chordRem = 0.8125,
}: {
  line: SheetLine;
  displayKey: string;
  display: "letters" | "numbers";
  lyricRem?: number;
  chordRem?: number;
}) {
  const glyph = (a: SheetLine["anchors"][number]) =>
    display === "numbers" ? chordToNumbers(a.chord, "major") : chordToLetters(a.chord, displayKey, "major");

  const words = [...line.text.matchAll(/\S+/g)];

  // The chord "pencil-mark" pill — present but subordinate to the words.
  const pillStyle: CSSProperties = {
    backgroundColor: "var(--cog-gold-pale)",
    color: "var(--cog-charcoal)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: `${chordRem}rem`,
    lineHeight: 1,
    padding: "3px 8px",
    borderRadius: 9999,
  };

  // Chord-only or blank line: render any chords inline, else reserve a small gap.
  if (words.length === 0) {
    const only = line.anchors.map(glyph);
    return only.length ? (
      <div className="flex flex-wrap gap-1">
        {only.map((c, i) => (
          <span key={i} style={pillStyle}>{c}</span>
        ))}
      </div>
    ) : (
      <div style={{ height: 6 }} />
    );
  }

  const starts = words.map((w) => w.index ?? 0);
  return (
    <div className="flex flex-wrap items-end gap-x-1.5 gap-y-1">
      {words.map((m, i) => {
        const lo = i === 0 ? -Infinity : starts[i];
        const hi = i === words.length - 1 ? Infinity : starts[i + 1];
        const labels = line.anchors.filter((a) => a.at >= lo && a.at < hi).map(glyph);
        return (
          <span key={i} className="flex flex-col items-start">
            {labels.length > 0 ? (
              <span className="flex gap-1" style={{ marginBottom: 4 }}>
                {labels.map((c, ci) => (
                  <span key={ci} style={pillStyle}>{c}</span>
                ))}
              </span>
            ) : (
              // Reserved (invisible) slot keeps the lyric baseline steady.
              <span aria-hidden="true" style={{ ...pillStyle, backgroundColor: "transparent", marginBottom: 4, visibility: "hidden" }}>
                {" "}
              </span>
            )}
            <span
              className="leading-snug"
              style={{ fontSize: `${lyricRem}rem`, color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              {m[0]}
            </span>
          </span>
        );
      })}
    </div>
  );
}
