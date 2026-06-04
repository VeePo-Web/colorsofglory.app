import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import BackHeader from "@/components/cog/BackHeader";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface ChordChartRow {
  label: string;   // e.g. "Verse 1"
  chords: string[];
}

const MOCK_CHART: ChordChartRow[] = [
  { label: "Intro",   chords: ["C", "G", "Am", "F"] },
  { label: "Verse 1", chords: ["C", "G", "Am", "F"] },
  { label: "Chorus",  chords: ["F", "G", "Am", "C"] },
  { label: "Bridge",  chords: ["Am", "F", "C", "G"] },
];

const ChordsPage = () => {
  const { id } = useParams<{ id: string }>();
  const songTitle = useSongTitle(id);
  const [key, setKey] = useState("C");
  const [bpm, setBpm] = useState("74");
  const [chart] = useState<ChordChartRow[]>(MOCK_CHART);

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 88 }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 65%)",
        }}
      />

      <BackHeader to={`/songs/${id}`} label="Song" />

      <div
        className="relative flex flex-col flex-1 px-5"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Logo + title */}
        <div className="flex justify-center mt-1 mb-4">
          <CogLogo size="sm" />
        </div>

        <h1
          className="text-2xl font-semibold text-center mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.2 }}
        >
          {songTitle}
        </h1>
        <p className="text-xs text-center mb-5" style={{ color: "var(--cog-muted)" }}>
          Chord chart
        </p>

        {/* Key + BPM row */}
        <div
          className="flex gap-3 mb-6 rounded-2xl p-4"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1px solid var(--cog-border)",
          }}
        >
          {/* Key picker */}
          <div className="flex-1">
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--cog-warm-gray)" }}>
              Key
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CHROMATIC.map((k) => (
                <button
                  key={k}
                  onClick={() => setKey(k)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-90"
                  style={{
                    backgroundColor:
                      key === k ? "var(--cog-gold)" : "rgba(28,26,23,0.06)",
                    color: key === k ? "#fff" : "var(--cog-warm-gray)",
                    border: key === k
                      ? "1px solid var(--cog-gold)"
                      : "1px solid transparent",
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* BPM */}
          <div style={{ minWidth: 72 }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--cog-warm-gray)" }}>
              BPM
            </p>
            <input
              type="number"
              inputMode="numeric"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-full rounded-xl px-2 py-2 text-center text-sm font-semibold outline-none transition-all duration-150"
              style={{
                backgroundColor: "rgba(184,149,58,0.08)",
                border: "1px solid rgba(184,149,58,0.25)",
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-body)",
              }}
              min={40}
              max={240}
            />
          </div>
        </div>

        {/* Chord chart sections */}
        <div className="flex flex-col gap-3 mb-6">
          {chart.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1px solid var(--cog-border)",
              }}
            >
              {/* Section label */}
              <p
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
              >
                {row.label}
              </p>

              {/* Chord chips */}
              <div className="flex gap-2 flex-wrap">
                {row.chords.map((chord, idx) => (
                  <span
                    key={`${chord}-${idx}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--cog-gold-pale)",
                      color: "var(--cog-charcoal)",
                      border: "1px solid rgba(184,149,58,0.30)",
                      fontFamily: "var(--font-body)",
                      minWidth: 40,
                      justifyContent: "center",
                    }}
                  >
                    {chord}
                  </span>
                ))}

                {/* Beat count indicator */}
                <span
                  className="inline-flex items-center px-2 py-1.5 rounded-xl text-[10px] font-medium ml-auto"
                  style={{
                    backgroundColor: "rgba(28,26,23,0.05)",
                    color: "var(--cog-muted)",
                  }}
                >
                  4 beats each
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add section ghost button */}
        <button
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-[0.97]"
          style={{
            border: "1.5px dashed rgba(184,149,58,0.35)",
            color: "var(--cog-gold-alt)",
            backgroundColor: "rgba(184,149,58,0.04)",
            fontFamily: "var(--font-body)",
          }}
        >
          <Plus size={16} strokeWidth={2} />
          Add section
        </button>
      </div>

      <SongTabBar activeTab="chords" />
    </div>
  );
};

export default ChordsPage;
