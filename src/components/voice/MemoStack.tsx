import { useEffect } from "react";
import { Play, Pause, Mic, Volume2, VolumeX } from "lucide-react";
import { useStackPlayer } from "@/hooks/useStackPlayer";
import { stackPlayOrder, type MemoStackGroup } from "@/lib/voice/stackModel";
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
}

interface MemoStackProps {
  base: StackMemoView;
  layers: StackMemoView[];
  /** Shown quietly when known — never invented. */
  bpm?: number | null;
  /** Role-gated: viewers don't see "Record over this". */
  canRecordOver?: boolean;
  onRecordOver?: (baseMemoId: string) => void;
}

const STACK_BARS = 28;
const STACK_WAVE_H = 34;

const MemoStack = ({ base, layers, bpm, canRecordOver = true, onRecordOver }: MemoStackProps) => {
  const group: MemoStackGroup<StackMemoView> = { base, layers };
  const playIds = stackPlayOrder(group);
  const { state, prepare, playPause, toggleMute, toggleSolo } = useStackPlayer(playIds);

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
          onClick={playPause}
          disabled={state.loading}
          style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            backgroundColor: baseColor.base, color: "#FFF", border: "none",
            cursor: state.loading ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 14px ${baseColor.glow}`,
            opacity: state.loading ? 0.6 : 1,
          }}
          aria-label={state.isPlaying ? "Pause stack" : `Play ${base.title} with all layers`}
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
            {base.contributor} · base · {formatDuration(base.durationMs)}
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
              <p style={{ margin: "1px 0 0", fontFamily: "var(--font-body)", fontSize: 10, color: "var(--cog-muted)" }}>
                {layer.contributor} · layer · {formatDuration(layer.durationMs)}
              </p>
            </div>
            {/* Mute */}
            <button
              type="button"
              onClick={() => toggleMute(layer.id)}
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
            {/* Solo */}
            <button
              type="button"
              onClick={() => toggleSolo(layer.id)}
              aria-pressed={isSolo}
              aria-label={isSolo ? `Unsolo ${layer.contributor}'s layer` : `Solo ${layer.contributor}'s layer`}
              style={{
                minWidth: 44, height: 44, borderRadius: 12, flexShrink: 0,
                padding: "0 12px",
                backgroundColor: isSolo ? lc.base : "transparent",
                border: `1px solid ${isSolo ? lc.base : "rgba(0,0,0,0.12)"}`,
                cursor: "pointer", color: isSolo ? "#FFF" : "#999",
                fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 700,
              }}
            >
              Solo
            </button>
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
          aria-label={`Record a new layer over ${base.title}`}
        >
          <Mic size={16} strokeWidth={2} />
          Record over this
        </button>
      )}
    </section>
  );
};

export default MemoStack;
