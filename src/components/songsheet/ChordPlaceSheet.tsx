import { useState } from "react";
import { X, Trash2, ChevronDown } from "lucide-react";
import { diatonic, borrowedChords, chordToLetters, chordToNumbers, type NumberChord } from "@/lib/chords/nashville";
import type { Mode } from "@/lib/chords/keys";
import { useDialogDismiss } from "./useDialogDismiss";

/**
 * Chord placement bottom sheet — tap a word, pick a chord. Mobile-first, thumb
 * zone, diatonic palette in the song's own key (the chords you actually reach
 * for), with borrowed chords behind "more". Direct manipulation, no typing.
 */
export default function ChordPlaceSheet({
  word,
  currentLabel,
  sourceKey,
  mode,
  onPick,
  onRemove,
  onClose,
}: {
  word: string;
  currentLabel?: string;
  sourceKey: string;
  mode: Mode;
  onPick: (chord: NumberChord) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  const palette = diatonic(mode);
  const extra = borrowedChords(mode);
  const closeRef = useDialogDismiss(onClose);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Choose a chord">
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

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
            Chord over <span style={{ color: "var(--cog-charcoal)", fontWeight: 600 }}>{word}</span>
          </p>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="flex items-center justify-center rounded-full active:scale-90" style={{ width: 44, height: 44, color: "var(--cog-warm-gray)" }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {palette.map((c, i) => (
            <ChordButton key={i} chord={c} sourceKey={sourceKey} mode={mode} onTap={() => onPick(c)} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--cog-gold-alt, var(--cog-gold))" }}
        >
          <ChevronDown size={13} style={{ transform: more ? "rotate(180deg)" : undefined, transition: "transform 150ms" }} />
          {more ? "Fewer" : "More"} chords
        </button>

        {more && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {extra.map((c, i) => (
              <ChordButton key={i} chord={c} sourceKey={sourceKey} mode={mode} onTap={() => onPick(c)} />
            ))}
          </div>
        )}

        {currentLabel && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-full text-sm font-medium active:scale-[0.97]"
            style={{ backgroundColor: "var(--cog-cream)", border: "1px solid var(--cog-border)", color: "var(--cog-warm-gray)" }}
          >
            <Trash2 size={15} strokeWidth={2} /> Remove {currentLabel}
          </button>
        )}
      </div>

      <style>{`
        .cog-sheet-up { animation: cog-sheet-up 280ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1)); }
        @keyframes cog-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .cog-sheet-up { animation: none; } }
      `}</style>
    </div>
  );
}

function ChordButton({ chord, sourceKey, mode, onTap }: { chord: NumberChord; sourceKey: string; mode: Mode; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex flex-col items-center justify-center rounded-2xl py-2.5 transition-transform active:scale-95"
      style={{ minHeight: 56, backgroundColor: "#fff", border: "1px solid var(--cog-border)" }}
    >
      <span className="text-[1.0625rem] font-semibold leading-none" style={{ color: "var(--cog-charcoal)" }}>
        {chordToLetters(chord, sourceKey, mode)}
      </span>
      <span className="text-[0.625rem] mt-1 leading-none" style={{ color: "var(--cog-muted)" }}>
        {chordToNumbers(chord, mode)}
      </span>
    </button>
  );
}
