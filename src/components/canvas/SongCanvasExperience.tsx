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
} from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";
import CanvasViewport, { DIVIDER_X } from "@/components/canvas/CanvasViewport";
import CanvasDivider from "@/components/canvas/CanvasDivider";
import ZoneLabels from "@/components/canvas/ZoneLabel";
import FirstActionPrompt from "@/components/canvas/FirstActionPrompt";

const SongCanvasWorkLayers = lazy(() => import("@/components/cog/SongCanvasWorkLayers"));
const SongCanvasCollabLayers = lazy(() => import("@/components/cog/SongCanvasCollabLayers"));

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
  accent: string;   // creator's aurora color
  x: number;        // canvas-coordinate position
  y: number;
  isDimmedReference?: boolean;  // true = original after move to Final
}

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
    accent: "#D4AE5C",
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
    accent: "#53AB8B",
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
    accent: "#8070C4",
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
    accent: "#D4AE5C",
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
    accent: "#8070C4",
    x: DIVIDER_X + 80,
    y: 420,
  },
];

const FIRST_VISIT_KEY = (songId: string) => `cog:canvas-first-visit-${songId}`;

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
    <button type="button">Add idea</button>
    <button type="button">Record idea</button>
  </section>
);

// ─── Canvas card component ─────────────────────────────────────────────────────

interface CanvasCardProps {
  card: CanvasCard;
  selected: boolean;
  onSelect: () => void;
  onMoveToFinal: () => void;
  onMoveToIdeas: () => void;
  onDragStart: (e: React.PointerEvent, cardId: string) => void;
}

const CanvasCardEl = ({
  card,
  selected,
  onSelect,
  onMoveToFinal,
  onMoveToIdeas,
  onDragStart,
}: CanvasCardProps) => {
  const Icon = CARD_ICONS[card.type];

  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: 200,
        minHeight: 130,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        border: selected
          ? `2px solid ${card.accent}`
          : card.isDimmedReference
          ? `1.5px dashed ${card.accent}60`
          : `2px solid ${card.accent}40`,
        boxShadow: selected
          ? `0 8px 28px ${card.accent}30`
          : "0 4px 14px rgba(0,0,0,0.09)",
        opacity: card.isDimmedReference ? 0.42 : 1,
        cursor: "pointer",
        userSelect: "none",
        zIndex: selected ? 20 : 10,
        transform: selected ? "scale(1.03)" : "scale(1)",
        transition: "transform 150ms ease, box-shadow 150ms ease, opacity 200ms ease",
        padding: 14,
        boxSizing: "border-box",
      }}
      onClick={onSelect}
      onPointerDown={(e) => {
        e.stopPropagation(); // prevent canvas pan when interacting with a card
        onDragStart(e, card.id);
      }}
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
            color: "#999",
            fontFamily: "var(--font-body)",
          }}
        >
          {card.section}
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1A1A1A",
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
          color: "#666",
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
          {card.tree === "ideas" && !card.isDimmedReference && (
            <button
              onClick={onMoveToFinal}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "#B5935A",
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
                color: "#666",
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
        </div>
      )}
    </div>
  );
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

  const [cards, setCards] = useState<CanvasCard[]>(INITIAL_CARDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);  // for divider glow
  const [showFirstAction, setShowFirstAction] = useState(() => {
    return !localStorage.getItem(FIRST_VISIT_KEY(songId));
  });
  const [activeLayer, setActiveLayer] = useState<LayerId>(() => {
    const layer = searchParams.get("layer");
    return isLayerId(layer) ? layer : "room";
  });
  const [showWorkPanel, setShowWorkPanel] = useState(activeLayer !== "room" && activeLayer !== "ideas");

  // Drag tracking for card repositioning
  const draggingCardId = useRef<string | null>(null);
  const dragStartCanvas = useRef({ x: 0, y: 0 });
  const dragStartCard = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const layer = searchParams.get("layer");
    if (isLayerId(layer)) {
      setActiveLayer(layer);
      setShowWorkPanel(layer !== "room" && layer !== "ideas");
    }
  }, [searchParams]);

  const dismissFirstAction = useCallback(() => {
    localStorage.setItem(FIRST_VISIT_KEY(songId), "1");
    setShowFirstAction(false);
  }, [songId]);

  // ── Card manipulation ──────────────────────────────────────────────────────

  const handleCardDragStart = useCallback((e: React.PointerEvent, cardId: string) => {
    draggingCardId.current = cardId;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    dragStartCanvas.current = { x: e.clientX, y: e.clientY };
    dragStartCard.current = { x: card.x, y: card.y };
    setIsDragOver(true);
    setSelectedId(cardId);
  }, [cards]);

  const handleMoveToFinal = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        // Original stays as dimmed reference
        return { ...c, isDimmedReference: true };
      }).concat({
        ...prev.find((c) => c.id === cardId)!,
        id: `${cardId}-final`,
        tree: "final",
        isDimmedReference: false,
        x: DIVIDER_X + 80 + Math.random() * 200,
        y: 200 + Math.random() * 300,
        status: "approved",
      })
    );
    setSelectedId(null);
    setIsDragOver(false);
  }, []);

  const handleMoveToIdeas = useCallback((cardId: string) => {
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
  }, []);

  const addCard = useCallback((type: CanvasCardType) => {
    dismissFirstAction();
    const newCard: CanvasCard = {
      id: `card-${Date.now()}`,
      tree: "ideas",
      type,
      title: type === "hum" ? "Quick hum" : type === "lyric" ? "New lyric" : "New chord",
      body: "",
      meta: "",
      section: "Raw idea",
      contributor: "You",
      status: "raw",
      accent: "#D4AE5C",
      x: 80 + Math.random() * 400,
      y: 160 + Math.random() * 600,
    };
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
  }, [dismissFirstAction]);

  const chooseLayer = (layer: LayerId) => {
    setActiveLayer(layer);
    const show = layer !== "room" && layer !== "ideas";
    setShowWorkPanel(show);
    navigate(`/songs/${songId}/canvas?layer=${layer}`, { replace: false });
  };

  const ideasCards = useMemo(() => cards.filter((c) => c.tree === "ideas"), [cards]);
  const finalCards = useMemo(() => cards.filter((c) => c.tree === "final"), [cards]);

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", backgroundColor: "#FAFAF6", overflow: "hidden" }}
    >
      <SongCanvasSemanticSummary />
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-30 flex items-center justify-between gap-3 px-5 pt-12 pb-3 flex-shrink-0"
        style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "#666", flexShrink: 0 }}
          aria-label="Back to songs"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Songs
        </button>

        {/* Song title centered */}
        <div className="flex flex-col items-center min-w-0 flex-1">
          <CogBrand variant="stacked" size="sm" />
          <h1
            className="text-center font-bold leading-tight truncate max-w-[180px]"
            style={{ fontSize: 15, color: "#1A1A1A", fontFamily: "var(--font-display)", marginTop: 4 }}
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
                  color: active ? "#B5935A" : "#999",
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

      {/* ── Canvas viewport ──────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
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
              {/* Quick-add FAB */}
              <button
                type="button"
                onClick={() => addCard("note")}
                className="absolute flex items-center justify-center rounded-full text-white transition-all duration-150 active:scale-95"
                style={{
                  right: 20,
                  bottom: 80,
                  width: 52,
                  height: 52,
                  backgroundColor: "#B5935A",
                  boxShadow: "0 4px 16px rgba(181,147,90,0.45)",
                  zIndex: 40,
                }}
                aria-label="Create idea"
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>
            </>
          }
        >
          {/* Canvas content — all positioned absolutely */}
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
              onDragStart={handleCardDragStart}
            />
          ))}
        </CanvasViewport>

        {/* Work layer slide-in panel */}
        {showWorkPanel && (
          <div
            className="absolute top-0 right-0 bottom-0 w-80 z-40 shadow-2xl overflow-y-auto"
            style={{ backgroundColor: "#FAFAF6", borderLeft: "1px solid rgba(0,0,0,0.08)" }}
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
            <div className="p-4 pt-12">
              <Suspense fallback={<div style={{ height: 200, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 16 }} />}>
                <SongCanvasWorkLayers activeLayer={activeLayer} />
              </Suspense>
              <Suspense fallback={null}>
                <SongCanvasCollabLayers activeLayer={activeLayer} />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      <SongTabBar activeTab="canvas" />
    </div>
  );
};

export default SongCanvasExperience;
