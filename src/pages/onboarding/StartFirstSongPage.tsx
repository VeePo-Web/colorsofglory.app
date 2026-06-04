import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const StartFirstSongPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [bpm, setBpm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = (mode: "create" | "skip") => {
    const songTitle = mode === "skip" || !title.trim() ? "Untitled Song" : title.trim();
    setIsSubmitting(true);

    sessionStorage.setItem(
      "cog:first-song",
      JSON.stringify({
        id: "1",
        title: songTitle,
        key: key || null,
        bpm: bpm || null,
        createdFrom: "onboarding",
      }),
    );

    setTimeout(() => {
      setIsSubmitting(false);
      navigate("/songs/1?first=1");
    }, 650);
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
            "radial-gradient(ellipse 70% 50% at 50% 90%, rgba(184,149,58,0.13) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate("/onboarding/intent")}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-8">
          <CogLogo size="sm" />
        </div>

        <h1
          className="text-4xl font-semibold mb-2 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Let's start your first song
        </h1>

        <p className="text-base mb-10 text-center" style={{ color: "var(--cog-warm-gray)" }}>
          Just the basics. You can add the rest inside.
        </p>

        <div className="mb-4">
          <label
            htmlFor="song-title"
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            Song title
          </label>
          <textarea
            id="song-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Name your song..."
            rows={3}
            className="w-full resize-none rounded-2xl px-4 py-4 text-xl font-semibold outline-none transition-all duration-150"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: title
                ? "1.5px solid var(--cog-gold)"
                : "1.5px solid var(--cog-border)",
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-display)",
              boxShadow: title ? "0 0 0 3px rgba(184,149,58,0.10)" : "none",
              lineHeight: 1.3,
            }}
          />
        </div>

        <div className="flex gap-3 mb-8">
          <div className="flex-1">
            <label
              htmlFor="song-key"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--cog-warm-gray)" }}
            >
              Key{" "}
              <span className="font-normal" style={{ color: "var(--cog-muted)" }}>
                (optional)
              </span>
            </label>
            <select
              id="song-key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className="w-full rounded-xl px-3 py-3.5 outline-none transition-all duration-150 appearance-none"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: key
                  ? "1.5px solid var(--cog-gold)"
                  : "1.5px solid var(--cog-border)",
                color: key ? "var(--cog-charcoal)" : "var(--cog-muted)",
                fontFamily: "var(--font-body)",
                fontSize: "0.9375rem",
              }}
            >
              <option value="">Key</option>
              {KEYS.map((songKey) => (
                <option key={songKey} value={songKey}>
                  {songKey}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label
              htmlFor="song-bpm"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--cog-warm-gray)" }}
            >
              BPM{" "}
              <span className="font-normal" style={{ color: "var(--cog-muted)" }}>
                (optional)
              </span>
            </label>
            <input
              id="song-bpm"
              type="number"
              inputMode="numeric"
              min={40}
              max={240}
              value={bpm}
              onChange={(event) => setBpm(event.target.value)}
              placeholder="120"
              className="w-full rounded-xl px-3 py-3.5 outline-none transition-all duration-150"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: bpm
                  ? "1.5px solid var(--cog-gold)"
                  : "1.5px solid var(--cog-border)",
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-body)",
                fontSize: "0.9375rem",
              }}
            />
          </div>
        </div>

        <button
          onClick={() => handleCreate("create")}
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50 mb-4"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
          }}
        >
          {isSubmitting ? "Creating..." : "Create song"}
        </button>

        <button
          onClick={() => handleCreate("skip")}
          disabled={isSubmitting}
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Skip for now
        </button>

        <div className="pb-10" />
      </div>
    </div>
  );
};

export default StartFirstSongPage;
