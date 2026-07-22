import { memo } from "react";
import { ChevronDown, ChevronUp, GripVertical, Play } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

interface FinalSongSectionRowProps {
  card: CanvasBoardCard;
  index: number;
  total: number;
  arranging: boolean;
  onMove: (id: string, delta: number) => void;
  onPlay: (id: string) => void;
}

const typeNames: Record<CanvasBoardCard["type"], string> = {
  lyric: "Lyrics",
  voice: "Voice memo",
  hum: "Melody",
  chord: "Chords",
  note: "Note",
  scripture: "Scripture",
  section: "Section",
};

const FinalSongSectionRow = memo(({
  card,
  index,
  total,
  arranging,
  onMove,
  onPlay,
}: FinalSongSectionRowProps) => {
  const sectionName = card.section || card.title || "Section " + (index + 1);
  const excerpt = card.body.trim() || card.title;

  return (
    <li>
      <article
        className="relative overflow-hidden rounded-2xl border bg-[var(--cog-cream-light)] p-4 shadow-[0_8px_30px_rgba(28,26,23,0.05)] transition-[border-color,transform,box-shadow] duration-200"
        style={{ borderColor: arranging ? "rgba(184,149,58,0.40)" : "rgba(28,26,23,0.10)" }}
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
            style={{ backgroundColor: card.accent || "var(--cog-gold)" }}
          >
            {index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cog-gold)]">
                  {typeNames[card.type]}
                </p>
                <h3 className="truncate font-display text-[19px] font-semibold leading-tight text-[var(--cog-charcoal)]">
                  {sectionName}
                </h3>
              </div>
              {arranging && (
                <GripVertical
                  size={20}
                  className="mt-1 shrink-0 text-[var(--cog-muted)]"
                  aria-label="Arrangement position"
                />
              )}
            </div>

            <p className="mt-2 line-clamp-3 whitespace-pre-line text-[14px] leading-6 text-[var(--cog-charcoal)]">
              {excerpt}
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
              <p className="min-w-0 truncate text-[11px] text-[var(--cog-warm-gray)]">
                {card.contributor ? "By " + card.contributor : card.meta || "Ready for the song"}
              </p>

              {arranging ? (
                <div className="flex shrink-0 items-center gap-1" aria-label={"Move " + sectionName}>
                  <button
                    type="button"
                    onClick={() => onMove(card.id, -1)}
                    disabled={index === 0}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--cog-charcoal)] transition-transform active:scale-95 disabled:opacity-30"
                    aria-label={"Move " + sectionName + " earlier"}
                  >
                    <ChevronUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(card.id, 1)}
                    disabled={index === total - 1}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--cog-charcoal)] transition-transform active:scale-95 disabled:opacity-30"
                    aria-label={"Move " + sectionName + " later"}
                  >
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onPlay(card.id)}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[rgba(184,149,58,0.32)] bg-white px-3 text-[12px] font-bold text-[var(--cog-gold)] transition-transform active:scale-[0.97]"
                  aria-label={"Play " + sectionName}
                >
                  <Play size={14} fill="currentColor" aria-hidden="true" />
                  Play
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
});

FinalSongSectionRow.displayName = "FinalSongSectionRow";

export default FinalSongSectionRow;
