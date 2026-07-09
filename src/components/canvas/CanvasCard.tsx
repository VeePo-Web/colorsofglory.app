import { memo, useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { useCanvasViewport } from "@/components/canvas/CanvasViewport";
import CardShell, { type CardInteractionState } from "@/components/canvas/CardShell";
import LyricCard from "@/components/canvas/LyricCard";
import VoiceMemoCard from "@/components/canvas/VoiceMemoCard";
import HumCard from "@/components/canvas/HumCard";
import ChordCard from "@/components/canvas/ChordCard";
import NoteCard from "@/components/canvas/NoteCard";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import { cardWidth, clampToBoard, DRAG_THRESHOLD_PX } from "@/lib/canvas/canvasGeometry";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import type { CanvasBoardCard, CanvasBoardCardType } from "@/lib/canvas/canvasTypes";
import type { CardFaceProps } from "@/components/canvas/cardFace";

export type CanvasZone = "ideas" | "final";

/** Which tree a card center at this x lives in. */
const zoneOfX = (centerX: number): CanvasZone => (centerX >= DIVIDER_X ? "final" : "ideas");

/**
 * The per-card wiring the host hands across the D1 boundary. CanvasCard renders
 * the pixels; what each callback DOES stays in the host with the D2 hooks.
 */
export interface CanvasCardInteractions {
  onSelect: () => void;
  onMoveToFinal: () => void;
  onMoveToIdeas: () => void;
  /** Commit a finished drag within the same tree: the card's new position. */
  onMove: (id: string, x: number, y: number) => void;
  /**
   * A card was dropped across the divider into the OTHER tree. D1 reports the
   * zone + position only; D2 owns what that MEANS (move-to-final / return-to
   * -ideas + its own placement). Absent → cross-tree drop just repositions.
   */
  onCardDrop?: (id: string, zone: CanvasZone, x: number, y: number) => void;
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
  /** Bring a dimmed "kept" reference back to life ("nothing is deleted"). */
  onRestore?: () => void;
  /** This card is sounding right now (listen path / compare audition). */
  playing?: boolean;
}

interface CanvasCardProps extends CanvasCardInteractions {
  card: CanvasBoardCard;
  selected: boolean;
  /** D3 slot: a calm per-card marker (e.g. pending-review dot), never red. */
  adornment?: ReactNode;
  /**
   * Reports the tree the card is being dragged over (for the divider glow), and
   * null when the drag ends. Owned by CanvasStage — never a data mutation.
   */
  onDragZone?: (zone: CanvasZone | null) => void;
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

// 44px — the iOS minimum touch target. These live INSIDE the zoomed canvas
// layer, so anything smaller becomes untappable the moment the user zooms out.
const btn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1, height: 44, borderRadius: 11, border: "none", cursor: "pointer",
  backgroundColor: bg, color, fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-body)",
});

/**
 * CanvasCard — the orchestrator that turns a CanvasBoardCard into a rendered
 * card: CardShell frame + a typed face (lyric/voice/hum/chord/note) + the
 * uniform interaction layer (listen-path #, arrangement #, merge ring, dim
 * label, selected action row, D3 adornment). Drag VISUALS only — every meaning
 * (move-to-final, merge, listen) is a callback into the host's D2 hooks.
 */
/** How close (screen px) to a viewport edge the pointer must be to auto-pan. */
const EDGE_PAN_ZONE = 52;
/** Max auto-pan speed in screen px per frame. */
const EDGE_PAN_SPEED = 16;

const CanvasCard = memo(function CanvasCard({
  card,
  selected,
  adornment,
  onSelect,
  onMoveToFinal,
  onMoveToIdeas,
  onMove,
  onCardDrop,
  onDragZone,
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
  onRestore,
  playing = false,
}: CanvasCardProps) {
  const { screenToCanvas, dragPanBy, endDragPan } = useCanvasViewport();
  const elRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startScreen: { x: number; y: number };
    startCard: { x: number; y: number };
    /** Grab point in canvas units relative to the card's origin — the card
     *  stays under the finger even while the viewport pans beneath it. */
    grabOffset: { x: number; y: number };
    lastClient: { x: number; y: number };
    lastX: number; lastY: number; moved: boolean;
    zone: CanvasZone;
    viewportRect: DOMRect | null;
    edgeRaf: number;
    didEdgePan: boolean;
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

  /** Reposition the lifted card from the latest pointer position. Correct even
   *  while the viewport pans mid-drag (edge auto-pan): position derives from
   *  the CURRENT transform, not a stale delta. */
  const applyDragPosition = () => {
    const st = drag.current;
    if (!st) return;
    const p = screenToCanvas(st.lastClient.x, st.lastClient.y);
    const newX = p.x - st.grabOffset.x;
    const newY = p.y - st.grabOffset.y;
    st.lastX = newX; st.lastY = newY;
    const el = elRef.current;
    if (el) { el.style.left = `${newX}px`; el.style.top = `${newY}px`; }
    const zone = zoneOfX(newX + cardWidth(card.type) / 2);
    if (zone !== st.zone) { st.zone = zone; onDragZone?.(zone); }
  };

  /** Edge auto-pan: dragging toward a viewport edge glides the canvas so a
   *  phone (which can never show both trees at once) can drag Ideas → Final. */
  const edgePanFrame = () => {
    const st = drag.current;
    if (!st || !st.moved) return;
    const rect = st.viewportRect;
    if (rect) {
      const { x, y } = st.lastClient;
      let dx = 0, dy = 0;
      if (x < rect.left + EDGE_PAN_ZONE) dx = (1 - (x - rect.left) / EDGE_PAN_ZONE) * EDGE_PAN_SPEED;
      else if (x > rect.right - EDGE_PAN_ZONE) dx = -(1 - (rect.right - x) / EDGE_PAN_ZONE) * EDGE_PAN_SPEED;
      if (y < rect.top + EDGE_PAN_ZONE) dy = (1 - (y - rect.top) / EDGE_PAN_ZONE) * EDGE_PAN_SPEED;
      else if (y > rect.bottom - EDGE_PAN_ZONE) dy = -(1 - (rect.bottom - y) / EDGE_PAN_ZONE) * EDGE_PAN_SPEED;
      if (dx !== 0 || dy !== 0) {
        dragPanBy(dx, dy);
        st.didEdgePan = true;
        applyDragPosition();
      }
    }
    st.edgeRaf = requestAnimationFrame(edgePanFrame);
  };

  const stopEdgePan = () => {
    const st = drag.current;
    if (st?.edgeRaf) { cancelAnimationFrame(st.edgeRaf); st.edgeRaf = 0; }
    if (st?.didEdgePan) endDragPan();
  };

  const endDragVisuals = () => {
    const el = elRef.current;
    if (el) {
      el.style.transform = ""; el.style.zIndex = ""; el.style.boxShadow = "";
      el.style.cursor = ""; el.style.transition = "";
    }
  };

  /** Abort without committing: spring back to where the drag started. */
  const abortDrag = () => {
    const st = drag.current;
    if (!st) return;
    stopEdgePan();
    window.removeEventListener("pointerdown", secondPointerListener, true);
    drag.current = null;
    onDragZone?.(null);
    try { elRef.current?.releasePointerCapture(st.pointerId); } catch { /* already released */ }
    const el = elRef.current;
    if (el && st.moved) {
      el.style.transform = ""; el.style.zIndex = ""; el.style.boxShadow = ""; el.style.cursor = "";
      el.style.transition = "left 320ms cubic-bezier(0.34,1.56,0.64,1), top 320ms cubic-bezier(0.34,1.56,0.64,1)";
      el.style.left = `${st.startCard.x}px`;
      el.style.top = `${st.startCard.y}px`;
      window.setTimeout(() => { if (elRef.current) elRef.current.style.transition = ""; }, 340);
    } else {
      endDragVisuals();
    }
  };

  // A second finger during a card drag means the user wants to PINCH, not
  // rearrange the song: abort the drag (no commit) and hand the first finger
  // to the viewport's gesture engine. The listener has one stable identity
  // (so add/removeEventListener always pair) and delegates through a ref.
  const onSecondPointerDown = useRef<(e: PointerEvent) => void>(() => {});
  onSecondPointerDown.current = (e: PointerEvent) => {
    const st = drag.current;
    if (st && e.pointerId !== st.pointerId) abortDrag();
  };
  const secondPointerListener = useRef((e: PointerEvent) => onSecondPointerDown.current(e)).current;

  // Safety net: never leave a global listener or rAF behind on unmount.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointerdown", secondPointerListener, true);
      const st = drag.current;
      if (st?.edgeRaf) cancelAnimationFrame(st.edgeRaf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag: pointer-capture, direct-to-DOM per frame, one commit on release ──
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (card.isDimmedReference) return; // dimmed cards select, never drag
    // A press on one of the card's own buttons (→ Final, Edit, Layers, ⋯) must
    // stay a BUTTON press. Capturing the pointer here retargets pointerup —
    // and therefore the click — to the card, so every real tap on the action
    // row silently toggled selection instead of firing the button.
    if ((e.target as Element).closest("button")) return;
    justDragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const grab = screenToCanvas(e.clientX, e.clientY);
    drag.current = {
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startCard: { x: card.x, y: card.y },
      grabOffset: { x: grab.x - card.x, y: grab.y - card.y },
      lastClient: { x: e.clientX, y: e.clientY },
      lastX: card.x, lastY: card.y, moved: false,
      zone: card.tree,
      viewportRect: (e.currentTarget.closest('[data-canvas-viewport]') as HTMLElement | null)
        ?.getBoundingClientRect() ?? null,
      edgeRaf: 0,
      didEdgePan: false,
    };
    window.addEventListener("pointerdown", secondPointerListener, true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    if (!st || e.pointerId !== st.pointerId) return;
    st.lastClient = { x: e.clientX, y: e.clientY };
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
      st.edgeRaf = requestAnimationFrame(edgePanFrame);
    }
    applyDragPosition();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current;
    if (!st || e.pointerId !== st.pointerId) return;
    stopEdgePan();
    window.removeEventListener("pointerdown", secondPointerListener, true);
    try { e.currentTarget.releasePointerCapture(st.pointerId); } catch { /* already released */ }
    drag.current = null;
    onDragZone?.(null);
    endDragVisuals();
    if (!st.moved) return; // a tap → onClick selects it
    justDragged.current = true;
    // A flung card can never leave the pannable board.
    const clamped = clampToBoard(st.lastX, st.lastY, card.type);
    const dropZone = zoneOfX(clamped.x + cardWidth(card.type) / 2);
    if (dropZone !== card.tree && onCardDrop) {
      // Crossed the divider — D2 decides the meaning + final placement.
      onCardDrop(card.id, dropZone, clamped.x, clamped.y);
    } else {
      // Same tree (or no drop handler wired): just commit the new position.
      onMove(card.id, clamped.x, clamped.y);
    }
  };

  // Aborted drag (pointercancel) → return-spring to where it started; never a
  // half-committed position. Reduced-motion just snaps back (no transition).
  const onPointerCancel = () => {
    abortDrag();
  };

  const handleClick = () => {
    if (justDragged.current) { justDragged.current = false; return; }
    onSelect();
  };

  const ariaLabel =
    `${card.type === "voice" || card.type === "hum" ? "Voice" : card.type} idea: ${card.title}` +
    ` by ${card.contributor}` +
    (finalOrder != null ? `, arrangement position ${finalOrder}` : "") +
    (listenIndex != null ? `, listen path stop ${listenIndex + 1}` : "") +
    (playing ? ", playing now" : "");

  return (
    <CardShell
      ref={elRef}
      color={color}
      state={state}
      mergeSelected={mergeSelected}
      playing={playing}
      width={cardWidth(card.type)}
      left={card.x}
      top={card.y}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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

      {/* Dimmed cards stay reachable: tap → a restrained restore row. The zone
          label promises "Nothing is deleted" — so nothing is unreachable. */}
      {selected && card.isDimmedReference && onRestore && (
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            style={btn(`${color.base}16`, color.dark)}
            aria-label="Bring this idea back to the board"
          >
            Bring back
          </button>
        </div>
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
              style={{ width: 44, height: 44, borderRadius: 11, border: "none", cursor: "pointer", backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", fontSize: 18, fontWeight: 700, fontFamily: "var(--font-body)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}
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
