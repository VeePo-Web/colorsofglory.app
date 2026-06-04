interface OnboardingShellProps {
  children: React.ReactNode;
  className?: string;
  /** Soft amber glow in bottom corner — enabled on most onboarding screens */
  glow?: boolean;
}

/**
 * Shared layout shell for all onboarding screens.
 * Near-white background, centered max-width container, safe-area padding.
 * Matches the clean reference mockup background (#FAFAF6).
 */
const OnboardingShell = ({
  children,
  className = "",
  glow = true,
}: OnboardingShellProps) => (
  <div
    className={`relative min-h-screen flex flex-col ${className}`}
    style={{ backgroundColor: "#FAFAF6" }}
  >
    {glow && (
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 85% 95%, rgba(181,147,90,0.10) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />
    )}

    <div
      className="relative flex flex-col flex-1 w-full mx-auto px-6"
      style={{ maxWidth: 430 }}
    >
      {children}
    </div>
  </div>
);

export default OnboardingShell;
