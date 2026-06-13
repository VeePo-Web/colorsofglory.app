import { useEffect, useRef } from "react";

const BAR_COUNT = 40;
const BAR_WIDTH = 4;
const BAR_GAP = 3;
const MAX_BAR_HEIGHT = 80;

interface RecordingWaveformProps {
  analyserNode: AnalyserNode | null;
  height?: number;
}

/**
 * RecordingWaveform — live 40-bar waveform driven by AnalyserNode FFT data.
 * All animation via requestAnimationFrame — zero React re-renders during playback.
 * Color gradient: amber (#D4AE5C) left → coral (#E85440) right.
 */
const RecordingWaveform = ({ analyserNode, height = MAX_BAR_HEIGHT }: RecordingWaveformProps) => {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const prevHeights = useRef(new Float32Array(BAR_COUNT).fill(0.08));

  useEffect(() => {
    if (!analyserNode) {
      // idle bars: all at minimum height, gold color
      barsRef.current.forEach((bar) => {
        if (bar) {
          bar.style.height = "5px";
          bar.style.backgroundColor = "#D4AE5C";
          bar.style.opacity = "0.35";
        }
      });
      return;
    }

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const step = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));

    function draw() {
      analyserNode!.getByteFrequencyData(dataArray);

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;

        const freq = dataArray[Math.min(i * step, dataArray.length - 1)] / 255;
        // Dual smoothing: analyser.smoothingTimeConstant=0.8 + lerp
        prevHeights.current[i] = prevHeights.current[i] * 0.65 + freq * 0.35;
        const h = Math.max(0.06, prevHeights.current[i]);

        bar.style.height = `${Math.round(h * height)}px`;

        // Amber (left) → coral (right) gradient per bar
        const t = i / (BAR_COUNT - 1);
        const r = Math.round(212 + t * 16);
        const g = Math.round(174 - t * 90);
        const b = Math.round(92 - t * 28);
        bar.style.backgroundColor = `rgb(${r},${g},${b})`;
        bar.style.opacity = String(Math.min(1, h * 0.7 + 0.3));
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode, height]);

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
