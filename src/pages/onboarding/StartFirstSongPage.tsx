import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import OnboardingProgress from "@/components/cog/OnboardingProgress";
import { setSong } from "@/lib/songContext";
import { supabase } from "@/integrations/supabase/client";
import { createSong } from "@/integrations/cog/songs";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const fieldStyle = (active: boolean): React.CSSProperties => ({
  backgroundColor: "var(--cog-cream-light)",
  border: active ? "1.5px solid var(--cog-gold)" : "1.5px solid var(--cog-border)",
  color: "var(--cog-charcoal)",
  boxShadow: active ? "0 0 0 3px var(--cog-gold-a10)" : "0 1px 3px rgba(0,0,0,0.04)",
  outline: "none",
  transition: "border 150ms, box-shadow 150ms",
  fontFamily: "var(--font-body)",
  fontSize: "0.9375rem",
  caretColor: "var(--cog-gold)",
});

const StartFirstSongPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [bpm, setBpm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (mode: "create" | "skip") => {
    const songTitle = mode === "skip" || !title.trim() ? "Untitled Song" : title.trim();
    setIsSubmitting(true);
    setError(null);

    // Resolve the signed-in user. A network failure resolving the session is
    // treated as "no session" so the demo/preview path still works offline.
    let user: { id: string } | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }

    if (user) {
      // Authenticated: create the REAL song through A3's createSong edge
      // function (ownership, membership, and quotas handled server-side).
      // If it fails, surface a retryable error — never silently drop the user
      // onto demo song "1" (which isn't theirs), making them think a song was
      // created when it wasn't.
      try {
        const { song } = await createSong({
          title: songTitle,
          key_signature: key || undefined,
          tempo_bpm: bpm ? parseInt(bpm, 10) : undefined,
        });

        // First-song pointer lets routeAfterAuth resume INSIDE this song.
        // (createSong doesn't set it — profile writes stay client-side.)
        await supabase.from("profiles").update({
          first_song_id: song.id,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).then(() => {}, () => {});

        updateOnboardingStep("first_song_created").catch(() => {});

        setSong({ id: song.id, title: song.title, key: key || null, bpm: bpm || null });
        sessionStorage.setItem("cog:first-song", JSON.stringify({ id: song.id, title: song.title, key, bpm }));

        // Land in the song's REAL mic-first capture (C2's recorder).
        navigate(`/songs/${song.id}`);
      } catch (err) {
        console.error("[StartFirstSong] song creation failed:", err);
        setError("We couldn't create your song just now. Please try again.");
        setIsSubmitting(false);
      }
      return;
    }

    // No auth session — the demo/preview branch is DEV-ONLY and must never
    // reach production: in prod an unauthenticated user goes to sign-in.
    if (import.meta.env.DEV) {
      setSong({ id: "1", title: songTitle, key: key || null, bpm: bpm || null });
      sessionStorage.setItem("cog:first-song", JSON.stringify({ id: "1", title: songTitle, key, bpm }));
      setIsSubmitting(false);
      navigate("/songs/1");
      return;
    }
    setIsSubmitting(false);
    navigate("/auth/login");
  };

  return (
    <OnboardingShell>
      {/* Back */}
      <div className="pt-14 pb-2">
        <button
          onClick={() => navigate("/onboarding/intent")}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "var(--cog-muted)", minHeight: 44 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
      </div>

      {/* Logo */}
      <div className="pb-5 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Momentum cue */}
      <OnboardingProgress step={2} total={2} className="mb-7" />

      {/* Headline — matches reference image exactly */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
      >
        Let's start your first song
      </h1>
      <p className="text-[1rem] text-center mb-8" style={{ color: "var(--cog-warm-gray)" }}>
        Just the basics. You can add the rest inside.
      </p>

      {/* Song title — large, dominant field */}
      <div className="mb-4">
        <label
          htmlFor="song-title"
          className="block text-[0.875rem] font-medium mb-2"
          style={{ color: "var(--cog-warm-gray)" }}
        >
          Song title
        </label>
        <input
          id="song-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !isSubmitting) handleCreate("create"); }}
          placeholder="Name your song..."
          autoFocus
          enterKeyHint="go"
          className="w-full rounded-2xl px-4 text-[1.1875rem] font-semibold"
          style={{
            ...fieldStyle(!!title),
            height: 72,
            fontFamily: "var(--font-display)",
          }}
        />
      </div>

      {/* Key + BPM row */}
      <div className="flex gap-3 mb-8">
        <div className="flex-1">
          <label htmlFor="song-key" className="block text-[0.875rem] font-medium mb-2" style={{ color: "var(--cog-warm-gray)" }}>
            Key <span style={{ color: "var(--cog-muted)", fontWeight: 400 }}>(optional)</span>
          </label>
          <select
            id="song-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-xl px-3 appearance-none"
            style={{ ...fieldStyle(!!key), height: 52, color: key ? "var(--cog-charcoal)" : "var(--cog-muted)" }}
          >
            <option value="">Key</option>
            {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="song-bpm" className="block text-[0.875rem] font-medium mb-2" style={{ color: "var(--cog-warm-gray)" }}>
            BPM <span style={{ color: "var(--cog-muted)", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="song-bpm"
            type="number"
            inputMode="numeric"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            placeholder="120"
            className="w-full rounded-xl px-3"
            style={{ ...fieldStyle(!!bpm), height: 52 }}
          />
        </div>
      </div>

      {/* Error — retryable, never a silent drop onto the wrong song */}
      {error && (
        <p
          className="text-sm text-center mb-4"
          style={{ color: "var(--cog-record-red)" }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      {/* Create song — pill CTA */}
      <GoldButton
        loading={isSubmitting}
        loadingText="Creating..."
        onClick={() => handleCreate("create")}
      >
        Create song
      </GoldButton>

      {/* Skip */}
      <button
        onClick={() => handleCreate("skip")}
        disabled={isSubmitting}
        className="text-[0.9375rem] text-center w-full py-4 transition-opacity hover:opacity-70 disabled:opacity-40 underline"
        style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
      >
        Skip for now
      </button>
    </OnboardingShell>
  );
};

export default StartFirstSongPage;
