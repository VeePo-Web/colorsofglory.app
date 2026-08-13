import { memo, useMemo } from "react";
import { Music } from "lucide-react";
import type { CardFaceProps } from "./cardFace";

const CHORD_RE = /^[A-G][#b]?(?:m|maj|min|sus|dim|aug|add|M)?\d{0,2}(?:\/[A-G][#b]?)?$/;

/** Pull chord tokens out of a free-text body ("Key: G · 74 BPM · C G Am F").
 *  The key phrase is lifted out FIRST so its letter can't masquerade as the
 *  opening chord, and "·"/em-dash separators never survive as garbage tags. */
function parseChords(body: string): { chords: string[]; rest: string } {
  let working = body;
  const restPre: string[] = [];
  const keyMatch = /\bkey[:\s]+([A-G][#b♯♭]?\s*(?:major|minor|m)?)\b/i.exec(working);
  if (keyMatch) {
    restPre.push(`Key ${keyMatch[1].trim()}`);
    working = working.replace(keyMatch[0], " ");
  }
  const tokens = working.split(/[\s,|>·—-]+/).map((t) => t.trim()).filter(Boolean);
  const chords: string[] = [];
  const rest: string[] = [];
  for (const t of tokens) (CHORD_RE.test(t) ? chords : rest).push(t);
  return {
    // The FULL progression — the face decides how many chips fit and says
    // "+N" for the overflow (a silent slice(0,8) made the card lie about
    // a 12-chord progression).
    chords,
    rest: [...restPre, rest.join(" ")].filter(Boolean).join(" · "),
  };
}

/** How many chips the face shows before folding the tail into a "+N" chip. */
const MAX_CHIPS = 8;

/**
 * ChordCard — the face for a chord/arrangement idea. The progression reads as
 * gold-tinted chips (the app's chord-chip signature) in rows of four; key/BPM
 * ride below as quiet tags. Presentational only — see cardFace.ts.
 */
const ChordCard = memo(({ card, tone }: CardFaceProps) => {
  const { chords, rest } = useMemo(() => parseChords(card.body || ""), [card.body]);

  const shown = chords.slice(0, MAX_CHIPS);
  const overflow = chords.length - shown.length;
  const rows: string[][] = [];
  for (let i = 0; i < shown.length; i += 4) rows.push(shown.slice(i, i + 4));

  // Dual-key suppression: when meta already carries the key ("G · 74 BPM"),
  // the parsed "Key G" tag repeated the same fact chip-by-chip beside it.
  const keyInMeta = /\bkey\b|^[A-G][#b♯♭]?\b/i.test(card.meta ?? "");
  const restShown = keyInMeta && rest.startsWith("Key ") ? rest.replace(/^Key [^·]*·?\s*/, "") : rest;

  return (
    <>
      {/* Serif headline — which part of the song this harmonic bed serves */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Music size={12} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <span
          style={{
            flex: 1, minWidth: 0,
            fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)",
            fontFamily: "var(--font-display)", lineHeight: 1.15,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {card.section || card.title || "Chords"}
        </span>
      </div>

      {/* Chord chips (or the raw body if no chords parsed) */}
      {shown.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }} aria-label={`Chord progression: ${chords.join(", ")}`}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {row.map((chord, ci) => (
                <span
                  key={`${ri}-${ci}`}
                  style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-body)",
                    padding: "3px 8px", borderRadius: 9999,
                    // The locked chord-chip signature: gold-pale bg, charcoal
                    // text — never a creator color.
                    backgroundColor: "var(--cog-gold-pale, #E8D5A0)",
                    border: "1px solid rgba(184,149,58,0.35)",
                    color: "var(--cog-charcoal, #1C1A17)", letterSpacing: "0.02em",
                  }}
                >
                  {chord}
                </span>
              ))}
              {/* The honest tail — the card never pretends 8 chips ARE the
                  whole progression. */}
              {ri === rows.length - 1 && overflow > 0 && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-body)",
                    padding: "3px 8px", borderRadius: 9999,
                    backgroundColor: "rgba(0,0,0,0.05)",
                    color: "var(--cog-warm-gray)", letterSpacing: "0.02em",
                  }}
                >
                  +{overflow}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--cog-warm-gray)", lineHeight: 1.5, fontFamily: "var(--font-body)", marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {card.body || "Tap to add a progression…"}
        </p>
      )}

      {/* Key / BPM / leftover text tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {card.meta && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
            ♪ {card.meta}
          </span>
        )}
        {restShown && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {restShown}
          </span>
        )}
      </div>
    </>
  );
});

ChordCard.displayName = "ChordCard";
export default ChordCard;
