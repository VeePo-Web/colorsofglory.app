import { Loader2 } from "lucide-react";

interface GoldButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  className?: string;
  fullWidth?: boolean;
}

/**
 * Full-pill gold CTA — the primary action button across all COG screens.
 * Matches the reference images: full-radius pill, gold fill, white text.
 */
const GoldButton = ({
  children,
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  loadingText,
  className = "",
  fullWidth = true,
}: GoldButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        flex items-center justify-center gap-2
        rounded-full font-semibold text-white
        transition-all duration-150
        active:scale-[0.97]
        disabled:opacity-40
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      style={{
        height: 56,
        // Locked brand gold token (CLAUDE.md §2) — was a near-miss #B5935A.
        backgroundColor: "var(--cog-gold)",
        fontFamily: "var(--font-body)",
        fontSize: "1rem",
        boxShadow: isDisabled ? "none" : "0 4px 16px rgba(184,149,58,0.35)",
      }}
    >
      {loading && <Loader2 size={18} className="animate-spin opacity-80" />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
};

export default GoldButton;
