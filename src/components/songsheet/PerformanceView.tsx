import { useEffect, useRef, useState } from "react";
import { X, Play, Pause, Minus, Plus } from "lucide-react";
import { type SheetSection } from "@/lib/chords/sheet";
import ChordLine from "@/components/songsheet/ChordLine";

/**
 * Performance / Stage view — the teleprompter. The most-requested chord-app
 * feature (OnSong, Ultimate Guitar): full-screen, large readable chart, smooth
 * auto-scroll you control, tap-to-pause. Apple-smooth (rAF, transform-free
 * scroll), reduced-motion aware, safe-area aware. Frontend-only, COG tokens.
 */

const MIN_SPEED = 8;
const MAX_SPEED = 80;
const DEFAULT_SPEED = 26; // px / second

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Keep the screen awake while performing — no more dimming mid-song. */
function useWakeLock() {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;
    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* denied or unsupported — fine, the chart still works */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, []);
}

const FONT_KEY = "cog-perform-fontscale";

export default function PerformanceView({
  sections,
  displayKey,
  display,
  capo = 0,
  songTitle,
  onClose,
  onStepKey,
}: {
  sections: SheetSection[];
  displayKey: string;
  display: "letters" | "numbers";
  capo?: number;
  songTitle: string;
  onClose: () => void;
  /** Transpose without leaving the stage view (OnSong-style). Letters only. */
  onStepKey?: (semitones: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const lastRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [shown, setShown] = useState(false);
  const [fontScale, setFontScale] = useState(() => {
    try {
      const v = Number(localStorage.getItem(FONT_KEY));
      return v >= 0.8 && v <= 1.8 ? v : 1;
    } catch {
      return 1;
    }
  });
  const reduced = usePrefersReducedMotion();
  useWakeLock();

  useEffect(() => {
    try {
      localStorage.setItem(FONT_KEY, String(fontScale));
    } catch {
      /* best-effort */
    }
  }, [fontScale]);
  const stepFont = (d: number) => setFontScale((s) => Math.max(0.8, Math.min(1.8, +(s + d).toFixed(2))));

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true)); // gentle fade-in
    return () => cancelAnimationFrame(t);
  }, []);

  // Smooth auto-scroll via rAF — accumulates sub-pixel distance so slow speeds
  // are steady, and stops cleanly at the end.
  useEffect(() => {
    if (!playing) return;
    const el = scrollRef.current;
    if (!el) return;
    let acc = 0;
    const tick = (t: number) => {
      if (lastRef.current == null) lastRef.current = t;
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      acc += speed * dt;
      if (acc >= 1) {
        const px = Math.floor(acc);
        el.scrollTop += px;
        acc -= px;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [playing, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stepSpeed = (d: number) => setSpeed((s) => Math.max(MIN_SPEED, Math.min(MAX_SPEED, s + d)));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        height: "100dvh",
        backgroundColor: "var(--cog-cream)",
        opacity: shown ? 1 : 0,
        transition: "opacity 240ms var(--cog-ease-reveal, ease-out)",
      }}
      role="dialog"
      aria-label="Performance view"
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)", paddingBottom: 10 }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
            {songTitle}
          </p>
          <p className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
            {display === "numbers" ? "Nashville numbers" : `Key of ${displayKey}`}
            {capo > 0 && display !== "numbers" ? ` · Capo ${capo}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Transpose on stage — no need to leave the chart (OnSong-style). */}
          {onStepKey && display === "letters" && (
            <div className="flex items-center rounded-full" style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}>
              <button
                type="button"
                onClick={() => onStepKey(-1)}
                aria-label="Lower the key"
                className="flex items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ width: 40, height: 40, color: "var(--cog-charcoal)" }}
              >
                <Minus size={16} strokeWidth={2.2} />
              </button>
              <span
                className="text-sm font-bold tabular-nums text-center"
                style={{ color: "var(--cog-charcoal)", minWidth: 24 }}
                aria-label={`Key of ${displayKey}`}
              >
                {displayKey}
              </span>
              <button
                type="button"
                onClick={() => onStepKey(1)}
                aria-label="Raise the key"
                className="flex items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ width: 40, height: 40, color: "var(--cog-charcoal)" }}
              >
                <Plus size={16} strokeWidth={2.2} />
              </button>
            </div>
          )}
          <div className="flex items-center rounded-full" style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}>
            <button
              type="button"
              onClick={() => stepFont(-0.1)}
              aria-label="Smaller text"
              disabled={fontScale <= 0.8}
              className="flex items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
              style={{ width: 40, height: 40, color: "var(--cog-charcoal)", fontSize: "0.8rem", fontWeight: 700 }}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => stepFont(0.1)}
              aria-label="Larger text"
              disabled={fontScale >= 1.8}
              className="flex items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
              style={{ width: 40, height: 40, color: "var(--cog-charcoal)", fontSize: "1.15rem", fontWeight: 700 }}
            >
              A
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close performance view"
            className="flex items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ width: 44, height: 44, backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Scrollable chart — tap toggles play */}
      <div
        ref={scrollRef}
        onClick={() => setPlaying((p) => !p)}
        className="flex-1 overflow-y-auto px-5"
        style={{ scrollBehavior: "auto", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", paddingBottom: "55vh", paddingTop: 8 }}>
          {sections.map((section, si) => (
            <section key={si} className="mb-8">
              {section.label && (
                <h2 className="mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", fontSize: `${1.2 * fontScale}rem` }}>
                  {section.label}
                </h2>
              )}
              <div className="flex flex-col gap-3.5">
                {section.lines.map((line, li) => (
                  <ChordLine
                    key={li}
                    line={line}
                    displayKey={displayKey}
                    display={display}
                    lyricRem={1.0625 * fontScale}
                    chordRem={0.9 * fontScale}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Control pill */}
      <div className="flex justify-center px-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)", paddingTop: 10 }}>
        <div
          className="flex items-center gap-1.5 rounded-full px-2 py-2"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)", boxShadow: "var(--cog-shadow-sm, 0 4px 16px rgba(0,0,0,0.08))" }}
        >
          <PillButton label="Slower" onClick={() => stepSpeed(-6)}>
            <Minus size={18} strokeWidth={2.2} />
          </PillButton>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause auto-scroll" : "Start auto-scroll"}
            className="flex items-center justify-center rounded-full transition-transform active:scale-95"
            style={{ width: 56, height: 56, backgroundColor: "var(--cog-gold)", color: "#fff" }}
          >
            {playing ? <Pause size={24} strokeWidth={2.2} /> : <Play size={24} strokeWidth={2.2} style={{ marginLeft: 2 }} />}
          </button>
          <PillButton label="Faster" onClick={() => stepSpeed(6)}>
            <Plus size={18} strokeWidth={2.2} />
          </PillButton>
        </div>
      </div>

      {reduced && (
        <p className="text-center text-[0.6875rem] pb-2" style={{ color: "var(--cog-muted)" }}>
          Reduced-motion is on — scroll by hand or tap play
        </p>
      )}
    </div>
  );
}

function PillButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center rounded-full transition-transform active:scale-90"
      style={{ width: 44, height: 44, color: "var(--cog-charcoal)" }}
    >
      {children}
    </button>
  );
}
