import { useRef, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { GLORY } from "@/lib/canvas/glorySpectrum";

interface SwipePromoteRowProps {
  children: ReactNode;
  /** Only live ideas promote — dimmed refs, viewers, and Final cards don't. */
  enabled: boolean;
  /** Commit: the card's rect rides along so the fly-to-Final ghost can launch
   *  from exactly where the finger let go. */
  onPromote: (rect: DOMRect) => void;
}

const COMMIT_AT = 96;

/**
 * SwipePromoteRow — slide an idea toward the song. The Feed's two-page
 * geography (Ideas left, Final right) makes this the natural gesture: swipe a
 * card RIGHT — toward the Final page — past the threshold and it promotes,
 * revealing a sage "→ Final" backing as it travels. Same proven mechanics as
 * the library's SwipeableRow (engage only on clear horizontal intent,
 * `touch-action: pan-y` keeps scrolling native, DOM-ref drag = zero re-renders
 * until release). A gesture is an accelerator, never the only route — the
 * selected card's → Final button remains the visible path.
 *
 * Swipe-right is FREE on the Ideas page: the pager only uses leftward swipes
 * from here (rightward is a no-op), so the two gesture systems never fight.
 */
const SwipePromoteRow = ({ children, enabled, onPromote }: SwipePromoteRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const engaged = useRef(false);
  const dx = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    engaged.current = false;
    dx.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current || e.touches.length !== 1) return;
    const mx = e.touches[0].clientX - start.current.x;
    const my = e.touches[0].clientY - start.current.y;
    if (!engaged.current) {
      // Engage only on clear RIGHTWARD horizontal intent (toward Final).
      if (Math.abs(my) > Math.abs(mx) || mx < 12) return;
      engaged.current = true;
    }
    dx.current = Math.max(0, mx);
    const el = rowRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translateX(${dx.current}px)`;
  };

  const settle = (commit: boolean) => {
    const el = rowRef.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    start.current = null;
    if (el) {
      el.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "translateX(0)";
    }
    if (commit && rect) onPromote(rect);
  };

  const onTouchEnd = () => {
    if (!engaged.current) {
      start.current = null;
      return;
    }
    settle(dx.current >= COMMIT_AT);
  };

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden"
      style={{ touchAction: "pan-y", borderRadius: 18 }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => settle(false)}
    >
      {/* The sage promise revealed behind the traveling card. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, borderRadius: 18,
          display: "flex", alignItems: "center", gap: 8, paddingLeft: 20,
          backgroundColor: GLORY.sage.bg, color: GLORY.sage.dark,
          fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 800,
        }}
      >
        <ArrowRight size={18} strokeWidth={2.2} />
        Final
      </div>
      <div ref={rowRef}>{children}</div>
    </div>
  );
};

export default SwipePromoteRow;
