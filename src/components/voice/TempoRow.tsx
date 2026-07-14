import { useState } from "react";
import { Headphones } from "lucide-react";
import TapTempo from "@/components/capture/TapTempo";
import { useAudioSession } from "@/hooks/useAudioSession";
import { clampBpm } from "@/lib/audio/metronome";

interface TempoRowProps {
  /** The song's canonical shared tempo (everyone reads this one value). */
  bpm: number | null;
  /** Owner + collaborator may set the shared tempo; viewers see it read-only. */
  canEdit: boolean;
  /** Persist a confirmed tempo (via cog/songs → realtime to every open room). */
  onSaveTempo: (bpm: number) => Promise<boolean>;
  countInOn: boolean;
  onCountInToggle: (on: boolean) => void;
}

/**
 * TempoRow — the pre-record tempo transport, shown at the record-over moment
 * (the stack sheet) where tempo, count-in, and earbuds actually matter next.
 *
 * Tap-tempo produces a PROPOSAL; the shared song tempo changes only on the
 * explicit "Set" confirm — never silently (the same rule the F13 auto-detect
 * prefill will follow). The earbuds confirmation is here because it is what
 * unlocks the audible guide + click during the take; without it, recording
 * falls back to the visual beat — honestly, with no bleed.
 */
const TempoRow = ({ bpm, canEdit, onSaveTempo, countInOn, onCountInToggle }: TempoRowProps) => {
  const { headphonesConfirmed, setHeadphones } = useAudioSession();
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const proposal = draft != null && draft !== bpm ? clampBpm(draft) : null;

  const confirmTempo = async () => {
    if (proposal == null || saving) return;
    setSaving(true);
    const ok = await onSaveTempo(proposal);
    setSaving(false);
    setNote(ok ? `Song tempo set to ${proposal} BPM for everyone.` : "Couldn't save the tempo — it stays as it was.");
    if (ok) setDraft(null);
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {canEdit && <TapTempo onBpm={setDraft} />}

        {proposal != null && canEdit && (
          <button
            type="button"
            onClick={() => void confirmTempo()}
            disabled={saving}
            className="transition-transform active:scale-95"
            style={{
              minHeight: 44,
              padding: "0 14px",
              borderRadius: 9999,
              background: "var(--cog-gold)",
              border: "1px solid var(--cog-gold)",
              color: "var(--cog-cream-light)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
            aria-label={`Set the song tempo to ${proposal} BPM for everyone`}
          >
            {saving ? "Setting…" : `Set ${proposal} BPM`}
          </button>
        )}

        {bpm != null && proposal == null && (
          <span
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 12px",
              borderRadius: 9999,
              border: "1px solid var(--cog-border)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--cog-charcoal)",
            }}
          >
            {bpm} BPM · shared
          </span>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={countInOn}
          aria-label="Count in one bar before recording starts"
          disabled={bpm == null}
          onClick={() => onCountInToggle(!countInOn)}
          className="transition-transform active:scale-95"
          style={{
            minHeight: 44,
            padding: "0 14px",
            borderRadius: 9999,
            background: countInOn && bpm != null ? "var(--cog-gold)" : "transparent",
            border: "1px solid var(--cog-border-gold)",
            color: countInOn && bpm != null ? "var(--cog-cream-light)" : bpm == null ? "var(--cog-muted)" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            cursor: bpm == null ? "default" : "pointer",
          }}
        >
          {countInOn && bpm != null ? "Count-in on" : "Count-in"}
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={headphonesConfirmed}
          aria-label={
            headphonesConfirmed
              ? "On earbuds — the take and click can play while you record"
              : "I'm on earbuds — hear the take and click while recording"
          }
          onClick={() => setHeadphones(!headphonesConfirmed)}
          className="transition-transform active:scale-95"
          style={{
            minHeight: 44,
            padding: "0 12px",
            borderRadius: 9999,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: headphonesConfirmed ? "var(--cog-gold-pale)" : "transparent",
            border: "1px solid var(--cog-border-gold)",
            color: headphonesConfirmed ? "var(--cog-charcoal)" : "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Headphones size={14} strokeWidth={2} />
          {headphonesConfirmed ? "Earbuds" : "Earbuds?"}
        </button>
      </div>

      <p
        aria-live="polite"
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--cog-warm-gray)",
        }}
      >
        {note ??
          (bpm == null
            ? canEdit
              ? "Tap a tempo to give this song a shared BPM — count-in and the click need one."
              : "No shared tempo yet."
            : headphonesConfirmed
              ? "You'll hear the take and the click in your earbuds while you record."
              : "Recording on the speaker: the beat shows as a gold pulse — put on earbuds to hear the take while you record.")}
      </p>
    </div>
  );
};

export default TempoRow;
