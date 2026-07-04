import { useEffect, useMemo, useState } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import {
  diatonic,
  borrowedChords,
  chordToLetters,
  chordToNumbers,
  progressionToLetters,
  type NumberChord,
  type Progression,
  type ChordQuality,
  type ChordExtension,
} from "@/lib/chords/nashville";
import { MAJOR_KEYS, MINOR_KEYS, type Mode } from "@/lib/chords/keys";
import TapTempo from "./TapTempo";

type DisplayMode = "letters" | "numbers";

interface ChordPickerProps {
  /** Pre-set key for the song, if any. If absent, we ask once. */
  initialKey?: string;
  initialMode?: Mode;
  initialBpm?: number;
  initialDisplay?: DisplayMode;
  /** Persist key/bpm at the song level when the user changes them here. */
  onKeyChange?: (key: string, mode: Mode) => void;
  onBpmChange?: (bpm: number) => void;
  /** Save the progression as a capture block. */
  onSave: (label: string, text: string, progression: Progression) => void;
}

const ChordPicker = ({
  initialKey,
  initialMode = "major",
  initialBpm,
  initialDisplay = "letters",
  onKeyChange,
  onBpmChange,
  onSave,
}: ChordPickerProps) => {
  const [keyChosen, setKeyChosen] = useState<boolean>(!!initialKey);
  const [tonic, setTonic] = useState<string>(initialKey?.replace(/m$/, "") ?? "G");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [bpm, setBpm] = useState<number | "">(initialBpm ?? "");
  const [display, setDisplay] = useState<DisplayMode>(initialDisplay);
  const [chords, setChords] = useState<NumberChord[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const palette = useMemo(() => diatonic(mode), [mode]);
  const borrowed = useMemo(() => borrowedChords(mode), [mode]);

  // Notify parent of key/bpm edits so song-level state can persist.
  useEffect(() => {
    if (keyChosen) onKeyChange?.(tonic, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonic, mode, keyChosen]);

  const render = (c: NumberChord) =>
    display === "letters" ? chordToLetters(c, tonic, mode) : chordToNumbers(c, mode);

  // ------ First-run key prompt ----------------------------------------------
  if (!keyChosen) {
    const keys = mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
          What key is this song in? We'll remember it.
        </p>
        <ModeToggle mode={mode} onChange={setMode} />
        <div className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTonic(k.replace(/m$/, ""));
                setKeyChosen(true);
              }}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-transform active:scale-95"
              style={{
                background: "white",
                border: "1px solid var(--cog-border)",
                color: "var(--cog-charcoal)",
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ------ Main picker --------------------------------------------------------
  const editing = editingIndex !== null ? chords[editingIndex] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Key + tempo header */}
      <div className="flex flex-col gap-3 p-3 rounded-2xl" style={{
        background: "white",
        border: "1px solid var(--cog-border)",
      }}>
        <div className="flex items-center gap-3 flex-wrap">
          <KeyPicker tonic={tonic} mode={mode} onTonic={setTonic} onMode={setMode} />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                inputMode="numeric"
                value={bpm}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                  const n = v === "" ? "" : Math.min(300, Math.max(20, Number(v)));
                  setBpm(n as number | "");
                  if (typeof n === "number") onBpmChange?.(n);
                }}
                placeholder="BPM"
                aria-label="Beats per minute"
                enterKeyHint="done"
                className="w-16 text-center rounded-lg py-1.5"
                // 16px so iOS Safari doesn't zoom the canvas when the BPM field
                // is focused.
                style={{ background: "var(--cog-cream)", border: "1px solid var(--cog-border)", fontSize: 16 }}
              />
              <span className="text-xs" style={{ color: "var(--cog-warm-gray)" }}>bpm</span>
            </div>
            {/* Tap tempo — set BPM by tapping in time, no typing. */}
            <TapTempo
              onBpm={(b) => {
                setBpm(b);
                onBpmChange?.(b);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--cog-warm-gray)" }}>
            Show as
          </span>
          <div className="flex rounded-full p-0.5" style={{ background: "var(--cog-cream)" }}>
            {(["letters", "numbers"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDisplay(d)}
                className="px-3 text-xs rounded-full transition-colors inline-flex items-center justify-center"
                style={{
                  background: display === d ? "var(--cog-gold)" : "transparent",
                  color: display === d ? "white" : "var(--cog-charcoal)",
                  minHeight: 36,
                }}
              >
                {d === "letters" ? "Letters" : "Numbers"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Diatonic palette */}
      <div>
        <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--cog-warm-gray)" }}>
          In {tonic}{mode === "minor" ? " minor" : ""} — tap to add
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {palette.map((c, i) => (
            <PaletteChip
              key={i}
              top={chordToNumbers(c, mode)}
              bottom={chordToLetters(c, tonic, mode)}
              onTap={() => setChords((prev) => [...prev, c])}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="mt-2 text-xs inline-flex items-center gap-1"
          style={{ color: "var(--cog-gold)", minHeight: 44, padding: "0 4px" }}
        >
          <ChevronDown size={12} style={{ transform: moreOpen ? "rotate(180deg)" : undefined }} />
          {moreOpen ? "Hide" : "+ more"} chords
        </button>
        {moreOpen && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {borrowed.map((c, i) => (
              <PaletteChip
                key={i}
                compact
                top={chordToNumbers(c, mode)}
                bottom={chordToLetters(c, tonic, mode)}
                onTap={() => setChords((prev) => [...prev, c])}
              />
            ))}
          </div>
        )}
      </div>

      {/* Progression strip */}
      <div>
        <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--cog-warm-gray)" }}>
          Progression
        </div>
        <div
          className="flex flex-wrap gap-1.5 min-h-[56px] p-2 rounded-2xl"
          style={{
            background: "var(--cog-cream)",
            border: "1px dashed var(--cog-border)",
          }}
        >
          {chords.length === 0 && (
            <span className="text-xs self-center px-2" style={{ color: "var(--cog-muted)" }}>
              Tap chords above to build the progression
            </span>
          )}
          {chords.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setEditingIndex(i)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-transform active:scale-95"
              style={{
                background: "var(--cog-gold-pale)",
                color: "var(--cog-charcoal)",
                border: editingIndex === i ? "1px solid var(--cog-gold)" : "1px solid transparent",
              }}
            >
              {render(c)}
              <span
                role="button"
                aria-label="Remove chord"
                onClick={(e) => {
                  e.stopPropagation();
                  setChords((prev) => prev.filter((_, idx) => idx !== i));
                  if (editingIndex === i) setEditingIndex(null);
                }}
                className="opacity-60 hover:opacity-100"
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {editing && editingIndex !== null && (
        <QualityEditor
          chord={editing}
          mode={mode}
          tonic={tonic}
          onChange={(updated) =>
            setChords((prev) => prev.map((c, i) => (i === editingIndex ? updated : c)))
          }
          onClose={() => setEditingIndex(null)}
        />
      )}

      <button
        type="button"
        disabled={chords.length === 0}
        onClick={() => {
          const progression: Progression = { key: tonic, mode, chords };
          const letters = progressionToLetters(progression);
          const tempo = typeof bpm === "number" ? ` · ${bpm} BPM` : "";
          const label = `Chords · ${tonic}${mode === "minor" ? "m" : ""}${tempo}`;
          onSave(label, letters, progression);
        }}
        className="w-full h-12 rounded-2xl text-base font-semibold disabled:opacity-40"
        style={{ background: "var(--cog-gold)", color: "var(--cog-cream-light, #faf7f2)" }}
      >
        Save chords
      </button>
    </div>
  );
};

// --- subcomponents ----------------------------------------------------------

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex rounded-full p-0.5 self-start" style={{ background: "var(--cog-cream)" }}>
      {(["major", "minor"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className="px-3 py-1 text-xs rounded-full"
          style={{
            background: mode === m ? "var(--cog-gold)" : "transparent",
            color: mode === m ? "white" : "var(--cog-charcoal)",
          }}
        >
          {m === "major" ? "Major" : "Minor"}
        </button>
      ))}
    </div>
  );
}

function KeyPicker({
  tonic, mode, onTonic, onMode,
}: {
  tonic: string;
  mode: Mode;
  onTonic: (t: string) => void;
  onMode: (m: Mode) => void;
}) {
  const keys = mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
  const stripSuffix = (k: string) => k.replace(/m$/, "");
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--cog-warm-gray)" }}>Key</span>
        <ModeToggle mode={mode} onChange={onMode} />
      </div>
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none" }}>
        {keys.map((k) => {
          const t = stripSuffix(k);
          const active = t === tonic;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onTonic(t)}
              className="px-2.5 py-1 rounded-lg text-sm font-medium shrink-0 transition-transform active:scale-95"
              style={{
                background: active ? "var(--cog-gold)" : "white",
                color: active ? "white" : "var(--cog-charcoal)",
                border: active ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
              }}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaletteChip({
  top, bottom, onTap, compact,
}: {
  top: string;
  bottom: string;
  onTap: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`rounded-xl flex flex-col items-center justify-center transition-transform active:scale-95 ${compact ? "px-3 py-1.5" : "py-2"}`}
      style={{
        background: "white",
        border: "1px solid var(--cog-border)",
        color: "var(--cog-charcoal)",
      }}
    >
      <span className="text-xs" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-display, Georgia)" }}>
        {top}
      </span>
      <span className="text-sm font-semibold leading-tight">{bottom}</span>
    </button>
  );
}

const QUALITIES: { value: ChordQuality; label: string }[] = [
  { value: "maj", label: "maj" },
  { value: "min", label: "min" },
  { value: "dim", label: "dim" },
  { value: "aug", label: "aug" },
  { value: "sus2", label: "sus2" },
  { value: "sus4", label: "sus4" },
];

const EXTENSIONS: { value: ChordExtension | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "7", label: "7" },
  { value: "maj7", label: "maj7" },
  { value: "m7", label: "m7" },
  { value: "add9", label: "add9" },
  { value: "9", label: "9" },
  { value: "13", label: "13" },
];

function QualityEditor({
  chord, mode, tonic, onChange, onClose,
}: {
  chord: NumberChord;
  mode: Mode;
  tonic: string;
  onChange: (c: NumberChord) => void;
  onClose: () => void;
}) {
  return (
    <div className="p-3 rounded-2xl flex flex-col gap-3" style={{
      background: "white",
      border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.40))",
    }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
          Editing {chordToLetters(chord, tonic, mode)}
          <span className="text-xs ml-2" style={{ color: "var(--cog-warm-gray)" }}>
            {chordToNumbers(chord, mode)}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close editor">
          <X size={16} style={{ color: "var(--cog-warm-gray)" }} />
        </button>
      </div>

      <div>
        <div className="text-xs uppercase mb-1" style={{ color: "var(--cog-warm-gray)" }}>Quality</div>
        <div className="flex flex-wrap gap-1.5">
          {QUALITIES.map((q) => (
            <button
              key={q.value}
              type="button"
              onClick={() => onChange({ ...chord, quality: q.value })}
              className="px-2.5 py-1 rounded-lg text-xs"
              style={{
                background: chord.quality === q.value ? "var(--cog-gold)" : "var(--cog-cream)",
                color: chord.quality === q.value ? "white" : "var(--cog-charcoal)",
                border: "1px solid var(--cog-border)",
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase mb-1" style={{ color: "var(--cog-warm-gray)" }}>Extension</div>
        <div className="flex flex-wrap gap-1.5">
          {EXTENSIONS.map((e) => (
            <button
              key={e.label}
              type="button"
              onClick={() => onChange({ ...chord, extension: e.value === "" ? undefined : e.value })}
              className="px-2.5 py-1 rounded-lg text-xs"
              style={{
                background: (chord.extension ?? "") === e.value ? "var(--cog-gold)" : "var(--cog-cream)",
                color: (chord.extension ?? "") === e.value ? "white" : "var(--cog-charcoal)",
                border: "1px solid var(--cog-border)",
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase mb-1" style={{ color: "var(--cog-warm-gray)" }}>Bass (slash)</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...chord, bass: undefined })}
            className="px-2.5 py-1 rounded-lg text-xs"
            style={{
              background: !chord.bass ? "var(--cog-gold)" : "var(--cog-cream)",
              color: !chord.bass ? "white" : "var(--cog-charcoal)",
              border: "1px solid var(--cog-border)",
            }}
          >
            none
          </button>
          {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...chord, bass: { degree: d } })}
              className="px-2.5 py-1 rounded-lg text-xs"
              style={{
                background: chord.bass?.degree === d ? "var(--cog-gold)" : "var(--cog-cream)",
                color: chord.bass?.degree === d ? "white" : "var(--cog-charcoal)",
                border: "1px solid var(--cog-border)",
              }}
            >
              /{d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChordPicker;