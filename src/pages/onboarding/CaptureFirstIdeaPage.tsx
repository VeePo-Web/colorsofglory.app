import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, PenLine } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import BackHeader from "@/components/cog/BackHeader";

const CaptureFirstIdeaPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = () => {
    if (isRecording) return;

    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      navigate(`/songs/${songId}/voice-added`);
    }, 2000);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 60%, rgba(184,149,58,0.18) 0%, transparent 65%)",
        }}
      />

      <BackHeader to={`/songs/${songId}`} label="Song" />

      <div
        className="relative flex flex-col flex-1 items-center justify-center px-6 pb-16 pt-2"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="flex justify-center mb-10">
          <CogLogo size="sm" />
        </div>

        <h1
          className="text-4xl font-semibold mb-3 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Capture the first idea
        </h1>

        <p
          className="text-base text-center mb-14 leading-relaxed"
          style={{ color: "var(--cog-warm-gray)", maxWidth: 300 }}
        >
          Record a melody, lyric thought, chord idea, or prayer moment.
        </p>

        <div className="relative mb-14 flex items-center justify-center">
          {isRecording && (
            <>
              <div
                className="absolute rounded-full"
                style={{
                  width: 160,
                  height: 160,
                  backgroundColor: "rgba(184,149,58,0.12)",
                  animation: "cog-record-ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: 140,
                  height: 140,
                  backgroundColor: "rgba(184,149,58,0.10)",
                  animation: "cog-record-ping 1.2s cubic-bezier(0,0,0.2,1) infinite 0.3s",
                }}
              />
            </>
          )}

          <button
            onClick={handleRecord}
            disabled={isRecording}
            className="relative flex items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:cursor-default"
            aria-label="Record voice memo"
            style={{
              width: 120,
              height: 120,
              backgroundColor: isRecording ? "var(--cog-gold)" : "rgba(184,149,58,0.12)",
              border: isRecording
                ? "2px solid var(--cog-gold)"
                : "2px solid rgba(184,149,58,0.35)",
              boxShadow: isRecording
                ? "0 0 40px rgba(184,149,58,0.50), 0 8px 32px rgba(184,149,58,0.30)"
                : "0 8px 32px rgba(184,149,58,0.20)",
            }}
          >
            <Mic size={42} strokeWidth={1.5} style={{ color: isRecording ? "#fff" : "var(--cog-gold)" }} />
          </button>
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 mb-8" aria-live="polite">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: "var(--cog-gold)",
                animation: "cog-record-pulse 1s ease-in-out infinite",
              }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--cog-gold-alt)" }}>
              Recording...
            </p>
          </div>
        )}

        <button
          onClick={handleRecord}
          disabled={isRecording}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-60 mb-4"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.40)",
          }}
        >
          {isRecording ? "Recording..." : "Record voice memo"}
        </button>

        <button
          onClick={() => navigate(`/songs/${songId}/lyrics`)}
          disabled={isRecording}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border)",
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
          }}
        >
          <PenLine size={16} strokeWidth={1.5} style={{ color: "var(--cog-warm-gray)" }} />
          Write lyrics instead
        </button>
      </div>

      <style>{`
        @keyframes cog-record-ping {
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes cog-record-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default CaptureFirstIdeaPage;
