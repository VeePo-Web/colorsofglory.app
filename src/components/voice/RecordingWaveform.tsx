import { useEffect, useRef } from "react";

const BAR_COUNT = 40;
const BAR_WIDTH = 4;
const BAR_GAP = 3;
const MAX_BAR_HEIGHT = 80;

/**
 * Per-bar colour for the live recording meter: a calm COG gold gradient
 * (gold-pale → gold), left to right. Deliberately stays in the warm gold family
 * — no coral/red spike — so an active recording reads as reverent, not alarming.
 * Exported + pure so the brand-colour contract can be unit-tested.
 */
export function goldWaveColor(t: number): string {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = Math.round(232 - clamped * 48); // 232 → 184  (gold-pale → gold)
  const g = Math.round(213 - clamped * 64); // 213 → 149
  const b = Math.round(160 - clamped * 102); // 160 → 58
  return `rgb(${r},${g},${b})`;
}

interface RecordingWaveformProps {
  analyserNode: AnalyserNode | null;
  /**
   * Whether a take is actively recording. When true but no analyser is available
   * (a known iOS Safari quirk where the AnalyserNode can't be wired), the meter
   * shows a gentle "listening" pulse so recording NEVER looks frozen. Defaults to
   * true since this component is only mounted during the recording flow.
   */
  active?: boolean;
  height?: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * RecordingWaveform — live recording meter.
 * - With an AnalyserNode: a 40-bar FFT waveform, all animation on rAF (zero React
 *   re-renders), dual-smoothed, in COG gold.
 * - Without an analyser but actively recording (iOS fallback): a calm travelling
 *   "listening" pulse, so the surface always shows life.
 * - Under prefers-reduced-motion: a static, present gold profile (no animation).
 */
const RecordingWaveform = ({ analyserNode, active = true, height = MAX_BAR_HEIGHT }: RecordingWaveformProps) => {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const prevHeights = useRef(new Float32Array(BAR_COUNT).fill(0.08));

  useEffect(() => {
    const setBar = (i: number, hFrac: number, t: number, opacity: number) => {
      const bar = barsRef.current[i];
      if (!bar) return;
      bar.style.height = `${Math.max(3, Math.round(hFrac * height))}px`;
      bar.style.backgroundColor = goldWaveColor(t);
      bar.style.opacity = String(opacity);
    };

    // Reduced motion: a calm, present, NON-animated gold profile (gentle centre
    // hump) — clearly "recording" without any moving bars.
    if (prefersReducedMotion()) {
      for (let i = 0; i < BAR_COUNT; i++) {
        const center = 1 - Math.abs(i / (BAR_COUNT - 1) - 0.5) * 2; // 0..1..0
        setBar(i, 0.12 + center * 0.18, i / (BAR_COUNT - 1), 0.8);
      }
      return;
    }

    // Live FFT meter.
    if (analyserNode) {
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      const step = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));
      const draw = () => {
        analyserNode.getByteFrequencyData(dataArray);
        for (let i = 0; i < BAR_COUNT; i++) {
          const freq = dataArray[Math.min(i * step, dataArray.length - 1)] / 255;
          prevHeights.current[i] = prevHeights.current[i] * 0.65 + freq * 0.35;
          const h = Math.max(0.06, prevHeights.current[i]);
          setBar(i, h, i / (BAR_COUNT - 1), Math.min(1, h * 0.7 + 0.3));
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(rafRef.current);
    }

    // No analyser but recording (iOS): a calm travelling "listening" pulse so the
    // meter never sits dead. Slow, low-amplitude — confirmation, not a toy.
    if (active) {
      const start = typeof performance !== "undefined" ? performance.now() : 0;
      const draw = () => {
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        const phase = ((now - start) / 1000) * 2.2; // gentle speed
        for (let i = 0; i < BAR_COUNT; i++) {
          const wave = 0.5 + 0.5 * Math.sin(phase - i * 0.32);
          setBar(i, 0.1 + wave * 0.16, i / (BAR_COUNT - 1), 0.45 + wave * 0.4);
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(rafRef.current);
    }

    // Idle (not recording): minimal static bars.
    for (let i = 0; i < BAR_COUNT; i++) setBar(i, 0.06, i / (BAR_COUNT - 1), 0.35);
  }, [analyserNode, active, height]);

  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: BAR_GAP,
        height,
        width: totalWidth,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          style={{
            width: BAR_WIDTH,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#D4AE5C",
            flexShrink: 0,
            willChange: "height, background-color, opacity",
          }}
        />
      ))}
    </div>
  );
};

export default RecordingWaveform;
