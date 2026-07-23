import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { polishAttach } from "@/lib/audio/enhance";

interface ReviewAudioPlayerProps {
  src: string;
  /** Fallback duration (ms) until the audio element reports its own metadata. */
  durationMs?: number;
  /** Fired when a section clip finishes or is interrupted (full-take play, seek). */
  onClipStop?: () => void;
  /**
   * The take's blob — lets the first listen play POLISHED (the music-safe
   * bus, loudness-leveled). Optional and strictly additive: without it (or
   * without Web Audio) playback is exactly as before.
   */
  blob?: Blob;
}

export interface ReviewAudioPlayerHandle {
  /**
   * Play just one section's slice of the take — seek to `startSec`, pause at
   * `endSec`. Derived + non-destructive: it's the same full-take element with
   * a stop point, so the raw recording is untouched.
   */
  playClip: (startSec: number, endSec: number) => void;
  stopClip: () => void;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * On-brand review scrubber — replaces the default gray <audio controls> with a
 * gold play/pause + keyboard-accessible range scrubber + time readout, so the
 * review sheet reads as intentional (Adobe / Apple Music standard) rather than
 * a raw browser widget.
 */
const ReviewAudioPlayer = forwardRef<ReviewAudioPlayerHandle, ReviewAudioPlayerProps>(
  ({ src, durationMs, onClipStop, blob }, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // End boundary (sec) of the section clip in flight, if any.
  const clipEndRef = useRef<number | null>(null);
  const onClipStopRef = useRef(onClipStop);
  onClipStopRef.current = onClipStop;
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = "metadata";
    audioRef.current = audio;

    const onMeta = () => {
      if (isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onTime = () => {
      setCurrent(audio.currentTime);
      const clipEnd = clipEndRef.current;
      if (clipEnd != null && audio.currentTime >= clipEnd) {
        audio.pause();
        clipEndRef.current = null;
        setPlaying(false);
        onClipStopRef.current?.();
      }
    };
    const onEnd = () => {
      setPlaying(false);
      if (clipEndRef.current != null) {
        clipEndRef.current = null;
        onClipStopRef.current?.();
      }
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
      clipEndRef.current = null;
    };
  }, [src]);

  const clearClip = () => {
    if (clipEndRef.current != null) {
      clipEndRef.current = null;
      onClipStopRef.current?.();
    }
  };

  useImperativeHandle(ref, () => ({
    playClip: (startSec: number, endSec: number) => {
      const audio = audioRef.current;
      if (!audio || endSec <= startSec) return;
      void polishAttach(audio, { memoId: src, blob });
      audio.currentTime = Math.max(0, startSec);
      clipEndRef.current = endSec;
      void audio.play().then(() => setPlaying(true)).catch(() => {
        clipEndRef.current = null;
        setPlaying(false);
        onClipStopRef.current?.();
      });
    },
    stopClip: () => {
      const audio = audioRef.current;
      if (audio && clipEndRef.current != null) audio.pause();
      clipEndRef.current = null;
      setPlaying(false);
      onClipStopRef.current?.();
    },
  }), [src, blob]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    // The main transport always plays the FULL take — leaving a clip window.
    clearClip();
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // Polish (strictly additive): the first listen plays through the
      // music-safe bus — the "recorded through COG sounds amazing" moment.
      // The object URL is unique per take, so it doubles as the profile key.
      void polishAttach(audio, { memoId: src, blob });
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    clearClip();
    audio.currentTime = value;
    setCurrent(value);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl mb-4"
      style={{
        padding: "12px 14px",
        background: "rgba(184,149,58,0.06)",
        border: "1px solid rgba(184,149,58,0.22)",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          background: "var(--cog-gold)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(184,149,58,0.35)",
        }}
      >
        {playing ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />}
      </button>

      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(current, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          // Without this a screen reader announces the raw seconds ("12.34");
          // aria-valuetext makes the transport position meaningful ("0:12 of 3:45").
          aria-valuetext={`${fmt(current)} of ${fmt(duration)}`}
          className="cog-scrub"
          // The gold-fill position rides a CSS var so the visible track can stay a
          // thin 4px line while the input itself is a tall, grabbable touch target.
          style={{ ["--fill" as string]: `${pct}%` }}
        />
        <div className="flex justify-between" style={{ marginTop: 4 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--cog-muted)", fontVariantNumeric: "tabular-nums" }}>
            {fmt(current)}
          </span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--cog-muted)", fontVariantNumeric: "tabular-nums" }}>
            {fmt(duration)}
          </span>
        </div>
      </div>

      <style>{`
        .cog-scrub {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          /* Tall, grabbable touch target for a thumb; the visible track stays thin
             (drawn on the track pseudo-elements below). */
          height: 22px;
          background: transparent;
          outline: none;
          cursor: pointer;
        }
        .cog-scrub::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 9999px;
          background: linear-gradient(to right, var(--cog-gold) var(--fill, 0%), rgba(184,149,58,0.20) var(--fill, 0%));
        }
        .cog-scrub::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          margin-top: -5px; /* centre the 14px thumb on the 4px track */
          border-radius: 50%;
          background: var(--cog-gold);
          box-shadow: 0 1px 4px rgba(184,149,58,0.5);
          cursor: pointer;
        }
        .cog-scrub::-moz-range-track {
          height: 4px;
          border-radius: 9999px;
          background: rgba(184,149,58,0.20);
        }
        .cog-scrub::-moz-range-progress {
          height: 4px;
          border-radius: 9999px;
          background: var(--cog-gold);
        }
        .cog-scrub::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border: none;
          border-radius: 50%;
          background: var(--cog-gold);
          box-shadow: 0 1px 4px rgba(184,149,58,0.5);
          cursor: pointer;
        }
        .cog-scrub:focus-visible {
          box-shadow: 0 0 0 3px rgba(184,149,58,0.30);
        }
      `}</style>
    </div>
  );
});

ReviewAudioPlayer.displayName = "ReviewAudioPlayer";

export default ReviewAudioPlayer;
