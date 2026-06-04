import { ElementType, memo } from "react";
import {
  CheckCircle2,
  FileText,
  ListMusic,
  Mic,
  MoveRight,
  Music,
  Route,
  ScrollText,
  StickyNote,
} from "lucide-react";

type CanvasTree = "ideas" | "final";
type CanvasCardType = "lyric" | "voice" | "hum" | "chord" | "note" | "scripture" | "section";

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

interface SongCanvasTreesProps {
  ideas: CanvasCard[];
  finalCards: CanvasCard[];
  selectedCard?: CanvasCard;
  selectedId: string;
  listenPath: string[];
  pathMode: boolean;
  onTogglePathMode: () => void;
  onSelect: (card: CanvasCard) => void;
  onAddToFinal: () => void;
}

const CARD_ICONS: Record<CanvasCardType, ElementType> = {
  lyric: FileText,
  voice: Mic,
  hum: Mic,
  chord: Music,
  note: StickyNote,
  scripture: ScrollText,
  section: ListMusic,
};

const SongCanvasTrees = ({
  ideas,
  finalCards,
  selectedCard,
  selectedId,
  listenPath,
  pathMode,
  onTogglePathMode,
  onSelect,
  onAddToFinal,
}: SongCanvasTreesProps) => (
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
            Explore and decide
          </p>
          <h2 className="text-xl font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
            Ideas Tree
          </h2>
        </div>
        <button
          type="button"
          onClick={onTogglePathMode}
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

      <TreePanel title="Ideas Tree" cards={ideas} selectedId={selectedId} listenPath={listenPath} onSelect={onSelect} />
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
            Worship-ready shape
          </p>
          <h2 className="text-xl font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
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

      <TreePanel title="Final Tree" cards={finalCards} selectedId={selectedId} listenPath={listenPath} onSelect={onSelect} />
    </section>

    <SelectedIdeaCard card={selectedCard} onAddToFinal={onAddToFinal} />
  </aside>
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

export default SongCanvasTrees;
