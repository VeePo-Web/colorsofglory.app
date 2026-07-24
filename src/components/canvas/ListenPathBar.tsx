import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ListMusic, Play, Pause, X } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { PLAYBACK_TONE } from "@/lib/canvas/glorySpectrum";
import { formatDuration } from "@/lib/voice/audioFormat";
import { usePrefersReducedMotion } from "@/lib/canvas/features/usePrefersReducedMotion";

/**
 * ListenPathBar — F20 Listen Path transport.
 *
 * Two states:
 *  - COLLAPSED (default, incl. a saved path restored on a fresh visit): a
 *    compact pill above the tab bar. A restored full-height bar used to bury
 *    the Record dock and bottom navigation on every visit until the user
 *    destroyed their queue with Clear.
 *  - EXPANDED: the full transport (chips, prev/play/next, Clear/Save) with a
 *    one-tap collapse chevron that never clears the queue.
 *
 * Presentation only: the playback state machine (real sequenced audio,
 * auto-advance, dwell) lives in useListenPath — this bar is a controlled
 * transport over that hook.
 */
interface ListenPathBarProps {
  queue: string[];
  cards: CanvasBoardCard[];
  step: number;
  playing: boolean;
  collapsed: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStepTo: (index: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSave: () => void;
}

const ListenPathBar = ({
  queue,
  cards,
  step,
  playing,
  collapsed,
  onExpand,
  onCollapse,
  onPlayPause,
  onPrev,
  onNext,
  onStepTo,
  onRemove,
  onClear,
  onSave,
}: ListenPathBarProps) => {
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Entry: defer one frame so CSS transition fires.
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(queue.length > 0));
    return () => cancelAnimationFrame(t);
  }, [queue.length]);

  const cardMap = new Map(cards.map((c) => [c.id, c]));

  if (queue.length === 0) return null;

  if (collapsed) {
    return (
      <div
        role="toolbar"
        aria-label={`Listen Path — ${queue.length} ${queue.length === 1 ? "card" : "cards"}`}
        style={{
          position: "fixed",
          left: 16,
          // Sit ABOVE the centered creation dock (bottom +88, ~56px tall), not
          // in its band — at +84 this left pill painted over the dock's leftmost
          // button (Practice), since it's z-520 vs the dock's z-42. +148 matches
          // the Final-arrangement launcher so both side pills form a clean row
          // above the dock instead of occluding it.
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 148px)",
          zIndex: 520,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.94)",
          border: `1px solid ${PLAYBACK_TONE.dim}`,
          boxShadow: playing
            ? `0 4px 18px ${PLAYBACK_TONE.glow}`
            : "0 4px 16px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
          paddingLeft: 4,
          paddingRight: 4,
          transition: "box-shadow 240ms ease",
        }}
      >
        {/* The play control stays GOLD — primary actions are always gold
            (locked decision #5). Cobalt marks playback INDICATORS only. */}
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? "Pause listen path" : "Play listen path"}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "none", cursor: "pointer",
            backgroundColor: playing ? "var(--cog-gold, #B8953A)" : "rgba(184,149,58,0.12)",
            color: playing ? "#FFF" : "var(--cog-gold, #B8953A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background-color 180ms ease, color 180ms ease",
          }}
        >
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Open Listen Path — ${queue.length} ${queue.length === 1 ? "card" : "cards"}, stop ${step + 1}`}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            minHeight: 44, padding: "0 12px 0 4px",
            border: "none", background: "none", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 700,
            color: "var(--cog-charcoal, #1C1A17)",
          }}
        >
          <ListMusic size={14} strokeWidth={2} style={{ color: PLAYBACK_TONE.base }} aria-hidden="true" />
          Path · {queue.length}
        </button>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Listen Path"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 540,
        backgroundColor: "var(--cog-cream-light, #FAFAF6)",
        borderTop: "1px solid rgba(28,26,23,0.10)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
        borderRadius: "20px 20px 0 0",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: reducedMotion ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Drag handle */}
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 4,
          borderRadius: 9999,
          backgroundColor: "rgba(28,26,23,0.15)",
          margin: "10px auto 0",
        }}
      />

      {/* Screen readers hear each stop as playback advances. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
          overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
        }}
      >
        {playing && cardMap.get(queue[step])
          ? `Playing stop ${step + 1} of ${queue.length}: ${cardMap.get(queue[step])?.title}`
          : ""}
      </span>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px 4px",
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--cog-charcoal, #1C1A17)",
            letterSpacing: "0.03em",
          }}
        >
          Listen Path · {queue.length} {queue.length === 1 ? "card" : "cards"}
        </span>
        {/* Step counter */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            color: "var(--cog-warm-gray, #6B6459)",
          }}
        >
          {step + 1} / {queue.length}
        </span>
        {/* Clear */}
        <button
          type="button"
          onClick={onClear}
          style={{
            minHeight: 40,
            padding: "0 12px",
            borderRadius: 10,
            backgroundColor: "rgba(28,26,23,0.06)",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--cog-warm-gray, #6B6459)",
          }}
          aria-label="Clear listen path"
        >
          Clear
        </button>
        {/* Save */}
        <button
          type="button"
          onClick={onSave}
          style={{
            minHeight: 40,
            padding: "0 14px",
            borderRadius: 10,
            backgroundColor: "var(--cog-gold, #B8953A)",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 700,
            color: "#FFF",
            boxShadow: "0 2px 8px rgba(184,149,58,0.30)",
          }}
          aria-label="Save this listen path to replay later"
        >
          Save path
        </button>
        {/* Collapse — tuck the transport away WITHOUT clearing the queue */}
        <button
          type="button"
          onClick={onCollapse}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: "rgba(28,26,23,0.06)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--cog-warm-gray, #6B6459)",
          }}
          aria-label="Minimize the listen path"
        >
          <ChevronDown size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Horizontal chip scroll */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "4px 16px 8px",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        } as React.CSSProperties}
      >
        {queue.map((id, index) => {
          const card = cardMap.get(id);
          if (!card) return null;
          const isActive = index === step;
          return (
            <ChipItem
              key={id}
              card={card}
              index={index}
              isActive={isActive}
              // Playback speaks soft blue everywhere — chips match the
              // now-sounding ring and the on-card stop badges.
              color={{ base: PLAYBACK_TONE.base, glow: PLAYBACK_TONE.glow }}
              onTap={() => onStepTo(index)}
              onRemove={() => onRemove(id)}
            />
          );
        })}
      </div>

      {/* Transport controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 16px 4px",
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={step === 0}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "rgba(28,26,23,0.06)",
            border: "none",
            cursor: step === 0 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: step === 0 ? "rgba(28,26,23,0.25)" : "var(--cog-charcoal, #1C1A17)",
          }}
          aria-label="Previous card"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={onPlayPause}
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            backgroundColor: "var(--cog-gold, #B8953A)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFF",
            boxShadow: "0 4px 16px rgba(184,149,58,0.40)",
          }}
          aria-label={playing ? "Pause" : "Play listen path"}
        >
          {playing
            ? <Pause size={20} fill="white" />
            : <Play size={20} fill="white" style={{ marginLeft: 2 }} />}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={step === queue.length - 1}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "rgba(28,26,23,0.06)",
            border: "none",
            cursor: step === queue.length - 1 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: step === queue.length - 1
              ? "rgba(28,26,23,0.25)"
              : "var(--cog-charcoal, #1C1A17)",
          }}
          aria-label="Next card"
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

// ── Chip sub-component ────────────────────────────────────────────────────────

interface ChipItemProps {
  card: CanvasBoardCard;
  index: number;
  isActive: boolean;
  color: { base: string; glow: string };
  onTap: () => void;
  onRemove: () => void;
}

const ChipItem = ({ card, index, isActive, color, onTap, onRemove }: ChipItemProps) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onTap}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTap(); }}
    aria-label={`Step ${index + 1}: ${card.title}`}
    aria-pressed={isActive}
    style={{
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 6,
      height: 36,
      padding: "0 10px 0 6px",
      borderRadius: 18,
      backgroundColor: isActive ? `${color.base}18` : "rgba(28,26,23,0.05)",
      border: `1px solid ${isActive ? color.base + "50" : "transparent"}`,
      cursor: "pointer",
      transition: "background-color 160ms ease, border-color 160ms ease",
    }}
  >
    {/* Numbered badge */}
    <div
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        backgroundColor: color.base,
        color: "#FFF",
        fontSize: 10,
        fontWeight: 800,
        fontFamily: "var(--font-body)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {index + 1}
    </div>

    {/* Title */}
    <span
      style={{
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: isActive ? 700 : 500,
        color: "var(--cog-charcoal, #1C1A17)",
        maxWidth: 120,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {card.title}
    </span>

    {/* Duration (voice/hum cards only) */}
    {card.durationMs != null && (
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          color: "var(--cog-muted, #A09689)",
          flexShrink: 0,
        }}
      >
        {formatDuration(card.durationMs)}
      </span>
    )}

    {/* Remove — 28px visual, padded to a real touch target with clearance
        from the seek area so a thumb never seeks when it meant to remove */}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      aria-label={`Remove ${card.title} from path`}
      style={{
        width: 28,
        height: 28,
        marginLeft: 4,
        borderRadius: "50%",
        backgroundColor: "rgba(28,26,23,0.10)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--cog-warm-gray, #6B6459)",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <X size={12} strokeWidth={2.5} />
    </button>
  </div>
);

export default ListenPathBar;
