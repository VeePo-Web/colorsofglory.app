import {
  ElementType,
  lazy,
  Suspense,
  useCallback,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Mic,
  Music,
  Plus,
  Sparkles,
  StickyNote,
  Users,
  GitBranch,
  BookOpen,
  History,
  UserPlus,
  Inbox,
} from "lucide-react";
import { loadPracticeSections } from "@/lib/practice/practiceApi";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import CreativeActionDock from "@/components/cog/CreativeActionDock";
import SongRoomSaveToast, { type SongRoomSaveMoment } from "@/components/cog/SongRoomSaveToast";
import { useSongTitle } from "@/lib/songContext";
import CanvasViewport, { useCanvasViewport, type ViewportCtx } from "@/components/canvas/CanvasViewport";
import CanvasDivider from "@/components/canvas/CanvasDivider";
import ZoneLabels from "@/components/canvas/ZoneLabel";
import FirstActionPrompt from "@/components/canvas/FirstActionPrompt";
import SongRootCard from "@/components/canvas/SongRootCard";
import CanvasBranchConnectors from "@/components/canvas/CanvasBranchConnectors";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";
import RecordingSheet from "@/components/voice/RecordingSheet";
import VoiceReviewSheet from "@/components/voice/VoiceReviewSheet";
import VoiceLayerPanel from "@/components/voice/VoiceLayerPanel";
import {
  enqueuePendingUpload,
  flushPendingUpload,
  listPendingUploads,
} from "@/lib/voice/pendingUploads";
import { formatDuration } from "@/lib/voice/audioFormat";
import { loadVoiceMemosForCanvas } from "@/lib/canvas/canvasLoader";
import {
  addLineSuggestion,
  listLineSuggestions,
  removeLineSuggestion,
  type PendingLineSuggestion,
} from "@/lib/canvas/lineSuggestions";
import StackSheet from "@/components/voice/StackSheet";
import type { StackMemoView } from "@/components/voice/MemoStack";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import { useSongCollaborators } from "@/lib/invite/useSongCollaborators";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { subscribeSongRoom } from "@/integrations/cog/realtime";
import { toast } from "sonner";
import WhatChangedRecapSheet from "@/components/canvas/WhatChangedRecapSheet";
import LineSuggestionSheet, { type LineSuggestionMode } from "@/components/canvas/LineSuggestionSheet";
import ListenPathBar from "@/components/canvas/ListenPathBar";
import MergeActionBar from "@/components/canvas/MergeActionBar";

const SongCanvasWorkLayers = lazy(() => import("@/components/cog/SongCanvasWorkLayers"));
const SongCanvasCollabLayers = lazy(() => import("@/components/cog/SongCanvasCollabLayers"));
const ShareSongSheet = lazy(() => import("@/components/invite/ShareSongSheet"));
const OwnerReviewQueueSheet = lazy(() => import("@/components/canvas/OwnerReviewQueueSheet"));

// ─── Types ───────────────────────────────────────────────────────────────────

type CanvasTree = "ideas" | "final";
type CanvasCardType = "lyric" | "voice" | "hum" | "chord" | "note" | "scripture" | "section";
type LayerId = "room" | "lyrics" | "voice" | "chords" | "notes" | "ideas" | "people";

export interface CanvasCard {
  id: string;
  tree: CanvasTree;
  type: CanvasCardType;
  title: string;
  body: string;
  meta: string;
  section: string;
  contributor: string;
  status: "raw" | "shortlisted" | "approved" | "meaning" | "review";
  accent: string;
  x: number;
  y: number;
  /** Set when this voice memo is a layer recorded over a base ("Record over this"). */
  parentMemoId?: string;
  /** Recording length for stack playback/labels; voice cards only. */
  durationMs?: number;
  /** Owner has reviewed this contributor idea (kept it in Ideas). Clears it from the review queue. */
  reviewed?: boolean;
  isDimmedReference?: boolean;
  isProcessing?: boolean;
}

/** Canvas card → the shape the stack engine + sheet consume. */
const toStackView = (c: CanvasCard): StackMemoView => ({
  id: c.id,
  parentMemoId: c.parentMemoId,
  title: c.title,
  contributor: c.contributor,
  durationMs: c.durationMs ?? 0,
  section: c.section,
});

type RecordingFlow = "idle" | "recording" | "reviewing";

const CARD_ICONS: Record<CanvasCardType, ElementType> = {
  lyric: FileText,
  voice: Mic,
  hum: Mic,
  chord: Music,
  note: StickyNote,
  scripture: StickyNote,
  section: GitBranch,
};

const LAYERS: Array<{ id: LayerId; label: string; icon: ElementType }> = [
  { id: "room",   label: "Canvas",  icon: GitBranch },
  { id: "lyrics", label: "Lyrics",  icon: FileText },
  { id: "voice",  label: "Voice",   icon: Mic },
  { id: "chords", label: "Chords",  icon: Music },
  { id: "notes",  label: "Notes",   icon: StickyNote },
  { id: "people", label: "People",  icon: Users },
];

// ─── Initial card data ────────────────────────────────────────────────────────

const INITIAL_CARDS: CanvasCard[] = [
  {
    id: "hum-1",
    tree: "ideas",
    type: "hum",
    title: "First melody hum",
    body: "Soft lift into the chorus. Keep the ache in the first two notes.",
    meta: "0:12 voice",
    section: "Verse 1",
    contributor: "Parker",
    status: "raw",
    accent: getCreatorColor("Parker").base,
    x: 80,
    y: 200,
  },
  {
    id: "verse-line",
    tree: "ideas",
    type: "lyric",
    title: "Verse image",
    body: "I waited in the quiet / You painted morning gold.",
    meta: "Lyric fragment",
    section: "Verse 1",
    contributor: "Sarah",
    status: "shortlisted",
    accent: getCreatorColor("Sarah").base,
    x: 320,
    y: 200,
  },
  {
    id: "meaning-psalm",
    tree: "ideas",
    type: "scripture",
    title: "Meaning anchor",
    body: "Psalm 46:10 — Be still before the second verse turns upward.",
    meta: "Scripture",
    section: "Meaning",
    contributor: "Parker",
    status: "meaning",
    accent: getCreatorColor("Parker").base,
    x: 80,
    y: 440,
  },
  {
    id: "chorus-core",
    tree: "final",
    type: "section",
    title: "Chorus center",
    body: "You are glory in the waiting / Fire in the night.",
    meta: "Approved lyric",
    section: "Chorus",
    contributor: "Parker",
    status: "approved",
    accent: getCreatorColor("Parker").base,
    x: DIVIDER_X + 80,
    y: 200,
  },
  {
    id: "chord-bed",
    tree: "final",
    type: "chord",
    title: "Warm progression",
    body: "C - G - Am - F, 74 BPM. Let the bridge breathe.",
    meta: "Key C",
    section: "Arrangement",
    contributor: "Caleb",
    status: "approved",
    accent: getCreatorColor("Caleb").base,
    x: DIVIDER_X + 80,
    y: 420,
  },
];

const FIRST_VISIT_KEY = (songId: string) => `cog:canvas-first-visit-${songId}`;
const CARDS_KEY = (songId: string) => `cog:canvas-cards-${songId}`;
const SHOW_LEGACY_CANVAS_FABS = false;

const getStoredCards = (songId: string): CanvasCard[] => {
  try {
    const stored = localStorage.getItem(CARDS_KEY(songId));
    if (!stored) return INITIAL_CARDS;
    const parsed = JSON.parse(stored) as CanvasCard[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CARDS;
  } catch {
    return INITIAL_CARDS;
  }
};

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const SongCanvasSemanticSummary = () => (
  <section aria-label="Song room sections" style={VISUALLY_HIDDEN}>
    <p>Everything for this song stays connected here.</p>
    <h2>Lyrics</h2>
    <h2>Voice memos</h2>
    <h2>Chord map</h2>
    <h2>Song notes</h2>
    <h2>Ideas tree</h2>
    <h2>Final tree</h2>
    <h2>In this room</h2>
    <h2>What changed</h2>
  </section>
);

// ─── Canvas card component ─────────────────────────────────────────────────────

interface CanvasCardProps {
  card: CanvasCard;
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
}

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
  onAddToListenPath,
  listenIndex,
  onMergeSelect,
  mergeSelected,
}: CanvasCardProps) => {
  const Icon = CARD_ICONS[card.type];
  const isVoice = card.type === "voice" || card.type === "hum";

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
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left-click / single touch)
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation(); // prevent canvas pan from starting
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startCard: { x: card.x, y: card.y },
      lastX: card.x,
      lastY: card.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    // Convert both the start and current screen positions to canvas coords so
    // the delta is expressed in canvas space (respects zoom level).
    const startCanvas = screenToCanvas(
      dragState.current.startScreen.x,
      dragState.current.startScreen.y,
    );
    const currCanvas = screenToCanvas(e.clientX, e.clientY);
    const newX = dragState.current.startCard.x + (currCanvas.x - startCanvas.x);
    const newY = dragState.current.startCard.y + (currCanvas.y - startCanvas.y);
    dragState.current.lastX = newX;
    dragState.current.lastY = newY;
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
    if (!dragState.current) return;
    const { pointerId, lastX, lastY } = dragState.current;
    e.currentTarget.releasePointerCapture(pointerId);
    dragState.current = null;
    // Commit the final position to React state exactly once.
    onMove(card.id, lastX, lastY);
  };

  return (
    <div
      ref={cardElRef}
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: 200,
        minHeight: 130,
        borderRadius: 16,
        backgroundColor: "var(--cog-cream-light)",
        border: mergeSelected
          ? "2px solid var(--cog-gold, #B8953A)"
          : selected
          ? `2px solid ${card.accent}`
          : card.isDimmedReference
          ? `1.5px dashed ${card.accent}60`
          : `2px solid ${card.accent}40`,
        boxShadow: mergeSelected
          ? "0 0 0 3px rgba(184,149,58,0.25), 0 4px 14px rgba(0,0,0,0.09)"
          : selected
          ? `0 8px 28px ${card.accent}30`
          : isVoice && layerCount > 0
          ? `0 4px 14px rgba(0,0,0,0.09), 5px 5px 0 0 ${card.accent}25, 10px 10px 0 0 ${card.accent}12`
          : "0 4px 14px rgba(0,0,0,0.09)",
        opacity: card.isDimmedReference ? 0.42 : 1,
        cursor: dragState.current ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: selected ? 20 : 10,
        transform: selected ? "scale(1.03)" : "scale(1)",
        transition: "transform 150ms ease, box-shadow 150ms ease, opacity 200ms ease",
        padding: 14,
        boxSizing: "border-box",
      }}
      onClick={onSelect}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="button"
      aria-pressed={selected}
      aria-label={`${card.type} card: ${card.title}`}
    >
      {/* Creator dot — top right */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: card.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 700,
          color: "#FFFFFF",
          letterSpacing: 0,
        }}
        title={card.contributor}
      >
        {card.contributor.slice(0, 2).toUpperCase()}
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

      {/* Body */}
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

      {/* "Used in Final" label for dimmed references */}
      {card.isDimmedReference && (
        <p style={{ fontSize: 10, color: card.accent, marginTop: 8, fontWeight: 600 }}>
          ↳ Used in Final
        </p>
      )}

      {/* In-place action buttons when selected */}
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
          {isVoice && onOpenStack && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenStack(); }}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: `${card.accent}16`,
                color: card.accent,
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
              aria-label={layerCount > 0 ? `Open stack — ${layerCount} layers` : "Open stack — record over this"}
            >
              {layerCount > 0 ? `Layers ${layerCount} ▸` : "Layers ▸"}
            </button>
          )}
          {card.tree === "ideas" && !card.isDimmedReference && (
            <button
              onClick={onMoveToFinal}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "var(--cog-gold)",
                color: "#FFF",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              → Final
            </button>
          )}
          {card.tree === "final" && (
            <button
              onClick={onMoveToIdeas}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "rgba(0,0,0,0.06)",
                color: "var(--cog-warm-gray)",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              ← Ideas
            </button>
          )}
          {canCompare && onCompare && (
            <button
              onClick={(e) => { e.stopPropagation(); onCompare(); }}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "rgba(0,0,0,0.06)",
                color: "var(--cog-warm-gray)",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
              aria-label="Compare versions"
            >
              Compare ▸
            </button>
          )}
          {card.type === "lyric" && onSuggestLine && (
            <button
              onClick={(e) => { e.stopPropagation(); onSuggestLine(); }}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "rgba(184,149,58,0.10)",
                color: "var(--cog-gold)",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
              aria-label="Suggest a line change"
            >
              Suggest line ▸
            </button>
          )}
          {onAddToListenPath && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddToListenPath(); }}
              style={{
                height: 30, padding: "0 10px", borderRadius: 8, border: "none", cursor: "pointer",
                backgroundColor: listenIndex != null ? "var(--cog-gold, #B8953A)" : "rgba(28,26,23,0.06)",
                color: listenIndex != null ? "#FFF" : "var(--cog-warm-gray, #6B6459)",
                fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600,
                boxShadow: listenIndex != null ? "0 2px 8px rgba(184,149,58,0.30)" : "none",
              }}
              aria-label={listenIndex != null ? `Remove from listen path (position ${listenIndex + 1})` : "Add to listen path"}
            >
              {listenIndex != null ? `Path ${listenIndex + 1} ✕` : "Path ▸"}
            </button>
          )}
          {card.tree === "ideas" && !card.isDimmedReference && onMergeSelect && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMergeSelect(); }}
              style={{
                height: 30, padding: "0 10px", borderRadius: 8, border: "none", cursor: "pointer",
                backgroundColor: mergeSelected ? "rgba(184,149,58,0.18)" : "rgba(28,26,23,0.06)",
                color: mergeSelected ? "var(--cog-gold, #B8953A)" : "var(--cog-warm-gray, #6B6459)",
                fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600,
                outline: mergeSelected ? "1.5px solid var(--cog-gold, #B8953A)" : "none",
              }}
              aria-pressed={mergeSelected}
              aria-label={mergeSelected ? "Deselect from merge" : "Select to merge"}
            >
              Merge ▸
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

// ─── isLayerId guard ──────────────────────────────────────────────────────────

const isLayerId = (v: string | null): v is LayerId =>
  ["room", "lyrics", "voice", "chords", "notes", "ideas", "people"].includes(v ?? "");

// ─── Main page ────────────────────────────────────────────────────────────────

const SongCanvasExperience = () => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewer = searchParams.get("role") === "viewer";

  // Real signed-in identity so contributions + presence carry the actual person,
  // not a hardcoded "You". Falls back gracefully before the profile resolves.
  const { profile } = useCurrentAccount();
  const currentUserName = useMemo(() => {
    const display = profile?.display_name?.trim();
    if (display) return display;
    const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    return full || "You";
  }, [profile]);

  const [cards, setCards] = useState<CanvasCard[]>(() => getStoredCards(songId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasStatus, setCanvasStatus] = useState("Saved to this song.");
  const [isDragOver, setIsDragOver] = useState(false);  // for divider glow
  const [showFirstAction, setShowFirstAction] = useState(() => {
    return !localStorage.getItem(FIRST_VISIT_KEY(songId));
  });
  const [activeLayer, setActiveLayer] = useState<LayerId>(() => {
    const layer = searchParams.get("layer");
    return isLayerId(layer) ? layer : "room";
  });
  const [showWorkPanel, setShowWorkPanel] = useState(activeLayer !== "room" && activeLayer !== "ideas");
  const [saveMoment, setSaveMoment] = useState<SongRoomSaveMoment | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  // Real room roster — the same source the People surface reads.
  const songMembers = useSongCollaborators(songId);
  // Viewport pan/zoom API, bridged out of <CanvasViewport> for presence-jump.
  const viewportApiRef = useRef<ViewportCtx | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [lineSuggest, setLineSuggest] = useState<{
    cardId: string;
    originalLine: string;
    sectionLabel: string;
  } | null>(null);
  // Pending line suggestions from co-writers (Feature 19), owner-reviewed.
  const [lineSuggestions, setLineSuggestions] = useState<PendingLineSuggestion[]>(
    () => listLineSuggestions(songId),
  );

  // ── Practice launcher state ──────────────────────────────────────────────────
  const [isPracticeLaunching, setIsPracticeLaunching] = useState(false);

  const handleLaunchPractice = useCallback(async () => {
    if (isPracticeLaunching) return;
    setIsPracticeLaunching(true);
    try {
      const sections = await loadPracticeSections(songId);
      navigate(`/songs/${songId}/practice`, {
        state: { songTitle, sections },
      });
    } catch {
      setIsPracticeLaunching(false);
    }
  }, [isPracticeLaunching, songId, songTitle, navigate]);

  const showSavedMoment = useCallback((title: string, destination: string, detail?: string) => {
    setSaveMoment({
      id: `save-${Date.now()}`,
      title,
      destination,
      detail,
    });
  }, []);

  // ── Voice recording state ────────────────────────────────────────────────────
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const [recordingFlow, setRecordingFlow] = useState<RecordingFlow>("idle");
  const [recordingSection, setRecordingSection] = useState("Raw idea");
  const [recordingNote, setRecordingNote] = useState("");
  const [pendingRecording, setPendingRecording] = useState<RecordingResult | null>(null);
  const voiceMemoCountRef = useRef(0);
  // When set, the next saved take is a layer recorded over this base memo.
  const recordingParentIdRef = useRef<string | null>(null);
  // The base memo whose stack sheet is currently open (null = closed).
  const [stackBaseId, setStackBaseId] = useState<string | null>(null);

  // ── F20 Listen Path ──────────────────────────────────────────────────────────
  const [listenQueue, setListenQueue] = useState<string[]>([]);
  const addToListenQueue = useCallback((id: string) => {
    setListenQueue((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);
  const saveListenArrangement = useCallback(() => {
    toast("Listen path saved", { description: `${listenQueue.length} cards in order` });
  }, [listenQueue]);

  // ── F22 Merge/Splice ─────────────────────────────────────────────────────
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const toggleMergeSelect = useCallback((id: string) => {
    setMergeSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }, []);
  const executeMerge = useCallback(() => {
    if (isViewer || mergeSelection.length !== 2) return;
    const [idA, idB] = mergeSelection;
    setCards((prev) => {
      const cardA = prev.find((c) => c.id === idA);
      const cardB = prev.find((c) => c.id === idB);
      if (!cardA || !cardB) return prev;
      const mergedId = `merged-${idA}-${idB}-${Date.now()}`;
      const contributors =
        cardA.contributor === cardB.contributor
          ? cardA.contributor
          : `${cardA.contributor} & ${cardB.contributor}`;
      const mergedCard: CanvasCard = {
        id: mergedId,
        tree: "ideas",
        type: "section",
        title: `${cardA.title} + ${cardB.title}`,
        body: [cardA.body, cardB.body].filter(Boolean).join("\n\n"),
        meta: `Merged from ${cardA.title} and ${cardB.title}`,
        section: cardA.section || cardB.section || "Merged section",
        contributor: contributors,
        status: "raw",
        accent: cardA.accent,
        x: Math.round((cardA.x + cardB.x) / 2),
        y: Math.round((cardA.y + cardB.y) / 2) + 60,
      };
      return prev
        .map((c) =>
          c.id === idA || c.id === idB ? { ...c, isDimmedReference: true } : c
        )
        .concat(mergedCard);
    });
    setMergeSelection([]);
    setSelectedId(null);
    showSavedMoment("Ideas merged", "Ideas tree", "New section created");
    toast("Ideas merged into a new section", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => {
          setCards((prev) => {
            const filtered = prev.filter(
              (c) => !c.id.startsWith(`merged-${idA}-${idB}`)
            );
            return filtered.map((c) =>
              c.id === idA || c.id === idB
                ? { ...c, isDimmedReference: false }
                : c
            );
          });
        },
      },
    });
  }, [isViewer, mergeSelection, showSavedMoment]);

  // Card drag position updates flow up through the onMove prop; see CanvasCardEl.

  useEffect(() => {
    const layer = searchParams.get("layer");
    if (isLayerId(layer)) {
      setActiveLayer(layer);
      setShowWorkPanel(layer !== "room" && layer !== "ideas");
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem(CARDS_KEY(songId), JSON.stringify(cards));
  }, [cards, songId]);

  // Pull any voice memos for this song from the backend and merge in the ones
  // we don't already have. Reused on mount AND on every realtime event, so a
  // collaborator's new memo/layer appears in the room without a reload.
  const hydrateVoiceMemos = useCallback(async () => {
    try {
      const db = await loadVoiceMemosForCanvas(songId);
      const dbCards: CanvasCard[] = db.nodes
        .filter((node) => node.objectType === "idea_card")
        .map((node): CanvasCard | null => {
          const card = db.cards[node.objectId];
          if (!card) return null;
          return {
            id: card.id,
            tree: "ideas" as const,
            type: "voice" as const,
            title: card.title,
            body: card.body || card.preview || "",
            meta: card.preview || "Voice memo",
            section: "Raw idea",
            contributor: card.contributorName,
            status: "raw" as const,
            accent: card.contributorColor,
            x: node.x,
            y: node.y,
          };
        })
        .filter((card): card is CanvasCard => Boolean(card));

      if (dbCards.length === 0) return;
      setCards((prev) => {
        const existing = new Set(prev.map((card) => card.id));
        const fresh = dbCards.filter((card) => !existing.has(card.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    } catch {
      // The local canvas remains usable when backend hydration is unavailable.
    }
  }, [songId]);

  // Mount hydration + live room channel. Any change in the song's room nudges a
  // re-hydrate; the merge dedupes by id so nothing flickers or duplicates.
  useEffect(() => {
    void hydrateVoiceMemos();
    const unsubscribe = subscribeSongRoom(songId, {
      onActivity: () => void hydrateVoiceMemos(),
      onCardChange: () => void hydrateVoiceMemos(),
      onTakeChange: () => void hydrateVoiceMemos(),
      onCaptureChange: () => void hydrateVoiceMemos(),
    });
    return unsubscribe;
  }, [songId, hydrateVoiceMemos]);

  const dismissFirstAction = useCallback(() => {
    localStorage.setItem(FIRST_VISIT_KEY(songId), "1");
    setShowFirstAction(false);
  }, [songId]);

  // ── Card manipulation ──────────────────────────────────────────────────────

  /** Called by CanvasCardEl's pointer-capture drag with the new canvas-space position. */
  const handleCardMove = useCallback((id: string, x: number, y: number) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, x, y } : c));
  }, []);

  const handleMoveToFinal = useCallback((cardId: string) => {
    if (isViewer) return;
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        // Original stays as dimmed reference
        return { ...c, isDimmedReference: true };
      }).concat((() => {
        const finalIndex = prev.filter((c) => c.tree === "final").length;
        return {
          ...prev.find((c) => c.id === cardId)!,
          id: `${cardId}-final`,
          tree: "final" as const,
          isDimmedReference: false,
          x: DIVIDER_X + 80 + (finalIndex % 2) * 240,
          y: 200 + Math.floor(finalIndex / 2) * 190,
          status: "approved" as const,
        };
      })())
    );
    setSelectedId(null);
    setIsDragOver(false);
    setCanvasStatus("Moved. Undo?");
    showSavedMoment("Approved idea", "Final tree", "Arrangement");
    toast("Idea moved to Final", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => {
          setCards((prev) =>
            prev
              .filter((c) => c.id !== `${cardId}-final`)
              .map((c) => c.id === cardId ? { ...c, isDimmedReference: false } : c)
          );
        },
      },
    });
  }, [isViewer, showSavedMoment]);

  const handleMoveToIdeas = useCallback((cardId: string) => {
    if (isViewer) return;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    // Restore the original dimmed reference
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId.replace("-final", "")
          ? { ...c, isDimmedReference: false }
          : c
      )
    );
    setSelectedId(null);
    setCanvasStatus("Moved. Undo?");
    showSavedMoment("Returned idea", "Ideas tree", "Arrangement");
  }, [isViewer, showSavedMoment]);

  const addCard = useCallback((type: CanvasCardType) => {
    if (isViewer) return;
    dismissFirstAction();
    const ideaIndex = cards.filter((card) => card.tree === "ideas").length;
    const titleByType: Record<CanvasCardType, string> = {
      hum: "Quick hum",
      lyric: "New lyric",
      chord: "New chord",
      note: "New idea",
      voice: "New voice memo",
      scripture: "Scripture note",
      section: "New section",
    };
    const newCard: CanvasCard = {
      id: `card-${Date.now()}`,
      tree: "ideas",
      type,
      title: titleByType[type],
      body: "",
      meta: "",
      section: "Raw idea",
      contributor: currentUserName,
      status: "raw",
      accent: getCreatorColor(currentUserName).base,
      x: 80 + (ideaIndex % 3) * 240,
      y: 700 + Math.floor(ideaIndex / 3) * 180,
    };
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
    setCanvasStatus("Saved to this song.");
    showSavedMoment(newCard.title, "Ideas tree", "Note");
  }, [cards, dismissFirstAction, isViewer, showSavedMoment, currentUserName]);

  // ── Voice recording handlers ──────────────────────────────────────────────────
  const handleStartRecording = useCallback(async (parentId?: string) => {
    if (isViewer) return;
    recordingParentIdRef.current = parentId ?? null;
    setRecordingSection(parentId ? "Layer" : "Raw idea");
    setRecordingNote("");
    const started = await startRecording();
    setRecordingFlow(started ? "recording" : "idle");
  }, [isViewer, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording();
    if (result) { setPendingRecording(result); setRecordingFlow("reviewing"); }
    else setRecordingFlow("idle");
  }, [stopRecording]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
  }, [cancelRecording]);

  // Flush a queued canvas take (base OR layer) and reconcile its card. On success
  // the temp card id becomes the real memo id; on failure the card stays put with
  // its blob safe in the cache, to be retried by the recovery sweep on next load /
  // reconnect. The creed holds on the canvas exactly as it does in the song room.
  const flushCanvasUpload = useCallback(async (pendingId: string) => {
    try {
      const memoId = await flushPendingUpload(pendingId);
      setCards((prev) => prev.map((c) =>
        c.id === pendingId ? { ...c, id: memoId ?? c.id, isProcessing: false } : c,
      ));
      setCanvasStatus("Saved to this song.");
    } catch {
      setCards((prev) => prev.map((c) =>
        c.id === pendingId ? { ...c, isProcessing: false } : c,
      ));
      setCanvasStatus("You can keep adding ideas. We'll finish saving when you're back online.");
    }
  }, []);

  const handleSaveMemo = useCallback(async ({ name, section, transcribe }: { name: string; section: string; transcribe: boolean }) => {
    if (!pendingRecording) return;
    const rec = pendingRecording;
    // Capture + clear the "record over" target before any async work so the
    // next normal record can't inherit a stale parent.
    const parentMemoId = recordingParentIdRef.current ?? undefined;
    recordingParentIdRef.current = null;
    voiceMemoCountRef.current++;
    setCanvasStatus("Saving...");
    showSavedMoment(
      name || "Voice memo",
      parentMemoId ? "Layer added to stack" : (section || "Raw idea"),
      "Voice memo",
    );
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
    // Reopen the base's stack so the songwriter sees their layer land.
    if (parentMemoId) setStackBaseId(parentMemoId);

    // Local-first: the blob is cached to the device BEFORE any network call, so a
    // base take or a layered "record over this" can never be lost on a dropped
    // upload. The pending row's id keys both the card and the upload idempotency.
    const pending = await enqueuePendingUpload({
      blob: rec.blob,
      songId,
      mimeType: rec.mimeType,
      durationMs: rec.durationMs,
      title: name,
      sectionLabel: section,
      transcribe,
      parentMemoId,
    });

    setCards((prev) => {
      const ideaIndex = prev.filter((card) => card.tree === "ideas").length;
      const newCard: CanvasCard = {
        id: pending.id, tree: "ideas", type: "voice",
        title: name, body: "", meta: formatDuration(rec.durationMs),
        section, contributor: currentUserName, status: "raw", accent: getCreatorColor(currentUserName).base,
        x: 80 + (ideaIndex % 3) * 240, y: 700 + Math.floor(ideaIndex / 3) * 180,
        parentMemoId, durationMs: rec.durationMs,
        isProcessing: true,
      };
      return [newCard, ...prev];
    });

    await flushCanvasUpload(pending.id);
  }, [pendingRecording, showSavedMoment, songId, currentUserName, flushCanvasUpload]);

  // Recovery sweep: a canvas take whose upload was interrupted last session is
  // still safe in the cache. Replay each on load — a reconnected device heals
  // itself, the take reaches the song, and its card swaps to the real memo id.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orphans = await listPendingUploads(songId);
      for (const orphan of orphans) {
        if (cancelled) return;
        await flushCanvasUpload(orphan.id);
      }
    })();
    return () => { cancelled = true; };
  }, [songId, flushCanvasUpload]);

  const openMicSettings = useCallback(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) window.location.href = "app-settings:";
    else if (/Android/.test(ua)) alert("Settings → Apps → Colors of Glory → Permissions → Microphone");
    else alert("Click the 🔒 lock icon in your address bar → Site Settings → Microphone → Allow");
  }, []);

  const handleRecordOver = useCallback((baseId: string) => {
    setStackBaseId(null);
    void handleStartRecording(baseId);
  }, [handleStartRecording]);

  const chooseLayer = (layer: LayerId) => {
    setActiveLayer(layer);
    const show = layer !== "room" && layer !== "ideas";
    setShowWorkPanel(show);
    navigate(`/songs/${songId}/canvas?layer=${layer}`, { replace: false });
  };

  // Layers live inside their base's stack, not loose on the board.
  const ideasCards = useMemo(() => cards.filter((c) => c.tree === "ideas" && !c.parentMemoId), [cards]);
  const finalCards = useMemo(() => cards.filter((c) => c.tree === "final" && !c.parentMemoId), [cards]);
  const layerCountByBase = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      if (c.parentMemoId) counts[c.parentMemoId] = (counts[c.parentMemoId] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

  // Everyone whose hand is on this song — derived from who contributed cards.
  // Stable color/initials per person so the room reads as collaborative at a glance.
  const roomCollaborators = useMemo(() => {
    const seen = new Map<string, { userId: string; firstName: string; lastName: string; avatarColor: string; avatarInitials: string }>();
    for (const c of cards) {
      if (!c.contributor || seen.has(c.contributor)) continue;
      seen.set(c.contributor, {
        userId: c.contributor,
        firstName: c.contributor,
        lastName: "",
        avatarColor: getCreatorColor(c.contributor).base,
        avatarInitials: getCreatorInitials(c.contributor),
      });
    }
    return Array.from(seen.values());
  }, [cards]);

  // Header presence prefers the real roster; card contributors fill in until it loads.
  const presenceStack = useMemo(
    () =>
      songMembers.length > 0
        ? songMembers.map((m) => ({
            userId: m.userId,
            firstName: m.firstName,
            lastName: m.lastName,
            avatarColor: m.avatarColor,
            avatarInitials: m.avatarInitials,
          }))
        : roomCollaborators,
    [songMembers, roomCollaborators],
  );

  // The people layer's roster rows (name + role); demo fallback lives in the layer.
  const peopleLayerCollaborators = useMemo(
    () =>
      songMembers.map((m) => ({
        initials: m.avatarInitials,
        name: `${m.firstName} ${m.lastName}`.trim(),
        role: m.role,
        color: m.avatarColor,
      })),
    [songMembers],
  );

  // The invite sheet's roster: real members when they exist, otherwise the
  // people already visible on cards — so presence-jump works in every room.
  const sheetRoster = useMemo(
    () =>
      songMembers.length > 0
        ? songMembers
        : roomCollaborators.map((c) => ({
            userId: c.userId,
            firstName: c.firstName,
            lastName: c.lastName,
            role: "Contributor",
            isOwner: false,
            avatarColor: c.avatarColor,
            avatarInitials: c.avatarInitials,
          })),
    [songMembers, roomCollaborators],
  );

  // Fly the canvas so a card lands at the viewport center, then select it.
  const jumpToCard = useCallback((card: CanvasCard) => {
    const area = canvasAreaRef.current;
    // Land the card's center at the viewport's center (card is 200px wide).
    viewportApiRef.current?.panTo(
      card.x + 100,
      card.y + 70,
      (area?.clientWidth ?? window.innerWidth) / 2,
      (area?.clientHeight ?? window.innerHeight) / 2,
      450,
    );
    setSelectedId(card.id);
  }, []);

  const jumpToCardId = useCallback(
    (cardId: string) => {
      const target = cards.find((c) => c.id === cardId);
      if (target) jumpToCard(target);
    },
    [cards, jumpToCard],
  );

  // Presence as navigation: fly the canvas to this person's latest idea and
  // select it, so "who is in the room" becomes "where they are working".
  const jumpToCollaborator = useCallback(
    (person: { firstName: string; lastName: string }) => {
      const fullName = `${person.firstName} ${person.lastName}`.trim();
      // Cards are prepended on add, so the first match is the latest idea.
      // Layers live inside stacks — only board-positioned cards are targets.
      const target = cards.find(
        (c) =>
          !c.parentMemoId &&
          (c.contributor === fullName || c.contributor === person.firstName),
      );
      setShowShareSheet(false);
      if (!target) {
        toast(`${person.firstName} hasn't added an idea here yet`, {
          description: "Their work will appear on the canvas as they contribute.",
        });
        return;
      }
      jumpToCard(target);
    },
    [cards, jumpToCard],
  );

  // The recap digest, from the room's real cards: what other hands added,
  // latest first, each row a deep link to its card (COG Product 12).
  const recapItems = useMemo(
    () =>
      cards
        .filter((c) => !c.parentMemoId && c.contributor && c.contributor !== currentUserName)
        .slice(0, 5)
        .map((c) => ({
          id: `recap-${c.id}`,
          text: `${c.contributor} added "${c.title}" · ${c.section}`,
          dotColor: c.accent,
          targetCardId: c.id,
        })),
    [cards, currentUserName],
  );

  // Ideas a co-writer added that the owner hasn't acted on yet: still in Ideas,
  // not a stack layer, not already approved/kept/dimmed. This is the pending
  // queue (COG Product 11) — the owner keeps control, contributors suggest.
  const KIND_BY_TYPE: Record<CanvasCardType, string> = useMemo(
    () => ({
      voice: "Voice memo", hum: "Voice memo", lyric: "Lyric", chord: "Chord",
      note: "Idea", scripture: "Theology note", section: "Section",
    }),
    [],
  );
  const pendingReview = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            c.tree === "ideas" &&
            !c.parentMemoId &&
            !c.isDimmedReference &&
            !c.reviewed &&
            c.status !== "approved" &&
            c.contributor &&
            c.contributor !== currentUserName,
        )
        .map((c) => ({
          id: c.id,
          title: c.title,
          body: c.body,
          section: c.section,
          contributor: c.contributor,
          accent: c.accent,
          kind: KIND_BY_TYPE[c.type] ?? "Idea",
        })),
    [cards, currentUserName, KIND_BY_TYPE],
  );

  // Keep-in-Ideas: mark reviewed so it leaves the queue but stays on the board.
  const handleKeepInIdeas = useCallback((cardId: string) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, reviewed: true } : c)));
  }, []);

  // Not-this-one: archive from the board, with a calm Undo (never a hard delete).
  const handleDismissReview = useCallback((cardId: string) => {
    let removed: CanvasCard | undefined;
    setCards((prev) => {
      removed = prev.find((c) => c.id === cardId);
      return prev.filter((c) => c.id !== cardId);
    });
    toast("Idea set aside", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => { if (removed) setCards((prev) => [removed as CanvasCard, ...prev]); },
      },
    });
  }, []);

  // Line suggestions (Feature 19) become their own review items, so a
  // "replace just this line" flows through the SAME owner accept/keep motion.
  const suggestionReviewItems = useMemo(
    () =>
      lineSuggestions.map((s) => ({
        id: s.id,
        title: "Line change",
        body: "",
        section: s.section,
        contributor: s.contributor,
        accent: getCreatorColor(s.contributor).base,
        kind: "Line suggestion",
        suggestion: { originalLine: s.originalLine, proposedLine: s.proposedLine },
      })),
    [lineSuggestions],
  );

  // One unified queue: pending ideas + pending line suggestions.
  const reviewQueueItems = useMemo(
    () => [...suggestionReviewItems, ...pendingReview],
    [suggestionReviewItems, pendingReview],
  );

  // Accept a line suggestion → replace the target card's body, drop the suggestion.
  const handleAcceptLine = useCallback((suggestionId: string) => {
    const s = lineSuggestions.find((x) => x.id === suggestionId);
    if (!s) return;
    setCards((prev) => prev.map((c) => (c.id === s.cardId ? { ...c, body: s.proposedLine } : c)));
    setLineSuggestions(removeLineSuggestion(songId, suggestionId));
    showSavedMoment("Line updated", "Lyrics", s.section);
  }, [lineSuggestions, songId, showSavedMoment]);

  // Keep original → drop the suggestion without touching the line.
  const handleKeepLine = useCallback((suggestionId: string) => {
    setLineSuggestions(removeLineSuggestion(songId, suggestionId));
  }, [songId]);

  const dockActions = useMemo(
    () => [
      {
        id: "practice",
        label: isPracticeLaunching ? "Loading" : "Practice",
        icon: BookOpen,
        onClick: () => { void handleLaunchPractice(); },
        loading: isPracticeLaunching,
        haptic: [4],
      },
      {
        id: "record",
        label: recordingFlow === "recording" ? "Recording" : "Record memo",
        icon: Mic,
        onClick: () => { void handleStartRecording(); },
        primary: true,
        disabled: isViewer || recordingFlow !== "idle",
        haptic: [10],
        ariaLabel: recordingFlow === "recording" ? "Recording voice memo" : "Record memo",
      },
      {
        id: "idea",
        label: "Add idea",
        icon: Plus,
        onClick: () => addCard("note"),
        disabled: isViewer,
        haptic: [5],
      },
    ],
    [addCard, handleLaunchPractice, handleStartRecording, isPracticeLaunching, isViewer, recordingFlow],
  );

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", backgroundColor: "var(--cog-cream)", overflow: "hidden" }}
    >
      <SongCanvasSemanticSummary />
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-30 flex items-center justify-between gap-3 px-5 pb-3 flex-shrink-0"
        style={{ maxWidth: 1180, margin: "0 auto", width: "100%", paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "var(--cog-warm-gray)", flexShrink: 0 }}
          aria-label="Back to songs"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Songs
        </button>

        {/* Song title centered */}
        <div className="flex flex-col items-center min-w-0 flex-1">
          <CogBrand variant="stacked" size="sm" />
          <h1
            className="text-center font-bold leading-tight truncate"
            style={{ fontSize: 15, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", marginTop: 4, maxWidth: 180 }}
          >
            {songTitle}
          </h1>
        </div>

        {/* Layer chips */}
        <div
          className="flex gap-1 overflow-x-auto flex-shrink-0"
          style={{ maxWidth: 220 }}
        >
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const active = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => chooseLayer(layer.id)}
                aria-pressed={active}
                className="flex min-h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition-all duration-150 active:scale-[0.97]"
                style={{
                  backgroundColor: active ? "#FFFFFF" : "transparent",
                  border: active ? "1px solid rgba(181,147,90,0.30)" : "1px solid transparent",
                  color: active ? "var(--cog-gold)" : "var(--cog-muted)",
                  boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Icon size={12} strokeWidth={1.8} />
                {layer.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="relative z-30 mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-5 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            aria-live="polite"
            className="truncate rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold)" }}
          >
            {canvasStatus}
          </p>
          <button
            type="button"
            onClick={() => setShowRecap(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70 active:scale-[0.94]"
            style={{ color: "var(--cog-warm-gray)" }}
            aria-label="What changed since you left"
          >
            <History size={16} strokeWidth={1.9} />
          </button>
          {!isViewer && reviewQueueItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReviewQueue(true)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
              style={{
                backgroundColor: "var(--cog-gold)",
                color: "#FFFFFF",
                boxShadow: "0 1px 6px rgba(184,149,58,0.30)",
                fontFamily: "var(--font-body)",
              }}
              aria-label={`Needs your review: ${reviewQueueItems.length} item${reviewQueueItems.length === 1 ? "" : "s"} from your co-writers`}
            >
              <Inbox size={13} strokeWidth={2.2} />
              Review {reviewQueueItems.length}
            </button>
          )}
        </div>
        {isViewer ? (
          <p className="text-right text-xs font-medium" style={{ color: "#6B6459" }}>
            You can view this canvas. Ask the owner if you need to contribute.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowShareSheet(true)}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1 pl-2 pr-1.5 transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            style={{
              backgroundColor: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(184,149,58,0.25)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}
            aria-label={
              presenceStack.length > 0
                ? `In this room: ${presenceStack.length} ${presenceStack.length === 1 ? "person" : "people"} — invite someone`
                : "Invite someone into this song"
            }
          >
            {presenceStack.length > 0 && (
              <CollaboratorAvatarStack collaborators={presenceStack} size={26} maxVisible={3} />
            )}
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
              style={{ backgroundColor: "var(--cog-gold)", color: "#FFFFFF", fontFamily: "var(--font-body)" }}
            >
              <UserPlus size={12} strokeWidth={2.2} />
              Invite
            </span>
          </button>
        )}
      </div>

      {/* ── Canvas viewport ──────────────────────────────────────────────── */}
      <div ref={canvasAreaRef} className="relative flex-1 min-h-0">
        <CanvasViewport
          className="w-full h-full"
          overlay={
            <>
              {showFirstAction && (
                <FirstActionPrompt
                  onHum={() => { addCard("hum"); dismissFirstAction(); }}
                  onLyric={() => { addCard("lyric"); dismissFirstAction(); }}
                  onChords={() => { addCard("chord"); dismissFirstAction(); }}
                />
              )}
              <CreativeActionDock actions={dockActions} />
              {SHOW_LEGACY_CANVAS_FABS && (
                <>
              {/* Practice FAB */}
              <button
                type="button"
                onClick={() => { void handleLaunchPractice(); }}
                disabled={isPracticeLaunching}
                className="absolute flex items-center justify-center gap-2 rounded-2xl transition-all duration-150 active:scale-95"
                style={{
                  left: 20, bottom: 80, width: 140, height: 52, zIndex: 40,
                  backgroundColor: isPracticeLaunching ? "rgba(181,147,90,0.55)" : "rgba(181,147,90,0.14)",
                  border: "1px solid rgba(181,147,90,0.40)",
                  color: "#B5935A",
                  boxShadow: "none",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
                aria-label="Practice this song"
              >
                <BookOpen size={18} strokeWidth={2} />
                <span>{isPracticeLaunching ? "Loading…" : "Practice"}</span>
              </button>

              {/* Mic FAB — record voice memo */}
              <button
                type="button"
                onClick={() => { void handleStartRecording(); }}
                disabled={isViewer || recordingFlow !== "idle"}
                className="absolute flex items-center justify-center gap-2 rounded-2xl transition-all duration-150 active:scale-95"
                style={{
                  right: 168, bottom: 80, width: 140, height: 52, zIndex: 40,
                  backgroundColor: recordingFlow === "recording" ? "var(--cog-charcoal)" : "#FFFFFF",
                  border: recordingFlow === "recording" ? "none" : "1px solid rgba(181,147,90,0.28)",
                  color: recordingFlow === "recording" ? "#FFFFFF" : "var(--cog-charcoal)",
                  boxShadow: recordingFlow === "recording"
                    ? "0 0 0 6px var(--cog-gold-glow), 0 4px 16px rgba(28,26,23,0.30)"
                    : "0 8px 24px rgba(28,26,23,0.12)",
                  animation: recordingFlow === "recording" ? "mic-pulse 1.4s ease-in-out infinite" : "none",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
                aria-label={recordingFlow === "recording" ? "Recording..." : "Record idea / Record memo"}
                aria-pressed={recordingFlow === "recording"}
              >
                <Mic size={20} strokeWidth={2} />
                <span>{recordingFlow === "recording" ? "Recording..." : "Record memo"}</span>
              </button>

              {/* Quick-add FAB */}
              <button
                type="button"
                onClick={() => addCard("note")}
                disabled={isViewer}
                className="absolute flex items-center justify-center gap-2 rounded-2xl text-white transition-all duration-150 active:scale-95"
                style={{
                  right: 20, bottom: 80, width: 140, height: 52, zIndex: 40,
                  backgroundColor: "#B5935A",
                  boxShadow: "0 4px 16px rgba(181,147,90,0.45)",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
                aria-label="Add idea"
              >
                <Plus size={22} strokeWidth={2.5} />
                <span>Add idea</span>
              </button>
                </>
              )}
            </>
          }
        >
          {/* Canvas content — all positioned absolutely */}
          <CanvasViewportBridge apiRef={viewportApiRef} />
          <CanvasBranchConnectors ideasCards={ideasCards} finalCards={finalCards} />
          <SongRootCard title={songTitle} />
          <ZoneLabels />
          <CanvasDivider isDropActive={isDragOver} />

          {/* Render all cards */}
          {[...ideasCards, ...finalCards].map((card) => (
            <CanvasCardEl
              key={card.id}
              card={card}
              selected={selectedId === card.id}
              onSelect={() => setSelectedId(selectedId === card.id ? null : card.id)}
              onMoveToFinal={() => handleMoveToFinal(card.id)}
              onMoveToIdeas={() => handleMoveToIdeas(card.id)}
              onMove={handleCardMove}
              layerCount={layerCountByBase[card.id] ?? 0}
              onOpenStack={
                card.type === "voice" || card.type === "hum"
                  ? () => setStackBaseId(card.id)
                  : undefined
              }
              onSuggestLine={
                card.type === "lyric" && !isViewer
                  ? () => setLineSuggest({ cardId: card.id, originalLine: card.body, sectionLabel: card.section })
                  : undefined
              }
              onAddToListenPath={() => addToListenQueue(card.id)}
              listenIndex={listenQueue.includes(card.id) ? listenQueue.indexOf(card.id) : undefined}
              onMergeSelect={!isViewer && card.tree === "ideas" && !card.isDimmedReference ? () => toggleMergeSelect(card.id) : undefined}
              mergeSelected={mergeSelection.includes(card.id)}
            />
          ))}
        </CanvasViewport>

        {/* Work layer slide-in panel */}
        {showWorkPanel && (
          <div
            className="absolute top-0 right-0 bottom-0 z-40 overflow-y-auto"
            style={{
              width: 320,
              backgroundColor: "#FAFAF6",
              borderLeft: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => { setShowWorkPanel(false); setActiveLayer("room"); }}
              className="absolute top-4 right-4 flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, backgroundColor: "rgba(0,0,0,0.06)", color: "#666" }}
              aria-label="Close panel"
            >
              ×
            </button>
            <div className="p-4" style={{ paddingTop: 48 }}>
              {activeLayer === "voice" ? (
                <VoiceLayerPanel
                  songId={songId}
                  currentUserName={currentUserName}
                  onRecord={() => { setShowWorkPanel(false); setActiveLayer("room"); void handleStartRecording(); }}
                />
              ) : (
                <>
                  <Suspense fallback={<div style={{ height: 200, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 16 }} />}>
                    <SongCanvasWorkLayers activeLayer={activeLayer} />
                  </Suspense>
                  <Suspense fallback={null}>
                    <SongCanvasCollabLayers
                      activeLayer={activeLayer}
                      collaborators={peopleLayerCollaborators}
                      onInvite={isViewer ? undefined : () => setShowShareSheet(true)}
                      onOpenRecap={() => setShowRecap(true)}
                    />
                  </Suspense>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <MergeActionBar
        selection={mergeSelection}
        cards={[...ideasCards, ...finalCards]}
        onRemove={(id) => setMergeSelection((prev) => prev.filter((x) => x !== id))}
        onMerge={executeMerge}
        onClear={() => setMergeSelection([])}
      />
      <ListenPathBar
        queue={listenQueue}
        cards={[...ideasCards, ...finalCards]}
        onRemove={(id) => setListenQueue((prev) => prev.filter((x) => x !== id))}
        onClear={() => setListenQueue([])}
        onSave={saveListenArrangement}
      />
      <SongTabBar activeTab="canvas" />
      <SongRoomSaveToast
        moment={saveMoment}
        onDone={() => setSaveMoment(null)}
      />

      {/* Recording sheet */}
      {(recordingFlow === "recording" || recorderState.phase === "permission-denied") && (
        <RecordingSheet
          phase={recorderState.phase}
          durationMs={recorderState.durationMs}
          analyserNode={recorderState.analyserNode}
          error={recorderState.error}
          section={recordingSection}
          onSectionChange={setRecordingSection}
          noteValue={recordingNote}
          onNoteChange={setRecordingNote}
          onStop={handleStopRecording}
          onCancel={handleCancelRecording}
          onOpenSettings={openMicSettings}
        />
      )}

      {/* Review sheet */}
      {recordingFlow === "reviewing" && pendingRecording && (
        <VoiceReviewSheet
          recording={pendingRecording}
          defaultName={recordingNote.trim() || `Voice Memo ${voiceMemoCountRef.current + 1}`}
          section={recordingSection}
          onSave={handleSaveMemo}
          onDiscard={handleCancelRecording}
        />
      )}

      {/* Voice memo stack — base + the layers recorded over it */}
      {stackBaseId && (() => {
        const base = cards.find((c) => c.id === stackBaseId);
        if (!base) return null;
        const stackLayers = cards.filter((c) => c.parentMemoId === stackBaseId);
        return (
          <StackSheet
            base={toStackView(base)}
            layers={stackLayers.map(toStackView)}
            canRecordOver={!isViewer}
            onRecordOver={handleRecordOver}
            onClose={() => setStackBaseId(null)}
          />
        );
      })()}

      {/* What Changed recap sheet */}
      {showRecap && (
        <WhatChangedRecapSheet
          songId={songId}
          items={recapItems}
          onJumpToCard={jumpToCardId}
          onDismiss={() => setShowRecap(false)}
        />
      )}

      {/* Copy-link invite sheet — one tap from the room's presence stack */}
      {showShareSheet && (
        <Suspense fallback={null}>
          <ShareSongSheet
            songId={songId}
            songTitle={songTitle}
            collaborators={sheetRoster}
            onJumpTo={jumpToCollaborator}
            onClose={() => setShowShareSheet(false)}
          />
        </Suspense>
      )}

      {/* Owner review queue — pending ideas from co-writers, one at a time */}
      {showReviewQueue && (
        <Suspense fallback={null}>
          <OwnerReviewQueueSheet
            items={reviewQueueItems}
            onApprove={handleMoveToFinal}
            onKeep={handleKeepInIdeas}
            onDismiss={handleDismissReview}
            onAcceptLine={handleAcceptLine}
            onKeepLine={handleKeepLine}
            onSee={(cardId) => { setShowReviewQueue(false); jumpToCardId(cardId); }}
            onClose={() => setShowReviewQueue(false)}
          />
        </Suspense>
      )}

      {/* Line-level suggestion sheet (F19) */}
      {lineSuggest && (
        <LineSuggestionSheet
          mode={isViewer ? "review" : "create"}
          originalLine={lineSuggest.originalLine}
          sectionLabel={lineSuggest.sectionLabel}
          onSend={(text) => {
            if (!lineSuggest) return;
            // Persist into the owner's review queue instead of vanishing on a
            // toast. The sheet plays its own "Suggestion sent" confirmation
            // and then calls onDismiss to unmount — don't unmount here.
            setLineSuggestions(
              addLineSuggestion({
                id: `ls-${Date.now()}`,
                songId,
                cardId: lineSuggest.cardId,
                originalLine: lineSuggest.originalLine,
                proposedLine: text,
                contributor: currentUserName,
                section: lineSuggest.sectionLabel,
                createdAt: Date.now(),
              }),
            );
          }}
          onKeep={() => setLineSuggest(null)}
          onDismiss={() => setLineSuggest(null)}
        />
      )}

      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(184,149,58,0.20), 0 4px 16px rgba(28,26,23,0.35); }
          50%       { box-shadow: 0 0 0 14px rgba(184,149,58,0.08), 0 4px 16px rgba(28,26,23,0.35); }
        }
      `}</style>
    </div>
  );
};

export default SongCanvasExperience;
