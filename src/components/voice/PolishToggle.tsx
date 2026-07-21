import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import {
  isPolishEnabled,
  isPolishSupported,
  setPolishEnabled,
  subscribePolish,
} from "@/lib/audio/enhance";

/**
 * The calm "Polished ✨ / Original" A/B pill (C4). One tap flips ALL live
 * playback between the music-safe polish bus and the untouched original —
 * instantly, mid-play. Hides itself entirely when Web Audio doesn't exist
 * (never a dead control). D1 can consume the same state for the canvas
 * voice card via subscribePolish/isPolishEnabled.
 */
const PolishToggle = () => {
  const polished = useSyncExternalStore(subscribePolish, isPolishEnabled, () => true);
  if (!isPolishSupported()) return null;

  return (
    <button
      type="button"
      onClick={() => setPolishEnabled(!polished)}
      aria-pressed={polished}
      aria-label={
        polished
          ? "Playback is polished — tap to hear the untouched original"
          : "Playback is the untouched original — tap to polish"
      }
      className="flex items-center gap-1.5 rounded-xl px-3.5 transition-all duration-150 active:scale-[0.98]"
      style={{
        minHeight: 44,
        backgroundColor: polished ? "rgba(184,149,58,0.10)" : "rgba(0,0,0,0.05)",
        border: polished ? "1px solid rgba(184,149,58,0.22)" : "1px solid transparent",
        color: polished ? "var(--cog-gold)" : "var(--cog-warm-gray)",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Sparkles size={14} strokeWidth={2} />
      {polished ? "Polished" : "Original"}
    </button>
  );
};

export default PolishToggle;
