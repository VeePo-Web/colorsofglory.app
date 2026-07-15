import { useEffect, useRef, useState } from "react";
import { ChevronRight, Play, Pause, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/lib/voice/audioFormat";
import { claimSeedIdea, deleteSeedIdea, renameSeedIdea, type SeedIdeaRecord } from "@/lib/voice/seedIdeaApi";
import { audioCache } from "@/lib/voice/audioCache";
import { createSong } from "@/integrations/cog/songs";

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
  onDiscarded?: () => void;
  /** Fired when "Make it a song" births a NEW song from this idea. */
  onSongBorn?: (song: { id: string; title: string }) => void;
}

/**
 * SeedIdeaCard — a captured idea waiting for a home. Tapping "File into a
 * song" opens a lightweight picker that hands the idea to claimSeedIdea,
 * which uploads it through the existing voice memo pipeline and the card
 * disappears from the shelf — the idea now lives in that song's room.
 */
const SeedIdeaCard = ({ idea, songs, onClaimed, onDiscarded, onSongBorn }: SeedIdeaCardProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);

  // Rename in place — a captured idea can always be given a better name. Local
  // index only; the audio blob is untouched.
  const commitRename = async () => {
    setEditing(false);
    const next = title.trim();
    if (!next) { setTitle(idea.title); return; }
    if (next !== idea.title) await renameSeedIdea(idea.id, next);
  };
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bars = buildPreviewBars(idea.id, PREVIEW_BAR_COUNT);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  // Two-tap confirm — a captured idea is irreplaceable, so discard is never a
  // single accidental tap. First tap arms it ("Tap to remove") for 3s; second
  // tap removes. Kept visually subordinate to "File into a song" (benchmark:
  // discard must never be more prominent than save).
  const handleDiscard = async () => {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      confirmTimerRef.current = setTimeout(() => setConfirmDiscard(false), 3000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    try {
      audioRef.current?.pause();
      await deleteSeedIdea(idea.id);
      onDiscarded?.();
    } catch {
      toast.error("Couldn't remove that just now — it's still safe here.");
      setConfirmDiscard(false);
    }
  };

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

  // "Make it a song" — a brand-new writer with ideas but no songs shouldn't hit a
  // dead-end. Turn the idea straight into a new song (named after the idea) and
  // move the capture into it, so the very first tap has a home.
  const handleStartNewSong = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const songTitle = title.trim() || idea.title;
      const { song } = await createSong({ title: songTitle });
      await claimSeedIdea({ seedId: idea.id, songId: song.id });
      setPickerOpen(false);
      onClaimed?.();
      // The song was just BORN from its first capture — the one moment the
      // dedication offer may appear (after the idea is safe, never before).
      onSongBorn?.({ id: song.id, title: songTitle });
      toast.success(`Started “${songTitle}” from your idea`);
    } catch {
      setClaiming(false);
      toast.error("Couldn't start a song right now — your idea is still safe here.");
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
          // A single soft elevation so a captured hum reads as a tactile object
          // held on the shelf — not a flat list row. Restrained (COG uses one
          // gentle shadow for cards, never shadow-on-everything).
          boxShadow: "0 2px 10px rgba(28,26,23,0.05)",
          scrollSnapAlign: "start",
        }}
      >
        <div>
          {/* Play + waveform row — tap either to hear the idea from local cache */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
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

          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setTitle(idea.title); setEditing(false); }
              }}
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              className="font-bold leading-snug w-full"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--cog-charcoal)",
                // 16px so iOS never zooms the shelf when renaming.
                fontSize: 16,
                background: "transparent",
                border: "none",
                borderBottom: "1.5px solid var(--cog-gold)",
                outline: "none",
                padding: "1px 0",
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setTitle(idea.title); setEditing(true); }}
              className="font-bold text-[0.9375rem] leading-snug truncate w-full text-left"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--cog-charcoal)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "text",
              }}
              aria-label={`Rename ${title}`}
            >
              {title}
            </button>
          )}
          <p
            className="text-[0.75rem] mt-1"
            style={{ fontFamily: "var(--font-body)", color: "var(--cog-warm-gray)" }}
          >
            {formatDuration(idea.durationMs)} · {timeAgo(idea.createdAt)}
          </p>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-left transition-transform duration-150 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cog-gold)",
              background: "none",
              border: "none",
              padding: "6px 0",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            File into a song →
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            aria-label={confirmDiscard ? "Tap again to remove this idea" : "Discard idea"}
            className="transition-transform duration-150 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              fontWeight: 600,
              // Subordinate to "File" — muted until armed, then a gentle prompt.
              color: confirmDiscard ? "var(--cog-charcoal)" : "var(--cog-muted)",
              background: "none",
              border: "none",
              padding: "6px 4px",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {confirmDiscard ? "Tap to remove" : "Discard"}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <SongPickerSheet
          songs={songs}
          busy={claiming}
          onPick={handlePick}
          onStartNew={handleStartNewSong}
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
  onStartNew: () => void;
  onClose: () => void;
}

/**
 * SongPickerSheet — a minimal bottom sheet mirroring CaptureShell's frosted
 * backdrop + cream slide-up conventions. There's no shared "song picker"
 * pattern in the app yet, so this stays small and purpose-built: a scrollable
 * tappable list, nothing more.
 */
const SongPickerSheet = ({ songs, busy, onPick, onStartNew, onClose }: SongPickerSheetProps) => {
  const [visible, setVisible] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      {/* Frosted charcoal scrim (COG tokens, matching CaptureSheetShell) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 799,
          backgroundColor: "rgba(28,26,23,0.65)",
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
          maxHeight: "70dvh",
          backgroundColor: "var(--cog-cream-light)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(28,26,23,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          // Reduced motion: cross-fade in place instead of sliding up.
          ...(reduceMotion
            ? { opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }
            : {
                transform: visible ? "translateY(0)" : "translateY(100%)",
                transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
              }),
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 9999,
            backgroundColor: "var(--cog-border-light)",
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
          {/* "Make it a song" — always offered, so a first idea never dead-ends
              on an empty catalog. It leads because turning an idea into its own
              song is the most common intent for a brand-new writer. */}
          <button
            type="button"
            onClick={onStartNew}
            disabled={busy}
            className="w-full transition-transform duration-150 active:scale-[0.98]"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textAlign: "center",
              padding: "16px 14px",
              marginBottom: songs.length === 0 ? 4 : 14,
              borderRadius: 14,
              background: "var(--cog-gold-glow)",
              border: "1px solid var(--cog-border-gold)",
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Plus size={17} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
            Start a new song from this idea
          </button>

          {songs.length > 0 && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--cog-muted)",
                textAlign: "center",
                margin: "2px 0 12px",
              }}
            >
              or file into a song
            </p>
          )}

          {songs.length > 0 &&
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
            ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            margin: "8px 28px 0",
            minHeight: 44,
            padding: "0 20px",
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
