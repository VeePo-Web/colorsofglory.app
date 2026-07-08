import { ShieldCheck } from "lucide-react";
import type { SongVersion } from "@/integrations/cog/versions";
import VersionSheetShell from "./VersionSheetShell";
import { versionHeadline } from "./VersionTimeline";

/**
 * Restore confirm (E3): protective, never scary. The promise is stated right
 * on the button path — the current version is saved first, nothing is lost.
 */

interface RestoreConfirmSheetProps {
  version: SongVersion;
  isRestoring: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const RestoreConfirmSheet = ({ version, isRestoring, error, onConfirm, onClose }: RestoreConfirmSheetProps) => (
  <VersionSheetShell ariaLabel="Restore this version" onClose={onClose} hideClose>
    <div style={{ padding: "8px 20px 0", textAlign: "center" }}>
      <div
        aria-hidden="true"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: "var(--cog-gold-glow)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "4px auto 12px",
        }}
      >
        <ShieldCheck size={22} strokeWidth={2} style={{ color: "var(--cog-gold)" }} />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.3 }}>
        Restore to v{version.version_number}?
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--cog-warm-gray)", lineHeight: 1.6 }}>
        “{versionHeadline(version)}” will become the song again. Your current version is saved
        first, so nothing is lost — you can undo this anytime.
      </p>
    </div>

    <p
      aria-live="polite"
      style={{ margin: 0, padding: "10px 20px 0", minHeight: 20, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: error ? "#C0392B" : "var(--cog-warm-gray)" }}
    >
      {error ?? (isRestoring ? "Saving your current version, then restoring…" : "")}
    </p>

    <div style={{ padding: "12px 16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isRestoring}
        className="active:scale-[0.97] transition-transform"
        style={{
          minHeight: 54,
          borderRadius: 16,
          backgroundColor: isRestoring ? "rgba(184,149,58,0.35)" : "var(--cog-gold)",
          color: "#FFF",
          fontSize: 16,
          fontWeight: 700,
          border: "none",
          cursor: isRestoring ? "default" : "pointer",
          width: "100%",
        }}
      >
        {isRestoring ? "Restoring…" : "Restore this version"}
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={isRestoring}
        style={{
          minHeight: 44,
          borderRadius: 14,
          backgroundColor: "transparent",
          color: "var(--cog-warm-gray)",
          fontSize: 14,
          fontWeight: 600,
          border: "1.5px solid var(--cog-border)",
          cursor: isRestoring ? "default" : "pointer",
          width: "100%",
        }}
      >
        Not now
      </button>
    </div>
  </VersionSheetShell>
);

export default RestoreConfirmSheet;
