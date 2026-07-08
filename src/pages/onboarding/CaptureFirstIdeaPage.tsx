import { useNavigate, useParams } from "react-router-dom";
import { PenLine } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import OnboardingShell from "@/components/cog/OnboardingShell";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";

/**
 * Guided "Capture the first idea" framing screen.
 *
 * IMPORTANT: this screen never records audio itself. The previous version
 * simulated a recording (fake waveform + timer) and persisted nothing — a
 * fake-success violation. Now the big gold mic hands the user straight into
 * the song's REAL mic-first capture (C2's CaptureScene at /songs/:id), so the
 * first capture is the user's real audio, saved by the real pipeline.
 *
 * Step advancement: `first_idea_captured` / `first_voice_memo_added` advance
 * via the DB triggers on the real voice_memo insert — the source of truth —
 * so nothing is marked here.
 */
const CaptureFirstIdeaPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  // The mic hands off to the song's real workspace/recorder — prefetch it idle.
  useIdlePrefetch(() => import("@/pages/CapturePage"));

  // Hand off to the song's real recorder — the capture itself is C2's.
  const handleRecord = () => navigate(`/songs/${songId}`);

  return (
    <OnboardingShell>
      {/* Logo — stacked, matches reference (crown + Colors + of Glory) */}
      <div className="pt-16 pb-6 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-3 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
      >
        Capture the first idea
      </h1>
      <p
        className="text-[1rem] text-center mb-14 leading-relaxed mx-auto"
        style={{ color: "var(--cog-warm-gray)", maxWidth: 280 }}
      >
        Record a melody, lyric thought, chord idea, or prayer moment.
      </p>

      {/* Large gold mic button — centered, prominent, matches reference.
          A slow, low-opacity gold halo breathes behind it to gently invite the
          first tap (calm, reverent — not a flashy blink). Disabled for
          prefers-reduced-motion. transform/opacity only; never blocks the tap. */}
      <style>{`
        @keyframes cogMicBreathe {
          0%, 100% { transform: scale(1); opacity: 0.26; }
          50% { transform: scale(1.16); opacity: 0; }
        }
        .cog-mic-pulse { animation: cogMicBreathe 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cog-mic-pulse { animation: none; opacity: 0; } }
      `}</style>
      <div className="flex justify-center mb-6">
        <div className="relative" style={{ width: 120, height: 120 }}>
          <span
            aria-hidden="true"
            className="cog-mic-pulse"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              backgroundColor: "var(--cog-gold)",
              pointerEvents: "none",
            }}
          />
          <button
            onClick={handleRecord}
            className="relative flex items-center justify-center rounded-full transition-all duration-150 active:scale-95"
            aria-label="Record a voice memo"
            style={{
              width: 120,
              height: 120,
              backgroundColor: "var(--cog-gold)",
              boxShadow: "0 8px 32px var(--cog-gold-a45)",
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
      </div>

      {/* "Record voice memo" — gold text link, matches reference */}
      <button
        onClick={handleRecord}
        className="block text-center w-full text-[0.9375rem] font-medium mb-4 transition-opacity hover:opacity-70 underline"
        style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
      >
        Record voice memo
      </button>

      {/* "Write lyrics instead" — non-dead-end skip into the real lyrics surface */}
      <button
        onClick={() => navigate(`/songs/${songId}/lyrics`)}
        className="block text-center w-full text-[0.9375rem] transition-opacity hover:opacity-70"
        style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
      >
        <PenLine size={14} strokeWidth={1.5} className="inline mr-1.5 -mt-0.5" />
        Write lyrics instead
      </button>
    </OnboardingShell>
  );
};

export default CaptureFirstIdeaPage;
