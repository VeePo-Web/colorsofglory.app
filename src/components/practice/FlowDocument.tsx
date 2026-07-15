import { getSectionColor } from "@/lib/audio/sectionColors";
import type { PracticeSection } from "@/lib/audio/practiceTypes";
import { ChordLine } from "./ChordScroll";

interface FlowDocumentProps {
  sections: PracticeSection[];
}

/**
 * FlowDocument — the whole song as one continuous, measurable chart: section
 * labels as gentle color-chipped dividers, lyrics in big bold Playfair with
 * C3's chord chips above the words (read-only, rendered by the same ChordLine
 * the practice chord view uses — one renderer, never two).
 *
 * Measurement contract for the scroll engine (useFlowEngine):
 *   [data-flow-section="i"]   — each section block (Tier 2 pacing)
 *   [data-flow-line-ms="ms"]  — a transcript-timed lyric line (Tier 3 sync);
 *                               only rendered when a section has timestamps
 *                               and no chord sheet (chords are the better
 *                               visual; timestamps belong to transcript lines).
 */
const FlowDocument = ({ sections }: FlowDocumentProps) => (
  <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
    {sections.map((section, i) => {
      const color = getSectionColor(section.label);
      const hasChords = !!section.chordLines && section.chordLines.length > 0;
      const hasTimedLines = !!section.transcriptLines && section.transcriptLines.length > 0;
      return (
        <section key={section.id} data-flow-section={i} aria-label={section.label}>
          {/* Gentle divider — the section's color for peripheral recognition */}
          <div className="flex items-center justify-center gap-3" style={{ padding: "28px 0 16px" }}>
            <span aria-hidden style={{ width: 34, height: 3, borderRadius: 9999, background: color.bg, opacity: 0.6 }} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: color.bg,
              }}
            >
              {section.label}
            </span>
            <span aria-hidden style={{ width: 34, height: 3, borderRadius: 9999, background: color.bg, opacity: 0.6 }} />
          </div>

          {hasChords ? (
            // Lyrics + chord chips — the closest thing to the paper chart.
            <div className="flex flex-col" style={{ gap: 10 }}>
              {section.chordLines!.map((line, li) => (
                <div key={li} style={{ textAlign: "center" }}>
                  <ChordLine
                    line={line}
                    lyricSize="clamp(1.375rem, 4.6vmin, 2rem)"
                    chordSize="clamp(0.875rem, 2.8vmin, 1.125rem)"
                    chordRow="1.6rem"
                    emphasized
                  />
                </div>
              ))}
            </div>
          ) : hasTimedLines ? (
            // Timed transcript lines — each carries its startMs so the engine
            // can scroll it to the reading line at its real moment (Tier 3).
            <div className="flex flex-col" style={{ gap: 10 }}>
              {section.transcriptLines!.map((line, li) => (
                <p
                  key={li}
                  data-flow-line-ms={line.startMs}
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "clamp(1.375rem, 4.6vmin, 2rem)",
                    lineHeight: 1.45,
                    color: "var(--cog-charcoal)",
                    textAlign: "center",
                  }}
                >
                  {line.text}
                </p>
              ))}
            </div>
          ) : section.lyrics ? (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "clamp(1.375rem, 4.6vmin, 2rem)",
                lineHeight: 1.55,
                color: "var(--cog-charcoal)",
                textAlign: "center",
                whiteSpace: "pre-wrap",
              }}
            >
              {section.lyrics}
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-body)",
                fontSize: "0.9375rem",
                color: "var(--cog-muted)",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              no lyrics yet — play on
            </p>
          )}
        </section>
      );
    })}
  </div>
);

export default FlowDocument;
