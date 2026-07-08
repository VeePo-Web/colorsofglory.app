import { RotateCcw, ShieldCheck } from "lucide-react";
import type { SongVersion } from "@/integrations/cog/versions";
import type { SongMember } from "@/integrations/cog/members";
import { parseSnapshot, summarizeSnapshot } from "@/integrations/cog/versions";
import { relativeTime } from "./relativeTime";
import VersionSheetShell from "./VersionSheetShell";
import { versionHeadline } from "./VersionTimeline";

/**
 * Version detail (E3): what this snapshot held, summarized warmly — never raw
 * JSON. Restore lives here (gated); the Original gets its reassurance line.
 */

interface VersionDetailSheetProps {
  version: SongVersion;
  isOriginal: boolean;
  member: SongMember | undefined;
  canRestore: boolean;
  /** True when this version IS the current head — nothing to restore to. */
  isCurrent: boolean;
  onRestore: () => void;
  onClose: () => void;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      borderRadius: 12,
      backgroundColor: "var(--cog-cream-light)",
      border: "1px solid var(--cog-border)",
      padding: "10px 12px",
      textAlign: "center",
    }}
  >
    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
      {value}
    </p>
    <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cog-muted)", fontWeight: 700 }}>
      {label}
    </p>
  </div>
);

const VersionDetailSheet = ({
  version,
  isOriginal,
  member,
  canRestore,
  isCurrent,
  onRestore,
  onClose,
}: VersionDetailSheetProps) => {
  const snap = parseSnapshot(version.snapshot);
  const summary = snap ? summarizeSnapshot(snap) : null;

  return (
    <VersionSheetShell ariaLabel={`Version ${version.version_number} details`} onClose={onClose}>
      <div style={{ padding: "8px 20px 0" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "var(--cog-gold)" }}>
          v{version.version_number}
          {isOriginal ? " · ORIGINAL" : ""}
        </p>
        <h2
          style={{
            margin: "4px 0 2px",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-display)",
            lineHeight: 1.25,
          }}
        >
          {versionHeadline(version)}
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--cog-warm-gray)" }}>
          Saved by {member?.display_name ?? member?.first_name ?? "a collaborator"} ·{" "}
          {relativeTime(version.created_at)}
        </p>
        {version.description && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.55 }}>
            {version.description}
          </p>
        )}
      </div>

      {/* What this snapshot held */}
      <div style={{ padding: "16px 20px 4px" }}>
        {summary ? (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <Stat label="Sections" value={String(summary.sectionCount)} />
              <Stat label="Lines" value={String(summary.lineCount)} />
              <Stat label="Chords" value={String(summary.chordCount)} />
            </div>
            {summary.sections.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {summary.sections.map((s, i) => (
                  <li
                    key={`${s.label}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                      borderBottom: "1px solid var(--cog-border)",
                      paddingBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--cog-muted)", flexShrink: 0 }}>
                      {s.lineCount} {s.lineCount === 1 ? "line" : "lines"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.6 }}>
                A blank page — the song before its first words.
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.6 }}>
            This snapshot is kept safe, but its contents can't be previewed here.
          </p>
        )}
      </div>

      {isOriginal && (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "14px 20px 0",
            padding: "10px 12px",
            borderRadius: 12,
            backgroundColor: "var(--cog-gold-glow)",
            fontSize: 12.5,
            color: "var(--cog-charcoal)",
            lineHeight: 1.5,
          }}
        >
          <ShieldCheck size={16} strokeWidth={2} style={{ color: "var(--cog-gold)", flexShrink: 0 }} aria-hidden="true" />
          Your first version is always safe. It can never be deleted, and you can return to it anytime.
        </p>
      )}

      {/* Actions */}
      <div style={{ padding: "18px 16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
        {canRestore && snap && !isCurrent && (
          <button
            type="button"
            onClick={onRestore}
            className="active:scale-[0.97] transition-transform"
            style={{
              minHeight: 54,
              borderRadius: 16,
              backgroundColor: "var(--cog-gold)",
              color: "#FFF",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <RotateCcw size={16} strokeWidth={2.5} aria-hidden="true" />
            Restore this version
          </button>
        )}
        {isCurrent && (
          <p style={{ margin: 0, textAlign: "center", fontSize: 12.5, color: "var(--cog-warm-gray)" }}>
            This is where the song is right now.
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: "transparent",
            color: "var(--cog-warm-gray)",
            fontSize: 14,
            fontWeight: 600,
            border: "1.5px solid var(--cog-border)",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Close
        </button>
      </div>
    </VersionSheetShell>
  );
};

export default VersionDetailSheet;
