import { memo, useMemo, useRef, useState, useCallback } from "react";
import { Mic, Play, Pause, Pencil } from "lucide-react";
import CardShell, { type CardInteractionState } from "./CardShell";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import {
  generateWaveform,
  MAX_BAR_HEIGHT,
  BAR_WIDTH,
  BAR_GAP,
  VOICE_BAR_COUNT,
} from "@/lib/canvas/waveformSeed";

export interface VoiceMemoCardData {
  id: string;
  x: number;
  y: number;
  title: string;
  section: string;
  duration: string;
  contributor: string;
  audioUrl?: string;
  age?: string;
  isDimmedReference?: boolean;
  hasBeenPlayed?: boolean;
}

interface VoiceMemoCardProps {
  card: VoiceMemoCardData;
  selected: boolean;
  isDragging?: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMoveToFinal?: () => void;
  onMoveToIdeas?: () => void;
}

const LS_PLAYED_KEY = (id: string) => `cog:played-${id}`;

/**
 * VoiceMemoCard — the canvas card for recorded voice memos.
 *
 * Features:
 *  - 20 deterministic waveform bars from card.id seed
 *  - Height-based opacity (shorter bars = more transparent)
 *  - Creator aurora color fills bars
 *  - "Not yet played" pulse dot (disappears after first play)
 *  - Expanded state: mini audio player with play/pause toggle
 */
const VoiceMemoCard = memo(({
  card,
  selected,
  isDragging = false,
  isNew = false,
  onSelect,
  onPointerDown,
  onMoveToFinal,
  onMoveToIdeas,
}: VoiceMemoCardProps) => {
  const color = getCreatorColor(card.contributor);
  const initials = getCreatorInitials(card.contributor);
  const barHeights = useMemo(() => generateWaveform(card.id, VOICE_BAR_COUNT), [card.id]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(
    () => !!localStorage.getItem(LS_PLAYED_KEY(card.id)) || card.hasBeenPlayed
  );
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) {
      if (card.audioUrl) {
        audioRef.current = new Audio(card.audioUrl);
        audioRef.current.ontimeupdate = () => {
          const a = audioRef.current!;
          setProgress(a.currentTime / (a.duration || 1));
        };
        audioRef.current.onended = () => { setIsPlaying(false); setProgress(0); };
      }
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        if (!hasPlayed) {
          setHasPlayed(true);
          localStorage.setItem(LS_PLAYED_KEY(card.id), "1");
        }
      }
    } else {
      // No audio URL — still mark as played for demo
      setHasPlayed(true);
      localStorage.setItem(LS_PLAYED_KEY(card.id), "1");
    }
  }, [card.audioUrl, card.id, isPlaying, hasPlayed]);

  const state: CardInteractionState = card.isDimmedReference
    ? "dimmed"
    : isDragging ? "dragging"
    : selected ? "selected"
    : "default";

  const totalBarsPx = VOICE_BAR_COUNT * BAR_WIDTH + (VOICE_BAR_COUNT - 1) * BAR_GAP;

  return (
    <CardShell
      color={color}
      state={state}
      isNew={isNew}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      aria-label={`Voice memo: ${card.title} by ${card.contributor}, ${card.duration}`}
      style={{ left: card.x, top: card.y } as React.CSSProperties}
    >
      {/* Creator dot + unplayed pulse dot */}
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 5 }}>
        {!hasPlayed && (
          <div
            aria-label="Not yet played"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: color.base,
              animation: "card-pulse-dot 2s ease-in-out infinite",
            }}
          />
        )}
        <div
          style={{
            width: 22, height: 22, borderRadius: "50%",
            backgroundColor: color.base,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, color: "#FFF",
          }}
          title={card.contributor}
          aria-hidden="true"
        >
          {initials}
        </div>
      </div>

      {/* Icon + section */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: 7,
            backgroundColor: color.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Mic size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", fontFamily: "var(--font-body)" }}>
          {card.section}
        </span>
      </div>

      {/* Title + duration row */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", fontFamily: "var(--font-display)", lineHeight: 1.2, flex: 1, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        <span style={{ fontSize: 10, color: "#999", fontFamily: "var(--font-body)", flexShrink: 0 }}>
          {card.duration}
        </span>
      </div>

      {/* Waveform bars */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: BAR_GAP,
          height: MAX_BAR_HEIGHT,
          width: totalBarsPx,
          marginBottom: 8,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => {
          const isPlayed = isPlaying && progress > i / VOICE_BAR_COUNT;
          return (
            <div
              key={i}
              style={{
                width: BAR_WIDTH,
                height: Math.round(h * MAX_BAR_HEIGHT),
                borderRadius: 3,
                backgroundColor: color.base,
                opacity: isPlayed ? h * 0.7 + 0.3 : (h * 0.5 + 0.15),
                flexShrink: 0,
                transition: "height 80ms ease, opacity 80ms ease",
              }}
            />
          );
        })}
      </div>

      {/* Progress bar (shows when expanded/playing) */}
      {selected && (
        <div
          style={{
            height: 4,
            borderRadius: 9999,
            backgroundColor: "rgba(0,0,0,0.07)",
            marginBottom: 9,
            overflow: "hidden",
            cursor: "pointer",
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

      {/* Footer: age + play button when selected */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#BBB", fontFamily: "var(--font-body)" }}>
          {card.section} · {card.age ?? "Just now"}
        </span>
        {selected && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={togglePlay}
              style={{
                width: 30, height: 30, borderRadius: "50%",
                backgroundColor: color.base,
                color: "#FFF",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 2px 8px ${color.glow}`,
                flexShrink: 0,
              }}
              aria-label={isPlaying ? "Pause" : `Play ${card.title}`}
            >
              {isPlaying
                ? <Pause size={13} fill="white" />
                : <Play size={13} fill="white" style={{ marginLeft: 1 }} />
              }
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#999", display: "flex", alignItems: "center", gap: 3,
                fontSize: 10, fontFamily: "var(--font-body)",
              }}
            >
              <Pencil size={11} strokeWidth={1.5} />
              Rename
            </button>
          </div>
        )}
      </div>

      {/* Action bar */}
      {selected && !card.isDimmedReference && (
        <div
          style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${color.base}18`, display: "flex", gap: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveToFinal && (
            <button
              onClick={onMoveToFinal}
              style={{ flex: 1, height: 30, borderRadius: 8, backgroundColor: color.base, color: "#FFF", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
            >
              → Final
            </button>
          )}
          {onMoveToIdeas && (
            <button
              onClick={onMoveToIdeas}
              style={{ flex: 1, height: 30, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
            >
              ← Ideas
            </button>
          )}
        </div>
      )}
    </CardShell>
  );
});

VoiceMemoCard.displayName = "VoiceMemoCard";

export default VoiceMemoCard;
