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
    // min-h-screen (100vh) is the fallback; 100dvh tracks the real mobile
    // viewport as the iOS/Android URL bar shows/hides. Unsupported browsers
    // ignore the dvh value and keep the class's 100vh.
    style={{ backgroundColor: "#FAFAF6", minHeight: "100dvh" }}
  >
    {glow && (
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 85% 95%, rgba(184,149,58,0.10) 0%, transparent 65%)",
        }}
        aria-hidden="true"
      />
    )}

    <div
      className="relative flex flex-col flex-1 w-full mx-auto px-6"
      // Real safe-area padding (the comment promised it; it was missing) so
      // content clears the notch + home indicator on notched devices. Insets
      // are 0 on non-notched/desktop, so this is a no-op there.
      style={{
        maxWidth: 430,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {children}
    </div>
  </div>
);

export default OnboardingShell;
