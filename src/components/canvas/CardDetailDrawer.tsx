import type { CanvasNode, CanvasPermissions, IdeaCard } from "@/lib/canvas/canvasTypes";
import { IDEA_CARD_TYPE_LABELS } from "@/lib/canvas/ideaCardLabels";

interface CardDetailDrawerProps {
  card: IdeaCard;
  node: CanvasNode;
  permissions: CanvasPermissions;
  onClose: () => void;
  onMove: () => void;
}

const CardDetailDrawer = ({ card, node, permissions, onClose, onMove }: CardDetailDrawerProps) => (
  <section
    role="dialog"
    aria-modal="false"
    aria-label={card.title}
    className="absolute inset-x-0 bottom-0 z-50 rounded-t-[28px] px-5 pb-6 pt-5 md:inset-y-4 md:left-auto md:right-4 md:w-[340px] md:rounded-[24px]"
    style={{
      backgroundColor: "var(--cog-cream-light)",
      border: "1px solid var(--cog-border)",
      boxShadow: "0 -18px 45px rgba(28,26,23,0.18)",
    }}
  >
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: card.contributorColor }}>
          {IDEA_CARD_TYPE_LABELS[card.type]}
        </p>
        <h2 className="text-2xl font-semibold leading-tight" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
          {card.title}
        </h2>
      </div>
      <button type="button" onClick={onClose} className="min-h-10 rounded-full px-3 text-sm" style={{ color: "var(--cog-warm-gray)" }}>
        Close
      </button>
    </div>

    <p className="mb-3 text-sm leading-6" style={{ color: "var(--cog-warm-gray)" }}>
      {card.body || card.preview}
    </p>
    <dl className="mb-4 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(28,26,23,0.04)" }}>
        <dt className="font-semibold" style={{ color: "var(--cog-muted)" }}>Contributor</dt>
        <dd style={{ color: "var(--cog-charcoal)" }}>{card.contributorName}</dd>
      </div>
      <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(28,26,23,0.04)" }}>
        <dt className="font-semibold" style={{ color: "var(--cog-muted)" }}>Zone</dt>
        <dd style={{ color: "var(--cog-charcoal)" }}>{node.zone.replace(/_/g, " ")}</dd>
      </div>
    </dl>

    <div className="grid gap-2">
      <button
        type="button"
        disabled={!permissions.canAddToFinal}
        className="min-h-11 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: "var(--cog-gold)" }}
      >
        {permissions.canAddToFinal ? "Add to Final" : "Suggest for Final"}
      </button>
      <button
        type="button"
        disabled={!permissions.canCreate}
        className="min-h-11 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
        style={{
          backgroundColor: "rgba(184,149,58,0.10)",
          color: "var(--cog-gold)",
        }}
      >
        Branch from this
      </button>
      <button
        type="button"
        disabled={!permissions.canMove}
        onClick={onMove}
        className="min-h-11 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
        style={{
          backgroundColor: "rgba(28,26,23,0.04)",
          color: "var(--cog-charcoal)",
        }}
      >
        Move to review
      </button>
    </div>
  </section>
);

export default CardDetailDrawer;
