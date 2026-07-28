import { type CSSProperties, type ReactNode } from "react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

interface TrappedDialogProps {
  onClose: () => void;
  "aria-label": string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * TrappedDialog — a focus-trapped modal dialog for sheets the host renders
 * INLINE (conditional JSX inside a big component can't call useModalFocusTrap
 * itself — hooks don't nest in conditionals). Mounting this wrapper when the
 * sheet opens runs the shared trap at exactly the right moment: focus moves
 * in (unless something inside already took it), Tab wraps, Escape closes,
 * focus returns to the trigger on close. One trap, every sheet, no hand-rolls.
 */
const TrappedDialog = ({ onClose, "aria-label": ariaLabel, style, children }: TrappedDialogProps) => {
  const ref = useModalFocusTrap(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      style={{ outline: "none", ...style }}
    >
      {children}
    </div>
  );
};

export default TrappedDialog;
