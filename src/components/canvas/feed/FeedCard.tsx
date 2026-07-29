import { memo, type ReactNode, type KeyboardEvent } from "react";
import { Mic } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasCardInteractions } from "@/components/canvas/CanvasCard";
import type { CardFaceProps } from "@/components/canvas/cardFace";
import LyricCard from "@/components/canvas/LyricCard";
import VoiceMemoCard from "@/components/canvas/VoiceMemoCard";
import HumCard from "@/components/canvas/HumCard";
import ChordCard from "@/components/canvas/ChordCard";
import NoteCard from "@/components/canvas/NoteCard";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import { GLORY_PLAYING_SHADOW, PLAYBACK_TONE, TYPE_TONE } from "@/lib/canvas/glorySpectrum";
import type { ComponentType } from "react";

/**
 * FeedCard — one idea, full-width, in the Glory Feed.
 *
 * The typed FACES (lyric serif, playable waveform, chord chips, ruled note)
 * are exactly the ones the spatial map renders — one visual language, two
 * lenses. The frame is feed-native: full-width paper, the type's tone stripe,
 * a calm settle on entry, and the selected action row (Edit / → Final / ⋯)
 * driven by the same host interactions the map uses, so every verb behaves
 * identically in both views.
 */

const FACES: Record<string, ComponentType<CardFaceProps>> = {
  lyric: LyricCard,
  section: LyricCard,
  voice: VoiceMemoCard,
  hum: HumCard,
  chord: ChordCard,
  note: NoteCard,
  scripture: NoteCard,
};

const btn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1,
  height: 44,
  borderRadius: 11,
  border: "none",
  cursor: "pointer",
  backgroundColor: bg,
  color,
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "var(--font-body)",
});

export interface FeedCardProps {
  card: CanvasBoardCard;
  selected: boolean;
  interactions: CanvasCardInteractions;
  adornment?: ReactNode;
  /** The cinematic hand-off: called with the card's rect so the feed can fly
   *  a ghost toward the Final tab before the promote actually runs. */
  onFlyToFinal?: (card: CanvasBoardCard, rect: DOMRect) => void;
  /** Entrance-cascade stagger: cards settle onto the page one after another
   *  like pages laid on a desk, not a wall appearing at once. */
  entranceDelayMs?: number;
}

const FeedCard = memo(function FeedCard({ card, selected, interactions, adornment, onFlyToFinal, entranceDelayMs = 0 }: FeedCardProps) {
  const color = getCreatorColor(card.contributor);
  const tone = TYPE_TONE[card.type] ?? TYPE_TONE.note;
  const Face = FACES[card.type] ?? LyricCard;
  const isVoice = card.type === "voice" || card.type === "hum";
  const playing = Boolean(interactions.playing);
  const dimmed = Boolean(card.isDimmedReference);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      interactions.onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${isVoice ? "Voice" : card.type} idea: ${card.title || card.section || "untitled"} by ${card.contributor}${playing ? ", playing now" : ""}`}
      onClick={interactions.onSelect}
      onKeyDown={onKeyDown}
      data-feed-card={card.id}
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 18,
        backgroundColor: dimmed ? "rgba(255,252,247,0.72)" : "#FFFCF7",
        border: playing
          ? `2px solid ${PLAYBACK_TONE.base}`
          : selected
          ? "2px solid var(--cog-gold, #B8953A)"
          : dimmed
          ? `1.5px dashed ${tone.dim}`
          : "1.5px solid rgba(28,26,23,0.08)",
        boxShadow: playing
          ? GLORY_PLAYING_SHADOW
          : selected
          ? "0 0 0 4px rgba(184,149,58,0.16), 0 12px 32px -10px rgba(184,149,58,0.28)"
          : dimmed
          ? "none"
          : "0 4px 16px rgba(28,26,23,0.06), 0 1px 3px rgba(28,26,23,0.05)",
        opacity: dimmed ? 0.6 : 1,
        padding: "13px 14px 12px 18px",
        boxSizing: "border-box",
        cursor: "pointer",
        userSelect: "none",
        // transform included so the tactile press (CSS :active) EASES rather
        // than snaps — inline transition wins over the stylesheet's.
        transition: "box-shadow 200ms ease, border-color 200ms ease, opacity 280ms ease, transform 150ms cubic-bezier(0.25,0.46,0.45,0.94)",
        // `both` holds the card invisible through its cascade delay, then it
        // settles like paper laid on a desk.
        animation: "cog-feed-enter 380ms cubic-bezier(0.22,1,0.36,1) both",
        animationDelay: `${entranceDelayMs}ms`,
      }}
    >
      {/* The type's tone stripe — same material language as the map. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: 7, top: 13, bottom: 13, width: 4, borderRadius: 4,
          background: `linear-gradient(180deg, ${tone.base}, ${tone.base}59)`,
          opacity: dimmed ? 0.5 : 1,
        }}
      />

      <Face
        card={card}
        color={color}
        tone={tone}
        selected={selected}
        playing={playing}
        onPlay={interactions.onPlay}
      />

      {/* One-tap layering — always visible on audio cards (a gesture-hidden
          layer path failed the intuition test) but in the QUIET register:
          gold belongs to the one primary act per screen, and this pill is on
          every voice card. The stack sheet stays the mixing room. */}
      {isVoice && !dimmed && interactions.onRecordOver && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); interactions.onRecordOver?.(); }}
          aria-label="Record a layer over this take"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            minHeight: 44, padding: "0 14px", marginTop: 8,
            borderRadius: 999, cursor: "pointer",
            backgroundColor: "rgba(28,26,23,0.04)",
            border: "1.5px solid rgba(28,26,23,0.12)",
            color: "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600,
          }}
        >
          <Mic size={14} strokeWidth={2.1} />
          Layer over this
        </button>
      )}

      {/* Who wrote it — the colored dot carries identity; the name reads as
          quiet metadata, never a second headline. */}
      {!dimmed && card.contributor && (
        <p
          style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 10.5, fontWeight: 500, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color.base, flexShrink: 0 }} />
          {card.contributor}
        </p>
      )}
      {dimmed && (
        <p style={{ fontSize: 10, color: color.dark, marginTop: 8, fontWeight: 600 }}>
          ↳ Already part of the song
        </p>
      )}

      {adornment}

      {/* Selected action row — the same verbs as the map, feed-native frame. */}
      {selected && !dimmed && (
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isVoice && interactions.onOpenStack ? (
            // The stack button earns its slot only once layers EXIST — before
            // that, "Layer over this" (above) is the one layering verb and a
            // duplicate "Layers" label was pure confusion.
            interactions.layerCount ? (
              <button
                onClick={(e) => { e.stopPropagation(); interactions.onOpenStack?.(); }}
                style={btn(`${color.base}16`, color.dark)}
                aria-label={`Open the stack — ${interactions.layerCount} layers`}
              >
                {`Layers · ${interactions.layerCount}`}
              </button>
            ) : null
          ) : interactions.onEdit ? (
            <button
              onClick={(e) => { e.stopPropagation(); interactions.onEdit?.(); }}
              style={btn(`${color.base}16`, color.dark)}
              aria-label="Edit this idea"
            >
              Edit
            </button>
          ) : null}

          {card.tree === "ideas" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget.closest("[data-feed-card]") as HTMLElement | null)?.getBoundingClientRect();
                if (rect && onFlyToFinal) onFlyToFinal(card, rect);
                else interactions.onMoveToFinal();
              }}
              style={btn("var(--cog-gold)", "#FFF")}
              aria-label="Move this idea into the final song"
            >
              → Final
            </button>
          )}
          {card.tree === "final" && (
            <button
              onClick={(e) => { e.stopPropagation(); interactions.onMoveToIdeas(); }}
              style={btn("rgba(0,0,0,0.06)", "var(--cog-warm-gray)")}
              aria-label="Return this to Ideas"
            >
              ← Ideas
            </button>
          )}

          {interactions.onMore && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); interactions.onMore?.(); }}
              style={{ width: 44, height: 44, borderRadius: 11, border: "none", cursor: "pointer", backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", fontSize: 18, fontWeight: 700, fontFamily: "var(--font-body)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}
              aria-label="More actions"
            >
              ⋯
            </button>
          )}
        </div>
      )}

      {/* Dimmed cards stay reachable — bring the idea back with one tap. */}
      {selected && dimmed && interactions.onRestore && (
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); interactions.onRestore?.(); }}
            style={btn(`${color.base}16`, color.dark)}
            aria-label="Bring this idea back to the board"
          >
            Bring back
          </button>
        </div>
      )}
    </div>
  );
});

FeedCard.displayName = "FeedCard";
export default FeedCard;
