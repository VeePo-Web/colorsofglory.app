import { memo } from "react";
import { Sparkles } from "lucide-react";
import { GLORY, GLORY_PALE_GOLD } from "@/lib/canvas/glorySpectrum";
import type { GloryTone } from "@/lib/canvas/glorySpectrum";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { WeaveTargetView } from "@/lib/canvas/weave";

/**
 * WeaveTargetFace — the forming section while Weave mode is on (D1).
 *
 * Each line of the section wears its rhyme-scheme letter (A-A-B-B — same
 * letter, same calm tone; never a rainbow) and its syllable count; a line
 * that drifts from the section's meter carries a quiet amber underline —
 * guidance the writer can see, never a gate. Tapping a line opens Line Lab.
 * All labels/counts come from D2 (buildTargetView); this face only paints.
 */

interface WeaveTargetFaceProps {
  card: CanvasBoardCard;
  view: WeaveTargetView;
  onLineTap: (index: number) => void;
}

// Same letter = same tone. A calm cycle of three warm tones + pale gold,
// re-used from the glory spectrum — related light, not a rainbow.
const SCHEME_TONES: GloryTone[] = [GLORY.gold, GLORY.sage, GLORY.violet, GLORY_PALE_GOLD];

const schemeTone = (letter: string): GloryTone | null => {
  if (!letter || letter === "-") return null;
  return SCHEME_TONES[(letter.charCodeAt(0) - 65) % SCHEME_TONES.length];
};

const WeaveTargetFace = memo(({ card, view, onLineTap }: WeaveTargetFaceProps) => {
  const name = card.section || card.title || "Section";
  return (
    <>
      {/* Crown: the section being formed — marked with the weave spark. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: GLORY.gold.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={12} strokeWidth={1.8} style={{ color: GLORY.gold.base }} />
        </div>
        <span
          style={{
            flex: 1, minWidth: 0,
            fontSize: 16, fontWeight: 700, color: "var(--cog-charcoal)",
            fontFamily: "var(--font-display)", lineHeight: 1.15,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em",
            padding: "2px 7px", borderRadius: 9999, flexShrink: 0,
            backgroundColor: GLORY.gold.bg, color: GLORY.gold.dark, fontFamily: "var(--font-body)",
          }}
        >
          forming
        </span>
      </div>

      {view.lines.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--cog-muted)", fontStyle: "italic", fontFamily: "var(--font-display)", lineHeight: 1.5 }}>
          Empty for now — tap a glowing line in your Ideas to begin.
        </p>
      ) : (
        <>
        {/* Line Lab's door, visible — not only in the aria-label. */}
        <p style={{ fontSize: 10.5, fontWeight: 600, fontFamily: "var(--font-body)", color: "var(--cog-warm-gray)", marginBottom: 6 }}>
          Tap a line to shape its ending word
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }} role="group" aria-label={`${name} — ${view.lines.length} lines so far`}>
          {view.lines.map((text, i) => {
            const letter = view.scheme[i];
            const lt = schemeTone(letter);
            const drifts = view.drift[i];
            return (
              <button
                key={`${i}:${text}`}
                type="button"
                onClick={(e) => { e.stopPropagation(); onLineTap(i); }}
                aria-label={
                  `Line ${i + 1}: “${text}” — ` +
                  (letter !== "-" ? `rhyme group ${letter}, ` : "") +
                  `${view.syllables[i]} syllables` +
                  (drifts ? `, drifts from the section's ${view.medianSyllables} — tap to open Line Lab` : ". Tap to open Line Lab") +
                  "."
                }
                style={{
                  display: "flex", alignItems: "flex-start", gap: 7, width: "100%", textAlign: "left",
                  // 44px floor — these rows live INSIDE the zoomed canvas layer
                  // (see CanvasCard's btn note); anything smaller dies on zoom-out.
                  minHeight: 44, padding: "7px 6px", borderRadius: 9, cursor: "pointer",
                  backgroundColor: "transparent", border: "1px solid rgba(28,26,23,0.06)",
                  transition: "background-color 160ms ease, border-color 160ms ease",
                }}
              >
                {/* Rhyme ribbon chip — the scheme, live as the section forms. */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, fontFamily: "var(--font-body)",
                    backgroundColor: lt ? lt.bg : "rgba(28,26,23,0.05)",
                    color: lt ? lt.dark : "var(--cog-muted)",
                    border: lt ? `1px solid ${lt.base}40` : "1px solid transparent",
                  }}
                >
                  {letter === "-" ? "·" : letter}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "inline",
                      fontSize: 13, fontFamily: "var(--font-display)", lineHeight: 1.45,
                      color: "var(--cog-charcoal)",
                      // The drift flag: a quiet amber dotted underline — a
                      // pencil mark in the margin, never a red error.
                      borderBottom: drifts ? `2px dotted ${GLORY.amber.base}B3` : "none",
                      paddingBottom: drifts ? 1 : 0,
                    }}
                  >
                    {text}
                  </span>
                </span>
                {/* Syllable meter — right-aligned, quiet. */}
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0, marginTop: 2,
                    fontSize: 9.5, fontWeight: 700, fontFamily: "var(--font-body)",
                    color: drifts ? GLORY.amber.dark : "var(--cog-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {view.syllables[i]}
                </span>
              </button>
            );
          })}
        </div>
        </>
      )}
    </>
  );
});

WeaveTargetFace.displayName = "WeaveTargetFace";
export default WeaveTargetFace;
