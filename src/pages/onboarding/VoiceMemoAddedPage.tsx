import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Mic, Play, Waves } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BackHeader from "@/components/cog/BackHeader";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";
import { getSong } from "@/lib/songContext";

const WAVEFORM = [18, 32, 24, 42, 28, 52, 36, 26, 46, 34, 22, 38, 30, 48, 26, 36, 20, 30];

const VoiceMemoAddedPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  // Real title from the active-song bridge; empty while unknown so we never
  // render a stranger's song name.
  const songTitle = useMemo(() => getSong(songId)?.title ?? "", [songId]);

  // The aha moment reached — the song now has memory.
  useEffect(() => {
    updateOnboardingStep("first_voice_memo_added").catch(() => {});
  }, []);

  // Subtle "you did it" reveal: the success badge gently pops in and the content
  // settles up on mount. Calm, reverent — not confetti. Reduced-motion users get
  // the final state instantly.
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduceMotion) { setShown(true); return; }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [reduceMotion]);

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 52% at 50% 72%, rgba(184,149,58,0.18) 0%, transparent 68%)",
        }}
      />

      <BackHeader to={`/songs/${songId}/capture`} label="Back" />

      <main
        className="relative mx-auto flex w-full flex-col justify-center px-6 pb-14 pt-4"
        style={{ maxWidth: "var(--max-w-app)", minHeight: "calc(100vh - 60px)" }}
      >
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <div
          className="mx-auto mb-8 flex items-center justify-center rounded-full"
          style={{
            width: 72,
            height: 72,
            backgroundColor: "rgba(184,149,58,0.12)",
            border: "1.5px solid rgba(184,149,58,0.30)",
            transform: shown ? "scale(1)" : "scale(0.82)",
            opacity: shown ? 1 : 0,
            transition: "transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 360ms ease",
          }}
        >
          {/* The check draws its own stroke just after the badge pops — a small
              premium "it completes" moment. Reduced-motion shows it drawn. */}
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4.2 4.2L19 7"
              stroke="var(--cog-gold)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 26,
                strokeDashoffset: reduceMotion ? 0 : shown ? 0 : 26,
                transition: reduceMotion
                  ? undefined
                  : "stroke-dashoffset 420ms cubic-bezier(0.65, 0, 0.35, 1) 200ms",
              }}
            />
          </svg>
        </div>

        <h1
          className="text-4xl font-semibold mb-3 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Voice memo added
        </h1>

        <p className="text-base text-center mb-8" style={{ color: "var(--cog-warm-gray)" }}>
          Your first idea is saved inside {songTitle || "your song"}.
        </p>

        <section
          className="rounded-2xl p-5 mb-8"
          style={{
            background: "linear-gradient(145deg, var(--cog-cream-light) 0%, rgba(232,213,160,0.24) 100%)",
            border: "1.5px solid var(--cog-border-gold)",
            boxShadow: "var(--cog-shadow-card)",
          }}
          aria-label="Saved voice memo"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: "rgba(184,149,58,0.12)",
                  border: "1px solid rgba(184,149,58,0.22)",
                }}
              >
                <Mic size={20} strokeWidth={1.6} style={{ color: "var(--cog-gold)" }} />
              </div>
              <div>
                <p
                  className="text-lg font-semibold leading-snug"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                >
                  First melody idea
                </p>
                <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                  0:12 - just now
                </p>
              </div>
            </div>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-95"
              style={{
                backgroundColor: "var(--cog-gold)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(184,149,58,0.30)",
              }}
              aria-label="Play saved memo"
            >
              <Play size={16} fill="currentColor" />
            </button>
          </div>

          <div className="flex h-16 items-center gap-1.5" aria-hidden>
            {WAVEFORM.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="block w-1 rounded-full"
                style={{
                  height,
                  backgroundColor: index < 8 ? "var(--cog-gold)" : "var(--cog-gold-pale)",
                  transformOrigin: "bottom",
                  // Bars rise into place left→right after the badge — "the sound arrives".
                  transform: reduceMotion || shown ? "scaleY(1)" : "scaleY(0.08)",
                  opacity: reduceMotion || shown ? 1 : 0,
                  transition: reduceMotion
                    ? undefined
                    : `transform 420ms cubic-bezier(0.22, 1, 0.36, 1) ${260 + index * 26}ms, opacity 280ms ease ${260 + index * 26}ms`,
                }}
              />
            ))}
          </div>
        </section>

        <button
          onClick={() => navigate(`/songs/${songId}`)}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-4"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.38)",
          }}
        >
          Return to song
        </button>

        <button
          onClick={() => navigate(`/songs/${songId}/lyrics`)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border)",
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
          }}
        >
          <FileText size={16} strokeWidth={1.5} style={{ color: "var(--cog-warm-gray)" }} />
          Add lyrics next
        </button>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--cog-muted)" }}>
          <Waves size={14} strokeWidth={1.5} />
          Saved to this song room
        </div>
      </main>
    </div>
  );
};

export default VoiceMemoAddedPage;

