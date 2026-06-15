import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface ReviewAudioPlayerProps {
  src: string;
  /** Fallback duration (ms) until the audio element reports its own metadata. */
  durationMs?: number;
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
const ReviewAudioPlayer = ({ src, durationMs }: ReviewAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
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
          className="cog-scrub"
          style={{
            // gold fill up to the playhead, cream track after
            background: `linear-gradient(to right, var(--cog-gold) ${pct}%, rgba(184,149,58,0.20) ${pct}%)`,
          }}
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
          height: 4px;
          border-radius: 9999px;
          outline: none;
          cursor: pointer;
        }
        .cog-scrub::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--cog-gold);
          box-shadow: 0 1px 4px rgba(184,149,58,0.5);
          cursor: pointer;
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
};

export default ReviewAudioPlayer;
