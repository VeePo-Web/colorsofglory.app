import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { TOUR_STEPS, seenCount } from "@/lib/onboarding/tour";

/**
 * One coach-mark tooltip — the visual half of the tour engine.
 * Portal-rendered and anchored to a host-provided ref, so host surfaces never
 * change their own internals (a ref + one hook line is the whole integration).
 *
 * Never blocks: no backdrop; tapping anywhere outside counts as "Got it".
 * Calm motion only; static under prefers-reduced-motion.
 */

const GOLD = "#B5935A";
const TOOLTIP_W = 280;
const GAP = 12;

interface CoachMarkProps {
  targetRef: RefObject<HTMLElement | null>;
  /** ≤ 2 short lines. First sentence may be bolded by passing `lead`. */
  lead?: string;
  body: string;
  onGotIt: () => void;
  onSkip: () => void;
  /** The last beat: on "Got it" it briefly shows a warm close before dismissing. */
  isFinal?: boolean;
}

// The subtle payoff for finishing the tour — one calm faith-toned line.
const COMPLETION_LINE = "That's the room — go write something worth singing.";
const COMPLETION_MS = 1600;

function useReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const CoachMark = ({ targetRef, lead, body, onGotIt, onSkip, isFinal }: CoachMarkProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; dotTop: number; dotLeft: number } | null>(null);
  const [done, setDone] = useState(false);
  const reduceMotion = useReducedMotion();
  const seen = seenCount();

  // Fire the real dismiss exactly once — the completion auto-timer and an
  // impatient tap can both call it.
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onGotIt();
  };

  // On the final beat, "Got it" shows the completion line (rail full) then
  // dismisses after a brief pause. Reduced-motion still gets the closing line
  // (a timed content swap, not decorative motion) — it just skips the CSS
  // animation. A tap during the pause dismisses immediately. Earlier beats
  // dismiss at once.
  const handleGotIt = () => {
    if (done) {
      finish();
      return;
    }
    if (isFinal) {
      setDone(true);
      window.setTimeout(finish, COMPLETION_MS);
      return;
    }
    onGotIt();
  };

  // Position below the target (above when near the viewport bottom), clamped
  // to the viewport. Re-measures on resize/scroll so it tracks the anchor.
  useLayoutEffect(() => {
    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = r.bottom + GAP + 140 < vh;
      const top = below ? r.bottom + GAP : Math.max(12, r.top - GAP - 140);
      const left = Math.min(Math.max(12, r.left + r.width / 2 - TOOLTIP_W / 2), vw - TOOLTIP_W - 12);
      setPos({
        top,
        left,
        dotTop: below ? r.bottom - 4 : r.top - 4,
        dotLeft: r.left + r.width / 2 - 4,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, { capture: true } as EventListenerOptions);
    };
  }, [targetRef]);

  // Tapping anywhere outside the tooltip = "Got it" (they're moving on — never
  // trap them). Deferred a tick so the arming tap doesn't instantly dismiss.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) handleGotIt();
    };
    const id = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 150);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGotIt, isFinal, done, reduceMotion]);

  if (!pos || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Soft pulse dot on the anchor */}
      <span
        aria-hidden="true"
        style={{
          position: "fixed",
          top: pos.dotTop,
          left: pos.dotLeft,
          width: 8,
          height: 8,
          borderRadius: 9999,
          backgroundColor: GOLD,
          zIndex: 1000,
          animation: reduceMotion ? undefined : "cog-coach-pulse 1.6s ease-in-out infinite",
        }}
      />
      <div
        ref={tooltipRef}
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: TOOLTIP_W,
          zIndex: 1001,
          backgroundColor: "#FFFFFF",
          border: `1.5px solid rgba(181,147,90,0.35)`,
          borderRadius: 16,
          boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
          padding: "14px 16px 12px",
          fontFamily: "var(--font-body)",
          animation: reduceMotion ? undefined : "cog-coach-in 250ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <p style={{ fontSize: "0.9375rem", lineHeight: 1.45, color: "#1A1A1A", marginBottom: 10 }}>
          {done ? (
            <span style={{ color: "#1A1A1A", fontWeight: 600 }}>{COMPLETION_LINE}</span>
          ) : (
            <>
              {lead && <strong style={{ fontWeight: 600 }}>{lead} </strong>}
              <span style={{ color: "#555" }}>{body}</span>
            </>
          )}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Dot rail — the tour's only gamification. Fills fully on completion. */}
          <span
            aria-label={done ? "Tour complete" : `Tip ${Math.min(seen + 1, TOUR_STEPS.length)} of ${TOUR_STEPS.length}`}
            style={{ display: "flex", gap: 4 }}
          >
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 9999,
                  backgroundColor: done || i < seen ? GOLD : "rgba(0,0,0,0.12)",
                }}
              />
            ))}
          </span>

          {!done && (
            <>
              <button
                onClick={onSkip}
                style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#999", background: "none", border: "none", padding: "8px 4px", cursor: "pointer" }}
              >
                Skip tour
              </button>
              <button
                onClick={handleGotIt}
                style={{ fontSize: "0.8125rem", fontWeight: 600, color: GOLD, background: "none", border: "none", padding: "8px 4px", cursor: "pointer" }}
              >
                Got it
              </button>
            </>
          )}
        </div>
      </div>

      {/* Keyframes injected once per mount — tiny, scoped, no stylesheet edits */}
      <style>{`
        @keyframes cog-coach-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(181,147,90,0.45); } 50% { box-shadow: 0 0 0 8px rgba(181,147,90,0); } }
        @keyframes cog-coach-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>,
    document.body,
  );
};

export default CoachMark;
