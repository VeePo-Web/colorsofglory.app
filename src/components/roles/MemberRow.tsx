// COG roles — a collaborator row with owner role-management (E1)
//
// One member of a song, rendered with a RoleBadge. When the signed-in viewer
// can manage roles (Owner), non-owner rows expose calm promote/demote + remove
// controls — the pencil is now a real action, not a dead affordance. Mutations
// are routed by the parent through A3's updateMemberRole / removeMember and are
// applied optimistically there. Owners are never demotable/removable from this
// UI, which structurally protects the last-Owner invariant.

import { useState } from "react";
import { Crown, Pencil, X, UserMinus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { SongMemberRole } from "@/types/role";
import RoleBadge from "./RoleBadge";

export interface ManageableMember {
  userId: string;
  firstName: string;
  lastName: string;
  role: SongMemberRole;
  isOwner: boolean;
  avatarColor: string;
  avatarInitials: string;
}

export interface MemberRowProps {
  member: ManageableMember;
  /** The signed-in viewer can manage roles (Owner). */
  canManage: boolean;
  onSetRole: (userId: string, role: SongMemberRole) => Promise<void> | void;
  onRemove: (userId: string) => Promise<void> | void;
}

type Mode = "idle" | "menu" | "confirmRemove";

export default function MemberRow({ member, canManage, onSetRole, onRemove }: MemberRowProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");

  // Owners are managed via a separate ownership-transfer flow, never here — so
  // an Owner row shows only the crown and the last Owner can never be demoted.
  const manageable = canManage && !member.isOwner;
  const name = `${member.firstName} ${member.lastName}`.trim();
  const promoteTo: SongMemberRole | null =
    member.role === "viewer" ? "collaborator" : member.role === "collaborator" ? "viewer" : null;

  const run = async (fn: () => Promise<void> | void, saidWhat: string) => {
    setBusy(true);
    try {
      await fn();
      setAnnounce(saidWhat);
      setMode("idle");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-center gap-3">
        <div
          className="rounded-full flex items-center justify-center text-white font-bold text-[0.75rem] flex-shrink-0"
          style={{ width: 38, height: 38, backgroundColor: member.avatarColor }}
          aria-hidden="true"
        >
          {member.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[0.9375rem] font-medium leading-snug truncate" style={{ color: "var(--cog-charcoal)" }}>
            {name || "Someone"}
          </p>
          <RoleBadge role={member.role} />
        </div>

        {member.isOwner && (
          <Crown size={14} strokeWidth={1.5} style={{ color: "var(--cog-gold)", flexShrink: 0 }} aria-label="Owner" />
        )}

        {manageable && mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("menu")}
            className="transition-opacity hover:opacity-70 active:scale-90 p-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cog-gold)]"
            aria-label={`Manage ${name || "collaborator"}'s role`}
            style={{ color: "#999" }}
          >
            <Pencil size={14} strokeWidth={1.6} />
          </button>
        )}

        {manageable && mode !== "idle" && (
          <button
            type="button"
            onClick={() => setMode("idle")}
            disabled={busy}
            className="transition-opacity hover:opacity-70 active:scale-90 p-2 rounded-full disabled:opacity-40"
            aria-label="Close role controls"
            style={{ color: "#999" }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Calm inline management — no modal, no red alarm. */}
      {manageable && mode === "menu" && (
        <div className="flex flex-wrap gap-2 mt-3 pl-[50px]">
          {promoteTo && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => onSetRole(member.userId, promoteTo),
                  `${name} is now a ${promoteTo === "collaborator" ? "Contributor" : "Viewer"}.`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "var(--cog-gold-a10)", color: "var(--cog-gold)" }}
            >
              {promoteTo === "collaborator" ? (
                <ArrowUpCircle size={14} strokeWidth={1.8} />
              ) : (
                <ArrowDownCircle size={14} strokeWidth={1.8} />
              )}
              {promoteTo === "collaborator" ? "Make Contributor" : "Make Viewer"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("confirmRemove")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "rgba(0,0,0,0.04)", color: "#666" }}
          >
            <UserMinus size={14} strokeWidth={1.8} />
            Remove
          </button>
        </div>
      )}

      {manageable && mode === "confirmRemove" && (
        <div className="flex items-center justify-between gap-2 mt-3 pl-[50px]">
          <p className="text-[0.8125rem]" style={{ color: "#666" }}>
            Remove {name || "this person"} from this song?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("menu")}
              className="rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ color: "#666" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => onRemove(member.userId), `${name} was removed from this song.`)}
              className="rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "var(--cog-charcoal)", color: "#FFFFFF" }}
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {/* Polite announcement — role changes are calm, not assertive. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
