import { Mic, PenLine, Music } from "lucide-react";

interface FirstActionPromptProps {
  onHum: () => void;
  onLyric: () => void;
  onChords: () => void;
}

const CHIPS = [
  {
    id: "hum",
    icon: Mic,
    label: "Hold to hum",
    sub: "Record a melody idea",
    color: "#B5935A",
    bg: "rgba(181,147,90,0.10)",
  },
  {
    id: "lyric",
    icon: PenLine,
    label: "Write a lyric",
    sub: "First line, verse, chorus",
    color: "#4D8FD2",
    bg: "rgba(77,143,210,0.10)",
  },
  {
    id: "chords",
    icon: Music,
    label: "Add chords",
    sub: "Key, BPM, progression",
    color: "#53AB8B",
    bg: "rgba(83,171,139,0.10)",
  },
] as const;

/**
 * First-action prompt shown centered in the viewport the first time a user
 * opens the canvas on a new song.
 *
 * Rendered as an OVERLAY (not inside the canvas layer) so it stays
 * centered regardless of pan/zoom.
 *
 * Dismissed: after tapping any chip, or after the first card is created.
 * Persisted: localStorage flag `cog:canvas-first-visit-{songId}`.
 */
const FirstActionPrompt = ({ onHum, onLyric, onChords }: FirstActionPromptProps) => {
  const handlers = { hum: onHum, lyric: onLyric, chords: onChords };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ pointerEvents: "none", zIndex: 50 }}
      aria-label="Start your first idea"
    >
      <div
        className="flex flex-col items-center rounded-3xl px-6 py-6 mx-4"
        style={{
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1.5px solid rgba(181,147,90,0.25)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.12)",
          maxWidth: 380,
          width: "100%",
          pointerEvents: "auto",
        }}
      >
        {/* Headline */}
        <p
          className="text-center mb-1 leading-snug"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#1A1A1A",
            fontFamily: "var(--font-display)",
          }}
        >
          What's the first idea
        </p>
        <p
          className="text-center mb-6"
          style={{ fontSize: 22, fontWeight: 700, color: "#1A1A1A", fontFamily: "var(--font-display)", lineHeight: 1.1 }}
        >
          for this song?
        </p>

        {/* Action chips */}
        <div className="flex flex-col gap-3 w-full">
          {CHIPS.map((chip) => {
            const Icon = chip.icon;
            const handler = handlers[chip.id];
            return (
              <button
                key={chip.id}
                onClick={handler}
                className="flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.97] w-full"
                style={{
                  backgroundColor: chip.bg,
                  border: `1.5px solid ${chip.color}30`,
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: chip.bg,
                    border: `1.5px solid ${chip.color}40`,
                  }}
                >
                  <Icon size={18} strokeWidth={1.6} style={{ color: chip.color }} />
                </div>
                <div>
                  <p
                    className="text-[0.9375rem] font-semibold"
                    style={{ color: "#1A1A1A", fontFamily: "var(--font-body)" }}
                  >
                    {chip.label}
                  </p>
                  <p
                    className="text-[0.8125rem]"
                    style={{ color: "#666", fontFamily: "var(--font-body)" }}
                  >
                    {chip.sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FirstActionPrompt;
