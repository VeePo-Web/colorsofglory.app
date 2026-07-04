import { useRef } from "react";
import { Repeat, X } from "lucide-react";

interface LoopRegion {
  startMs: number;
  endMs: number;
}

interface ABLoopBarProps {
  durationMs: number;
  positionMs: number;
  color: string;
  region: LoopRegion | null;
  onRegionChange: (region: LoopRegion | null) => void;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const MIN_WINDOW_MS = 800;
const DEFAULT_WINDOW_MS = 6000;

/**
 * Progress bar with an optional A/B loop window — GarageBand's cycle region for
 * a voice memo. Tap "Loop a part" to drop a window at the playhead, then drag
 * the two gold handles to frame exactly the phrase you keep stumbling on. Only
 * that window plays until you clear it. Pointer-based so it works with touch.
 */
export function ABLoopBar({ durationMs, positionMs, color, region, onRegionChange }: ABLoopBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dur = durationMs > 0 ? durationMs : 1;

  const pct = (ms: number) => Math.min(Math.max((ms / dur) * 100, 0), 100);

  const msFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return ratio * dur;
  };

  const dragHandle = (which: "start" | "end") => (e: React.PointerEvent) => {
    if (!region) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const ms = msFromClientX(ev.clientX);
      if (which === "start") {
        onRegionChange({ ...region, startMs: Math.min(ms, region.endMs - MIN_WINDOW_MS) });
      } else {
        onRegionChange({ ...region, endMs: Math.max(ms, region.startMs + MIN_WINDOW_MS) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const arm = () => {
    if (durationMs < MIN_WINDOW_MS * 2) {
      onRegionChange({ startMs: 0, endMs: durationMs });
      return;
    }
    const start = Math.min(Math.max(positionMs, 0), durationMs - DEFAULT_WINDOW_MS);
    onRegionChange({ startMs: Math.max(start, 0), endMs: Math.min(start + DEFAULT_WINDOW_MS, durationMs) });
  };

  return (
    <div className="relative z-10 px-6 pb-4">
      {/* Track — taller hit area so the 4px bar has finger room */}
      <div ref={trackRef} className="relative" style={{ height: 28, display: "flex", alignItems: "center" }}>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: "rgba(28,26,23,0.10)" }}>
          <div className="rounded-full" style={{ height: "100%", width: `${pct(positionMs)}%`, backgroundColor: color, transition: "width 200ms linear" }} />
        </div>

        {region && (
          <>
            {/* Window fill */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `${pct(region.startMs)}%`,
                width: `${pct(region.endMs) - pct(region.startMs)}%`,
                height: 6,
                backgroundColor: color,
                opacity: 0.35,
              }}
            />
            {(["start", "end"] as const).map((which) => (
              <div
                key={which}
                onPointerDown={dragHandle(which)}
                className="absolute flex items-center justify-center"
                style={{
                  left: `${pct(which === "start" ? region.startMs : region.endMs)}%`,
                  transform: "translateX(-50%)",
                  width: 28,
                  height: 28,
                  cursor: "ew-resize",
                  touchAction: "none",
                }}
                aria-label={which === "start" ? "Loop start" : "Loop end"}
              >
                <div style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: color, border: "2px solid #fff", boxShadow: "0 2px 6px rgba(28,26,23,0.28)" }} />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        {region ? (
          <>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, color }}>
              Looping {fmt(region.startMs)}–{fmt(region.endMs)}
            </span>
            <button
              onClick={() => onRegionChange(null)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 active:scale-95"
              style={{ backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, border: "none" }}
            >
              <X size={12} /> Clear
            </button>
          </>
        ) : (
          <>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--cog-muted)" }}>
              {fmt(positionMs)} / {fmt(durationMs)}
            </span>
            <button
              onClick={arm}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 active:scale-95"
              style={{ backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, border: "none" }}
            >
              <Repeat size={12} /> Loop a part
            </button>
          </>
        )}
      </div>
    </div>
  );
}
