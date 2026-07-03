import { useEffect, useRef, useState } from "react";
import { ChevronRight, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/lib/voice/audioFormat";
import { claimSeedIdea, type SeedIdeaRecord } from "@/lib/voice/seedIdeaApi";
import { audioCache } from "@/lib/voice/audioCache";

// Re-use waveform seed pattern from VoiceReviewSheet — here seeded with the
// idea's id (a seed has no blob at list-render time, only its index record).
function buildPreviewBars(seed: string, count: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    let h = 0;
    for (let j = 0; j < seed.length; j++) {
      h += seed.charCodeAt(j) * (i + 1) * (j + 1);
    }
    const t = i / (count - 1);
    const envelope = 1 - Math.abs(t - 0.5) * 1.4;
    const wave = Math.sin(i * 0.8 + (h % 100) * 0.06) * 0.35 + 0.5;
    bars.push(Math.max(0.1, Math.min(1, wave * envelope + 0.1)));
  }
  return bars;
}

// Mirrors VoiceLayerPanel's relative-time pattern — kept local since it's a
// one-line pure function and the two call sites have no shared module today.
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const PREVIEW_BAR_COUNT = 18;
const PREVIEW_BAR_MAX_H = 28;
const CARD_WIDTH = 216;

export interface SeedIdeaCardSong {
  id: string;
  title: string;
}

interface SeedIdeaCardProps {
  idea: SeedIdeaRecord;
  songs: SeedIdeaCardSong[];
  onClaimed?: () => void;
}

/**
 * SeedIdeaCard — a captured idea waiting for a home. Tapping "File into a
 * song" opens a lightweight picker that hands the idea to claimSeedIdea,
 * which uploads it through the existing voice memo pipeline and the card
 * disappears from the shelf — the idea now lives in that song's room.
 */
const SeedIdeaCard = ({ idea, songs, onClaimed }: SeedIdeaCardProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const bars = buildPreviewBars(idea.id, PREVIEW_BAR_COUNT);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  // Hear the spark before deciding its home — plays instantly from the local
  // cache (the seed's blob lives in audioCache until it's filed). Offline-safe.
  const togglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      const blob = await audioCache.get(idea.id);
      if (!blob) {
        toast.error("This idea's audio isn't on this device.");
        return;
      }
      const url = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.src = url;
      audio.onended = () => setIsPlaying(false);
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handlePick = async (songId: string) => {
    if (claiming) return;
    setClaiming(true);
    try {
      await claimSeedIdea({ seedId: idea.id, songId });
      setPickerOpen(false);
      onClaimed?.();
    } catch {
      setClaiming(false);
      toast.error("Couldn't file that idea right now — it's still safe and waiting here.");
    }
  };

  return (
    <>
      <div
        className="flex-shrink-0 flex flex-col justify-between"
        style={{
          width: CARD_WIDTH,
          minHeight: 156,
          padding: 16,
          borderRadius: 16,
          background: "var(--cog-cream-light)",
          border: "1px solid var(--cog-border)",
          scrollSnapAlign: "start",
        }}
      >
        <div>
          {/* Play + waveform row — tap either to hear the idea from local cache */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? `Pause ${idea.title}` : `Play ${idea.title}`}
              style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                backgroundColor: "var(--cog-gold)",
                color: "#FFF",
                border: "none",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(184,149,58,0.30)",
                transition: "transform 120ms ease",
              }}
              onMouseDown={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(0.94)")}
              onMouseUp={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>
            <div
              onClick={togglePlay}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: PREVIEW_BAR_MAX_H,
                cursor: "pointer",
              }}
              aria-hidden="true"
            >
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: Math.round(h * PREVIEW_BAR_MAX_H),
                    borderRadius: 2,
                    backgroundColor: isPlaying ? "var(--cog-gold)" : "var(--cog-gold-pale)",
                    opacity: h * 0.6 + 0.25,
                    transition: "background-color 150ms ease",
                  }}
                />
              ))}
            </div>
          </div>

          <p
            className="font-bold text-[0.9375rem] leading-snug truncate"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
          >
            {idea.title}
          </p>
          <p
            className="text-[0.75rem] mt-1"
            style={{ fontFamily: "var(--font-body)", color: "var(--cog-warm-gray)" }}
          >
            {formatDuration(idea.durationMs)} · {timeAgo(idea.createdAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-3 self-start text-left transition-transform duration-150 active:scale-[0.97]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cog-gold)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          File into a song →
        </button>
      </div>

      {pickerOpen && (
        <SongPickerSheet
          songs={songs}
          busy={claiming}
          onPick={handlePick}
          onClose={() => {
            if (!claiming) setPickerOpen(false);
          }}
        />
      )}
    </>
  );
};

interface SongPickerSheetProps {
  songs: SeedIdeaCardSong[];
  busy: boolean;
  onPick: (songId: string) => void;
  onClose: () => void;
}

/**
 * SongPickerSheet — a minimal bottom sheet mirroring CaptureShell's frosted
 * backdrop + cream slide-up conventions. There's no shared "song picker"
 * pattern in the app yet, so this stays small and purpose-built: a scrollable
 * tappable list, nothing more.
 */
const SongPickerSheet = ({ songs, busy, onPick, onClose }: SongPickerSheetProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      {/* Frosted backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.65)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a song for this idea"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 800,
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 9999,
            backgroundColor: "#CCC",
            margin: "12px auto 0",
            flexShrink: 0,
          }}
          aria-hidden="true"
        />

        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 17,
            fontWeight: 700,
            color: "var(--cog-charcoal)",
            textAlign: "center",
            margin: "16px 28px 4px",
          }}
        >
          File this idea into…
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--cog-warm-gray)",
            textAlign: "center",
            margin: "0 28px 16px",
          }}
        >
          It lands as a voice memo in that song's room.
        </p>

        <div style={{ overflowY: "auto", padding: "0 16px" }}>
          {songs.length === 0 ? (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--cog-warm-gray)",
                textAlign: "center",
                padding: "20px 12px 28px",
              }}
            >
              Start a song first — then your captured ideas can move in.
            </p>
          ) : (
            songs.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => onPick(song.id)}
                disabled={busy}
                className="w-full transition-transform duration-150 active:scale-[0.98]"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                  padding: "16px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  background: "var(--cog-cream-light)",
                  border: "1px solid var(--cog-border)",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--cog-charcoal)",
                  }}
                >
                  {song.title}
                </span>
                <ChevronRight size={18} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            margin: "8px 28px 0",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--cog-warm-gray)",
            background: "none",
            border: "none",
            cursor: busy ? "not-allowed" : "pointer",
            alignSelf: "center",
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

export default SeedIdeaCard;
