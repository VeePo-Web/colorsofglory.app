import { memo } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, Mic, FileText, Music, BookOpen, StickyNote } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasCardInteractions } from "@/components/canvas/CanvasCard";
import { GLORY, PLAYBACK_TONE } from "@/lib/canvas/glorySpectrum";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import type { ComponentType } from "react";

/**
 * FinalListenPage — the Final song as a LISTEN MODE, deliberately its own
 * surface (the user's call: "the final should be like a listen mode, with its
 * own UI and UX from the ideas canvas").
 *
 * Ideas is gold and exploratory; Final is SAGE and resolved — a set list you
 * can hear. One dominant action (▶ Play the song — gold, primary actions are
 * always gold), rows numbered in running order, the sounding row lit in the
 * playback cobalt, reorder by honest up/down (44px, a11y-first, no drag
 * required), and every removal returns the idea safely to Ideas.
 */

const TYPE_ICON: Record<string, ComponentType<{ size?: number | string; strokeWidth?: number | string; style?: React.CSSProperties }>> = {
  lyric: FileText,
  section: FileText,
  voice: Mic,
  hum: Mic,
  chord: Music,
  scripture: BookOpen,
  note: StickyNote,
};

const iconBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 11,
  border: "1px solid rgba(28,26,23,0.10)",
  backgroundColor: "rgba(255,255,255,0.8)",
  color: "var(--cog-warm-gray)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

export interface FinalListenPageProps {
  cards: CanvasBoardCard[];
  selectedId: string | null;
  getInteractions: (card: CanvasBoardCard) => CanvasCardInteractions;
  listening: boolean;
  currentId: string | null;
  onPlaySong: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReorder: (id: string, delta: number) => void;
  isViewer: boolean;
  onGoToIdeas: () => void;
}

const FinalListenPage = memo(function FinalListenPage({
  cards,
  selectedId,
  getInteractions,
  listening,
  currentId,
  onPlaySong,
  onPlayPause,
  onNext,
  onPrev,
  onReorder,
  isViewer,
  onGoToIdeas,
}: FinalListenPageProps) {
  if (cards.length === 0) {
    return (
      <div style={{ padding: "56px 24px", textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
            background: `linear-gradient(140deg, ${GLORY.sage.bg}, ${GLORY.sage.glow})`,
            border: `1.5px solid ${GLORY.sage.dim}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Play size={22} strokeWidth={1.8} style={{ color: GLORY.sage.dark, marginLeft: 2 }} />
        </div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", margin: "0 0 8px" }}>
          The song&rsquo;s final shape lives here
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--cog-warm-gray)", lineHeight: 1.6, margin: "0 0 20px" }}>
          When an idea is ready, send it over with <strong>→ Final</strong>. The parts land here in
          running order — then press play and hear the whole song.
        </p>
        <button
          type="button"
          onClick={onGoToIdeas}
          style={{
            minHeight: 48, padding: "0 22px", borderRadius: 14, border: "none", cursor: "pointer",
            backgroundColor: "var(--cog-gold)", color: "#FFF",
            fontFamily: "var(--font-body)", fontSize: 14.5, fontWeight: 700,
            boxShadow: "0 6px 18px rgba(184,149,58,0.35)",
          }}
        >
          Back to the ideas
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 220px" }}>
      {/* The song header — sage identity, one dominant gold action. */}
      <div
        style={{
          borderRadius: 20,
          background: `linear-gradient(150deg, #FFFFFF 0%, #F6F9F3 100%)`,
          border: `1.5px solid ${GLORY.sage.dim}`,
          boxShadow: `0 12px 36px ${GLORY.sage.glow}, 0 2px 8px rgba(28,26,23,0.06)`,
          padding: "18px 18px 16px",
          marginBottom: 18,
        }}
      >
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: GLORY.sage.dark, fontFamily: "var(--font-body)" }}>
          The final song
        </p>
        <p style={{ margin: "6px 0 14px", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: "var(--cog-charcoal)" }}>
          {cards.length} {cards.length === 1 ? "part" : "parts"}, in order
        </p>
        {listening ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} role="group" aria-label="Song playback">
            <button type="button" onClick={onPrev} style={iconBtn} aria-label="Previous part">
              <SkipBack size={17} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onPlayPause}
              aria-label="Pause the song"
              style={{
                flex: 1, minHeight: 52, borderRadius: 15, border: "none", cursor: "pointer",
                backgroundColor: "var(--cog-gold)", color: "#FFF",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 800,
                boxShadow: "0 6px 18px rgba(184,149,58,0.35)",
              }}
            >
              <Pause size={18} strokeWidth={2} fill="currentColor" />
              Playing the song
            </button>
            <button type="button" onClick={onNext} style={iconBtn} aria-label="Next part">
              <SkipForward size={17} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPlaySong}
            aria-label="Play the whole song, top to bottom"
            style={{
              width: "100%", minHeight: 52, borderRadius: 15, border: "none", cursor: "pointer",
              backgroundColor: "var(--cog-gold)", color: "#FFF",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 800,
              boxShadow: "0 6px 18px rgba(184,149,58,0.35)",
            }}
          >
            <Play size={18} strokeWidth={2} fill="currentColor" style={{ marginLeft: 2 }} />
            Play the song
          </button>
        )}
      </div>

      {/* The set list — numbered, sounding row lit, honest reorder. */}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {cards.map((card, i) => {
          const interactions = getInteractions(card);
          const sounding = currentId === card.id && listening;
          const selected = selectedId === card.id;
          const Icon = TYPE_ICON[card.type] ?? StickyNote;
          const color = getCreatorColor(card.contributor);
          const preview = (card.body || card.meta || "").split("\n")[0];
          return (
            <li
              key={card.id}
              style={{
                // The set list settles in top-to-bottom — same cascade grammar
                // as the Ideas stream (reduced-motion neutralizes it upstream).
                animation: "cog-feed-enter 380ms cubic-bezier(0.22,1,0.36,1) both",
                animationDelay: `${Math.min(i * 40, 320)}ms`,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`Part ${i + 1}: ${card.section || card.title || card.type}${sounding ? ", sounding now" : ""}`}
                onClick={interactions.onSelect}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); interactions.onSelect(); }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  borderRadius: 16, padding: "12px 12px 12px 14px",
                  backgroundColor: sounding ? "#F3F7FB" : "#FFFCF7",
                  border: sounding
                    ? `2px solid ${PLAYBACK_TONE.base}`
                    : selected
                    ? `2px solid var(--cog-gold, #B8953A)`
                    : "1.5px solid rgba(28,26,23,0.08)",
                  boxShadow: sounding ? `0 8px 24px ${PLAYBACK_TONE.glow}` : "0 2px 10px rgba(28,26,23,0.05)",
                  cursor: "pointer",
                  transition: "border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease",
                }}
              >
                {/* Running-order number — the map's sage set-list badge, enlarged. */}
                <span
                  aria-hidden="true"
                  style={{
                    minWidth: 30, height: 30, borderRadius: 15, padding: "0 8px", flexShrink: 0,
                    backgroundColor: sounding ? PLAYBACK_TONE.dark : GLORY.sage.dark,
                    color: "#FFF", fontSize: 13, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-body)",
                    transition: "background-color 200ms ease",
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 700, color: "var(--cog-charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Icon size={13} strokeWidth={1.9} style={{ color: color.base, flexShrink: 0 }} />
                    {card.section || card.title || "Part"}
                  </p>
                  {preview && (
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {preview}
                    </p>
                  )}
                </div>
                {!isViewer && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={(e) => { e.stopPropagation(); onReorder(card.id, -1); }}
                      aria-label={`Move ${card.section || card.title || "this part"} earlier`}
                      style={{ ...iconBtn, width: 40, height: 40, opacity: i === 0 ? 0.35 : 1, cursor: i === 0 ? "default" : "pointer" }}
                    >
                      <ChevronUp size={16} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      disabled={i === cards.length - 1}
                      onClick={(e) => { e.stopPropagation(); onReorder(card.id, 1); }}
                      aria-label={`Move ${card.section || card.title || "this part"} later`}
                      style={{ ...iconBtn, width: 40, height: 40, opacity: i === cards.length - 1 ? 0.35 : 1, cursor: i === cards.length - 1 ? "default" : "pointer" }}
                    >
                      <ChevronDown size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                )}
              </div>
              {/* Selected row: the safe exits, right where the decision is. */}
              {selected && !isViewer && (
                <div style={{ display: "flex", gap: 6, marginTop: 6, padding: "0 2px" }} onClick={(e) => e.stopPropagation()}>
                  {interactions.onEdit && (
                    <button
                      type="button"
                      onClick={interactions.onEdit}
                      style={{ flex: 1, height: 44, borderRadius: 11, border: "none", cursor: "pointer", backgroundColor: `${color.base}16`, color: color.dark, fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-body)" }}
                      aria-label="Edit this part"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={interactions.onMoveToIdeas}
                    style={{ flex: 1, height: 44, borderRadius: 11, border: "none", cursor: "pointer", backgroundColor: "rgba(0,0,0,0.06)", color: "var(--cog-warm-gray)", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-body)" }}
                    aria-label="Return this part to Ideas — nothing is deleted"
                  >
                    ← Back to Ideas
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p style={{ marginTop: 16, fontSize: 11, color: "var(--cog-muted)", fontFamily: "var(--font-body)", textAlign: "center" }}>
        Removing a part returns it to Ideas — nothing is ever deleted.
      </p>
    </div>
  );
});

FinalListenPage.displayName = "FinalListenPage";
export default FinalListenPage;
