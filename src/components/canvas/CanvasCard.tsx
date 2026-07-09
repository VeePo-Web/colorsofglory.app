import { memo, useRef, type ComponentType, type ReactNode } from "react";
import { useCanvasViewport } from "@/components/canvas/CanvasViewport";
import CardShell, { type CardInteractionState } from "@/components/canvas/CardShell";
import LyricCard from "@/components/canvas/LyricCard";
import VoiceMemoCard from "@/components/canvas/VoiceMemoCard";
import HumCard from "@/components/canvas/HumCard";
import ChordCard from "@/components/canvas/ChordCard";
import NoteCard from "@/components/canvas/NoteCard";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import { cardWidth, DRAG_THRESHOLD_PX } from "@/lib/canvas/canvasGeometry";
import type { CanvasBoardCard, CanvasBoardCardType } from "@/lib/canvas/canvasTypes";
import type { CardFaceProps } from "@/components/canvas/cardFace";

/**
 * The per-card wiring the host hands across the D1 boundary. CanvasCard renders
 * the pixels; what each callback DOES stays in the host with the D2 hooks.
 */
export interface CanvasCardInteractions {
  onSelect: () => void;
  onMoveToFinal: () => void;
  onMoveToIdeas: () => void;
  /** Commit a finished drag: the card's new canvas-space position. */
  onMove: (id: string, x: number, y: number) => void;
  layerCount?: number;
  onOpenStack?: () => void;
  canCompare?: boolean;
  onCompare?: () => void;
  onSuggestLine?: () => void;
  onAddToListenPath?: () => void;
  listenIndex?: number;
  onMergeSelect?: () => void;
  mergeSelected?: boolean;
  onEdit?: () => void;
  onMore?: () => void;
  finalOrder?: number;
}

interface CanvasCardProps extends CanvasCardInteractions {
  card: CanvasBoardCard;
  selected: boolean;
  /** D3 slot: a calm per-card marker (e.g. pending-review dot), never red. */
  adornment?: ReactNode;
}

const FACES: Record<CanvasBoardCardType, ComponentType<CardFaceProps>> = {
  lyric: LyricCard,
  section: LyricCard,
  voice: VoiceMemoCard,
  hum: HumCard,
  chord: ChordCard,
  note: NoteCard,
  scripture: NoteCard,
};

const DIM_LABEL: Record<string, string> = {
  merged: "↳ Merged into section",
  compare_kept: "↳ Kept for reference",
  moved_to_final: "↳ Used in Final",
};

const btn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
  backgroundColor: bg, color, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
});

/**
 * CanvasCard — the orchestrator that turns a CanvasBoardCard into a rendered
 * card: CardShell frame + a typed face (lyric/voice/hum/chord/note) + the
 * uniform interaction layer (listen-path #, arrangement #, merge ring, dim
 * label, selected action row, D3 adornment). Drag VISUALS only — every meaning
 * (move-to-final, merge, listen) is a callback into the host's D2 hooks.
 */
const CanvasCard = memo(function CanvasCard({
  card,
  selected,
  adornment,
  onSelect,
  onMoveToFinal,
  onMoveToIdeas,
  onMove,
  layerCount = 0,
  onOpenStack,
  canCompare = false,
  onCompare,
  onSuggestLine,
  onEdit,
  onAddToListenPath,
  listenIndex,
  onMergeSelect,
  mergeSelected = false,
  onMore,
  finalOrder,
}: CanvasCardProps) {
  const { screenToCanvas } = useCanvasViewport();
  const elRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startScreen: { x: number; y: number };
    startCard: { x: number; y: number };
    lastX: number; lastY: number; moved: boolean;
  } | null>(null);
  const justDragged = useRef(false);

  const color = getCreatorColor(card.contributor);
  const isVoice = card.type === "voice" || card.type === "hum";
  const state: CardInteractionState = card.isDimmedReference ? "dimmed" : selected ? "selected" : "default";
  const Face = FACES[card.type] ?? LyricCard;

  const hasMore =
    Boolean(onMore) &&
    (Boolean(canCompare && onCompare) ||
      (card.type === "lyric" && Boolean(onSuggestLine)) ||
      Boolean(onAddToListenPath) ||
      (card.tree === "ideas" && !card.isDimmedReference && Boolean(onMergeSelect)) ||
      (isVoice && Boolean(onOpenStack)));

  // ── Drag: pointer-capture, direct-to-DOM per frame, one commit on release ──
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    justDragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startCard: { x: card.x, y: card.y },
      lastX: card.x, lastY: card.y, moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    if (!st) return;
    if (!st.moved) {
      const dx = e.clientX - st.startScreen.x;
      const dy = e.clientY - st.startScreen.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      st.moved = true;
      const el = elRef.current;
      if (el) {
        // Physical lift the instant a real drag begins (Apple/CapCut feel).
        el.style.transform = "scale(1.06) rotate(1.5deg) translateZ(0)";
        el.style.zIndex = "50";
        el.style.boxShadow = `0 24px 60px ${color.glow}, 0 0 0 2px ${color.base}`;
        el.style.cursor = "grabbing";
        el.style.transition = "none";
      }
    }
    const startCanvas = screenToCanvas(st.startScreen.x, st.startScreen.y);
    const currCanvas = screenToCanvas(e.clientX, e.clientY);
    const newX = st.startCard.x + (currCanvas.x - startCanvas.x);
    const newY = st.startCard.y + (currCanvas.y - startCanvas.y);
    st.lastX = newX; st.lastY = newY;
    const el = elRef.current;
    if (el) { el.style.left = `${newX}px`; el.style.top = `${newY}px`; }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    if (!st) return;
    e.currentTarget.releasePointerCapture(st.pointerId);
    drag.current = null;
    const el = elRef.current;
    if (el) {
      // Hand transform/shadow/z/left/top back to React's style prop.
      el.style.transform = ""; el.style.zIndex = ""; el.style.boxShadow = "";
      el.style.cursor = ""; el.style.transition = "";
    }
    if (st.moved) {
      justDragged.current = true;
      onMove(card.id, st.lastX, st.lastY);
    }
  };

  const handleClick = () => {
    if (justDragged.current) { justDragged.current = false; return; }
    onSelect();
  };

  const ariaLabel =
    `${card.type === "voice" || card.type === "hum" ? "Voice" : card.type} idea: ${card.title}` +
    ` by ${card.contributor}` +
    (finalOrder != null ? `, arrangement position ${finalOrder}` : "") +
    (listenIndex != null ? `, listen path stop ${listenIndex + 1}` : "");

  return (
    <CardShell
      ref={elRef}
      color={color}
      state={state}
      mergeSelected={mergeSelected}
      width={cardWidth(card.type)}
      left={card.x}
      top={card.y}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={handleClick}
    >
      {/* Arrangement position — the song's set-list number (Final cards) */}
      {finalOrder != null && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: -10, left: -10,
            minWidth: 24, height: 24, padding: "0 6px", borderRadius: 12,
            backgroundColor: "#53AB8B", color: "#FFF", fontSize: 12, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(83,171,139,0.40)", border: "2px solid #FAFAF6",
            fontFamily: "var(--font-body)",
          }}
        >
          {finalOrder}
        </div>
      )}

      {/* The typed face */}
      <Face card={card} color={color} selected={selected} />

      {/* Who wrote it — collaboration made visible (color always paired with name) */}
      {!card.isDimmedReference && (
        <p style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, color: color.dark, fontFamily: "var(--font-body)", letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.contributor}
        </p>
      )}

      {/* Kept-reference label — nothing is ever deleted */}
      {card.isDimmedReference && card.dimReason && (
        <p style={{ fontSize: 10, color: color.dark, marginTop: 8, fontWeight: 600 }}>
          {DIM_LABEL[card.dimReason] ?? "↳ Kept for reference"}
        </p>
      )}

      {/* Selected action row — one primary + promote + More (calm, not a wall) */}
      {selected && !card.isDimmedReference && (
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isVoice && onOpenStack ? (
            <button onClick={(e) => { e.stopPropagation(); onOpenStack(); }} style={btn(`${color.base}16`, color.dark)} aria-label={layerCount > 0 ? `Open stack — ${layerCount} layers` : "Open stack — record over this"}>
              {layerCount > 0 ? `Layers ${layerCount}` : "Layers"}
            </button>
          ) : onEdit ? (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={btn(`${color.base}16`, color.dark)} aria-label="Edit this idea">
              Edit
            </button>
          ) : null}

          {card.tree === "ideas" && (
            <button onClick={(e) => { e.stopPropagation(); onMoveToFinal(); }} style={btn("var(--cog-gold)", "#FFF")} aria-label="Move this idea to the Final song">
              → Final
            </button>
          )}
          {card.tree === "final" && (
            <button onClick={(e) => { e.stopPropagation(); onMoveToIdeas(); }} style={btn("rgba(0,0,0,0.06)", "var(--cog-warm-gray)")} aria-label="Return this to Ideas">
              ← Ideas
            </button>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMore?.(); }}
              style={{ width: 40, height: 34, borderRadius: 9, border: "none", cursor: "pointer", backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", fontSize: 16, fontWeight: 700, fontFamily: "var(--font-body)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
              aria-label="More actions"
            >
              ⋯
            </button>
          )}
        </div>
      )}

      {/* Listen-path stop number — bottom-left gold badge */}
      {listenIndex != null && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", bottom: 8, left: 8,
            width: 22, height: 22, borderRadius: "50%",
            backgroundColor: "var(--cog-gold, #B8953A)", color: "#FFF", fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(184,149,58,0.40)", fontFamily: "var(--font-body)",
          }}
        >
          {listenIndex + 1}
        </div>
      )}

      {/* D3 slot: calm per-card marker (pending review etc.) */}
      {adornment}
    </CardShell>
  );
});

CanvasCard.displayName = "CanvasCard";
export default CanvasCard;
