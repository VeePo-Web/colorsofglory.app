import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PenLine } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import OnboardingShell from "@/components/cog/OnboardingShell";

// ─── Animated waveform ────────────────────────────────────────────────────────

const BAR_COUNT = 32;

function useWaveform(active: boolean) {
  const [heights, setHeights] = useState(() => Array.from({ length: BAR_COUNT }, () => 8));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setHeights(Array.from({ length: BAR_COUNT }, () => 8));
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let frame = 0;
    const tick = () => {
      frame++;
      if (frame % 2 === 0) {
        setHeights((prev) =>
          prev.map((h) => {
            const target = Math.random() * 72 + 8;
            return h + (target - h) * 0.35;
          })
        );
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return heights;
}

// ─── Recording timer ──────────────────────────────────────────────────────────

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) { setSeconds(0); return; }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CaptureFirstIdeaPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";

  const [isRecording, setIsRecording] = useState(false);
  const waveHeights = useWaveform(isRecording);
  const timerDisplay = useTimer(isRecording);

  const handleRecord = () => {
    if (isRecording) return;
    // Request mic permission then start recording
    // MediaRecorder wired by Lovable — for now simulate
    setIsRecording(true);
  };

  const handleStop = () => {
    setIsRecording(false);
    // Navigate to voice memo saved screen
    setTimeout(() => navigate(`/songs/${songId}/voice-added`), 300);
  };

  // ── Recording state — full screen, red waveform + timer ─────────────────
  if (isRecording) {
    return (
      <div
        className="relative min-h-screen flex flex-col items-center justify-center"
        style={{ backgroundColor: "#FAFAF6" }}
      >
        {/* Animated waveform bars — orange/red gradient, reference image style */}
        <div
          className="flex items-end justify-center gap-1 mb-8"
          style={{ width: 320, height: 120 }}
          aria-hidden="true"
        >
          {waveHeights.map((h, i) => {
            // Gradient from left (amber) to center-right (red/coral)
            const progress = i / (BAR_COUNT - 1);
            const r = Math.round(210 + progress * 30);
            const g = Math.round(120 - progress * 80);
            const b = Math.round(60 - progress * 40);
            return (
              <div
                key={i}
                className="rounded-full flex-1 transition-none"
                style={{
                  height: `${h}px`,
                  backgroundColor: `rgb(${r},${g},${b})`,
                  minWidth: 6,
                  maxWidth: 10,
                  transition: "height 80ms ease",
                }}
              />
            );
          })}
        </div>

        {/* Timer — large red, reference shows "0:42" */}
        <p
          className="text-[4rem] font-bold mb-2 tabular-nums"
          style={{ color: "#E05440", fontFamily: "var(--font-body)", lineHeight: 1 }}
        >
          {timerDisplay}
        </p>
        <p className="text-[1rem] mb-12" style={{ color: "#999" }}>
          Recording...
        </p>

        {/* Stop button — red pill, matches reference */}
        <button
          onClick={handleStop}
          className="flex items-center justify-center rounded-full font-semibold text-white transition-all duration-150 active:scale-[0.97]"
          style={{
            width: 180,
            height: 52,
            backgroundColor: "#E05440",
            fontFamily: "var(--font-body)",
            fontSize: "1rem",
            boxShadow: "0 4px 16px rgba(224,84,64,0.40)",
          }}
        >
          Stop
        </button>
      </div>
    );
  }

  // ── Default state — mic button + capture prompt ──────────────────────────
  return (
    <OnboardingShell>
      {/* Logo — stacked, matches reference (crown + Colors + of Glory) */}
      <div className="pt-16 pb-6 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-3 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Capture the first idea
      </h1>
      <p
        className="text-[1rem] text-center mb-14 leading-relaxed mx-auto"
        style={{ color: "#666", maxWidth: 280 }}
      >
        Record a melody, lyric thought, chord idea, or prayer moment.
      </p>

      {/* Large gold mic button — centered, prominent, matches reference */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleRecord}
          className="flex items-center justify-center rounded-full transition-all duration-150 active:scale-95"
          aria-label="Tap to record a voice memo"
          style={{
            width: 120,
            height: 120,
            backgroundColor: "#B5935A",
            boxShadow: "0 8px 32px rgba(181,147,90,0.45)",
          }}
        >
          {/* Mic icon — white, inline SVG for precision */}
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 2C10.3431 2 9 3.34315 9 5V11C9 12.6569 10.3431 14 12 14C13.6569 14 15 12.6569 15 11V5C15 3.34315 13.6569 2 12 2Z"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M5 10C5 13.866 8.13401 17 12 17C15.866 17 19 13.866 19 10"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line x1="12" y1="17" x2="12" y2="22" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* "Record voice memo" — gold text link, matches reference */}
      <button
        onClick={handleRecord}
        className="block text-center w-full text-[0.9375rem] font-medium mb-4 transition-opacity hover:opacity-70 underline"
        style={{ color: "#B5935A", fontFamily: "var(--font-body)" }}
      >
        Record voice memo
      </button>

      {/* "Write lyrics instead" — gray text link */}
      <button
        onClick={() => navigate(`/songs/${songId}/lyrics`)}
        className="block text-center w-full text-[0.9375rem] transition-opacity hover:opacity-70"
        style={{ color: "#999", fontFamily: "var(--font-body)" }}
      >
        <PenLine size={14} strokeWidth={1.5} className="inline mr-1.5 -mt-0.5" />
        Write lyrics instead
      </button>
    </OnboardingShell>
  );
};

export default CaptureFirstIdeaPage;
