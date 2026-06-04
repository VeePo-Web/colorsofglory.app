import { ElementType, lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  GitBranch,
  ListMusic,
  Mic,
  MoveRight,
  Music,
  Plus,
  Route,
  ScrollText,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

const SongCanvasWorkLayers = lazy(() => import("@/components/cog/SongCanvasWorkLayers"));
const SongCanvasCollabLayers = lazy(() => import("@/components/cog/SongCanvasCollabLayers"));

type CanvasTree = "ideas" | "final";
type CanvasCardType = "lyric" | "voice" | "hum" | "chord" | "note" | "scripture" | "section";
type LayerId = "room" | "lyrics" | "voice" | "chords" | "notes" | "ideas" | "people";

interface CanvasCard {
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
}

const LAYERS: Array<{ id: LayerId; label: string; icon: ElementType }> = [
  { id: "room", label: "Room", icon: Sparkles },
  { id: "lyrics", label: "Lyrics", icon: FileText },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "chords", label: "Chords", icon: Music },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "ideas", label: "Ideas", icon: GitBranch },
  { id: "people", label: "People", icon: Users },
];

const INITIAL_CARDS: CanvasCard[] = [
  {
    id: "hum-1",
    tree: "ideas",
    type: "hum",
    title: "First melody hum",
    body: "Soft lift into the chorus. Keep the ache in the first two notes.",
    meta: "0:12 voice",
    section: "Raw idea",
    contributor: "Parker",
    status: "raw",
    accent: "#B8953A",
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
  },
  {
    id: "meaning-psalm",
    tree: "ideas",
    type: "scripture",
    title: "Meaning anchor",
    body: "Psalm 46:10. Be still before the second verse turns upward.",
    meta: "Scripture note",
    section: "Meaning zone",
    contributor: "Parker",
    status: "meaning",
    accent: "#8070C4",
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
    accent: "#B77722",
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
    accent: "#A4864D",
  },
];

const CARD_ICONS: Record<CanvasCardType, ElementType> = {
  lyric: FileText,
  voice: Mic,
  hum: Mic,
  chord: Music,
  note: StickyNote,
  scripture: ScrollText,
  section: ListMusic,
};

const isLayerId = (value: string | null): value is LayerId =>
  value === "room" ||
  value === "lyrics" ||
  value === "voice" ||
  value === "chords" ||
  value === "notes" ||
  value === "ideas" ||
  value === "people";

const SongCanvasPage = () => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cards, setCards] = useState<CanvasCard[]>(INITIAL_CARDS);
  const [selectedId, setSelectedId] = useState(INITIAL_CARDS[0].id);
  const [pathMode, setPathMode] = useState(false);
  const [listenPath, setListenPath] = useState<string[]>(["verse-line", "chorus-core", "chord-bed"]);
  const [savedMessage, setSavedMessage] = useState("Saved to this song");
  const [activeLayer, setActiveLayer] = useState<LayerId>(() => {
    const layer = searchParams.get("layer");
    return isLayerId(layer) ? layer : "room";
  });

  useEffect(() => {
    const layer = searchParams.get("layer");
    if (isLayerId(layer)) setActiveLayer(layer);
  }, [searchParams]);

  const ideas = useMemo(() => cards.filter((card) => card.tree === "ideas"), [cards]);
  const finalCards = useMemo(() => cards.filter((card) => card.tree === "final"), [cards]);
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? cards[0],
    [cards, selectedId],
  );

  const addIdea = () => {
    const nextIndex = ideas.length + 1;
    const nextCard: CanvasCard = {
      id: `idea-${Date.now()}`,
      tree: "ideas",
      type: "note",
      title: `New idea ${nextIndex}`,
      body: "A safe place for the next lyric, chord, memo, or prayer before it is final.",
      meta: "Saving...",
      section: "Raw idea",
      contributor: "You",
      status: "raw",
      accent: "#B8953A",
    };

    setCards((current) => [nextCard, ...current]);
    setSelectedId(nextCard.id);
    setSavedMessage("Saving idea...");
    window.setTimeout(() => {
      setCards((current) => current.map((card) => (card.id === nextCard.id ? { ...card, meta: "Saved just now" } : card)));
      setSavedMessage("Saved to this song");
    }, 450);
  };

  const recordIdea = () => {
    const nextCard: CanvasCard = {
      id: `voice-${Date.now()}`,
      tree: "ideas",
      type: "voice",
      title: "New voice idea",
      body: "Recording placeholder saved as a voice memo card in this song room.",
      meta: "0:00 voice",
      section: "Voice",
      contributor: "You",
      status: "raw",
      accent: "#B8953A",
    };

    setCards((current) => [nextCard, ...current]);
    setSelectedId(nextCard.id);
    setActiveLayer("voice");
    setSavedMessage("Voice memo saved to this song");
  };

  const moveSelectedToFinal = () => {
    if (!selectedCard || selectedCard.tree === "final") return;

    setCards((current) =>
      current.map((card) =>
        card.id === selectedCard.id
          ? {
              ...card,
              tree: "final",
              status: "approved",
              section: card.section === "Raw idea" ? "Final idea" : card.section,
              meta: "Added to Final",
            }
          : card,
      ),
    );
    setSavedMessage("Added to Final. Original idea is preserved.");
  };

  const togglePathMode = () => {
    setPathMode((current) => !current);
  };

  const handleSelect = (card: CanvasCard) => {
    setSelectedId(card.id);
    if (!pathMode) return;

    setListenPath((current) => {
      if (current.includes(card.id)) {
        return current.filter((pathId) => pathId !== card.id);
      }
      return [...current, card.id];
    });
  };

  const chooseLayer = (layer: LayerId) => {
    setActiveLayer(layer);
    navigate(`/songs/${songId}/canvas?layer=${layer}`, { replace: false });
    const element = document.getElementById(`layer-${layer}`);
    element?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 92 }}
    >
      <div className="pointer-events-none fixed inset-0 cog-glow" />

      <header
        className="relative z-20 mx-auto flex w-full items-center justify-between px-5 pt-12 pb-2"
        style={{ maxWidth: 1180 }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity duration-150 hover:opacity-70 active:scale-[0.97]"
          style={{ color: "var(--cog-warm-gray)" }}
          aria-label="Back to songs"
        >
          <ArrowLeft size={17} strokeWidth={1.8} />
          Songs
        </button>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: "rgba(184,149,58,0.10)",
            border: "1px solid rgba(184,149,58,0.18)",
            color: "var(--cog-gold-alt)",
          }}
          aria-live="polite"
        >
          {savedMessage}
        </span>
      </header>

      <main className="relative z-10 mx-auto w-full px-5 pb-5" style={{ maxWidth: 1180 }}>
        <section id="layer-room" className="mx-auto mb-4 max-w-[760px] text-center">
          <div className="mb-3 flex justify-center">
            <CogLogo size="sm" />
          </div>
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--cog-muted)" }}
          >
            Private song room
          </p>
          <h1
            className="mx-auto mb-2 max-w-[11ch] text-[clamp(2.25rem,8vw,4.6rem)] font-semibold leading-[0.98]"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
          >
            {songTitle}
          </h1>
          <p className="mx-auto max-w-[34rem] text-sm leading-6" style={{ color: "var(--cog-warm-gray)" }}>
            Everything for this song stays connected here: lyrics, voice memos, chords, notes, ideas, people, and changes.
          </p>
        </section>

        <section className="mx-auto mb-4 max-w-[760px]" aria-label="Song room quick actions">
          <div className="grid grid-cols-3 gap-2.5">
            <RoomAction icon={Plus} label="Add idea" onClick={addIdea} primary />
            <RoomAction icon={Mic} label="Record idea" onClick={recordIdea} />
            <RoomAction icon={Users} label="Invite" onClick={() => chooseLayer("people")} />
          </div>
        </section>

        <section className="mx-auto mb-4 max-w-[760px]" aria-label="Song room layers">
          <div
            className="cog-scroll flex gap-2 overflow-x-auto rounded-2xl p-1.5"
            style={{ backgroundColor: "rgba(237,231,218,0.76)", border: "1px solid rgba(28,26,23,0.06)" }}
          >
            {LAYERS.map((layer) => (
              <LayerChip
                key={layer.id}
                layer={layer}
                active={activeLayer === layer.id}
                onClick={() => chooseLayer(layer.id)}
              />
            ))}
          </div>
        </section>

        <section
          aria-label="Song whiteboard canvas"
          className="rounded-[26px] p-3 shadow-[var(--cog-shadow-card)] md:p-5"
          style={{
            backgroundColor: "rgba(251,247,239,0.86)",
            border: "1px solid rgba(28,26,23,0.10)",
          }}
        >
          <div
            className="grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.72fr)]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(184,149,58,0.08) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          >
            <Suspense fallback={<CanvasLayerSkeleton label="Song layers" />}>
              <SongCanvasWorkLayers activeLayer={activeLayer} />
            </Suspense>

            <aside className="space-y-3">
              <section
                id="layer-ideas"
                className="rounded-[22px] p-3"
                style={{
                  backgroundColor: "rgba(250,247,242,0.86)",
                  border: "1px solid rgba(28,26,23,0.08)",
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: "var(--cog-muted)" }}
                    >
                      Explore and decide
                    </p>
                    <h2
                      className="text-xl font-semibold"
                      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                    >
                      Ideas Tree
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={togglePathMode}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.97]"
                    style={{
                      backgroundColor: pathMode ? "var(--cog-gold)" : "rgba(184,149,58,0.10)",
                      color: pathMode ? "#fff" : "var(--cog-gold-alt)",
                    }}
                  >
                    <Route size={14} strokeWidth={1.8} />
                    {pathMode ? "Path on" : "Path"}
                  </button>
                </div>

                <TreePanel
                  title="Ideas Tree"
                  cards={ideas}
                  selectedId={selectedId}
                  listenPath={listenPath}
                  onSelect={handleSelect}
                />
              </section>

              <section
                className="rounded-[22px] p-3"
                style={{
                  backgroundColor: "rgba(250,247,242,0.90)",
                  border: "1px solid rgba(184,149,58,0.18)",
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: "var(--cog-muted)" }}
                    >
                      Worship-ready shape
                    </p>
                    <h2
                      className="text-xl font-semibold"
                      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                    >
                      Final Tree
                    </h2>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold-alt)" }}
                  >
                    {finalCards.length}
                  </span>
                </div>

                <TreePanel
                  title="Final Tree"
                  cards={finalCards}
                  selectedId={selectedId}
                  listenPath={listenPath}
                  onSelect={handleSelect}
                />
              </section>

              <SelectedIdeaCard card={selectedCard} onAddToFinal={moveSelectedToFinal} />
            </aside>
          </div>
        </section>

        <Suspense fallback={<CanvasLayerSkeleton label="Collaboration layers" compact />}>
          <SongCanvasCollabLayers activeLayer={activeLayer} />
        </Suspense>
      </main>

      <SongTabBar activeTab={activeLayer === "room" ? "canvas" : activeLayer} />
    </div>
  );
};

interface RoomActionProps {
  icon: ElementType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}

const RoomAction = ({ icon: Icon, label, onClick, primary = false }: RoomActionProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
    style={{
      backgroundColor: primary ? "var(--cog-gold)" : "var(--cog-cream-light)",
      border: primary ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
      color: primary ? "#fff" : "var(--cog-charcoal)",
      boxShadow: primary ? "var(--cog-shadow-fab)" : "var(--cog-shadow-sm)",
    }}
  >
    <Icon size={18} strokeWidth={1.8} />
    {label}
  </button>
);

interface LayerChipProps {
  layer: { id: LayerId; label: string; icon: ElementType };
  active: boolean;
  onClick: () => void;
}

const LayerChip = ({ layer, active, onClick }: LayerChipProps) => {
  const Icon = layer.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.97]"
      style={{
        backgroundColor: active ? "var(--cog-cream-light)" : "transparent",
        border: active ? "1px solid rgba(184,149,58,0.24)" : "1px solid transparent",
        color: active ? "var(--cog-gold-alt)" : "var(--cog-warm-gray)",
        boxShadow: active ? "0 1px 6px rgba(28,26,23,0.08)" : "none",
      }}
    >
      <Icon size={14} strokeWidth={1.8} />
      {layer.label}
    </button>
  );
};

const CanvasLayerSkeleton = ({ label, compact = false }: { label: string; compact?: boolean }) => (
  <div
    className={`space-y-3 rounded-[22px] p-4 ${compact ? "mt-3" : ""}`}
    style={{ backgroundColor: "rgba(250,247,242,0.74)", border: "1px solid rgba(28,26,23,0.08)" }}
    aria-label={`Loading ${label}`}
  >
    <div className="h-4 w-28 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.14)" }} />
    <div className="h-24 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.40)" }} />
    {!compact && <div className="h-24 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.32)" }} />}
  </div>
);

interface TreePanelProps {
  title: string;
  cards: CanvasCard[];
  selectedId: string;
  listenPath: string[];
  onSelect: (card: CanvasCard) => void;
}

const TreePanel = ({ title, cards, selectedId, listenPath, onSelect }: TreePanelProps) => (
  <div className="flex flex-col gap-2" role="list" aria-label={title}>
    {cards.map((card) => (
      <CanvasNode
        key={card.id}
        card={card}
        selected={selectedId === card.id}
        pathOrder={listenPath.indexOf(card.id) + 1}
        onSelect={() => onSelect(card)}
      />
    ))}
  </div>
);

interface CanvasNodeProps {
  card: CanvasCard;
  selected: boolean;
  pathOrder: number;
  onSelect: () => void;
}

const CanvasNode = memo(({ card, selected, pathOrder, onSelect }: CanvasNodeProps) => {
  const Icon = CARD_ICONS[card.type];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="relative min-h-[116px] rounded-2xl p-3 text-left transition-all duration-150 active:scale-[0.985]"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: selected ? "1.5px solid var(--cog-border-gold)" : "1px solid var(--cog-border)",
        boxShadow: selected ? "0 12px 28px rgba(184,149,58,0.16)" : "0 4px 14px rgba(28,26,23,0.06)",
        transform: "translateZ(0)",
      }}
    >
      {pathOrder > 0 && (
        <span
          className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: "var(--cog-gold)", color: "#fff", boxShadow: "var(--cog-shadow-fab)" }}
          aria-label={`Listen path order ${pathOrder}`}
        >
          {pathOrder}
        </span>
      )}
      <div className="mb-2 flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "rgba(184,149,58,0.11)", color: "var(--cog-gold-alt)" }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--cog-muted)" }}>
            {card.section}
          </p>
          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--cog-charcoal)" }}>
            {card.title}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 text-sm leading-5" style={{ color: "var(--cog-warm-gray)" }}>
        {card.body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--cog-muted)" }}>
          {card.meta}
        </span>
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: card.accent }}>
          {card.status === "approved" && <CheckCircle2 size={13} strokeWidth={1.8} />}
          {card.contributor}
        </span>
      </div>
    </button>
  );
});

CanvasNode.displayName = "CanvasNode";

const SelectedIdeaCard = ({ card, onAddToFinal }: { card?: CanvasCard; onAddToFinal: () => void }) => (
  <section
    className="rounded-[22px] p-4"
    style={{
      backgroundColor: "var(--cog-cream-light)",
      border: "1px solid var(--cog-border)",
      boxShadow: "0 8px 22px rgba(28,26,23,0.06)",
    }}
    aria-label="Selected idea"
  >
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
          Focused card
        </p>
        <h2 className="text-lg font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
          {card?.title ?? "No idea selected"}
        </h2>
      </div>
      <span
        className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{
          backgroundColor: "rgba(184,149,58,0.12)",
          color: "var(--cog-gold-alt)",
        }}
      >
        {card?.tree ?? "ideas"}
      </span>
    </div>
    <p className="mb-3 text-sm leading-6" style={{ color: "var(--cog-warm-gray)" }}>
      {card?.body ?? "Choose a card on the canvas to see the thought behind it."}
    </p>
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onAddToFinal}
        disabled={!card || card.tree === "final"}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-45"
        style={{ backgroundColor: "var(--cog-gold)", color: "#fff" }}
      >
        <MoveRight size={15} strokeWidth={1.8} />
        Add to Final
      </button>
      <button
        type="button"
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
        style={{
          backgroundColor: "rgba(28,26,23,0.04)",
          border: "1px solid rgba(28,26,23,0.08)",
          color: "var(--cog-charcoal)",
        }}
      >
        Branch from this
      </button>
    </div>
  </section>
);

export default SongCanvasPage;
