import { FileText, ListOrdered, Music2, Play, Sparkles } from "lucide-react";
import FinalSongSectionRow from "@/components/canvas/FinalSongSectionRow";
import { usePrefersReducedMotion } from "@/lib/canvas/features/usePrefersReducedMotion";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

interface FinalSongSurfaceProps {
  songTitle: string;
  cards: CanvasBoardCard[];
  arranging: boolean;
  canArrange: boolean;
  onBeginArrange: () => void;
  onMove: (id: string, delta: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onPlayAll: () => void;
  onPlaySection: (id: string) => void;
  onOpenSongSheet: () => void;
}

const FinalSongSurface = ({
  songTitle,
  cards,
  arranging,
  canArrange,
  onBeginArrange,
  onMove,
  onSave,
  onCancel,
  onPlayAll,
  onPlaySection,
  onOpenSongSheet,
}: FinalSongSurfaceProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const sectionCount = cards.length;
  const readinessCopy = sectionCount === 0
    ? "Your strongest ideas will gather here as the song takes shape."
    : sectionCount === 1
      ? "One section is taking shape. Keep listening for what belongs next."
      : sectionCount + " sections are forming a clear running order.";

  return (
    <section
      aria-labelledby="final-song-heading"
      className="h-full overflow-y-auto bg-[var(--cog-cream)]"
      style={{
        backgroundImage: "radial-gradient(ellipse 75% 48% at 50% 92%, rgba(184,149,58,0.18) 0%, transparent 72%)",
        animation: reducedMotion ? "none" : "cog-fade-in 280ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-5 pb-36 pt-24 sm:px-8">
        <header className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(184,149,58,0.26)] bg-white/70 text-[var(--cog-gold)] shadow-[0_10px_28px_rgba(184,149,58,0.12)]">
            <Music2 size={23} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--cog-gold)]">
            Final song
          </p>
          <h2
            id="final-song-heading"
            className="mt-1 font-display text-[clamp(2rem,8vw,3rem)] font-semibold leading-[1.05] text-[var(--cog-charcoal)]"
          >
            {songTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-[var(--cog-warm-gray)]">
            {readinessCopy}
          </p>
        </header>

        {sectionCount > 0 && !arranging && (
          <div className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:justify-center">
            <button
              type="button"
              onClick={onPlayAll}
              className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[var(--cog-gold)] px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(184,149,58,0.28)] transition-transform active:scale-[0.97] sm:col-auto"
            >
              <Play size={17} fill="currentColor" aria-hidden="true" />
              Play from top
            </button>
            {canArrange && (
              <button
                type="button"
                onClick={onBeginArrange}
                className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/80 px-4 text-[13px] font-bold text-[var(--cog-charcoal)] transition-transform active:scale-[0.97]"
              >
                <ListOrdered size={17} aria-hidden="true" />
                Arrange
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSongSheet}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/80 px-4 text-[13px] font-bold text-[var(--cog-charcoal)] transition-transform active:scale-[0.97]"
            >
              <FileText size={17} aria-hidden="true" />
              Song sheet
            </button>
          </div>
        )}

        {arranging && (
          <div
            role="toolbar"
            aria-label="Edit final song running order"
            className="sticky top-20 z-20 mt-7 flex items-center gap-2 rounded-2xl border border-[rgba(184,149,58,0.36)] bg-[var(--cog-cream-light)]/95 p-2 shadow-[0_10px_34px_rgba(28,26,23,0.12)] backdrop-blur-xl"
          >
            <div className="min-w-0 flex-1 pl-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cog-gold)]">
                Running order
              </p>
              <p className="truncate text-[12px] text-[var(--cog-warm-gray)]">
                Move sections, then save
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-xl bg-black/[0.05] px-3 text-[12px] font-bold text-[var(--cog-warm-gray)] active:scale-[0.97]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="min-h-11 rounded-xl bg-[var(--cog-gold)] px-4 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(184,149,58,0.25)] active:scale-[0.97]"
            >
              Save order
            </button>
          </div>
        )}

        {sectionCount === 0 ? (
          <div
            role="status"
            className="mt-10 rounded-3xl border border-dashed border-[rgba(184,149,58,0.34)] bg-white/45 px-6 py-12 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cog-gold-glow)] text-[var(--cog-gold)]">
              <Sparkles size={22} aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-[22px] font-semibold text-[var(--cog-charcoal)]">
              Your keepers will gather here
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[var(--cog-warm-gray)]">
              In Ideas, choose the fragments that carry the song forward and move them to Final.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 mt-9 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cog-muted)]">
                  Running order
                </p>
                <p className="mt-1 text-[13px] text-[var(--cog-warm-gray)]">
                  {arranging ? "Use the arrows to shape the flow." : "Top to bottom is how the song will play."}
                </p>
              </div>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-[var(--cog-warm-gray)]">
                {sectionCount}
              </span>
            </div>
            <ol className="space-y-3" aria-label="Final song running order">
              {cards.map((card, index) => (
                <FinalSongSectionRow
                  key={card.id}
                  card={card}
                  index={index}
                  total={sectionCount}
                  arranging={arranging}
                  onMove={onMove}
                  onPlay={onPlaySection}
                />
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
};

export default FinalSongSurface;
