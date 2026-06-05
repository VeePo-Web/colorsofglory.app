import { FileText, Mic, Music, ScrollText, StickyNote } from "lucide-react";
import type { CanvasNode, IdeaCard } from "@/lib/canvas/canvasTypes";
import { IDEA_CARD_TYPE_LABELS } from "@/lib/canvas/ideaCardLabels";

const ICONS = {
  lyric: FileText,
  voice: Mic,
  chord: Music,
  note: StickyNote,
  scripture: ScrollText,
  story: ScrollText,
  arrangement: Music,
  comment: StickyNote,
  file: FileText,
};

interface IdeaCanvasCardProps {
  card: IdeaCard;
  node: CanvasNode;
  selected: boolean;
  onOpen: () => void;
}

const IdeaCanvasCard = ({ card, node, selected, onOpen }: IdeaCanvasCardProps) => {
  const Icon = ICONS[card.type];

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Open ${card.title}`}
      onClick={onOpen}
      className="absolute rounded-2xl p-3 text-left transition-all duration-150 active:scale-[0.985]"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        minHeight: node.height,
        backgroundColor: "var(--cog-cream-light)",
        borderTop: selected ? `1.5px solid ${card.contributorColor}` : "1px solid var(--cog-border)",
        borderRight: selected ? `1.5px solid ${card.contributorColor}` : "1px solid var(--cog-border)",
        borderBottom: selected ? `1.5px solid ${card.contributorColor}` : "1px solid var(--cog-border)",
        borderLeft: `4px solid ${card.contributorColor}`,
        boxShadow: selected ? `0 16px 34px ${card.contributorColor}24` : "0 7px 20px rgba(28,26,23,0.07)",
        color: "var(--cog-charcoal)",
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${card.contributorColor}18`, color: card.contributorColor }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span
          className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ backgroundColor: `${card.contributorColor}16`, color: card.contributorColor }}
        >
          {card.contributorName.slice(0, 2)}
        </span>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--cog-muted)" }}>
        {IDEA_CARD_TYPE_LABELS[card.type]}
      </p>
      <p className="mt-1 text-sm font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
        {card.title}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-5" style={{ color: "var(--cog-warm-gray)" }}>
        {card.preview}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--cog-muted)" }}>
        <span>{card.contributorName}</span>
        <span>{card.status.replace(/_/g, " ")}</span>
      </div>
    </button>
  );
};

export default IdeaCanvasCard;
