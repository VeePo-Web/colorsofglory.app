interface SettingsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Calm accessible switch row for settings screens.
 * Real `role="switch"` semantics; 44px touch target; gold only when on.
 */
const SettingsToggle = ({ label, description, checked, disabled = false, onChange }: SettingsToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-4 text-left transition-opacity disabled:opacity-50"
    style={{ minHeight: 44, padding: "10px 0" }}
  >
    <span className="min-w-0 flex-1">
      <span
        className="block text-sm font-medium"
        style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
      >
        {label}
      </span>
      {description && (
        <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: "var(--cog-muted)" }}>
          {description}
        </span>
      )}
    </span>
    <span
      aria-hidden="true"
      className="relative flex-shrink-0 rounded-full transition-colors duration-150"
      style={{
        width: 46,
        height: 28,
        backgroundColor: checked ? "var(--cog-gold)" : "rgba(28,26,23,0.14)",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-transform duration-150"
        style={{
          width: 22,
          height: 22,
          top: 3,
          left: 3,
          transform: checked ? "translateX(18px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(28,26,23,0.25)",
        }}
      />
    </span>
  </button>
);

export default SettingsToggle;
