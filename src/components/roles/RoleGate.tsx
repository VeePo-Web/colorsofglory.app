// COG roles — the declarative permission gate (E1)
//
// The one-line way any feature (C2–C5, D2, D3, E2–E4) gates an action by
// capability. It asks the single source (useCapabilities) and, when the answer
// is no, renders a CALM view-only affordance — never a hidden control that
// leaves the user wondering, and never a dead button that looks tappable but
// isn't. View-only is a quiet STATE, aligned with "calm activity intelligence".
//
// Two shapes:
//   <RoleGate songId can="edit"> … </RoleGate>   — wrap the gated UI
//   const allowed = useCan(songId, "edit")        — gate imperatively
//
// For a control you'd rather DISABLE in place (keep it visible but inert), read
// useCapabilities().can(...) directly and set `disabled` — RoleGate is for the
// show-or-explain pattern.

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useCapabilities } from "@/lib/permissions";
import type { Capability } from "@/lib/permissions";

/** A gentle, non-anxious "you can look but not touch" hint. Not an error. */
export function ViewOnlyHint({ label = "View only", className = "" }: { label?: string; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${className}`}
      style={{
        backgroundColor: "rgba(0,0,0,0.04)",
        color: "var(--cog-muted)",
        fontFamily: "var(--font-body)",
        fontSize: "0.8125rem",
      }}
      // A calm, polite status — not an alert. Screen readers announce it softly.
      role="note"
    >
      <Lock size={13} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export interface RoleGateProps {
  songId: string | undefined;
  /** The capability required to see/use the children. */
  can: Capability;
  children: ReactNode;
  /** Custom denied UI. Defaults to a calm <ViewOnlyHint />. */
  fallback?: ReactNode;
  /** Render nothing (instead of the calm hint) when denied. */
  silent?: boolean;
  /** Treat a contributor as a Reviewer (comment/approve, no edit). */
  reviewer?: boolean;
}

/**
 * Render `children` only when the current user has `can` in this song.
 * Denied → `fallback` (or a calm view-only hint, or nothing if `silent`).
 */
export default function RoleGate({
  songId,
  can,
  children,
  fallback,
  silent = false,
  reviewer = false,
}: RoleGateProps) {
  const caps = useCapabilities(songId, { reviewer });

  if (caps.can(can)) return <>{children}</>;
  if (silent) return null;
  return <>{fallback ?? <ViewOnlyHint />}</>;
}

/** Imperative form: does the current user have `capability` in this song? */
export function useCan(
  songId: string | undefined,
  capability: Capability,
  opts?: { reviewer?: boolean },
): boolean {
  const caps = useCapabilities(songId, opts);
  return caps.can(capability);
}
