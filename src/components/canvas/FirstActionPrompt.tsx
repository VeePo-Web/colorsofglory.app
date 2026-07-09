import { Mic, PenLine, Music } from "lucide-react";
import { GLORY, GLORY_PALE_GOLD, TYPE_TONE } from "@/lib/canvas/glorySpectrum";

interface FirstActionPromptProps {
  onHum: () => void;
  onLyric: () => void;
  onChords: () => void;
}

// Each chip wears the glory tone its card will wear — the first tap teaches
// the canvas's color language. The mic chip opens the REAL recorder.
const CHIPS = [
  {
    id: "hum",
    icon: Mic,
    label: "Hum a melody",
    sub: "Tap to record an idea",
    color: GLORY.gold.base,
    bg: GLORY.gold.bg,
  },
  {
    id: "lyric",
    icon: PenLine,
    label: "Write a lyric",
    sub: "First line, verse, chorus",
    color: TYPE_TONE.lyric.base,
    bg: TYPE_TONE.lyric.bg,
  },
  {
    id: "chords",
    icon: Music,
    label: "Add chords",
    sub: "Key, BPM, progression",
    color: GLORY_PALE_GOLD.base,
    bg: GLORY_PALE_GOLD.bg,
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
      {/* Glory aura — the auth-code light gathered behind the invitation */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            `radial-gradient(50% 50% at 50% 50%, ${GLORY.gold.base}1F 0%, transparent 70%), ` +
            `radial-gradient(60% 60% at 34% 40%, ${GLORY.crimson.base}0F 0%, transparent 70%), ` +
            `radial-gradient(60% 60% at 66% 40%, ${GLORY.cobalt.base}0D 0%, transparent 70%), ` +
            `radial-gradient(60% 60% at 50% 68%, ${GLORY.sage.base}0D 0%, transparent 70%)`,
          animation: "cog-glory-breathe 14s ease-in-out infinite",
        }}
      />
      <div
        className="flex flex-col items-center rounded-3xl px-6 py-6 mx-4"
        style={{
          position: "relative",
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
        {/* Headline — the calm empty state */}
        <p
          className="text-center leading-snug"
          style={{
            fontSize: 23,
            fontWeight: 700,
            color: "#1A1A1A",
            fontFamily: "var(--font-display)",
            lineHeight: 1.15,
          }}
        >
          Every idea for this song
        </p>
        <p
          className="text-center mb-2"
          style={{ fontSize: 23, fontWeight: 700, color: "#1A1A1A", fontFamily: "var(--font-display)", lineHeight: 1.15 }}
        >
          starts here.
        </p>
        <p
          className="text-center mb-6"
          style={{ fontSize: 13.5, color: "var(--cog-warm-gray, #6B6459)", fontFamily: "var(--font-body)", maxWidth: 280 }}
        >
          Capture the first spark — a hum, a line, a chord. Nothing is ever lost.
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
                    style={{ color: "var(--cog-warm-gray, #6B6459)", fontFamily: "var(--font-body)" }}
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
