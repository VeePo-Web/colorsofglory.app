import type { RhymeCandidate, RhymePaletteGroups } from "@/lib/lyrics/rhymePalette";
import { paletteIsEmpty } from "@/lib/lyrics/rhymePalette";

/**
 * RhymePaletteStrip — the calm, grouped candidate display of the Live Rhyme
 * Schemer. Pure presentation: groups (Perfect / Near · Slant / Related /
 * Phrase), each chip syllable-tagged; theme-matched chips wear a quiet gold
 * ring. Tapping a chip calls `onPick` — WHEN a line is being edited it inserts
 * at the cursor; otherwise reading is enough and the chips simply inform
 * (suggest, never write).
 *
 * Focus discipline: pointer-down is prevented on every chip so tapping one
 * NEVER blurs the lyric input — the editor keeps focus, the writer keeps flow.
 */

const GROUPS: Array<{ id: keyof RhymePaletteGroups; label: string }> = [
  { id: "perfect", label: "Perfect" },
  { id: "nearSlant", label: "Near · Slant" },
  { id: "phrase", label: "Phrase" },
  { id: "related", label: "Related" },
];

const TIER_WORD: Record<RhymeCandidate["tier"], string> = {
  perfect: "perfect rhyme",
  nearSlant: "near rhyme",
  related: "related word",
};

interface RhymePaletteStripProps {
  palette: RhymePaletteGroups | null;
  loading: boolean;
  /** True when the offline rung produced this palette (writer's own words). */
  fromOwnWords: boolean;
  seed: string;
  /** Insert the candidate at the cursor; null = no line being edited (read-only inspiration). */
  onPick: ((text: string) => void) | null;
}

const RhymePaletteStrip = ({ palette, loading, fromOwnWords, seed, onPick }: RhymePaletteStripProps) => {
  if (!seed) {
    return (
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", padding: "10px 2px", lineHeight: 1.5 }}>
        Sing or write a line — rhymes for its last word will gather here.
      </p>
    );
  }
  if (loading && !palette) {
    return (
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", padding: "10px 2px" }}>
        Listening for words against “{seed}”…
      </p>
    );
  }
  if (!palette || paletteIsEmpty(palette)) {
    return (
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", padding: "10px 2px", lineHeight: 1.5 }}>
        Nothing sings against “{seed}” just now — trust your own ear.
      </p>
    );
  }

  return (
    <div aria-label={`Rhyme options for ${seed}`}>
      {fromOwnWords && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 10.5, fontWeight: 600, color: "var(--cog-warm-gray)", marginBottom: 6 }}>
          Offline — these are from your own words.
        </p>
      )}
      {GROUPS.map(({ id, label }) => {
        const items = palette[id];
        if (items.length === 0) return null;
        return (
          <div key={id} style={{ marginBottom: 8 }}>
            <p
              style={{
                fontFamily: "var(--font-body)", fontSize: 9.5, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: "var(--cog-muted)", marginBottom: 4,
              }}
            >
              {label}
            </p>
            <div role="group" aria-label={`${label} rhymes`} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {items.map((c) => (
                <button
                  key={c.text}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onPick?.(c.text)}
                  aria-label={`${c.text}, ${TIER_WORD[c.tier]}, ${c.syllables} ${c.syllables === 1 ? "syllable" : "syllables"}${c.themeHit ? ", on your theme" : ""}${onPick ? ", tap to insert" : ""}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    minHeight: 36, padding: "0 11px", borderRadius: 999,
                    cursor: onPick ? "pointer" : "default",
                    backgroundColor: "rgba(255,255,255,0.9)",
                    border: c.themeHit
                      ? "1.5px solid var(--cog-border-gold, rgba(184,149,58,0.4))"
                      : "1px solid rgba(28,26,23,0.10)",
                    boxShadow: c.themeHit ? "0 0 0 3px rgba(184,149,58,0.08)" : "none",
                    fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                    color: "var(--cog-charcoal)",
                  }}
                >
                  {c.text}
                  <span
                    aria-hidden="true"
                    style={{ fontSize: 9, fontWeight: 700, color: "var(--cog-muted)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {c.syllables}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RhymePaletteStrip;
