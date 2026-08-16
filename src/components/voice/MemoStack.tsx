import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Mic, Volume2, VolumeX, Trash2 } from "lucide-react";
import { useStackPlayer } from "@/hooks/useStackPlayer";
import { stackPlayOrder, type MemoStackGroup } from "@/lib/voice/stackModel";
import { setLayerMix } from "@/integrations/cog/memos";
import { memoKey } from "@/lib/canvas/features/canvasAudio";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { resolveWaveformBars } from "@/lib/canvas/waveformSeed";
import { formatDuration } from "@/lib/voice/audioFormat";

/**
 * MemoStack — one base voice memo plus the harmony/response layers recorded
 * over it, played back together. This is the visible payoff of "Record over
 * this": base + layers as a calm stack of tactile cards (never track lanes),
 * with a single group transport and per-layer mute/solo. The base is never
 * altered — a layer is a child memo.
 */
export interface StackMemoView {
  id: string;
  parentMemoId?: string | null;
  title: string;
  contributor: string;
  durationMs: number;
  section?: string;
  createdAt?: string;
  /** Real persisted peaks (0–1); null on legacy rows → seed fallback. */
  waveformPeaks?: number[] | null;
  /** Melody Lens contour — the base row rides the primary take's tune. */
  pitchContour?: number[] | null;
  /** Persisted quick-mix (voice_memos.layer_gain / layer_muted). */
  layerGain?: number;
  layerMuted?: boolean;
  /** Persisted record-latency offset (playback starts this far into the layer). */
  layerOffsetMs?: number;
}

interface MemoStackProps {
  base: StackMemoView;
  layers: StackMemoView[];
  /** Shown quietly when known — never invented. */
  bpm?: number | null;
  /** Role-gated: viewers don't see "Record over this". */
  canRecordOver?: boolean;
  onRecordOver?: (baseMemoId: string) => void;
  /** Remove a botched layer right here (GarageBand's one-gesture delete,
   *  behind a calm inline confirm). Absent = viewers/no permission. */
  onRemoveLayer?: (layerId: string) => void;
  /** Per-layer permission: only the layer's own writer may remove their
   *  work — nobody's contribution is erased by another hand. */
  canRemoveLayer?: (layerId: string) => boolean;
}

const STACK_BARS = 28;
const STACK_WAVE_H = 34;
const LAYER_BARS = 20;
const LAYER_WAVE_H = 14;

const MemoStack = ({ base, layers, bpm, canRecordOver = true, onRecordOver, onRemoveLayer, canRemoveLayer }: MemoStackProps) => {
  const group: MemoStackGroup<StackMemoView> = { base, layers };
  // Which layer is showing its inline "Remove?" confirm strip.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const playIds = stackPlayOrder(group);
  // Seed the mixer from the PERSISTED mix — the balance the room last set —
  // and hand the engine the record-latency offsets so layers line up.
  // Keyed on the mix CONTENT, not just membership: the sheet's server
  // refresh can land new gain/mute/offset values under the same ids, and an
  // ids-only key made the room mix write-only past mount.
  const seedsKey = [base, ...layers]
    .map((l) => `${l.id}:${l.layerGain ?? ""}:${l.layerMuted ? 1 : 0}:${l.layerOffsetMs ?? 0}`)
    .join("|");
  const seeds = useMemo(() => {
    const initialGains: Record<string, number> = {};
    const initialMuted: string[] = [];
    const serverOffsets: Record<string, number> = {};
    for (const l of layers) {
      if (typeof l.layerGain === "number") initialGains[l.id] = l.layerGain;
      if (l.layerMuted) initialMuted.push(l.id);
      if (l.layerOffsetMs) serverOffsets[l.id] = l.layerOffsetMs;
    }
    return { initialGains, initialMuted, serverOffsets };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedsKey]);
  const { state, prepare, playPause, toggleMute, toggleSolo, setGain } = useStackPlayer(
    playIds,
    seeds,
  );

  // Persist a gain drag debounced (offline-quiet: a failed save just waits
  // for the next adjustment — the local mix rules the session either way).
  const saveTimers = useRef<Map<string, number>>(new Map());
  const persistGain = (id: string, gain: number) => {
    const timers = saveTimers.current;
    const prev = timers.get(id);
    if (prev) window.clearTimeout(prev);
    timers.set(
      id,
      window.setTimeout(() => {
        timers.delete(id);
        // memoKey: a hydrated layer's in-view id is db-voice-<uuid> — sent
        // raw, the uuid PK update matched nothing and the room-shared mix
        // silently never persisted.
        void setLayerMix(memoKey(id), { gain });
      }, 600),
    );
  };
  useEffect(() => {
    const timers = saveTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  // Resolve audio when the stack opens so the first tap plays instantly (iOS).
  useEffect(() => { void prepare(); }, [prepare]);

  const baseColor = getCreatorColor(base.contributor);
  // Melody Lens precedence: contour (rides the tune) → real peaks → seed.
  const wave = resolveWaveformBars({
    seedId: base.id,
    peaks: base.waveformPeaks,
    contour: base.pitchContour,
    barCount: STACK_BARS,
    maxHeight: STACK_WAVE_H,
  });
  const layerCount = layers.length;

  return (
    <section
      role="group"
      aria-label={`${base.title} by ${base.contributor}, base memo${
        layerCount ? `, ${layerCount} layer${layerCount > 1 ? "s" : ""}` : ""
      }`}
      style={{
        backgroundColor: "var(--cog-cream-light)",
        borderRadius: 20,
        border: `1px solid ${baseColor.base}28`,
        boxShadow: "0 12px 32px rgba(31,37,42,0.10)",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      {/* ── Base memo header ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {/* Group play/pause — the whole stack at once */}
        <button
          type="button"
          className="cog-press"
          onClick={playPause}
          disabled={state.loading || state.unavailable}
          aria-busy={state.loading}
          style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            backgroundColor: baseColor.base, color: "#FFF", border: "none",
            cursor: state.loading ? "wait" : state.unavailable ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 14px ${baseColor.glow}`,
            opacity: state.loading || state.unavailable ? 0.6 : 1,
          }}
          aria-label={
            state.loading
              ? "Getting the takes ready"
              : state.unavailable
                ? "Can't reach this audio yet — check your connection"
                : state.isPlaying
                  ? "Pause"
                  : `Play ${base.title} with every voice`
          }
        >
          {state.isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" style={{ marginLeft: 2 }} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Mic size={12} strokeWidth={1.8} style={{ color: baseColor.base, flexShrink: 0 }} />
            <p style={{
              margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700,
              color: "var(--cog-charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {base.title}
            </p>
          </div>
          <p style={{ margin: "2px 0 0", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--cog-muted)" }}>
            {base.contributor} · first voice · {formatDuration(base.durationMs)}
            {bpm ? ` · ${bpm} BPM` : ""}
          </p>
        </div>
      </div>

      {/* Calm waveform + progress (preview only, never editable). Melody bars
          ride the tune via marginTop; unvoiced stretches sit dim. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 2, height: STACK_WAVE_H, marginBottom: 4 }} aria-hidden="true">
        {wave.bars.map((bar, i) => {
          const played = state.isPlaying && state.progress > i / STACK_BARS;
          return (
            <div key={i} style={{
              flex: 1, height: Math.max(3, bar.height), marginTop: bar.top, borderRadius: 2,
              backgroundColor: baseColor.base,
              opacity: !bar.voiced ? 0.14 : played ? bar.amp * 0.7 + 0.3 : bar.amp * 0.45 + 0.15,
              transition: "opacity 80ms ease",
            }} />
          );
        })}
      </div>
      <div style={{ height: 3, borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${state.progress * 100}%`, backgroundColor: baseColor.base, transition: "width 120ms linear" }} />
      </div>

      {/* ── Layer rows (the stack) ─────────────────────────────────────── */}
      {layers.map((layer) => {
        const lc = getCreatorColor(layer.contributor);
        const isMuted = state.muted.has(layer.id);
        const isSolo = state.soloId === layer.id;
        const confirming = confirmRemoveId === layer.id;
        // The layer's own shape — base and layer visually READ as aligned
        // takes, not anonymous strips (alignment used to be audio-only).
        const layerWave = resolveWaveformBars({
          seedId: layer.id,
          peaks: layer.waveformPeaks,
          contour: layer.pitchContour,
          barCount: LAYER_BARS,
          maxHeight: LAYER_WAVE_H,
        });
        return (
          <div
            key={layer.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", marginBottom: 8, borderRadius: 14,
              backgroundColor: `${lc.base}0E`,
              border: `1px solid ${lc.base}26`,
              opacity: isMuted ? 0.5 : 1,
              transition: "opacity 160ms ease",
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              backgroundColor: lc.base, color: "#FFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700,
            }} aria-hidden="true">
              {getCreatorInitials(layer.contributor)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--cog-charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {layer.title}
              </p>
              {confirming ? (
                <p style={{ margin: "3px 0 0", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--cog-charcoal)", lineHeight: 1.4 }}>
                  Remove this layer? It leaves the stack for everyone.
                </p>
              ) : (
                <>
                  <p style={{ margin: "1px 0 0", fontFamily: "var(--font-body)", fontSize: 10, color: "var(--cog-muted)" }}>
                    {layer.contributor} · layer · {formatDuration(layer.durationMs)}
                  </p>
                  <div
                    aria-hidden="true"
                    style={{ display: "flex", alignItems: "flex-end", gap: 2, height: LAYER_WAVE_H, marginTop: 4, overflow: "hidden" }}
                  >
                    {layerWave.bars.map((bar, i) => (
                      <div
                        key={i}
                        style={{
                          width: 3, height: Math.max(2, bar.height), borderRadius: 2, flexShrink: 0,
                          backgroundColor: lc.base,
                          opacity: bar.voiced ? bar.amp * 0.5 + 0.25 : 0.12,
                        }}
                      />
                    ))}
                  </div>
                  {/* The quick mix — a quiet per-layer volume. Live (ramped, no
                      clicks, mid-playback) + persisted debounced, shared with
                      the room. Volume + mute + solo is the ENTIRE mixer. */}
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={state.gains[layer.id] ?? layer.layerGain ?? 1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setGain(layer.id, v);
                      persistGain(layer.id, v);
                    }}
                    aria-label={`${layer.contributor}'s layer volume`}
                    style={{
                      width: "100%",
                      maxWidth: 150,
                      height: 20,
                      marginTop: 4,
                      accentColor: lc.base,
                      cursor: "pointer",
                    }}
                  />
                </>
              )}
            </div>
            {confirming ? (
              /* The calm inline confirm — no modal, no red wall. Remove is a
                 real removal (the row said so above); Keep walks it back. */
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRemoveId(null);
                    onRemoveLayer?.(layer.id);
                  }}
                  style={{
                    minWidth: 44, height: 44, borderRadius: 12, padding: "0 14px",
                    backgroundColor: "var(--cog-charcoal)", color: "#FFF",
                    border: "none", cursor: "pointer",
                    fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700,
                  }}
                  aria-label={`Remove ${layer.contributor}'s layer from this stack`}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemoveId(null)}
                  style={{
                    minWidth: 44, height: 44, borderRadius: 12, padding: "0 12px",
                    backgroundColor: "transparent", color: "var(--cog-warm-gray)",
                    border: "1px solid rgba(0,0,0,0.12)", cursor: "pointer",
                    fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700,
                  }}
                  aria-label="Keep this layer"
                >
                  Keep
                </button>
              </div>
            ) : (
              <>
                {/* Mute */}
                <button
                  type="button"
                  onClick={() => {
                    const nowMuted = !state.muted.has(layer.id);
                    toggleMute(layer.id);
                    void setLayerMix(memoKey(layer.id), { muted: nowMuted });
                  }}
                  aria-pressed={isMuted}
                  aria-label={isMuted ? `Unmute ${layer.contributor}'s layer` : `Mute ${layer.contributor}'s layer`}
                  style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    backgroundColor: isMuted ? "rgba(0,0,0,0.06)" : `${lc.base}14`,
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isMuted ? "#999" : lc.base,
                  }}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                {/* Solo — but in the writer's words: "Just this" is what the
                    act IS ("Unsolo" is not a word anyone's child says). */}
                <button
                  type="button"
                  onClick={() => toggleSolo(layer.id)}
                  aria-pressed={isSolo}
                  aria-label={isSolo ? "Hear everyone again" : `Hear just ${layer.contributor}'s voice`}
                  style={{
                    minWidth: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    padding: "0 12px",
                    backgroundColor: isSolo ? lc.base : "transparent",
                    border: `1px solid ${isSolo ? lc.base : "rgba(0,0,0,0.12)"}`,
                    cursor: "pointer", color: isSolo ? "#FFF" : "#999",
                    fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700,
                  }}
                >
                  Just this
                </button>
                {/* Remove — the quietest control on the row, own-work only
                    (GarageBand lets you delete your track; here it asks once). */}
                {onRemoveLayer && (canRemoveLayer?.(layer.id) ?? false) && (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(layer.id)}
                    aria-label={`Remove your layer "${layer.title}"`}
                    style={{
                      width: 36, height: 44, borderRadius: 12, flexShrink: 0,
                      backgroundColor: "transparent", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--cog-muted)",
                    }}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* ── Record over this ───────────────────────────────────────────── */}
      {canRecordOver && (
        <button
          type="button"
          onClick={() => onRecordOver?.(base.id)}
          style={{
            width: "100%", height: 52, marginTop: 4, borderRadius: 14,
            backgroundColor: "var(--cog-gold)", color: "#FFF", border: "none", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(184,149,58,0.35)",
          }}
          aria-label={`Sing over this — your voice plays together with ${base.title}`}
        >
          <Mic size={16} strokeWidth={2} />
          Sing over this
        </button>
      )}
    </section>
  );
};

export default MemoStack;
