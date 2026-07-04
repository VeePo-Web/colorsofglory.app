import { useRef, type ReactNode } from "react";
import { Archive, ArchiveRestore, MinusCircle } from "lucide-react";

type SwipeMode = "archive" | "restore" | "remove";

interface SwipeableRowProps {
  children: ReactNode;
  /** Fired when the row is swiped left past the commit threshold. */
  onSwipe: () => void;
  /** archive (default) · restore (Archived tab) · remove (inside an album). */
  mode?: SwipeMode;
}

const COMMIT_AT = 96;

const REVEAL: Record<SwipeMode, { label: string; Icon: typeof Archive }> = {
  archive: { label: "Archive", Icon: Archive },
  restore: { label: "Restore", Icon: ArchiveRestore },
  remove: { label: "Remove", Icon: MinusCircle },
};

/**
 * SwipeableRow — Apple Mail's fastest triage gesture, kept calm: swipe a
 * row left past the threshold and release. The action depends on context:
 * archive/restore in the main library, but "remove from this album" inside
 * an album (a song leaving an EP is not the same as archiving the song). The
 * drag runs on DOM refs — zero React re-renders until release. Vertical
 * scrolling stays native (`touch-action: pan-y`); the gesture only engages
 * once the finger's intent is clearly horizontal.
 */
const SwipeableRow = ({ children, onSwipe, mode = "archive" }: SwipeableRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const engaged = useRef(false);
  const dx = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    engaged.current = false;
    dx.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current || e.touches.length !== 1) return;
    const mx = e.touches[0].clientX - start.current.x;
    const my = e.touches[0].clientY - start.current.y;
    if (!engaged.current) {
      // Engage only on clear leftward horizontal intent.
      if (Math.abs(my) > Math.abs(mx) || mx > -12) return;
      engaged.current = true;
    }
    dx.current = Math.min(0, mx);
    const el = rowRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translateX(${dx.current}px)`;
  };

  const settle = (commit: boolean) => {
    const el = rowRef.current;
    start.current = null;
    if (!el) return;
    el.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "translateX(0)";
    if (commit) onSwipe();
  };

  const onTouchEnd = () => {
    if (!engaged.current) {
      start.current = null;
      return;
    }
    settle(dx.current <= -COMMIT_AT);
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      data-no-swipe-nav
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => settle(false)}
    >
      {/* Action layer revealed behind the row — calm gold, never red */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end gap-2 rounded-2xl pr-5"
        style={{ backgroundColor: "var(--cog-gold-pale)", color: "var(--cog-gold)" }}
      >
        {(() => {
          const { Icon } = REVEAL[mode];
          return <Icon size={18} strokeWidth={2} />;
        })()}
        <span
          className="text-[0.8125rem] font-bold"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {REVEAL[mode].label}
        </span>
      </div>
      <div ref={rowRef}>{children}</div>
    </div>
  );
};

export default SwipeableRow;
