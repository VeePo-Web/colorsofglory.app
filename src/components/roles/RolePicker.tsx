// COG roles — the canonical "Choose their role" selector (E1)
//
// One selector, consumed by BOTH the People screen and B3's invite flow, so
// there is exactly one role picker with one visual language (gold-selected
// border + soft ring — matches reference image "download (19)"). Labels +
// descriptions come from ONE place: A2's role model (ROLE_DISPLAY, via
// @/lib/invite/roles — B3's interim canonical home until A2 re-homes it to
// @/types; consumed, never redefined here).
//
// Reviewer is surfaced consistently with the other roles but rendered
// "coming soon" and non-selectable, because it is a permission FLAG, not yet a
// stored DB role (see capabilities.ts). Callers choose which roles appear via
// `roles`; the default is the invite set (Viewer / Contributor / Reviewer).

import type { CSSProperties } from "react";
import { ROLE_DISPLAY, type UiRole } from "@/lib/invite/roles";

export interface RolePickerProps {
  /** Currently-selected role. */
  value: UiRole;
  /** Fired when a *selectable* (non-coming-soon) role is chosen. */
  onChange: (role: UiRole) => void;
  /** Roles to show, in order. Default: viewer / contributor / reviewer. */
  roles?: UiRole[];
  /** "stack" = full-width cards (default, People + invite); "row" = side-by-side. */
  layout?: "stack" | "row";
  /** Accessible group label. */
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_INVITE_ROLES: UiRole[] = ["viewer", "contributor", "reviewer"];

const RoleCard = ({
  role,
  selected,
  disabled,
  onSelect,
}: {
  role: UiRole;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) => {
  const { label, selectDesc, comingSoon } = ROLE_DISPLAY[role];
  const style: CSSProperties = {
    backgroundColor: selected ? "var(--cog-gold-a04)" : "#FFFFFF",
    border: selected ? "1.5px solid var(--cog-gold)" : "1.5px solid rgba(0,0,0,0.08)",
    boxShadow: selected
      ? "0 0 0 3px var(--cog-gold-a12), 0 2px 12px rgba(0,0,0,0.06)"
      : "0 2px 8px rgba(0,0,0,0.05)",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
  };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className="w-full flex-1 rounded-2xl p-4 text-left transition-all duration-150 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--cog-gold)]"
      style={style}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p
          className="text-[0.9375rem] font-semibold"
          style={{ color: selected ? "var(--cog-gold)" : "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
        >
          {label}
        </p>
        {comingSoon && (
          <span
            className="text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: "rgba(0,0,0,0.05)", color: "var(--cog-muted)" }}
          >
            Soon
          </span>
        )}
      </div>
      <p className="text-[0.75rem] leading-snug" style={{ color: "#666" }}>
        {selectDesc}
      </p>
    </button>
  );
};

/**
 * Canonical role selector. Coming-soon roles (Reviewer today) are shown for
 * clarity but cannot be selected — the picker only fires onChange for roles
 * that are actually storable right now.
 */
export default function RolePicker({
  value,
  onChange,
  roles = DEFAULT_INVITE_ROLES,
  layout = "stack",
  ariaLabel = "Choose their role",
  className = "",
}: RolePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex gap-2 ${layout === "stack" ? "flex-col" : "flex-row"} ${className}`}
    >
      {roles.map((role) => (
        <RoleCard
          key={role}
          role={role}
          selected={value === role}
          disabled={Boolean(ROLE_DISPLAY[role].comingSoon)}
          onSelect={() => onChange(role)}
        />
      ))}
    </div>
  );
}
