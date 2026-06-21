import { useCallback, useRef, useState } from "react";
import { Hand } from "lucide-react";
import { useVibration } from "@/hooks/useVibration";

interface TapTempoProps {
  /** Fired with a fresh BPM each time enough taps are gathered. */
  onBpm: (bpm: number) => void;
  className?: string;
}

const RESET_MS = 2000; // a pause longer than this starts a new measurement
const MAX_TAPS = 6; // rolling window of recent taps
const MIN_BPM = 30;
const MAX_BPM = 300;

/**
 * Tap-tempo — the songwriter taps in time and we read the BPM from the gaps.
 * No typing. Resets after a pause so a fresh tempo isn't averaged with the old one.
 * Pure UI; calls `onBpm` with a clamped, rounded value. ≥44px, haptic on tap.
 */
const TapTempo = ({ onBpm, className }: TapTempoProps) => {
  const { vibrate } = useVibration();
  const tapsRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);

  const handleTap = useCallback(() => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > RESET_MS) {
      taps.length = 0; // stale — start over
    }
    taps.push(now);
    if (taps.length > MAX_TAPS) taps.shift();
    vibrate(5);

    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i += 1) sum += taps[i] - taps[i - 1];
      const avgMs = sum / (taps.length - 1);
      const computed = Math.round(60000 / avgMs);
      const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, computed));
      setBpm(clamped);
      onBpm(clamped);
    }
  }, [onBpm, vibrate]);

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={bpm ? `Tap tempo, currently ${bpm} BPM` : "Tap tempo to set BPM"}
      className={`flex items-center justify-center gap-1.5 transition-transform active:scale-95 ${className ?? ""}`}
      style={{
        minHeight: 44,
        padding: "0 14px",
        borderRadius: 9999,
        background: "rgba(184,149,58,0.12)",
        border: "1px solid rgba(184,149,58,0.30)",
        color: "var(--cog-gold)",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <Hand size={14} strokeWidth={2} />
      <span>{bpm ? `${bpm} BPM` : "Tap tempo"}</span>
    </button>
  );
};

export default TapTempo;
