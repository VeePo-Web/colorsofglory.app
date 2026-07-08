import { History, RotateCcw, ShieldCheck } from "lucide-react";
import type { SongVersion } from "@/integrations/cog/versions";
import type { SongMember } from "@/integrations/cog/members";
import { parseSnapshot, summarizeSnapshot } from "@/integrations/cog/versions";
import { relativeTime } from "./relativeTime";

/**
 * The snapshot timeline (E3): versions newest-first down a warm gold spine.
 * Each card = version number, what it was, who saved it, when. The Original
 * sits at the bottom with its shield — always there, always safe.
 */

// ─── Copy helpers ─────────────────────────────────────────────────────────────

/** The card's one-line headline for a version. Calm, never system-y. */
export function versionHeadline(v: SongVersion): string {
  if (v.label) return v.label;
  if (v.kind === "restore_point") return "Restored version";
  if (v.kind === "auto") return "Auto snapshot";
  return "Saved version";
}

function kindTint(v: SongVersion, isOriginal: boolean): string {
  if (isOriginal) return "var(--cog-gold)";
  if (v.kind === "restore_point") return "#7A8B6F"; // sage — a gentle return
  if (v.kind === "manual") return "var(--cog-gold)";
  return "var(--cog-muted)";
}

/** Cheap what-it-held line straight from the stored snapshot. */
function snapshotLine(v: SongVersion): string | null {
  const snap = parseSnapshot(v.snapshot);
  if (!snap) return null;
  const s = summarizeSnapshot(snap);
  if (s.isEmpty) return "A blank page — the song before its first words.";
  const parts = [
    `${s.sectionCount} ${s.sectionCount === 1 ? "section" : "sections"}`,
    `${s.lineCount} ${s.lineCount === 1 ? "line" : "lines"}`,
  ];
  if (s.chordCount > 0) parts.push(`${s.chordCount} chords`);
  return parts.join(" · ");
}

// ─── Actor chip ───────────────────────────────────────────────────────────────

const ActorChip = ({ member }: { member: SongMember | undefined }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        backgroundColor: member?.avatar_color ?? "var(--cog-muted)",
        color: "#FFF",
        fontSize: 8,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {member?.initials ?? "•"}
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cog-warm-gray)" }}>
      {member?.display_name ?? member?.first_name ?? "A collaborator"}
    </span>
  </span>
);

// ─── Card ─────────────────────────────────────────────────────────────────────

interface VersionCardProps {
  version: SongVersion;
  isOriginal: boolean;
  member: SongMember | undefined;
  onOpen: () => void;
}

const VersionCard = ({ version, isOriginal, member, onOpen }: VersionCardProps) => {
  const tint = kindTint(version, isOriginal);
  const detail = snapshotLine(version);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Version ${version.version_number}${isOriginal ? ", the original" : ""}: ${versionHeadline(version)}, ${relativeTime(version.created_at)}`}
      className="w-full text-left transition-transform active:scale-[0.98]"
      style={{
        borderRadius: 16,
        backgroundColor: "var(--cog-cream-light)",
        border: isOriginal ? "1.5px solid var(--cog-border-gold)" : "1px solid var(--cog-border)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: tint,
              fontFamily: "var(--font-body)",
              flexShrink: 0,
            }}
          >
            v{version.version_number}
          </span>
          {isOriginal && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--cog-gold)",
                backgroundColor: "var(--cog-gold-glow)",
                borderRadius: 999,
                padding: "3px 8px",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={11} strokeWidth={2.5} aria-hidden="true" />
              Original
            </span>
          )}
          {version.kind === "restore_point" && !isOriginal && (
            <RotateCcw size={12} strokeWidth={2.5} style={{ color: tint, flexShrink: 0 }} aria-hidden="true" />
          )}
        </span>
        <span style={{ fontSize: 11, color: "var(--cog-muted)", flexShrink: 0 }}>
          {relativeTime(version.created_at)}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          color: "var(--cog-charcoal)",
          fontFamily: "var(--font-display)",
          lineHeight: 1.3,
        }}
      >
        {versionHeadline(version)}
      </p>

      {detail && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--cog-warm-gray)", lineHeight: 1.5 }}>
          {detail}
        </p>
      )}

      <ActorChip member={member} />
    </button>
  );
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

interface VersionTimelineProps {
  versions: SongVersion[];
  originalId: string | null;
  membersById: Map<string, SongMember>;
  onOpen: (version: SongVersion) => void;
}

const VersionTimeline = ({ versions, originalId, membersById, onOpen }: VersionTimelineProps) => {
  if (versions.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ padding: "56px 24px", gap: 12 }}
      >
        <History size={28} strokeWidth={1.5} style={{ color: "var(--cog-muted)" }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: 15, color: "var(--cog-warm-gray)", lineHeight: 1.6, maxWidth: 280 }}>
          Nothing here yet — versions will appear as the song grows, and every one stays safe.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      {/* The spine */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 5,
          top: 10,
          bottom: 10,
          width: 2,
          borderRadius: 1,
          background:
            "linear-gradient(to bottom, var(--cog-border), var(--cog-border-gold))",
        }}
      />
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {versions.map((v) => {
          const isOriginal = v.id === originalId;
          return (
            <li key={v.id} style={{ position: "relative" }}>
              {/* Node dot on the spine */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -18,
                  top: 20,
                  width: 8,
                  height: 8,
                  marginLeft: 2,
                  borderRadius: "50%",
                  backgroundColor: isOriginal ? "var(--cog-gold)" : "var(--cog-cream-dark)",
                  border: isOriginal ? "none" : "1.5px solid var(--cog-border)",
                }}
              />
              <VersionCard
                version={v}
                isOriginal={isOriginal}
                member={membersById.get(v.created_by_user_id)}
                onOpen={() => onOpen(v)}
              />
            </li>
          );
        })}
      </ol>

      {versions.length === 1 && (
        <p
          style={{
            margin: "16px 0 0",
            fontSize: 13,
            color: "var(--cog-warm-gray)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Just the original so far — every save lives here.
        </p>
      )}
    </div>
  );
};

export default VersionTimeline;
