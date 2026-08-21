import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Mic, RotateCcw, ChevronRight } from "lucide-react";
import MemoStack, { type StackMemoView } from "./MemoStack";
import TrappedDialog from "@/components/canvas/TrappedDialog";
import { listTakes, type Take } from "@/integrations/cog/takes";
import { listVoiceMemos } from "@/lib/voice/voiceApi";
import { memoKey } from "@/lib/canvas/features/canvasAudio";

/**
 * MemoSheet — the ONE sheet for a voice memo's two relationships
 * (docs/features/VOICE-MEMO-STACKING-RESEARCH.md §5). It replaces
 * StackSheet (retired) and the never-built TakesDrawer:
 *
 *  Section A · "Other tries at this" — TAKES (F15): attempts at the
 *    SAME idea, one keeper plays. Verb: "Try again". Managing tries opens
 *    the polished TakeMiniPlayer (keeper/rename/archive/swipe-compare) via
 *    onOpenTries — the consumer orchestrates layering (z-order stays sane).
 *  Section B · "Layers" — the STACK (F16): sounds that play TOGETHER over
 *    the base, each with volume + mute. Verb: "Record a layer".
 *
 * The two verbs are never merged — the sheet holds the distinction so the
 * user never has to. On open it re-reads the SERVER rows for the stack
 * (persisted parentage + the shared mix), so a canvas whose in-memory view
 * lags still shows the truth. Safe-area aware, dismissible (tap-out, Escape,
 * the close button), and focus-trapped while open like every other sheet.
 */
interface MemoSheetProps {
  base: StackMemoView;
  layers: StackMemoView[];
  /** The song the memo belongs to — used to refresh server truth on open. */
  songId?: string;
  bpm?: number | null;
  canRecordOver: boolean;
  onRecordOver: (baseMemoId: string) => void;
  /** Remove a layer (own-work only — gated per layer by canRemoveLayer). */
  onRemoveLayer?: (layerId: string) => void;
  canRemoveLayer?: (layerId: string) => boolean;
  /** Open the takes player (TakeMiniPlayer) for this memo — the tries flow. */
  onOpenTries?: (memoId: string) => void;
  /** Future: record a new TAKE of this memo (the "Try again" verb). */
  onTryAgain?: (memoId: string) => void;
  onClose: () => void;
  /** Optional pre-record tempo transport (TempoRow) — shown under the stack. */
  tempoSlot?: ReactNode;
  /**
   * Render the sheet's own backdrop scrim (default true). The canvas host
   * passes false and hoists ONE persistent scrim under the whole layer flow
   * (LayerFlowScrim, G7) so sheet hand-offs never flash a bare canvas.
   */
  scrim?: boolean;
  /** G10b — the layer that just landed: its row glows once and the stack
   *  announces "Your layer is in the stack" for screen readers. */
  arrivedLayerId?: string | null;
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
  onRemoveLayer,
  canRemoveLayer,
  onOpenTries,
  onTryAgain,
  onClose,
  tempoSlot,
  scrim = true,
  arrivedLayerId,
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

  // Escape lives in TrappedDialog now (shared trap: Tab wraps, focus returns
  // to the trigger on close) — a window-level listener here would fire twice.

  // THE ID SEAM: the sheet's base may be a CARD id (`db-voice-<uuid>` for
  // hydrated mirrors) while the server speaks raw memo uuids — every server
  // read below must use the resolved memo id or it silently matches nothing.
  const baseMemoId = memoKey(base.id);
  // Latest passed layers without effect-identity churn (the prop is re-mapped
  // every host render; as a dep it would refetch the song's memos per render).
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Section A data — the tries. Calm on failure: the section shows the
  // keeper it already knows and no count.
  useEffect(() => {
    let live = true;
    listTakes(baseMemoId, { include_archived: true })
      .then((rows) => {
        if (live) setTakes(rows);
      })
      .catch(() => {
        if (live) setTakes([]);
      });
    return () => {
      live = false;
    };
  }, [baseMemoId]);

  // Section B server truth — persisted parentage + shared mix. UNION with the
  // passed view, never replace: a just-recorded layer still uploading (temp
  // id, not on the server yet) must not vanish from the sheet mid-flow.
  useEffect(() => {
    if (!songId) return;
    let live = true;
    listVoiceMemos(songId)
      .then((records) => {
        if (!live) return;
        const children = records.filter(
          (r) => r.parentMemoId && memoKey(r.parentMemoId) === baseMemoId,
        );
        if (children.length === 0) return; // keep the passed view (may be optimistic)
        const passed = new Map(layersRef.current.map((l) => [memoKey(l.id), l]));
        const fromServer = children.map((r) => ({
          ...(passed.get(memoKey(r.id)) ?? {
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
        }));
        // Server rows ONLY — the optimistic union happens at render time
        // against the LIVE prop (freezing prop items here duplicated a layer
        // after its temp→memo rename while the sheet stayed open).
        setFreshLayers(fromServer);
      })
      .catch(() => {
        /* the passed view stands */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, baseMemoId]);

  const keeper = takes?.find((t) => t.is_primary) ?? null;
  const earlierCount = takes ? Math.max(0, takes.length - 1) : null;
  // Render-time UNION with the live prop: server truth wins where it exists;
  // a still-uploading layer (temp id, not on the server yet) rides the prop
  // and never vanishes — and a mid-open temp→memo rename can't duplicate.
  const shownLayers = useMemo(() => {
    if (!freshLayers) return layers;
    const serverKeys = new Set(freshLayers.map((l) => memoKey(l.id)));
    return [...freshLayers, ...layers.filter((l) => !serverKeys.has(memoKey(l.id)))];
  }, [freshLayers, layers]);

  return (
    <>
      {scrim && (
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
      )}
      <TrappedDialog
        onClose={onClose}
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

          {/* ── Section A · Other tries at this (takes, one keeper) ── */}
          {(onOpenTries || (earlierCount ?? 0) > 0) && (
            <section aria-label="This sound and its other tries" style={{ marginBottom: 16 }}>
              <SectionLabel>Other tries at this</SectionLabel>
              <button
                type="button"
                onClick={() => onOpenTries?.(base.id)}
                disabled={!onOpenTries}
                aria-label={
                  earlierCount
                    ? `${earlierCount} earlier ${earlierCount === 1 ? "try" : "tries"} of this idea — open`
                    : "See the other tries"
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
                      ? "the only try so far — your other tries of this same idea live here"
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
                  aria-label="Try it again — another try at this same idea"
                >
                  <RotateCcw size={14} strokeWidth={2} />
                  Try it again
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
              arrivedLayerId={arrivedLayerId}
              bpm={bpm}
              canRecordOver={canRecordOver}
              onRecordOver={onRecordOver}
              canRemoveLayer={canRemoveLayer}
              onRemoveLayer={
                onRemoveLayer
                  ? (layerId) => {
                      // Prune the server-truth overlay too — otherwise the
                      // removed layer resurrects from freshLayers (read at
                      // open) until the sheet is next reopened.
                      setFreshLayers((prev) =>
                        prev ? prev.filter((l) => memoKey(l.id) !== memoKey(layerId)) : prev,
                      );
                      onRemoveLayer(layerId);
                    }
                  : undefined
              }
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
                Sing over this and both voices play together — a harmony, a hum, an answer.
              </p>
            )}
          </section>

          {tempoSlot}
        </div>
      </TrappedDialog>
    </>
  );
};

export default MemoSheet;
