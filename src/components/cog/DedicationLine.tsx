import { useRef, useState } from "react";
import { useDedication, DEDICATION_MAX } from "@/lib/songs/dedication";

interface DedicationLineProps {
  songId: string;
  /** Server truth when the surface has it (SongDetail/SongCard). Omit if unknown. */
  serverValue?: string | null;
  /** Owner/Contributor may edit; viewers just read. The server stays the gate. */
  canEdit?: boolean;
  /**
   * Show the barely-there "add a dedication" affordance when empty. Only the
   * workspace header opts in — every other surface stays genuinely invisible.
   */
  showAddWhenEmpty?: boolean;
  align?: "center" | "left";
  className?: string;
}

/**
 * DedicationLine — the song's quiet "for …" line, and its only edit surface.
 * Inherits the header's "Key · BPM IF available" grammar: when there is no
 * dedication (and no add affordance requested), it renders NOTHING — no
 * placeholder, no empty state, no badge. When present it is one muted italic
 * line in the type hierarchy — no divider, no box, never gold. Tap to change;
 * clearing the text returns the song to invisible. Saves are offline-first
 * and unfailing (lib/songs/dedication).
 */
const DedicationLine = ({
  songId,
  serverValue,
  canEdit = false,
  showAddWhenEmpty = false,
  align = "center",
  className = "",
}: DedicationLineProps) => {
  const { text, save } = useDedication(songId, serverValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";

  const beginEdit = () => {
    if (!canEdit) return;
    setDraft(text ?? "");
    setEditing(true);
    // Focus after the input exists; the writer chose to edit, so the keyboard
    // is invited here (unlike the birth offer, which never grabs focus).
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commit = () => {
    save(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={DEDICATION_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label="Song dedication — who this song is for"
        placeholder="who this song is for"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        className={`block w-full max-w-xs rounded-lg italic ${alignClass} ${className}`}
        // 16px floor so iOS Safari never zooms the header when focused.
        style={{
          minHeight: 36,
          padding: "0 10px",
          fontSize: 16,
          fontFamily: "var(--font-body)",
          color: "var(--cog-charcoal)",
          background: "var(--cog-cream-light)",
          border: "1px solid var(--cog-border)",
          caretColor: "var(--cog-gold)",
        }}
      />
    );
  }

  if (text) {
    const line = `for ${text}`;
    return canEdit ? (
      <button
        type="button"
        onClick={beginEdit}
        aria-label={`Song dedication: ${line}. Tap to change it.`}
        className={`block italic text-[0.8125rem] ${alignClass} ${className}`}
        style={{
          minHeight: 32,
          padding: "0 8px",
          background: "transparent",
          border: "none",
          color: "var(--cog-warm-gray)",
          fontFamily: "var(--font-body)",
          cursor: "pointer",
        }}
      >
        {line}
      </button>
    ) : (
      <p
        className={`italic text-[0.8125rem] ${alignClass} ${className}`}
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", margin: 0 }}
      >
        {line}
      </p>
    );
  }

  if (showAddWhenEmpty && canEdit) {
    return (
      <button
        type="button"
        onClick={beginEdit}
        aria-label="Add a dedication — who this song is for"
        className={`block text-[0.75rem] ${alignClass} ${className}`}
        style={{
          minHeight: 32,
          padding: "0 8px",
          background: "transparent",
          border: "none",
          color: "var(--cog-muted)",
          fontFamily: "var(--font-body)",
          cursor: "pointer",
        }}
      >
        add a dedication
      </button>
    );
  }

  return null;
};

export default DedicationLine;
