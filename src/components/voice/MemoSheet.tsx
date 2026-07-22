import { useEffect, useState, type ReactNode } from "react";
import { X, Mic, RotateCcw, ChevronRight } from "lucide-react";
import MemoStack, { type StackMemoView } from "./MemoStack";
import { listTakes, type Take } from "@/integrations/cog/takes";
import { listVoiceMemos } from "@/lib/voice/voiceApi";

/**
 * MemoSheet — the ONE sheet for a voice memo's two relationships
 * (docs/features/VOICE-MEMO-STACKING-RESEARCH.md §5). It replaces
 * StackSheet (retired) and the never-built TakesDrawer:
 *
 *  Section A · "This sound · other tries" — TAKES (F15): attempts at the
 *    SAME idea, one keeper plays. Verb: "Try again". Managing tries opens
 *    the polished TakeMiniPlayer (keeper/rename/archive/swipe-compare) via
 *    onOpenTries — the consumer orchestrates layering (z-order stays sane).
 *  Section B · "Layers" — the STACK (F16): sounds that play TOGETHER over
 *    the base, each with volume + mute. Verb: "Record a layer".
 *
 * The two verbs are never merged — the sheet holds the distinction so the
 * user never has to. On open it re-reads the SERVER rows for the stack
 * (persisted parentage + the shared mix), so a canvas whose in-memory view
 * lags still shows the truth. Safe-area aware, dismissible, never traps.
 */
interface MemoSheetProps {
  base: StackMemoView;
  layers: StackMemoView[];
  /** The song the memo belongs to — used to refresh server truth on open. */
  songId?: string;
  bpm?: number | null;
  canRecordOver: boolean;
  onRecordOver: (baseMemoId: string) => void;
  /** Open the takes player (TakeMiniPlayer) for this memo — the tries flow. */
  onOpenTries?: (memoId: string) => void;
  /** Future: record a new TAKE of this memo (the "Try again" verb). */
  onTryAgain?: (memoId: string) => void;
  onClose: () => void;
  /** Optional pre-record tempo transport (TempoRow) — shown under the stack. */
  tempoSlot?: ReactNode;
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p
    style={{
      margin: "0 0 8px",
      fontFamily: "var(--font-display)",
      fontSize: 14,
      color: "var(--cog-charcoal)",
    }}
  >
    {children}
  </p>
);

const MemoSheet = ({
  base,
  layers,
  songId,
  bpm,
  canRecordOver,
  onRecordOver,
  onOpenTries,
  onTryAgain,
  onClose,
  tempoSlot,
}: MemoSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [takes, setTakes] = useState<Take[] | null>(null);
  // Server-truth overlay: persisted layers + the shared mix, refreshed on
  // open so the canvas's in-memory view can never mask real parentage.
  const [freshLayers, setFreshLayers] = useState<StackMemoView[] | null>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Section A data — the tries. Calm on failure: the section shows the
  // keeper it already knows and no count.
  useEffect(() => {
    let live = true;
    listTakes(base.id, { include_archived: true })
      .then((rows) => {
        if (live) setTakes(rows);
      })
      .catch(() => {
        if (live) setTakes([]);
      });
    return () => {
      live = false;
    };
  }, [base.id]);

  // Section B server truth — persisted parentage + shared mix.
  useEffect(() => {
    if (!songId) return;
    let live = true;
    listVoiceMemos(songId)
      .then((records) => {
        if (!live) return;
        const children = records.filter((r) => r.parentMemoId === base.id);
        if (children.length === 0) return; // keep the passed view (may be optimistic)
        const passed = new Map(layers.map((l) => [l.id, l]));
        setFreshLayers(
          children.map((r) => ({
            ...(passed.get(r.id) ?? {
              id: r.id,
              title: r.title,
              contributor: r.created_by,
              durationMs: r.duration_ms,
              createdAt: r.created_at,
              waveformPeaks: r.waveform_peaks,
              pitchContour: r.pitch_contour,
            }),
            parentMemoId: base.id,
            layerGain: r.layerGain,
            layerMuted: r.layerMuted,
            layerOffsetMs: r.layerOffsetMs,
          })),
        );
      })
      .catch(() => {
        /* the passed view stands */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, base.id]);

  const keeper = takes?.find((t) => t.is_primary) ?? null;
  const earlierCount = takes ? Math.max(0, takes.length - 1) : null;
  const shownLayers = freshLayers ?? layers;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 280ms ease",
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Voice memo: ${base.title}`}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 800,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxHeight: "85dvh",
          overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div style={{ position: "relative", padding: "0 20px" }}>
          <div
            style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 16px" }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 8,
              right: 16,
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.05)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* ── Section A · This sound · other tries (takes, one keeper) ── */}
          {(onOpenTries || (earlierCount ?? 0) > 0) && (
            <section aria-label="This sound and its other tries" style={{ marginBottom: 16 }}>
              <SectionLabel>This sound · other tries</SectionLabel>
              <button
                type="button"
                onClick={() => onOpenTries?.(base.id)}
                disabled={!onOpenTries}
                aria-label={
                  earlierCount
                    ? `${earlierCount} earlier ${earlierCount === 1 ? "try" : "tries"} of this idea — open`
                    : "Open the takes for this idea"
                }
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.08)",
                  backgroundColor: "rgba(255,255,255,0.8)",
                  cursor: onOpenTries ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "var(--cog-gold)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="block truncate"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--cog-charcoal)",
                      display: "block",
                    }}
                  >
                    {keeper?.friendly_name ?? "This take"}
                    <span style={{ color: "var(--cog-muted)", fontWeight: 500 }}> · keeper</span>
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 11,
                      color: "var(--cog-warm-gray)",
                      display: "block",
                    }}
                  >
                    {takes === null
                      ? "…"
                      : earlierCount === 0
                      ? "the only try so far — another take of this same idea lives here"
                      : `${earlierCount} earlier ${earlierCount === 1 ? "try" : "tries"} tucked away`}
                  </span>
                </span>
                {onOpenTries && <ChevronRight size={16} style={{ color: "var(--cog-muted)", flexShrink: 0 }} />}
              </button>
              {onTryAgain && (
                <button
                  type="button"
                  onClick={() => onTryAgain(base.id)}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    marginTop: 8,
                    borderRadius: 12,
                    border: "1px solid rgba(184,149,58,0.35)",
                    backgroundColor: "rgba(184,149,58,0.08)",
                    color: "var(--cog-gold)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  aria-label="Try again — record another take of this same idea"
                >
                  <RotateCcw size={14} strokeWidth={2} />
                  Try again — another take of this
                </button>
              )}
            </section>
          )}

          {/* ── Section B · Layers (the stack — voices that play together) ── */}
          <section aria-label="Layers — voices that play together over this sound">
            <SectionLabel>Layers</SectionLabel>
            <MemoStack
              base={base}
              layers={shownLayers}
              bpm={bpm}
              canRecordOver={canRecordOver}
              onRecordOver={onRecordOver}
            />
            {shownLayers.length === 0 && (
              <p
                style={{
                  margin: "10px 2px 0",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--cog-warm-gray)",
                  lineHeight: 1.5,
                }}
              >
                <Mic size={11} strokeWidth={2} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
                A layer is a different voice over this one — a harmony, a hum, a response — and
                they play together. (A "try" is another take of the same idea; that lives above.)
              </p>
            )}
          </section>

          {tempoSlot}
        </div>
      </div>
    </>
  );
};

export default MemoSheet;
