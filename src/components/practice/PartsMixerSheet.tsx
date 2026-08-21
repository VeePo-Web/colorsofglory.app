import { Volume2, VolumeX } from "lucide-react";
import TrappedDialog from "@/components/canvas/TrappedDialog";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import type { SingItTimeline } from "@/lib/practice/singItEngine";

/**
 * PartsMixerSheet — the Practice Room's "Parts" door: every voice in the
 * song, one row each, volume under the thumb (GarageBand's mixer, made
 * human). Grouped by section in play order; a row = the part's name, its
 * maker's color dot, a slider, and a mute. Sound changes LIVE (the engine
 * ramps); the mix persists per song on this device. No dB, no waveforms,
 * no solo lecture — louder, quieter, ear off. The mixer doubles as the
 * credits page you can touch: every voice wears its maker's color.
 */

interface PartsMixerSheetProps {
  open: boolean;
  onClose: () => void;
  timeline: SingItTimeline;
  gains: Record<string, number>;
  muted: Set<string>;
  unavailable: Set<string>;
  onGain: (memoId: string, gain: number) => void;
  onMute: (memoId: string) => void;
}

export function PartsMixerSheet({
  open,
  onClose,
  timeline,
  gains,
  muted,
  unavailable,
  onGain,
  onMute,
}: PartsMixerSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0" style={{ zIndex: 810 }}>
      {/* Scrim — one of the three dismissals. */}
      <button
        type="button"
        aria-label="Close the parts mixer"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(28,26,23,0.45)",
          border: "none",
          cursor: "pointer",
        }}
      />
      <TrappedDialog
        onClose={onClose}
        aria-label="Parts — each voice's volume"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "70dvh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--cog-cream-light)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "0 -8px 32px rgba(28,26,23,0.18)",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 20px 6px" }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--cog-charcoal)",
              margin: 0,
            }}
          >
            Parts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cog-press"
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: "0 14px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "transparent",
              color: "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
        <p
          style={{
            margin: "0 20px 10px",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--cog-warm-gray)",
          }}
        >
          Slide a voice louder or quieter — the song remembers your mix.
        </p>

        <div
          style={{
            overflowY: "auto",
            padding: "0 20px calc(env(safe-area-inset-bottom) + 20px)",
          }}
        >
          {timeline.sections.map((section, si) => {
            const sectionParts = timeline.parts.filter((p) => p.sectionIndex === si);
            if (sectionParts.length === 0) return null;
            return (
              <section key={section.id} aria-label={section.label} style={{ marginBottom: 14 }}>
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--cog-muted)",
                    margin: "10px 0 6px",
                  }}
                >
                  {section.label}
                </h3>
                {sectionParts.map((part) => {
                  const color = getCreatorColor(part.authorId || part.memoId).base;
                  const gain = gains[part.memoId] ?? part.seedGain;
                  const isMuted = muted.has(part.memoId);
                  const isGone = unavailable.has(part.memoId);
                  const pct = Math.round((gain / 1.5) * 100);
                  return (
                    <div
                      key={part.memoId}
                      className="flex items-center"
                      style={{ gap: 12, padding: "6px 0", opacity: isGone ? 0.45 : 1 }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          backgroundColor: color,
                          flexShrink: 0,
                          marginLeft: part.isBase ? 0 : 14,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "var(--cog-charcoal)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {part.label}
                        </p>
                        {isGone ? (
                          <p
                            style={{
                              margin: 0,
                              fontFamily: "var(--font-body)",
                              fontSize: "0.75rem",
                              color: "var(--cog-muted)",
                            }}
                          >
                            Can't reach this voice yet
                          </p>
                        ) : (
                          <input
                            type="range"
                            min={0}
                            max={1.5}
                            step={0.05}
                            value={gain}
                            disabled={isMuted}
                            onChange={(e) => onGain(part.memoId, Number(e.target.value))}
                            aria-label={`${part.label} volume`}
                            aria-valuetext={`${pct}%`}
                            style={{
                              width: "100%",
                              maxWidth: 220,
                              height: 24,
                              accentColor: color,
                              cursor: "pointer",
                              opacity: isMuted ? 0.35 : 1,
                            }}
                          />
                        )}
                      </div>
                      {!isGone && (
                        <button
                          type="button"
                          onClick={() => onMute(part.memoId)}
                          aria-pressed={isMuted}
                          aria-label={isMuted ? `Turn ${part.label} back on` : `Turn ${part.label} off`}
                          className="cog-press"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            flexShrink: 0,
                            backgroundColor: isMuted ? "rgba(0,0,0,0.06)" : `${color}14`,
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isMuted ? "var(--cog-muted)" : color,
                          }}
                        >
                          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </TrappedDialog>
    </div>
  );
}
