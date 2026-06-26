import { Mic } from "lucide-react";

interface MicPermissionPanelProps {
  message: string;
  error: string | null;
  onOpenSettings: () => void;
  onCancel: () => void;
}

/**
 * MicPermissionPanel — the shared "microphone access needed" state for the
 * capture sheets. Calm and reverent: a gold mic glyph and an explanatory line,
 * never an alarm. The diagnostic detail (secure-context / framed-preview) is
 * shown in muted warm-gray, not red — it's guidance, not a failure.
 */
const MicPermissionPanel = ({ message, error, onOpenSettings, onCancel }: MicPermissionPanelProps) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "32px 32px 0",
      gap: 12,
    }}
  >
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        backgroundColor: "var(--cog-gold-glow)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Mic size={28} style={{ color: "var(--cog-gold)" }} />
    </div>
    <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--cog-charcoal)", margin: 0 }}>
      Microphone access needed
    </p>
    <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--cog-warm-gray)", lineHeight: 1.5, margin: 0 }}>
      {message}
    </p>
    {error && (
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", margin: 0 }}>
        {error}
      </p>
    )}
    <button
      type="button"
      onClick={onOpenSettings}
      style={{
        marginTop: 8,
        height: 48,
        padding: "0 28px",
        borderRadius: 9999,
        backgroundColor: "var(--cog-gold)",
        color: "#FFFFFF",
        fontFamily: "var(--font-body)",
        fontSize: 15,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
      }}
    >
      Open Settings →
    </button>
    <button
      type="button"
      onClick={onCancel}
      style={{
        // Stays visually light, but the tap target meets the 44px minimum so it's
        // easy to hit with a thumb — not a 13px-tall sliver of text.
        marginTop: 4,
        minHeight: 44,
        padding: "0 20px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        color: "var(--cog-muted)",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      Cancel
    </button>
  </div>
);

export default MicPermissionPanel;
