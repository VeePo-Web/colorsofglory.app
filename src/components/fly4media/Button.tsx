import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "ghost" | "light";

interface BaseProps {
  variant?: Variant;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", arrow = true, className = "", children, ...rest },
  ref,
) {
  const base =
    variant === "primary" ? "btn-primary group"
    : variant === "light"  ? "btn-light group"
    : "btn-ghost group";
  return (
    <button
      ref={ref}
      data-cursor="hover"
      {...(variant === "primary" || variant === "light" ? { "data-magnetic": "" } : {})}
      className={`${base} ${className}`}
      {...rest}
    >
      <span>{children}</span>
      {arrow && <span className="link-arrow">↗</span>}
    </button>
  );
});

interface LinkButtonProps extends BaseProps {
  to: string;
  ariaLabel?: string;
  onClick?: () => void;
}

export function LinkButton({
  to,
  variant = "primary",
  arrow = true,
  className = "",
  children,
  ariaLabel,
  onClick,
}: LinkButtonProps) {
  const base =
    variant === "primary" ? "btn-primary group"
    : variant === "light"  ? "btn-light group"
    : "btn-ghost group";
  return (
    <Link
      to={to}
      data-cursor="hover"
      {...(variant === "primary" || variant === "light" ? { "data-magnetic": "" } : {})}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${base} ${className}`}
    >
      <span>{children}</span>
      {arrow && <span className="link-arrow">↗</span>}
    </Link>
  );
}
