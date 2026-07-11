import { useState, useRef, useCallback } from "react";
import { Play, Pause, MoreHorizontal } from "lucide-react";
import type { VoiceMemoRecord } from "@/lib/voice/voiceApi";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { resolveWaveformBars } from "@/lib/canvas/waveformSeed";
import { formatDuration } from "@/lib/voice/audioFormat";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { audioCache } from "@/lib/voice/audioCache";

interface VoiceMemoListItemProps {
  memo: VoiceMemoRecord;
  creatorName: string;
  ageLabel: string;
  onDelete?: (id: string) => void;
}

const MINI_BAR_COUNT = 8;
const MINI_BAR_MAX_H = 12;

const VoiceMemoListItem = ({ memo, creatorName, ageLabel, onDelete }: VoiceMemoListItemProps) => {
  const color = getCreatorColor(creatorName);
  const initials = getCreatorInitials(creatorName);
  // Melody Lens precedence: contour (bars ride the tune) → real peaks → seed.
  const wave = resolveWaveformBars({
    seedId: memo.id,
    peaks: memo.waveform_peaks,
    contour: memo.pitch_contour,
    barCount: MINI_BAR_COUNT,
    maxHeight: MINI_BAR_MAX_H,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      const cached = await audioCache.get(memo.id);
      let url: string;

      if (cached) {
        url = URL.createObjectURL(cached);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
      } else {
        const signedUrl = await getSignedUrl(memo.id);
        url = signedUrl;
        audioCache.prefetch(memo.id, signedUrl);
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      audio.src = url;
      audio.ontimeupdate = () => setProgress(audio.currentTime / (audio.duration || 1));
      audio.onended = () => { setIsPlaying(false); setProgress(0); };
      await audio.play();
      setIsPlaying(true);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, memo.id]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        position: "relative",
      }}
    >
      {/* Mini waveform (static) — melody bars ride the tune via marginTop */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          height: MINI_BAR_MAX_H,
          flexShrink: 0,
          width: 32,
        }}
        aria-hidden="true"
      >
        {wave.bars.map((bar, i) => {
          const played = isPlaying && progress > i / MINI_BAR_COUNT;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(2, bar.height),
                marginTop: bar.top,
                borderRadius: 2,
                backgroundColor: played ? color.base : color.dim,
                opacity: bar.voiced ? 1 : 0.4,
              }}
            />
          );
        })}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            color: "#1A1A1A",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {memo.title}
        </p>
        <p
          style={{
            margin: "2px 0 0",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            color: "#999",
          }}
        >
          {formatDuration(memo.duration_ms)} · {ageLabel} · {creatorName}
        </p>
        {/* Progress bar (only when playing) */}
        {isPlaying && (
          <div
            style={{
              marginTop: 4,
              height: 2,
              borderRadius: 9999,
              backgroundColor: "rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                backgroundColor: color.base,
                borderRadius: 9999,
                transition: "width 200ms linear",
              }}
            />
          </div>
        )}
      </div>

      {/* Creator avatar */}
      <div
        style={{
          width: 24, height: 24, borderRadius: "50%",
          backgroundColor: color.base,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 700, color: "#FFF",
          flexShrink: 0,
        }}
        title={creatorName}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Play button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        style={{
          width: 30, height: 30, borderRadius: "50%",
          backgroundColor: color.base,
          color: "#FFF",
          border: "none", cursor: isLoading ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 2px 6px ${color.glow}`,
          flexShrink: 0,
          opacity: isLoading ? 0.6 : 1,
        }}
        aria-label={isPlaying ? `Pause ${memo.title}` : `Play ${memo.title}`}
      >
        {isLoading ? (
          <span style={{ fontSize: 10 }}>…</span>
        ) : isPlaying ? (
          <Pause size={12} fill="white" />
        ) : (
          <Play size={12} fill="white" style={{ marginLeft: 1 }} />
        )}
      </button>

      {/* More menu */}
      {onDelete && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              backgroundColor: "transparent",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#BBB",
            }}
            aria-label="More options"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 90 }}
                onClick={() => setShowMenu(false)}
                aria-hidden="true"
              />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 4px)",
                  zIndex: 91,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
                  padding: "4px 0",
                  minWidth: 120,
                }}
              >
                <button
                  type="button"
                  onClick={() => { onDelete(memo.id); setShowMenu(false); }}
                  style={{
                    display: "block", width: "100%",
                    padding: "9px 14px",
                    textAlign: "left",
                    fontFamily: "var(--font-body)",
                    fontSize: 13, color: "#E05440",
                    backgroundColor: "transparent", border: "none", cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceMemoListItem;
