import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * RoomWelcome — the hallway, taught in one breath (Golden Path gap table,
 * row 3). The FIRST time this device ever opens a song room, one calm card
 * names the metaphor and the one move that matters, then dissolves into the
 * feed and never returns:
 *
 *   "This is ⟨song⟩'s room."
 *   "Everything for this song stays here — your ideas on this page,
 *    the finished song one swipe left."
 *
 * Once per DEVICE, not per song: the hallway lesson repeats for nobody.
 * Tap anywhere (or the gold button, or Escape) dismisses — an 8-year-old's
 * first guess is the right one.
 */

const SEEN_KEY = "cog:room-welcome-seen";

export function hasSeenRoomWelcome(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked → never gate the room behind a welcome
  }
}

export function markRoomWelcomeSeen(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* the session state still dismisses it */
  }
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const RoomWelcome = ({ songTitle, onDismiss }: { songTitle: string; onDismiss: () => void }) => {
  const [leaving, setLeaving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const dismiss = () => {
    if (leaving) return;
    markRoomWelcomeSeen();
    if (reduce) {
      onDismiss();
      return;
    }
    setLeaving(true); // dissolve, then unmount
    window.setTimeout(onDismiss, 260);
  };

  useEffect(() => {
    btnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-label={`Welcome to ${songTitle}'s room`}
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        backgroundColor: "rgba(245,240,232,0.86)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: leaving ? 0 : 1,
        transition: reduce ? "none" : `opacity 260ms ${EASE}`,
        cursor: "pointer",
      }}
    >
      <style>{`@keyframes cog-welcome-rise { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 340,
          textAlign: "center",
          cursor: "default",
          animation: reduce ? "none" : `cog-welcome-rise 420ms ${EASE}`,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            margin: "0 auto 18px",
            background: "linear-gradient(140deg, rgba(212,174,92,0.30), rgba(184,149,58,0.14))",
            border: "1.5px solid rgba(184,149,58,0.40)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={24} strokeWidth={1.8} style={{ color: "var(--cog-gold)" }} />
        </div>
        <p
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            color: "var(--cog-charcoal)",
          }}
        >
          This is {songTitle ? `“${songTitle}”` : "your song"}&rsquo;s room
        </p>
        <p
          style={{
            margin: "0 0 22px",
            fontFamily: "var(--font-body)",
            fontSize: 14.5,
            lineHeight: 1.65,
            color: "var(--cog-warm-gray)",
          }}
        >
          Everything for this song stays here — your ideas on this page, the finished song one
          swipe left.
        </p>
        <button
          ref={btnRef}
          type="button"
          onClick={dismiss}
          style={{
            minHeight: 50,
            padding: "0 28px",
            borderRadius: 14,
            border: "none",
            cursor: "pointer",
            backgroundColor: "var(--cog-gold)",
            color: "#FFFFFF",
            fontFamily: "var(--font-body)",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Start writing
        </button>
      </div>
    </div>
  );
};

export default RoomWelcome;
