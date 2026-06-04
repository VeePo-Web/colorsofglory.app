import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";

const SAVED_NOTES = [
  "Inspired by Psalm 46 â€” 'Be still and know'",
  "Bridge idea: needs more space emotionally",
  "Key change on final chorus works",
];

const NotesPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const [note, setNote] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    if (!note.trim()) return;
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setNote("");
  };

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
          Notes
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          Grace in the Waiting
        </p>

        {/* Notes textarea */}
        <div
          className="rounded-2xl mb-6 overflow-hidden"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border)",
          }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write a thought, prayer, scripture, or production note..."
            rows={8}
            className="w-full resize-none px-5 py-5 text-base leading-relaxed outline-none bg-transparent"
            style={{
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)",
            }}
          />
        </div>

        {/* Previous notes */}
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Previous notes
        </h2>

        <div className="flex flex-col gap-2.5">
          {SAVED_NOTES.map((savedNote, index) => (
            <div
              key={index}
              className="rounded-xl px-4 py-3.5"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1.5px solid var(--cog-border)",
              }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                {savedNote}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky save button */}
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
          onClick={handleSave}
          disabled={!note.trim()}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: isSaved ? "#53AB8B" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: note.trim() ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
          }}
        >
          {isSaved ? "Note saved" : "Save note"}
        </button>
      </div>
      <SongTabBar activeTab="notes" />
    </div>
  );
};

export default NotesPage;

