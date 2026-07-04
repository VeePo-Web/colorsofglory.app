import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { goBackOr } from "@/lib/nav/safeBack";

interface BackHeaderProps {
  to?: string;
  label?: string;
  right?: React.ReactNode;
  className?: string;
  /** Safe home when there is no in-app history to pop (cold load / deep link). */
  fallback?: string;
}

/**
 * Consistent top-left back button used on every interior screen.
 * 44px touch target, warm-gray color, active scale feedback.
 * Without an explicit `to`, it pops in-app history but never dead-ends:
 * on a cold load it routes to `fallback` instead of walking out of the app.
 */
const BackHeader = ({ to, label = "Back", right, className = "", fallback = "/songs" }: BackHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      goBackOr(navigate, location.key, fallback);
    }
  };

  return (
    <div
      className={`flex items-center justify-between px-5 pt-14 pb-2 ${className}`}
      style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
    >
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 transition-all duration-150 active:scale-95 active:opacity-60"
        style={{
          color: "var(--cog-warm-gray)",
          fontFamily: "var(--font-body)",
          fontSize: "0.9375rem",
          minWidth: 44,
          minHeight: 44,
          marginLeft: -6,
          paddingLeft: 6,
          paddingRight: 6,
        }}
        aria-label={`Go back: ${label}`}
      >
        <ArrowLeft size={18} strokeWidth={2} />
        <span>{label}</span>
      </button>
      {right && <div>{right}</div>}
    </div>
  );
};

export default BackHeader;
