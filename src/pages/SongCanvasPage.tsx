import { memo, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  GitBranch,
  ListMusic,
  Mic,
  MoveRight,
  Music,
  PenLine,
  Plus,
  Route,
  ScrollText,
  Sparkles,
  StickyNote,
} from "lucide-react";
import BackHeader from "@/components/cog/BackHeader";
import CogLogo from "@/components/cog/CogLogo";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

type CanvasTree = "ideas" | "final";
type CanvasCardType = "lyric" | "voice" | "hum" | "chord" | "note" | "scripture";

interface CanvasCard {
  id: string;
  tree: CanvasTree;
  type: CanvasCardType;
  title: string;
  body: string;
  meta: string;
  section: string;
  contributor: string;
  status: "raw" | "approved" | "meaning";
  accent: string;
}

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
    status: "raw",
    accent: "#8A7A52",
  },
  {
    id: "chorus-core",
    tree: "final",
    type: "lyric",
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
    accent: "#9D7F34",
  },
];

const CARD_ICONS: Record<CanvasCardType, typeof PenLine> = {
  lyric: PenLine,
  voice: Mic,
  hum: Mic,
  chord: Music,
  note: StickyNote,
  scripture: ScrollText,
};

const SongCanvasPage = () => {
  const { id } = useParams<{ id: string }>();
  const songTitle = useSongTitle(id);
  const [cards, setCards] = useState<CanvasCard[]>(INITIAL_CARDS);
  const [selectedId, setSelectedId] = useState(INITIAL_CARDS[0].id);
  const [pathMode, setPathMode] = useState(false);
  const [listenPath, setListenPath] = useState<string[]>(["hum-1", "chorus-core"]);

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
      body: "A place to hold the next lyric, chord, or melody before it is final.",
      meta: "Just added",
      section: "Raw idea",
      contributor: "You",
      status: "raw",
      accent: "#B8953A",
    };

    setCards((current) => [nextCard, ...current]);
    setSelectedId(nextCard.id);
  };

  const moveSelectedToFinal = () => {
    if (!selectedCard || selectedCard.tree === "final") return;

    setCards((current) =>
      current.map((card) =>
        card.id === selectedCard.id
          ? { ...card, tree: "final", status: "approved", section: card.section === "Raw idea" ? "Final idea" : card.section }
          : card,
      ),
    );
  };

  const togglePathMode = () => {
    setPathMode((current) => !current);
  };

  const handleSelect = (card: CanvasCard) => {
    setSelectedId(card.id);
    if (!pathMode) return;

    setListenPath((current) => {
      if (current.includes(card.id)) {
        return current.filter((id) => id !== card.id);
      }
      return [...current, card.id];
    });
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 92 }}
    >
      <div className="pointer-events-none fixed inset-0 cog-glow" />

      <BackHeader to={`/songs/${id ?? "1"}`} label="Song" />

      <main
        className="relative mx-auto flex w-full flex-col px-5 pb-4"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <section className="pb-4 text-center">
          <div className="mb-3 flex justify-center">
            <CogLogo size="sm" />
          </div>
          <div
            className="mx-auto mb-3 inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-medium"
            style={{
              backgroundColor: "rgba(184,149,58,0.11)",
              border: "1px solid rgba(184,149,58,0.20)",
              color: "var(--cog-gold-alt)",
            }}
          >
            <GitBranch size={13} strokeWidth={1.8} />
            Ideas to final
          </div>
          <h1
            className="mb-1 text-2xl font-semibold leading-tight"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
          >
            Song Whiteboard
          </h1>
          <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
            {songTitle} - keep raw ideas safe while the song takes shape.
          </p>
        </section>

        <section
          aria-label="Whiteboard summary"
          className="mb-3 grid grid-cols-3 gap-2"
        >
          <MetricCard label="Ideas" value={ideas.length} />
          <MetricCard label="Final" value={finalCards.length} />
          <MetricCard label="Path" value={listenPath.length} />
        </section>

        <section
          className="mb-3 rounded-2xl p-3"
          style={{
            backgroundColor: "rgba(250,247,242,0.78)",
            border: "1px solid var(--cog-border)",
          }}
          aria-label="Whiteboard tools"
        >
          <div className="grid grid-cols-3 gap-2">
            <ToolButton icon={Plus} label="Add idea" onClick={addIdea} />
            <ToolButton
              icon={MoveRight}
              label="Move final"
              onClick={moveSelectedToFinal}
              disabled={!selectedCard || selectedCard.tree === "final"}
            />
            <ToolButton
              icon={Route}
              label={pathMode ? "Path on" : "Path"}
              onClick={togglePathMode}
              active={pathMode}
            />
          </div>
        </section>

        <section
          className="mb-3 rounded-2xl p-3"
          style={{
            backgroundColor: "rgba(184,149,58,0.07)",
            border: "1px solid rgba(184,149,58,0.20)",
          }}
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <Sparkles size={16} strokeWidth={1.8} style={{ color: "var(--cog-gold)" }} />
            <p className="text-xs leading-5" style={{ color: "var(--cog-warm-gray)" }}>
              {pathMode
                ? "Path mode is on. Tap cards to build a listening order."
                : "Tap a card to inspect it. Move raw ideas into the final tree when they feel ready."}
            </p>
          </div>
        </section>

        <section
          aria-label="Song whiteboard canvas"
          className="cog-scroll mb-4 overflow-x-auto rounded-[22px]"
          style={{
            backgroundColor: "var(--cog-cream-canvas)",
            border: "1px solid rgba(28,26,23,0.10)",
            boxShadow: "var(--cog-shadow-card)",
          }}
        >
          <div
            className="relative grid min-h-[520px] w-[740px] grid-cols-2 gap-4 p-4"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(184,149,58,0.10) 1px, transparent 0)",
              backgroundSize: "24px 24px",
              willChange: "transform",
            }}
          >
            <TreeColumn
              title="Ideas Tree"
              eyebrow="Unfiltered"
              cards={ideas}
              selectedId={selectedId}
              listenPath={listenPath}
              onSelect={handleSelect}
            />
            <TreeColumn
              title="Final Tree"
              eyebrow="Curated"
              cards={finalCards}
              selectedId={selectedId}
              listenPath={listenPath}
              onSelect={handleSelect}
            />
          </div>
        </section>

        <section
          className="rounded-2xl p-4"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1px solid var(--cog-border)",
          }}
          aria-label="Selected idea"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
            >
              {selectedCard?.title ?? "No idea selected"}
            </p>
            <span
              className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                backgroundColor: "rgba(184,149,58,0.12)",
                color: "var(--cog-gold-alt)",
              }}
            >
              {selectedCard?.tree ?? "Ideas"}
            </span>
          </div>
          <p className="text-sm leading-6" style={{ color: "var(--cog-warm-gray)" }}>
            {selectedCard?.body ?? "Choose a card on the canvas to see the thought behind it."}
          </p>
        </section>
      </main>

      <SongTabBar activeTab="canvas" />
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
}

const MetricCard = ({ label, value }: MetricCardProps) => (
  <div
    className="min-h-[64px] rounded-2xl px-3 py-2 text-center"
    style={{
      backgroundColor: "var(--cog-cream-light)",
      border: "1px solid var(--cog-border)",
    }}
  >
    <p className="text-lg font-semibold" style={{ color: "var(--cog-charcoal)" }}>
      {value}
    </p>
    <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--cog-muted)" }}>
      {label}
    </p>
  </div>
);

interface ToolButtonProps {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

const ToolButton = ({ icon: Icon, label, onClick, active = false, disabled = false }: ToolButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-45"
    style={{
      backgroundColor: active ? "var(--cog-gold)" : "var(--cog-cream-light)",
      border: active ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
      color: active ? "#fff" : "var(--cog-charcoal)",
    }}
  >
    <Icon size={16} strokeWidth={1.8} />
    {label}
  </button>
);

interface TreeColumnProps {
  title: string;
  eyebrow: string;
  cards: CanvasCard[];
  selectedId: string;
  listenPath: string[];
  onSelect: (card: CanvasCard) => void;
}

const TreeColumn = ({ title, eyebrow, cards, selectedId, listenPath, onSelect }: TreeColumnProps) => (
  <div
    className="rounded-[18px] p-3"
    style={{
      backgroundColor: "rgba(250,247,242,0.82)",
      border: "1px solid rgba(28,26,23,0.08)",
    }}
  >
    <div className="mb-3 flex items-center justify-between gap-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
          {eyebrow}
        </p>
        <h2 className="text-lg font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
      </div>
      <span
        className="rounded-full px-2 py-1 text-xs font-semibold"
        style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold-alt)" }}
      >
        {cards.length}
      </span>
    </div>

    <div className="flex flex-col gap-3" role="list" aria-label={title}>
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
      className="relative min-h-[142px] rounded-2xl p-3 text-left transition-all duration-150 active:scale-[0.985]"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: selected ? "1.5px solid var(--cog-border-gold)" : "1px solid var(--cog-border)",
        boxShadow: selected ? "0 14px 32px rgba(184,149,58,0.18)" : "0 4px 16px rgba(28,26,23,0.08)",
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <span
        className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: card.accent }}
        aria-hidden
      />
      {pathOrder > 0 && (
        <span
          className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: "var(--cog-gold)", color: "#fff", boxShadow: "var(--cog-shadow-fab)" }}
          aria-label={`Listen path order ${pathOrder}`}
        >
          {pathOrder}
        </span>
      )}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: "rgba(184,149,58,0.11)", color: "var(--cog-gold-alt)" }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--cog-muted)" }}>
            {card.section}
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
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
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--cog-gold-alt)" }}>
          {card.status === "approved" && <CheckCircle2 size={13} strokeWidth={1.8} />}
          {card.contributor}
        </span>
      </div>
    </button>
  );
});

CanvasNode.displayName = "CanvasNode";

export default SongCanvasPage;
