import type { CSSProperties, ElementType } from "react";
import { useCallback } from "react";
import { useVibration } from "@/hooks/useVibration";
import { cn } from "@/lib/utils";

export interface CreativeDockAction {
  id: string;
  label: string;
  icon: ElementType;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  haptic?: number | number[];
  ariaLabel?: string;
}

interface CreativeActionDockProps {
  actions: CreativeDockAction[];
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_HAPTIC = [5];
const PRIMARY_HAPTIC = [9];

const CreativeActionDock = ({ actions, className, style }: CreativeActionDockProps) => {
  const { vibrate } = useVibration();

  const handlePress = useCallback(
    (action: CreativeDockAction) => {
      if (action.disabled || action.loading) return;
      vibrate(action.haptic ?? (action.primary ? PRIMARY_HAPTIC : DEFAULT_HAPTIC));
      action.onClick();
    },
    [vibrate],
  );

  return (
    <div
      aria-label="Quick creation actions"
      className={cn("cog-creation-dock", className)}
      style={style}
    >
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handlePress(action)}
            disabled={action.disabled || action.loading}
            aria-label={action.ariaLabel ?? action.label}
            aria-busy={action.loading || undefined}
            data-primary={action.primary ? "true" : undefined}
            className={cn(
              "cog-creation-action",
              action.primary && "cog-creation-action-primary",
            )}
          >
            <span className="cog-creation-action-icon" aria-hidden="true">
              <Icon size={action.primary ? 21 : 18} strokeWidth={action.primary ? 2.35 : 2} />
            </span>
            <span className="cog-creation-action-label">
              {action.loading ? "Loading..." : action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CreativeActionDock;
