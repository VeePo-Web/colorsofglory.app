import { memo, useMemo } from "react";
import { Music } from "lucide-react";
import { getCreatorInitials } from "@/lib/canvas/creatorColors";
import type { CardFaceProps } from "./cardFace";

const CHORD_RE = /^[A-G][#b]?(?:m|maj|min|sus|dim|aug|add|M)?\d{0,2}(?:\/[A-G][#b]?)?$/;

/** Pull chord tokens out of a free-text body ("C - G - Am - F, 74 BPM"). */
function parseChords(body: string): { chords: string[]; rest: string } {
  const tokens = body.split(/[\s,|>-]+/).map((t) => t.trim()).filter(Boolean);
  const chords: string[] = [];
  const rest: string[] = [];
  for (const t of tokens) (CHORD_RE.test(t) ? chords : rest).push(t);
  return { chords: chords.slice(0, 8), rest: rest.join(" ") };
}

/**
 * ChordCard — the face for a chord/arrangement idea. The progression reads as
 * gold-tinted chips (the app's chord-chip signature) in rows of four; key/BPM
 * ride below as quiet tags. Presentational only — see cardFace.ts.
 */
const ChordCard = memo(({ card, color }: CardFaceProps) => {
  const initials = getCreatorInitials(card.contributor);
  const { chords, rest } = useMemo(() => parseChords(card.body || ""), [card.body]);

  const rows: string[][] = [];
  for (let i = 0; i < chords.length; i += 4) rows.push(chords.slice(i, i + 4));

  return (
    <>
      {/* Creator dot */}
      <div
        style={{
          position: "absolute", top: 11, right: 11,
          width: 22, height: 22, borderRadius: "50%", backgroundColor: color.base,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 800, color: "#FFF",
          border: "2px solid #FFFFFF", boxShadow: `0 2px 6px ${color.glow}`,
        }}
        title={card.contributor}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Icon + title/section */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: color.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Music size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--cog-muted)", fontFamily: "var(--font-body)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.section || card.title}
        </span>
      </div>

      {/* Chord chips (or the raw body if no chords parsed) */}
      {chords.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }} aria-label={`Chord progression: ${chords.join(", ")}`}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {row.map((chord, ci) => (
                <span
                  key={`${ri}-${ci}`}
                  style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-body)",
                    padding: "3px 8px", borderRadius: 9999,
                    backgroundColor: `${color.base}18`, border: `1px solid ${color.base}38`,
                    color: color.dark, letterSpacing: "0.02em",
                  }}
                >
                  {chord}
                </span>
              ))}
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
        {rest && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {rest}
          </span>
        )}
      </div>
    </>
  );
});

ChordCard.displayName = "ChordCard";
export default ChordCard;
