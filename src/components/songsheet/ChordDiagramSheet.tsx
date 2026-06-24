import { X } from "lucide-react";
import { getChordShapeForLetters, type Voicing } from "@/lib/chords/chordShapes";
import { useDialogDismiss } from "./useDialogDismiss";

/**
 * Chord diagram bottom sheet (Ultimate Guitar's signature) — tap a chord, see
 * where to put your fingers. SVG fretboard, correct voicings from chordShapes.
 * Mobile-first, COG tokens, degrades calmly when a chord has no drawn shape.
 */

const FRET_ROWS = 4;

export default function ChordDiagramSheet({ label, onClose }: { label: string; onClose: () => void }) {
  const voicing = getChordShapeForLetters(label);
  const closeRef = useDialogDismiss(onClose);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`${label} chord diagram`}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" style={{ backgroundColor: "rgba(28,26,23,0.32)" }} />
      <div
        className="cog-sheet-up relative rounded-t-3xl px-5 pt-3"
        style={{
          backgroundColor: "var(--cog-cream-light)",
          paddingBottom: "max(env(safe-area-inset-bottom), 18px)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div className="mx-auto mb-3 rounded-full" style={{ width: 36, height: 5, backgroundColor: "var(--cog-border)" }} />
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
            {label}
          </span>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="flex items-center justify-center rounded-full active:scale-90" style={{ width: 44, height: 44, color: "var(--cog-warm-gray)" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex justify-center py-3">
          {voicing ? (
            <Diagram voicing={voicing} />
          ) : (
            <p className="text-sm py-8" style={{ color: "var(--cog-muted)" }}>
              No diagram for this chord yet — try the chords-over-lyrics view.
            </p>
          )}
        </div>
      </div>
      <style>{`
        .cog-sheet-up { animation: cog-sheet-up 280ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1)); }
        @keyframes cog-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .cog-sheet-up { animation: none; } }
      `}</style>
    </div>
  );
}

function Diagram({ voicing }: { voicing: Voicing }) {
  const { frets, baseFret } = voicing;
  const W = 132;
  const H = 156;
  const left = 18;
  const right = 12;
  const top = 26;
  const gridW = W - left - right;
  const gx = gridW / 5; // 6 strings, 5 gaps
  const gridH = H - top - 14;
  const gy = gridH / FRET_ROWS;
  const xOf = (s: number) => left + s * gx;
  const yLine = (k: number) => top + k * gy;
  const showNut = baseFret === 1;
  const rowCenterY = (fret: number) => top + (fret - baseFret + 0.5) * gy;

  const positive = frets.filter((f) => f > 0);
  const barreFret = positive.length ? Math.min(...positive) : 0;
  const barreStrings = frets.map((f, s) => (f === barreFret ? s : -1)).filter((s) => s >= 0);
  const isBarre = barreStrings.length >= 3 && barreFret > 0;

  const stroke = "var(--cog-charcoal)";
  const muted = "var(--cog-muted)";
  const dot = "var(--cog-gold-alt, var(--cog-gold))";

  return (
    <svg width={W * 1.4} height={H * 1.4} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chord fingering">
      {/* fret lines */}
      {Array.from({ length: FRET_ROWS + 1 }).map((_, k) => (
        <line
          key={`f${k}`}
          x1={left}
          y1={yLine(k)}
          x2={xOf(5)}
          y2={yLine(k)}
          stroke={stroke}
          strokeWidth={k === 0 && showNut ? 3.5 : 1}
          opacity={k === 0 && showNut ? 0.9 : 0.35}
        />
      ))}
      {/* strings */}
      {Array.from({ length: 6 }).map((_, s) => (
        <line key={`s${s}`} x1={xOf(s)} y1={top} x2={xOf(s)} y2={top + gridH} stroke={stroke} strokeWidth={1} opacity={0.35} />
      ))}

      {/* base fret label when not at the nut */}
      {!showNut && (
        <text x={left - 6} y={rowCenterY(baseFret)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={muted}>
          {baseFret}fr
        </text>
      )}

      {/* open / muted markers above the nut */}
      {frets.map((f, s) => {
        if (f > 0) return null;
        return (
          <text key={`m${s}`} x={xOf(s)} y={top - 9} textAnchor="middle" fontSize={11} fill={f === 0 ? stroke : muted}>
            {f === 0 ? "○" : "×"}
          </text>
        );
      })}

      {/* barre */}
      {isBarre && (
        <rect
          x={xOf(barreStrings[0]) - 4}
          y={rowCenterY(barreFret) - 6}
          width={xOf(barreStrings[barreStrings.length - 1]) - xOf(barreStrings[0]) + 8}
          height={12}
          rx={6}
          fill={dot}
        />
      )}

      {/* finger dots */}
      {frets.map((f, s) => {
        if (f <= 0) return null;
        if (isBarre && f === barreFret) return null;
        return <circle key={`d${s}`} cx={xOf(s)} cy={rowCenterY(f)} r={6} fill={dot} />;
      })}
    </svg>
  );
}
