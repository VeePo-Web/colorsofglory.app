import { useState } from "react";
import { Bookmark } from "lucide-react";
import VersionSheetShell from "./VersionSheetShell";

/**
 * "Save a version" (E3): name this moment so the timeline stays meaningful —
 * "Before the bridge rewrite". The label is optional; saving is always calm.
 */

interface SaveVersionSheetProps {
  isSaving: boolean;
  error: string | null;
  onSave: (label: string) => void;
  onClose: () => void;
}

const SaveVersionSheet = ({ isSaving, error, onSave, onClose }: SaveVersionSheetProps) => {
  const [label, setLabel] = useState("");

  return (
    <VersionSheetShell ariaLabel="Save a version" onClose={onClose}>
      <div style={{ padding: "8px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bookmark size={16} strokeWidth={2} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
            Save a version
          </h2>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.55 }}>
          Keep this exact moment of the song safe. A name helps you find it later.
        </p>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        <label
          htmlFor="cog-version-label"
          style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cog-muted)", marginBottom: 6 }}
        >
          Name (optional)
        </label>
        <input
          id="cog-version-label"
          type="text"
          value={label}
          maxLength={80}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSaving) onSave(label);
          }}
          placeholder="Before the bridge rewrite"
          style={{
            width: "100%",
            minHeight: 48,
            borderRadius: 14,
            border: "1.5px solid var(--cog-border)",
            backgroundColor: "var(--cog-cream-light)",
            padding: "0 14px",
            fontSize: 15,
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
            outlineColor: "var(--cog-gold)",
          }}
        />
      </div>

      <p
        aria-live="polite"
        style={{ margin: 0, padding: "8px 20px 0", minHeight: 20, fontSize: 12.5, fontWeight: 600, color: error ? "#C0392B" : "var(--cog-warm-gray)" }}
      >
        {error ?? (isSaving ? "Saving this version…" : "")}
      </p>

      <div style={{ padding: "10px 16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => onSave(label)}
          disabled={isSaving}
          className="active:scale-[0.97] transition-transform"
          style={{
            minHeight: 54,
            borderRadius: 16,
            backgroundColor: isSaving ? "rgba(184,149,58,0.35)" : "var(--cog-gold)",
            color: "#FFF",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            cursor: isSaving ? "default" : "pointer",
            width: "100%",
          }}
        >
          {isSaving ? "Saving…" : "Save this version"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          style={{
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: "transparent",
            color: "var(--cog-warm-gray)",
            fontSize: 14,
            fontWeight: 600,
            border: "1.5px solid var(--cog-border)",
            cursor: isSaving ? "default" : "pointer",
            width: "100%",
          }}
        >
          Not now
        </button>
      </div>
    </VersionSheetShell>
  );
};

export default SaveVersionSheet;
