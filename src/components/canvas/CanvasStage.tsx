import { useState, type ReactNode } from "react";
import CanvasViewport, {
  useCanvasViewport,
  type ViewportCtx,
} from "@/components/canvas/CanvasViewport";
import CanvasDivider from "@/components/canvas/CanvasDivider";
import ZoneFields from "@/components/canvas/ZoneFields";
import ZoneLabels from "@/components/canvas/ZoneLabel";
import SongRootCard from "@/components/canvas/SongRootCard";
import CanvasBranchConnectors from "@/components/canvas/CanvasBranchConnectors";
import CanvasCard, { type CanvasCardInteractions, type CanvasZone } from "@/components/canvas/CanvasCard";
import SectionCluster, { type SectionClusterData } from "@/components/canvas/SectionCluster";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

export type { CanvasCardInteractions };

/**
 * CanvasStage — the whiteboard's pure render surface (D1's lane).
 *
 * Everything that draws board pixels lives here: the pan/zoom viewport, the
 * warm room glow, the two-tree layout (root card, zone labels, divider,
 * bezier connectors) and the card render loop. Each card is a memoized
 * CanvasCard = CardShell frame + a typed face (lyric/voice/hum/chord/note) +
 * the uniform interaction layer, with pointer-capture drag VISUALS. CanvasStage
 * receives render inputs as props/selectors and emits pixels — it never mutates
 * data, never runs feature mechanics (D2), never talks to realtime (D3).
 *
 * D2/D3 mount through the named slots (see docs/CANVAS-RENDER-CONTRACT.md):
 *   - `overlay`       fixed chrome above the canvas, NOT transformed
 *   - `featureLayers` D2 surfaces INSIDE the transforming layer (canvas-space)
 *   - `collabLayers`  D3 surfaces INSIDE the transforming layer, topmost
 *   - `cardAdornment` per-card marker render prop (D3 pending-review dots)
 *   - `onCursorMove`  canvas-space cursor stream (D3 live cursors)
 */

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
   * Collapsed section stacks to render (a dense section presented as one
   * stacked-shadow node). The FLAG for what clusters comes from the store (see
   * canvasBoardSource.clusterFlags) — the render layer only presents it; its
   * member cards are already excluded from ideasCards/finalCards by the host.
   */
  clusters?: SectionClusterData[];
  /** Tapping a cluster asks the host to expand + frame it (Step 6 fitTo). */
  onExpandCluster?: (clusterId: string) => void;
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
  clusters,
  onExpandCluster,
  viewportApiRef,
  overlay,
  featureLayers,
  collabLayers,
  onCursorMove,
  initialZoom,
  initialPan,
  className,
  style,
}: CanvasStageProps) => {
  // The tree a card is currently being dragged over — drives the divider's gold
  // glow as a card crosses toward Final. Pure visual state (D1's lane).
  const [dragZone, setDragZone] = useState<CanvasZone | null>(null);

  return (
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
      <ZoneFields isDropActive={isDropActive || dragZone === "final"} />
      <CanvasBranchConnectors ideasCards={ideasCards} finalCards={finalCards} />
      <SongRootCard title={songTitle} />
      <ZoneLabels />
      <CanvasDivider isDropActive={isDropActive || dragZone === "final"} />

      {/* Collapsed section stacks — a dense section as one stacked node */}
      {clusters?.map((cluster) => (
        <SectionCluster
          key={cluster.id}
          cluster={cluster}
          onExpand={(id) => onExpandCluster?.(id)}
        />
      ))}

      {/* Render all visible cards (clustered members are excluded upstream) */}
      {[...ideasCards, ...finalCards].map((card) => (
        <CanvasCard
          key={card.id}
          card={card}
          selected={selectedId === card.id}
          adornment={cardAdornment?.(card)}
          onDragZone={setDragZone}
          {...getCardInteractions(card)}
        />
      ))}

      {/* D2 feature surfaces — canvas-space, above cards */}
      {featureLayers}
      {/* D3 collaboration surfaces — canvas-space, topmost */}
      {collabLayers}
    </CanvasViewport>
    {/* Stage-owned card keyframes, injected ONCE here (never per card instance).
        <style> has no layout footprint, so this sibling never disturbs the
        viewport's sizing. Reduced-motion neutralizes them (Step 9). */}
    <style>{`
      @keyframes cog-card-enter {
        0%   { opacity: 0; transform: scale(0.86) translateZ(0); }
        60%  { opacity: 1; transform: scale(1.03) translateZ(0); }
        100% { opacity: 1; transform: scale(1) translateZ(0); }
      }
      @keyframes cog-card-pulse-dot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.4; transform: scale(0.75); }
      }
      /* A sounding waveform breathes — GPU scaleY only, staggered per bar. */
      @keyframes cog-wave-play {
        0%, 100% { transform: scaleY(1); }
        50%       { transform: scaleY(0.55); }
      }
      /* The room's light breathes, slowly — glory, not a screensaver. */
      @keyframes cog-glory-breathe {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.82; }
      }
      @media (prefers-reduced-motion: reduce) {
        [style*="cog-card-enter"] { animation: none !important; }
        [style*="cog-card-pulse-dot"] { animation: none !important; }
        [style*="cog-wave-play"] { animation: none !important; }
        [style*="cog-glory-breathe"] { animation: none !important; }
        /* Cards + clusters settle instantly (no transform/opacity easing) — the
           inline transitions are neutralized so nothing slides or springs. */
        [data-canvas-card], [data-canvas-nopan], [data-canvas-nopan] * {
          transition: none !important;
        }
      }
    `}</style>
  </>
  );
};

export default CanvasStage;
