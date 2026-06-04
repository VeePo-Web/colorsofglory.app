import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Pause, Play } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

interface VoiceMemo {
  id: string;
  name: string;
  duration: string;
  section: string;
  age: string;
  waveform: number[];
}

const MEMOS: VoiceMemo[] = [
  {
    id: "1",
    name: "First melody idea",
    duration: "0:42",
    section: "Verse 1",
    age: "2h ago",
    waveform: [18, 32, 24, 42, 28, 52, 36, 26, 46, 34, 22, 38, 30, 48, 26, 36, 20, 30, 40, 24],
  },
  {
    id: "2",
    name: "Chorus hook",
    duration: "1:14",
    section: "Chorus",
    age: "Yesterday",
    waveform: [24, 40, 18, 52, 34, 28, 44, 30, 22, 48, 36, 20, 42, 28, 38, 24, 46, 32, 26, 42],
  },
  {
    id: "3",
    name: "Bridge concept",
    duration: "0:28",
    section: "Bridge",
    age: "3 days ago",
    waveform: [30, 22, 44, 18, 36, 50, 24, 40, 28, 34, 20, 46, 32, 26, 42, 18, 38, 30, 24, 36],
  },
];

const MemoCard = ({ memo }: { memo: VoiceMemo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const playhead = Math.floor(memo.waveform.length * 0.4);

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border)",
        boxShadow: "0 4px 16px rgba(28,26,23,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 44,
              height: 44,
              backgroundColor: "rgba(184,149,58,0.12)",
              border: "1px solid rgba(184,149,58,0.22)",
            }}
          >
            <Mic size={18} strokeWidth={1.6} style={{ color: "var(--cog-gold)" }} />
          </div>
          <div>
            <p
              className="text-base font-semibold leading-snug"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
            >
              {memo.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
              {memo.duration} Â· {memo.section} Â· {memo.age}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center justify-center rounded-full transition-all duration-150 active:scale-95 flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            backgroundColor: "var(--cog-gold)",
            color: "#fff",
            boxShadow: "0 4px 16px rgba(184,149,58,0.30)",
          }}
          aria-label={isPlaying ? `Pause ${memo.name}` : `Play ${memo.name}`}
        >
          {isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
          )}
        </button>
      </div>

      {/* Waveform */}
      <div className="flex h-12 items-center gap-1" aria-hidden>
        {memo.waveform.map((height, index) => (
          <span
            key={index}
            className="block rounded-full flex-1"
            style={{
              height,
              maxHeight: 48,
              backgroundColor: index < playhead ? "var(--cog-gold)" : "var(--cog-gold-pale)",
              transition: "background-color 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const VoiceMemosPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pb-36"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Voice memos
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          Grace in the Waiting
        </p>

        <div className="flex flex-col gap-4">
          {MEMOS.map((memo) => (
            <MemoCard key={memo.id} memo={memo} />
          ))}
        </div>
      </div>

      {/* Sticky record button */}
      <div
        className="fixed bottom-0 px-6 pb-8 pt-4 w-full"
        style={{
          background: "linear-gradient(to top, var(--cog-cream) 70%, transparent 100%)",
          maxWidth: "var(--max-w-app)",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <button
          onClick={() => navigate(`/songs/${songId}/capture`)}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.40)",
          }}
        >
          <span className="flex items-center justify-center gap-2">
            <Mic size={18} strokeWidth={1.8} />
            Record new memo
          </span>
        </button>
      </div>
      <SongTabBar activeTab="voice" />
    </div>
  );
};

export default VoiceMemosPage;

