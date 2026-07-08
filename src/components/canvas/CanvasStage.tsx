import { useRef, type ElementType, type ReactNode } from "react";
import { FileText, GitBranch, Mic, Music, StickyNote } from "lucide-react";
import CanvasViewport, {
  useCanvasViewport,
  type ViewportCtx,
} from "@/components/canvas/CanvasViewport";
import CanvasDivider from "@/components/canvas/CanvasDivider";
import ZoneLabels from "@/components/canvas/ZoneLabel";
import SongRootCard from "@/components/canvas/SongRootCard";
import CanvasBranchConnectors from "@/components/canvas/CanvasBranchConnectors";
import { getCreatorInitials } from "@/lib/canvas/creatorColors";
import {
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  DRAG_THRESHOLD_PX,
} from "@/lib/canvas/canvasGeometry";
import type { CanvasBoardCard, CanvasBoardCardType } from "@/lib/canvas/canvasTypes";

/**
 * CanvasStage — the whiteboard's pure render surface (D1's lane).
 *
 * Everything that draws board pixels lives here: the pan/zoom viewport, the
 * warm room glow, the two-tree layout (root card, zone labels, divider,
 * bezier connectors) and the card render loop with its pointer-capture drag
 * VISUALS. It receives render inputs as props/selectors and emits pixels —
 * it never mutates data, never runs feature mechanics (D2), never talks to
 * realtime (D3).
 *
 * D2/D3 mount through the named slots (see docs/CANVAS-RENDER-CONTRACT.md):
 *   - `overlay`       fixed chrome above the canvas, NOT transformed
 *   - `featureLayers` D2 surfaces INSIDE the transforming layer (canvas-space)
 *   - `collabLayers`  D3 surfaces INSIDE the transforming layer, topmost
 *   - `cardAdornment` per-card marker render prop (D3 pending-review dots)
 *   - `onCursorMove`  canvas-space cursor stream (D3 live cursors)
 */

// ─── Card icons ───────────────────────────────────────────────────────────────

const CARD_ICONS: Record<CanvasBoardCardType, ElementType> = {
  lyric: FileText,
  voice: Mic,
  hum: Mic,
  chord: Music,
  note: StickyNote,
  scripture: StickyNote,
  section: GitBranch,
};

// A calm decorative waveform so a voice card reads as audio at a glance.
const WAVE_BARS = [7, 13, 20, 11, 24, 15, 9, 22, 13, 18, 10, 16, 8, 12, 19, 10, 14];
const MiniWaveform = ({ accent }: { accent: string }) => (
  <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 2.5, height: 26, marginTop: 4, marginBottom: 2 }}>
    {WAVE_BARS.map((h, i) => (
      <div
        key={i}
        style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: i < 6 ? accent : `${accent}55` }}
      />
    ))}
  </div>
);

// ─── Canvas card component ─────────────────────────────────────────────────────

interface CanvasCardProps {
  card: CanvasBoardCard;
  selected: boolean;
  onSelect: () => void;
  onMoveToFinal: () => void;
  onMoveToIdeas: () => void;
  /** Called continuously during drag with the new canvas-space position */
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
  /** Opens the overflow action sheet (Compare, Suggest, Listen Path, Merge…). */
  onMore?: () => void;
  /** 1-based position in the Final arrangement (Final cards only). */
  finalOrder?: number;
  /** D3 slot: calm per-card marker (e.g. pending-review dot), canvas-space. */
  adornment?: ReactNode;
}

/**
 * The wiring a single card needs from the host — everything CanvasCardEl takes
 * except the render inputs CanvasStage itself supplies (`card`, `selected`,
 * `adornment`). The host derives one of these per card from the D2 feature
 * hooks; CanvasStage never knows what the callbacks DO.
 */
export type CanvasCardInteractions = Omit<CanvasCardProps, "card" | "selected" | "adornment">;

const CanvasCardEl = ({
  card,
  selected,
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
  mergeSelected,
  onMore,
  finalOrder,
  adornment,
}: CanvasCardProps) => {
  const Icon = CARD_ICONS[card.type];
  const isVoice = card.type === "voice" || card.type === "hum";
  // Actions that belong in the overflow sheet, so the card shows at most a
  // primary + promote + "More" instead of a wall of tiny buttons.
  const hasMore =
    Boolean(onMore) &&
    (Boolean(canCompare && onCompare) ||
      (card.type === "lyric" && Boolean(onSuggestLine)) ||
      Boolean(onAddToListenPath) ||
      (card.tree === "ideas" && !card.isDimmedReference && Boolean(onMergeSelect)) ||
      (isVoice && Boolean(onOpenStack)));

  // Pointer-capture drag: card receives all pointer events even when the cursor
  // leaves its bounds. screenToCanvas from the viewport context converts the
  // pointer position to canvas coords so the card follows correctly even at
  // non-1x zoom. This is intentionally separate from the canvas pan gesture.
  const { screenToCanvas } = useCanvasViewport();
  const cardElRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    pointerId: number;
    startScreen: { x: number; y: number };
    startCard: { x: number; y: number };
    lastX: number;
    lastY: number;
    /** True once the pointer crosses the threshold — only then does it move. */
    moved: boolean;
  } | null>(null);
  // Suppresses the click that fires after a real drag, so dropping a card never
  // also toggles its selection.
  const justDraggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left-click / single touch)
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation(); // prevent canvas pan from starting
    // Clear any stale suppress flag (in case a click never fired after a drag).
    justDraggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startCard: { x: card.x, y: card.y },
      lastX: card.x,
      lastY: card.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st) return;
    // A tap must never nudge the card. Hold position until the finger crosses a
    // small threshold; below it, the gesture is still a tap, not a drag.
    if (!st.moved) {
      const dx = e.clientX - st.startScreen.x;
      const dy = e.clientY - st.startScreen.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      st.moved = true;
      const el = cardElRef.current;
      if (el) {
        // Physical "lift" the moment a real drag begins (CapCut/Apple feel).
        el.style.transform = "scale(1.05)";
        el.style.zIndex = "40";
        el.style.boxShadow = `0 14px 34px ${card.accent}45`;
        el.style.cursor = "grabbing";
      }
    }
    // Convert both the start and current screen positions to canvas coords so
    // the delta is expressed in canvas space (respects zoom level).
    const startCanvas = screenToCanvas(st.startScreen.x, st.startScreen.y);
    const currCanvas = screenToCanvas(e.clientX, e.clientY);
    const newX = st.startCard.x + (currCanvas.x - startCanvas.x);
    const newY = st.startCard.y + (currCanvas.y - startCanvas.y);
    st.lastX = newX;
    st.lastY = newY;
    // Write the new position straight to THIS card's element — no setState per
    // frame, so dragging one card never re-renders the whole board (the single
    // biggest source of drag jank on a busy mobile canvas). React state is
    // reconciled once, on pointer-up.
    const el = cardElRef.current;
    if (el) {
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st) return;
    e.currentTarget.releasePointerCapture(st.pointerId);
    dragState.current = null;
    const el = cardElRef.current;
    if (el) {
      // Hand transform/shadow/z back to React's style prop.
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.boxShadow = "";
      el.style.cursor = "";
    }
    if (st.moved) {
      justDraggedRef.current = true;
      // Commit the final position to React state exactly once.
      onMove(card.id, st.lastX, st.lastY);
    }
    // A pointer that never crossed the threshold is a tap → onClick selects it.
  };

  return (
    <div
      ref={cardElRef}
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: CARD_WIDTH,
        minHeight: CARD_MIN_HEIGHT,
        borderRadius: 18,
        backgroundColor: "#FFFCF7",
        border: mergeSelected
          ? "2px solid var(--cog-gold, #B8953A)"
          : selected
          ? `2px solid ${card.accent}`
          : card.isDimmedReference
          ? `1.5px dashed ${card.accent}55`
          : `1.5px solid ${card.accent}2E`,
        boxShadow: mergeSelected
          ? `0 0 0 4px rgba(184,149,58,0.20), 0 10px 28px rgba(28,26,23,0.12)`
          : selected
          ? `0 0 0 4px ${card.accent}22, 0 16px 36px ${card.accent}30, 0 2px 6px rgba(28,26,23,0.08)`
          : isVoice && layerCount > 0
          ? `0 6px 20px rgba(28,26,23,0.08), 5px 6px 0 0 ${card.accent}22, 11px 12px 0 0 ${card.accent}10`
          : `0 6px 20px rgba(28,26,23,0.08), 0 1px 3px rgba(28,26,23,0.06)`,
        opacity: card.isDimmedReference ? 0.5 : 1,
        cursor: dragState.current ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: selected ? 20 : 10,
        transform: selected ? "scale(1.03)" : "scale(1)",
        transition: "transform 150ms ease, box-shadow 220ms ease, border-color 200ms ease, opacity 200ms ease",
        // A calm settle the first time this card mounts (add / promote / remote
        // arrival). `backwards` fill hands transform back to the inline value
        // afterwards, so selection scale still works. Reduced-motion disables
        // it via the shared <style> block below.
        animation: "cog-card-in 340ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
        padding: "13px 14px 12px 18px",
        boxSizing: "border-box",
      }}
      onClick={() => {
        // Ignore the click synthesised at the end of a real drag.
        if (justDraggedRef.current) { justDraggedRef.current = false; return; }
        onSelect();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="button"
      aria-pressed={selected}
      aria-label={finalOrder != null ? `${card.type} card: ${card.title}, arrangement position ${finalOrder}` : `${card.type} card: ${card.title}`}
    >
      {/* Contributor identity stripe — the writer's colour down the left edge */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: 7, top: 13, bottom: 13, width: 4, borderRadius: 4,
          background: `linear-gradient(180deg, ${card.accent}, ${card.accent}66)`,
        }}
      />
      {/* Final arrangement position — the song's set-list number */}
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
      {/* Contributor avatar — top right, with a soft ring */}
      <div
        style={{
          position: "absolute",
          top: 11,
          right: 11,
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: card.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: 0,
          border: "2px solid #FFFCF7",
          boxShadow: `0 2px 6px ${card.accent}40`,
        }}
        title={card.contributor}
      >
        {getCreatorInitials(card.contributor)}
      </div>

      {/* Icon + section */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: `${card.accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={14} strokeWidth={1.8} style={{ color: card.accent }} />
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--cog-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {card.section}
        </span>
        {isVoice && layerCount > 0 && onOpenStack && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenStack(); }}
            style={{
              marginLeft: "auto",
              fontSize: 9,
              fontWeight: 700,
              color: card.accent,
              backgroundColor: `${card.accent}1A`,
              borderRadius: 9999,
              padding: "6px 10px",
              minHeight: 44,
              fontFamily: "var(--font-body)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
            }}
            aria-label={`${layerCount} layer${layerCount > 1 ? "s" : ""} — tap to open stack`}
          >
            {layerCount} layer{layerCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--cog-charcoal)",
          fontFamily: "var(--font-display)",
          marginBottom: 6,
          lineHeight: 1.3,
        }}
      >
        {card.title}
      </p>

      {/* Body — a waveform for voice, the words for everything else */}
      {isVoice ? (
        <MiniWaveform accent={card.accent} />
      ) : card.body ? (
        <p
          style={{
            fontSize: 12,
            color: "var(--cog-warm-gray)",
            lineHeight: 1.5,
            fontFamily: "var(--font-body)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {card.body}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: "var(--cog-muted)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>
          Tap to write the idea…
        </p>
      )}

      {/* Who wrote it — collaboration made visible */}
      {!card.isDimmedReference && (
        <p
          style={{
            marginTop: 8, fontSize: 10.5, fontWeight: 700, color: card.accent,
            fontFamily: "var(--font-body)", letterSpacing: "0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {card.contributor}
        </p>
      )}

      {/* Kept-reference label for dimmed cards — nothing is ever deleted */}
      {card.isDimmedReference && (
        <p style={{ fontSize: 10, color: card.accent, marginTop: 8, fontWeight: 600 }}>
          {card.dimReason === "merged"
            ? "↳ Merged into section"
            : card.dimReason === "compare_kept"
            ? "↳ Kept for reference"
            : "↳ Used in Final"}
        </p>
      )}

      {/* In-place actions when selected — one primary + promote + More.
          Everything else lives in the overflow sheet so the card stays calm. */}
      {selected && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 10,
            borderTop: "1px solid rgba(0,0,0,0.07)",
            paddingTop: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Primary: edit text card / open stack on a voice card */}
          {isVoice && onOpenStack ? (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenStack(); }}
              style={{
                flex: 1, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
                backgroundColor: `${card.accent}16`, color: card.accent,
                fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
              }}
              aria-label={layerCount > 0 ? `Open stack — ${layerCount} layers` : "Open stack — record over this"}
            >
              {layerCount > 0 ? `Layers ${layerCount}` : "Layers"}
            </button>
          ) : onEdit ? (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{
                flex: 1, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
                backgroundColor: `${card.accent}16`, color: card.accent,
                fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
              }}
              aria-label="Edit this idea"
            >
              Edit
            </button>
          ) : null}

          {/* Promote / return between the trees */}
          {card.tree === "ideas" && !card.isDimmedReference && (
            <button
              onClick={onMoveToFinal}
              style={{
                flex: 1, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
                backgroundColor: "var(--cog-gold)", color: "#FFF",
                fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
              }}
              aria-label="Move this idea to the Final song"
            >
              → Final
            </button>
          )}
          {card.tree === "final" && (
            <button
              onClick={onMoveToIdeas}
              style={{
                flex: 1, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
                backgroundColor: "rgba(0,0,0,0.06)", color: "var(--cog-warm-gray)",
                fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
              }}
              aria-label="Return this to Ideas"
            >
              ← Ideas
            </button>
          )}

          {/* Overflow — Compare, Suggest a line, Listen Path, Merge… */}
          {hasMore && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMore?.(); }}
              style={{
                width: 40, height: 34, borderRadius: 9, border: "none", cursor: "pointer",
                backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)",
                fontSize: 16, fontWeight: 700, fontFamily: "var(--font-body)",
                display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
              }}
              aria-label="More actions"
            >
              ⋯
            </button>
          )}
        </div>
      )}
      {listenIndex != null && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", bottom: 8, left: 8,
            width: 22, height: 22, borderRadius: "50%",
            backgroundColor: "var(--cog-gold, #B8953A)", color: "#FFF",
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(184,149,58,0.40)",
            fontFamily: "var(--font-body)",
          }}
        >
          {listenIndex + 1}
        </div>
      )}
      {/* D3 slot: calm per-card marker (pending review etc.) — never red */}
      {adornment}
    </div>
  );
};

// ─── Viewport bridge ─────────────────────────────────────────────────────────

/**
 * Exposes the viewport's pan/zoom API to the page shell (header, sheets) that
 * lives OUTSIDE <CanvasViewport>. Renders nothing; just forwards the context.
 */
const CanvasViewportBridge = ({ apiRef }: { apiRef: React.MutableRefObject<ViewportCtx | null> }) => {
  const ctx = useCanvasViewport();
  apiRef.current = ctx;
  return null;
};

// ─── CanvasStage ──────────────────────────────────────────────────────────────

export interface CanvasStageProps {
  /** The song's name — rendered on the root card the trees branch from. */
  songTitle: string;
  /** Board-positioned cards, already split by tree (layers stay in stacks). */
  ideasCards: CanvasBoardCard[];
  finalCards: CanvasBoardCard[];
  /** Which card is selected (shows its in-place action row). */
  selectedId: string | null;
  /** Divider glows gold while a card is being dragged toward it. */
  isDropActive?: boolean;
  /**
   * Per-card wiring, derived by the host from the D2 feature hooks. Called
   * during render for every visible card; return the callbacks/badges this
   * card should surface. CanvasStage never interprets what they do.
   */
  getCardInteractions: (card: CanvasBoardCard) => CanvasCardInteractions;
  /** D3 slot: calm per-card marker (e.g. pending-review dot), rendered inside the card. */
  cardAdornment?: (card: CanvasBoardCard) => ReactNode;
  /**
   * Bridges the viewport pan/zoom API (panTo, screenToCanvas…) out to the page
   * shell for presence-jump / fly-to-card. Populated after first render.
   */
  viewportApiRef?: React.MutableRefObject<ViewportCtx | null>;
  /** Fixed chrome above the canvas, NOT transformed (quick-nav, prompts, docks). */
  overlay?: ReactNode;
  /** D2 slot: feature surfaces INSIDE the transforming layer (canvas-space coords). */
  featureLayers?: ReactNode;
  /** D3 slot: collaboration surfaces INSIDE the transforming layer, above cards. */
  collabLayers?: ReactNode;
  /** D3 seam: cursor position in canvas coords (throttled) for live cursors. */
  onCursorMove?: (cx: number, cy: number) => void;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The full board, rendered from props. Layer order inside the transforming
 * canvas layer (back → front): connectors → root card → zone labels → divider
 * → cards → featureLayers (D2) → collabLayers (D3).
 */
const CanvasStage = ({
  songTitle,
  ideasCards,
  finalCards,
  selectedId,
  isDropActive = false,
  getCardInteractions,
  cardAdornment,
  viewportApiRef,
  overlay,
  featureLayers,
  collabLayers,
  onCursorMove,
  initialZoom,
  initialPan,
  className,
  style,
}: CanvasStageProps) => (
  <>
    <CanvasViewport
      className={className}
      style={style}
      initialZoom={initialZoom}
      initialPan={initialPan}
      onCursorMove={onCursorMove}
      overlay={overlay}
    >
      {/* Canvas content — all positioned absolutely in canvas space */}
      {viewportApiRef && <CanvasViewportBridge apiRef={viewportApiRef} />}
      <CanvasBranchConnectors ideasCards={ideasCards} finalCards={finalCards} />
      <SongRootCard title={songTitle} />
      <ZoneLabels />
      <CanvasDivider isDropActive={isDropActive} />

      {/* Render all cards */}
      {[...ideasCards, ...finalCards].map((card) => (
        <CanvasCardEl
          key={card.id}
          card={card}
          selected={selectedId === card.id}
          adornment={cardAdornment?.(card)}
          {...getCardInteractions(card)}
        />
      ))}

      {/* D2 feature surfaces — canvas-space, above cards */}
      {featureLayers}
      {/* D3 collaboration surfaces — canvas-space, topmost */}
      {collabLayers}
    </CanvasViewport>
    {/* Stage-owned keyframes: the card entrance settle. <style> has no layout
        footprint, so this sibling never disturbs the viewport's sizing. */}
    <style>{`
      @keyframes cog-card-in {
        0%   { opacity: 0; transform: scale(0.96) translateY(6px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        [style*="cog-card-in"] { animation: none !important; }
      }
    `}</style>
  </>
);

export default CanvasStage;
