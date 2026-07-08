// COG roles — the one role label (E1)
//
// Every role label in the UI renders through here, so the raw DB enum
// (`collaborator`) never leaks to a human. Text comes from A2's role model
// (roleLabel → ROLE_DISPLAY, via @/lib/invite/roles). Owners get the crown.

import { Crown } from "lucide-react";
import { roleLabel } from "@/lib/invite/roles";

export interface RoleBadgeProps {
  /** DB role (owner|collaborator|viewer) or a UI role string — both map safely. */
  role: string | null | undefined;
  /** Show the gold crown for owners (default true). */
  crown?: boolean;
  className?: string;
}

export default function RoleBadge({ role, crown = true, className = "" }: RoleBadgeProps) {
  const isOwner = role === "owner";
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      style={{ color: "#999", fontFamily: "var(--font-body)" }}
    >
      {crown && isOwner && (
        <Crown size={12} strokeWidth={1.8} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
      )}
      <span className="text-[0.8125rem]">{roleLabel(role)}</span>
    </span>
  );
}
