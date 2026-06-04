import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, FileText, Mic, Play, Waves } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

const WAVEFORM = [18, 32, 24, 42, 28, 52, 36, 26, 46, 34, 22, 38, 30, 48, 26, 36, 20, 30];

const readSongTitle = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem("cog:first-song") ?? "{}") as {
      title?: string;
    };
    return stored.title || "Grace in the Waiting";
  } catch {
    return "Grace in the Waiting";
  }
};

const VoiceMemoAddedPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const songTitle = useMemo(readSongTitle, []);

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

      <main
        className="relative mx-auto flex min-h-screen w-full flex-col justify-center px-6 py-14"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <div className="flex justify-center mb-10">
          <CogLogo size="sm" />
        </div>

        <div
          className="mx-auto mb-8 flex items-center justify-center rounded-full"
          style={{
            width: 72,
            height: 72,
            backgroundColor: "rgba(184,149,58,0.12)",
            border: "1.5px solid rgba(184,149,58,0.30)",
          }}
        >
          <CheckCircle size={34} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
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
          Your first idea is saved inside {songTitle}.
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
