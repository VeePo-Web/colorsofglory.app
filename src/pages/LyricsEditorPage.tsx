import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mic, Plus } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

type Tab = "Lyrics" | "Chords" | "Voice" | "Notes";

interface SongSection {
  label: string;
  chords: string[];
  lyrics: string;
}

const INITIAL_SECTIONS: SongSection[] = [
  {
    label: "Verse 1",
    chords: ["C", "G", "Am"],
    lyrics:
      "Grace in the waiting, peace in the storm\nYour hand holds me steady when my heart is worn\nI breathe in the silence, I rest in your name\nEven in darkness, you stay just the same",
  },
  {
    label: "Chorus",
    chords: ["G", "D", "Em"],
    lyrics:
      "You are the anchor, you are my song\nEvery note of my life you have written all along\nColors of glory, flooding my sight\nAll of my shadows overcome by your light",
  },
];

const ChordChip = ({ label }: { label: string }) => (
  <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mr-1.5 mb-1"
    style={{
      backgroundColor: "var(--cog-gold-pale)",
      color: "var(--cog-charcoal)",
      border: "1px solid rgba(184,149,58,0.28)",
      fontFamily: "var(--font-body)",
    }}
  >
    {label}
  </span>
);

const LyricsEditorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const [activeTab, setActiveTab] = useState<Tab>("Lyrics");
  const [sections, setSections] = useState<SongSection[]>(INITIAL_SECTIONS);
  const [saved, setSaved] = useState(true);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleLyricsChange = (index: number, value: string) => {
    setSaved(false);
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], lyrics: value };
      return next;
    });
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(() => setSaved(true), 1200);
    setSaveTimer(t);
  };

  const tabs: Tab[] = ["Lyrics", "Chords", "Voice", "Notes"];

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
        className="relative flex flex-col flex-1"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="px-6 pt-14 pb-4">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 mb-6"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>

          <div className="flex justify-center mb-5">
            <CogLogo size="sm" />
          </div>

          {/* Song title + autosave */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <h1
              className="font-semibold leading-tight flex-1"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--cog-charcoal)",
                fontSize: "clamp(1.75rem, 7vw, 2.5rem)",
                lineHeight: 1.1,
              }}
            >
              {songTitle}
            </h1>
            <div
              className="flex items-center gap-1.5 mt-1.5 flex-shrink-0"
              style={{ color: saved ? "var(--cog-gold)" : "var(--cog-muted)" }}
            >
              {saved ? (
                <>
                  <CheckCircle2 size={14} strokeWidth={2} />
                  <span className="text-xs font-medium" style={{ fontFamily: "var(--font-body)" }}>
                    Saved
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium" style={{ fontFamily: "var(--font-body)" }}>
                  Saving…
                </span>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div
            className="flex gap-0 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--cog-cream-dark)",
              padding: "3px",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-150"
                style={{
                  fontFamily: "var(--font-body)",
                  backgroundColor: activeTab === tab ? "var(--cog-cream-light)" : "transparent",
                  color: activeTab === tab ? "var(--cog-gold)" : "var(--cog-warm-gray)",
                  boxShadow: activeTab === tab ? "0 1px 4px rgba(28,26,23,0.08)" : "none",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="flex-1 px-6 pb-36 overflow-y-auto">
          {sections.map((section, index) => (
            <div key={section.label} className="mb-8">
              {/* Section label */}
              <h2
                className="text-lg font-semibold mb-2"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--cog-charcoal)",
                }}
              >
                {section.label}
              </h2>

              {/* Chord chips */}
              <div className="flex flex-wrap mb-3">
                {section.chords.map((chord) => (
                  <ChordChip key={chord} label={chord} />
                ))}
              </div>

              {/* Lyrics textarea */}
              <textarea
                value={section.lyrics}
                onChange={(e) => handleLyricsChange(index, e.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl px-4 py-4 text-base leading-relaxed outline-none transition-all duration-150"
                style={{
                  backgroundColor: "var(--cog-cream-light)",
                  border: "1.5px solid transparent",
                  color: "var(--cog-charcoal)",
                  fontFamily: "var(--font-body)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1.5px solid var(--cog-gold)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(184,149,58,0.10)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1.5px solid transparent";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          ))}
        </div>

        {/* Sticky bottom actions */}
        <div
          className="fixed bottom-0 px-6 pb-8 pt-4 w-full"
          style={{
            background: "linear-gradient(to top, var(--cog-cream) 70%, transparent 100%)",
            maxWidth: "var(--max-w-app)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex gap-3">
            <button
              className="flex-1 py-3.5 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-[0.97]"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1.5px solid var(--cog-border)",
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-body)",
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Plus size={15} strokeWidth={2} />
                Add section
              </span>
            </button>
            <button
              onClick={() => navigate(`/songs/${songId}/voice`)}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97]"
              style={{
                backgroundColor: "var(--cog-gold)",
                fontFamily: "var(--font-body)",
                boxShadow: "0 4px 16px rgba(184,149,58,0.30)",
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Mic size={15} strokeWidth={2} />
                Record idea
              </span>
            </button>
          </div>
        </div>
      </div>
      <SongTabBar activeTab="lyrics" />
    </div>
  );
};

export default LyricsEditorPage;
