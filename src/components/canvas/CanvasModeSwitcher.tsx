import { forwardRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

export type CanvasViewMode = "ideas" | "final";

interface CanvasModeSwitcherProps {
  mode: CanvasViewMode;
  ideasCount: number;
  finalCount: number;
  onModeChange: (mode: CanvasViewMode) => void;
  onFitIdeas: () => void;
}

const CanvasModeSwitcher = forwardRef<HTMLDivElement, CanvasModeSwitcherProps>(
  ({ mode, ideasCount, finalCount, onModeChange, onFitIdeas }, ref) => (
    <>
      <div className="pointer-events-none absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1.5">
        <div
          ref={ref}
          role="tablist"
          aria-label="Song canvas view"
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/90 p-1 shadow-[0_4px_18px_rgba(28,26,23,0.10)] backdrop-blur-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ideas"}
            onClick={() => onModeChange("ideas")}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: mode === "ideas" ? "var(--cog-gold)" : "transparent",
              color: mode === "ideas" ? "#FFFFFF" : "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
            }}
          >
            Ideas
            <span className="text-[10px] opacity-75" aria-label={ideasCount + " ideas"}>
              {ideasCount}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "final"}
            onClick={() => onModeChange("final")}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: mode === "final" ? "#78866B" : "transparent",
              color: mode === "final" ? "#FFFFFF" : "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
            }}
          >
            Final song
            <span className="text-[10px] opacity-75" aria-label={finalCount + " final sections"}>
              {finalCount}
            </span>
          </button>
        </div>

        {mode === "ideas" && (
          <button
            type="button"
            onClick={onFitIdeas}
            className="pointer-events-auto flex min-h-11 items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 text-[12px] font-bold text-[var(--cog-warm-gray)] shadow-[0_4px_18px_rgba(28,26,23,0.10)] backdrop-blur-xl transition-all duration-150 active:scale-[0.97]"
            aria-label="Fit all ideas to view"
          >
            <Maximize2 size={14} strokeWidth={2.2} aria-hidden="true" />
            Fit
          </button>
        )}
      </div>

      {mode === "ideas" ? (
        <button
          type="button"
          onClick={() => onModeChange("final")}
          aria-label="Open the final song"
          className="absolute right-0 top-1/2 z-50 flex min-h-28 w-11 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-xl border border-r-0 border-black/10 bg-white/90 text-[var(--cog-warm-gray)] shadow-[-4px_4px_16px_rgba(28,26,23,0.08)] backdrop-blur-xl active:bg-[var(--cog-cream-dark)]"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          <span className="[writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-[0.14em]">
            Final
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onModeChange("ideas")}
          aria-label="Return to the ideas canvas"
          className="absolute left-0 top-1/2 z-50 flex min-h-28 w-11 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-r-xl border border-l-0 border-black/10 bg-white/90 text-[var(--cog-warm-gray)] shadow-[4px_4px_16px_rgba(28,26,23,0.08)] backdrop-blur-xl active:bg-[var(--cog-cream-dark)]"
        >
          <ChevronRight size={15} aria-hidden="true" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-[0.14em]">
            Ideas
          </span>
        </button>
      )}
    </>
  ),
);

CanvasModeSwitcher.displayName = "CanvasModeSwitcher";

export default CanvasModeSwitcher;
