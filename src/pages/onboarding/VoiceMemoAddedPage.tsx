import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, FileText, Mic, Pause, Play, UserPlus, Waves } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BackHeader from "@/components/cog/BackHeader";
import { listMemosForSong, getPlaybackUrl } from "@/integrations/cog/memos";
import type { VoiceMemo } from "@/types";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";
import { getSong } from "@/lib/songContext";

/** Muted placeholder bars — shown only when the real memo has no stored peaks
 *  yet. Rendered pale, never presented as the recorded audio itself. */
const PLACEHOLDER_BARS = [18, 32, 24, 42, 28, 52, 36, 26, 46, 34, 22, 38, 30, 48, 26, 36, 20, 30];

const formatDuration = (ms: number | null) => {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Normalize stored waveform_peaks (array of numbers) into ~18 bar heights. */
const peaksToBars = (peaks: unknown): number[] | null => {
  if (!Array.isArray(peaks) || peaks.length === 0) return null;
  const nums = peaks.filter((p): p is number => typeof p === "number" && isFinite(p) && p >= 0);
  if (nums.length === 0) return null;
  const max = Math.max(...nums, 0.0001);
  const target = 18;
  const step = Math.max(1, Math.floor(nums.length / target));
  const bars: number[] = [];
  for (let i = 0; i < nums.length && bars.length < target; i += step) {
    bars.push(10 + (nums[i] / max) * 42);
  }
  return bars;
};

const VoiceMemoAddedPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  // Real title from the active-song bridge (session pointer); neutral fallback
  // so we never render a stranger's song name.
  const songTitle = useMemo(() => getSong(songId)?.title ?? "", [songId]);

  // The REAL first memo — no hardcoded fixture. Loaded via A3's memo SDK.
  const [memo, setMemo] = useState<VoiceMemo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMemosForSong(songId)
      .then((memos) => {
        if (cancelled) return;
        const latest = memos[0] ?? null;
        setMemo(latest);
        setLoading(false);
        // Never fake success: only mark the aha step when a real memo exists.
        // (The DB trigger on the voice_memo insert remains the source of truth;
        // this is the monotonic client-side belt-and-suspenders mark.)
        if (latest) updateOnboardingStep("first_voice_memo_added").catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  // Real playback of the real memo.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const handlePlay = async () => {
    if (!memo) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    try {
      if (!audioRef.current) {
        const url = await getPlaybackUrl(memo.id);
        const audio = new Audio(url);
        audio.onended = () => setPlaying(false);
        audioRef.current = audio;
      }
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };
  useEffect(() => () => audioRef.current?.pause(), []);

  // Subtle "you did it" reveal: the success badge gently pops in. Calm,
  // reverent — not confetti. Reduced-motion users get the final state instantly.
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduceMotion) { setShown(true); return; }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [reduceMotion]);

  const realBars = peaksToBars(memo?.waveform_peaks);
  const bars = realBars ?? PLACEHOLDER_BARS;
  const durationLabel = formatDuration(memo?.duration_ms ?? null);

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 52% at 50% 72%, var(--cog-gold-glow-18) 0%, transparent 68%)",
        }}
      />

      <BackHeader to={`/songs/${songId}`} label="Back" />

      <main
        className="relative mx-auto flex w-full flex-col justify-center px-6 pb-14 pt-4"
        style={{ maxWidth: "var(--max-w-app)", minHeight: "calc(100vh - 60px)" }}
      >
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <div
          className="mx-auto mb-8 flex items-center justify-center rounded-full"
          style={{
            width: 72,
            height: 72,
            backgroundColor: "var(--cog-gold-a12)",
            border: "1.5px solid var(--cog-gold-a30)",
            transform: shown ? "scale(1)" : "scale(0.82)",
            opacity: shown ? 1 : 0,
            transition: "transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 360ms ease",
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
          Your first idea is saved inside {songTitle || "your song"}.
        </p>

        {loading ? (
          <section
            className="rounded-2xl p-5 mb-8"
            style={{
              background: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
            }}
            aria-label="Loading your voice memo"
          >
            <div className="h-5 w-40 rounded-full mb-3" style={{ backgroundColor: "var(--cog-gold-a12)" }} />
            <div className="h-4 w-24 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.06)" }} />
          </section>
        ) : memo ? (
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
                    backgroundColor: "var(--cog-gold-a12)",
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
                    {memo.title || "First idea"}
                  </p>
                  <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                    {durationLabel ? `${durationLabel} · just now` : "just now"}
                  </p>
                </div>
              </div>
              <button
                onClick={handlePlay}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-95"
                style={{
                  backgroundColor: "var(--cog-gold)",
                  color: "#fff",
                  boxShadow: "0 4px 16px var(--cog-gold-a30)",
                }}
                aria-label={playing ? "Pause memo" : "Play saved memo"}
              >
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
            </div>

            <div className="flex h-16 items-center gap-1.5" aria-hidden>
              {bars.map((height, index) => (
                <span
                  key={index}
                  className="block w-1 rounded-full"
                  style={{
                    height,
                    backgroundColor: realBars ? "var(--cog-gold)" : "var(--cog-gold-pale)",
                  }}
                />
              ))}
            </div>
          </section>
        ) : (
          // No memo found (e.g. a deep link before the first capture) — never
          // show a fake memo; guide back into the real recorder instead.
          <section
            className="rounded-2xl p-5 mb-8 text-center"
            style={{
              background: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
              No voice memo here yet — tap the gold mic in your song to capture the first idea.
            </p>
          </section>
        )}

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
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-[0.97] mb-3"
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

        {/* Collaboration is the growth loop — a quiet, optional door into the
            invite moment (B3 owns send/token/accept; /people is the seam). */}
        <button
          onClick={() => navigate(`/songs/${songId}/people`)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          <UserPlus size={15} strokeWidth={1.5} />
          Invite a collaborator
        </button>

        {/* Calm terminal dismiss — a non-dead-end exit from the guided journey.
            `dismissed` is terminal in the step machine; routeAfterAuth sends
            dismissed users to /home from then on. */}
        <button
          onClick={() => {
            updateOnboardingStep("dismissed").catch(() => {});
            navigate(`/songs/${songId}`);
          }}
          className="w-full py-2 text-xs transition-opacity hover:opacity-70 underline"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
        >
          I'll finish setting up later
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--cog-muted)" }}>
          <Waves size={14} strokeWidth={1.5} />
          Saved to this song room
        </div>
      </main>
    </div>
  );
};

export default VoiceMemoAddedPage;
