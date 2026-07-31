import { memo, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, Mic, FileText, Music, BookOpen, StickyNote, Repeat } from "lucide-react";
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
  /** The song played all the way through — time for the next-moment card. */
  finished: boolean;
  /** Paused mid-song — the transport stays up so Resume is one tap. */
  paused: boolean;
  /** Play these parts in order — the page passes the full song or a
   *  play-from-here tail (tap any row to start THERE, Apple Music style). */
  onPlaySong: (ids: string[]) => void;
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
  finished,
  paused,
  onPlaySong,
  onPlayPause,
  onNext,
  onPrev,
  onReorder,
  isViewer,
  onGoToIdeas,
}: FinalListenPageProps) {
  // The performance follows itself: as playback advances, the sounding row
  // glides into view (guarded — scrollIntoView is absent in some envs).
  useEffect(() => {
    if (!listening || !currentId) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    try {
      document
        .querySelector(`[data-final-row="${currentId}"]`)
        ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    } catch {
      /* the row is still highlighted — the glide is a courtesy */
    }
  }, [currentId, listening]);

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
        {/* No eyebrow: the active "Final" tab sits 60px above — restating the
            surface's name here was the same fact twice. The serif line is the
            header's one claim. */}
        <p style={{ margin: "0 0 14px", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: "var(--cog-charcoal)" }}>
          {cards.length} {cards.length === 1 ? "part" : "parts"}, in order
        </p>
        {listening || paused ? (
          // The transport stays up while PAUSED too — otherwise Resume was
          // unreachable and the only visible control restarted the song.
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} role="group" aria-label="Song playback">
            <button type="button" onClick={onPrev} style={iconBtn} aria-label="Previous part">
              <SkipBack size={17} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onPlayPause}
              aria-label={paused ? "Resume the song" : "Pause the song"}
              style={{
                flex: 1, minHeight: 52, borderRadius: 15, cursor: "pointer",
                // While the song sounds, the SOUNDING ROW is the one bold thing —
                // the pause control is quiet chrome, not a second gold headline.
                border: `1.5px solid ${paused ? "var(--cog-gold)" : "rgba(28,26,23,0.14)"}`,
                backgroundColor: paused ? "var(--cog-gold)" : "rgba(255,255,255,0.85)",
                color: paused ? "#FFF" : "var(--cog-charcoal)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 700,
              }}
            >
              {paused ? (
                <Play size={18} strokeWidth={2} fill="currentColor" style={{ marginLeft: 2 }} />
              ) : (
                <Pause size={18} strokeWidth={2} fill="currentColor" />
              )}
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" onClick={onNext} style={iconBtn} aria-label="Next part">
              <SkipForward size={17} strokeWidth={2} />
            </button>
          </div>
        ) : finished ? null : (
          // While the finished card is up it owns the ONE gold play — the
          // header yields rather than doubling the same verb on one screen.
          <button
            type="button"
            onClick={() => onPlaySong(cards.map((c) => c.id))}
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

      {/* The finished moment — the song just played all the way through. The
          next most-likely things, one tap each (never a dead stop). */}
      {finished && !listening && (
        <div
          style={{
            borderRadius: 16,
            marginBottom: 14,
            padding: "14px 16px",
            background: `linear-gradient(150deg, #FFFFFF 0%, #F6F9F3 100%)`,
            border: `1.5px solid ${GLORY.sage.dim}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            animation: "cog-feed-enter 380ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--cog-charcoal)" }}>
            That&rsquo;s the whole song.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onPlaySong(cards.map((c) => c.id))}
              aria-label="Play the song again"
              style={{
                flex: 1, minHeight: 46, borderRadius: 12, border: "none", cursor: "pointer",
                backgroundColor: "var(--cog-gold)", color: "#FFF",
                fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Repeat size={15} strokeWidth={2.2} />
              Play it again
            </button>
            <button
              type="button"
              onClick={onGoToIdeas}
              aria-label="Keep shaping in Ideas"
              style={{
                flex: 1, minHeight: 46, borderRadius: 12, cursor: "pointer",
                border: "1px solid rgba(28,26,23,0.10)", backgroundColor: "rgba(255,255,255,0.8)",
                color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600,
              }}
            >
              Keep shaping in Ideas
            </button>
          </div>
        </div>
      )}

      {/* The set list — numbered, sounding row lit, honest reorder. Tapping a
          row PLAYS FROM THERE (tap the sounding row to pause) — in a listen
          mode, hearing is what a tap means. */}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {cards.map((card, i) => {
          const interactions = getInteractions(card);
          // The sounding row stays lit while PAUSED too — the song's place is
          // held, the read-along stays open, and tapping it resumes.
          const sounding = currentId === card.id && (listening || paused);
          const selected = selectedId === card.id;
          const Icon = TYPE_ICON[card.type] ?? StickyNote;
          const color = getCreatorColor(card.contributor);
          const preview = (card.body || card.meta || "").split("\n")[0];
          const tapRow = () => {
            interactions.onSelect();
            if (sounding) {
              onPlayPause();
              return;
            }
            // Play the song FROM this part to the end (Apple Music row tap).
            onPlaySong(cards.slice(i).map((c) => c.id));
          };
          return (
            <li
              key={card.id}
              data-final-row={card.id}
              style={{
                // One settle, no index-keyed stagger: a delay derived from `i`
                // restarts the CSS animation on every reorder (the renumbered
                // rows below a moved part would re-flash their entrance).
                animation: "cog-feed-enter 380ms cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`Part ${i + 1}: ${card.section || card.title || card.type}${
                  sounding
                    ? paused
                      ? ", paused here — tap to resume"
                      : ", sounding now — tap to pause"
                    : ", tap to play from here"
                }`}
                onClick={tapRow}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); tapRow(); }
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
                    {/* Neutral glyph: creator color on a type icon double-encoded
                        with no legend here — the set list keeps sage/cobalt only. */}
                    <Icon size={13} strokeWidth={1.9} style={{ color: "var(--cog-warm-gray)", flexShrink: 0 }} />
                    {card.section || card.title || "Part"}
                  </p>
                  {/* READ-ALONG: while this part sounds, its full words open
                      up in serif — you read the lyric as the song carries it.
                      At rest, the quiet one-line preview. */}
                  {sounding && card.body ? (
                    <p
                      style={{
                        margin: "5px 0 0",
                        fontSize: 13.5,
                        fontFamily: "var(--font-display)",
                        color: "var(--cog-charcoal)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-line",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 8,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {card.body}
                    </p>
                  ) : preview ? (
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {preview}
                    </p>
                  ) : null}
                </div>
                {!isViewer && !listening && !paused && (
                  // Quiet chrome: borderless ghost chevrons — the honest,
                  // always-reachable reorder path without 2N bordered buttons
                  // fighting the Play primary (targets stay 40px). They REST
                  // while the song sounds: the playing queue is a snapshot,
                  // and reordering under it visibly desynced the numbers.
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={(e) => { e.stopPropagation(); onReorder(card.id, -1); }}
                      aria-label={`Move ${card.section || card.title || "this part"} earlier`}
                      style={{ width: 40, height: 40, borderRadius: 11, border: "none", backgroundColor: "transparent", color: "var(--cog-warm-gray)", display: "flex", alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.25 : 0.7, cursor: i === 0 ? "default" : "pointer" }}
                    >
                      <ChevronUp size={16} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      disabled={i === cards.length - 1}
                      onClick={(e) => { e.stopPropagation(); onReorder(card.id, 1); }}
                      aria-label={`Move ${card.section || card.title || "this part"} later`}
                      style={{ width: 40, height: 40, borderRadius: 11, border: "none", backgroundColor: "transparent", color: "var(--cog-warm-gray)", display: "flex", alignItems: "center", justifyContent: "center", opacity: i === cards.length - 1 ? 0.25 : 0.7, cursor: i === cards.length - 1 ? "default" : "pointer" }}
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
