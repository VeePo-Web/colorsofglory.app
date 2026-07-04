interface OnboardingProgressProps {
  /** 1-based index of the current step. */
  step: number;
  /** Total number of steps in this lane. */
  total: number;
  className?: string;
}

/**
 * Calm momentum cue for the create-song onboarding lane.
 *
 * A quiet row of dots — the active one elongates to a gold pill. Momentum
 * (you can see you're nearly there) without the loud, aggressive progress bars
 * of commerce apps. Honours the "creative sanctuary" tone: subtle, reverent.
 */
const OnboardingProgress = ({ step, total, className = "" }: OnboardingProgressProps) => (
  <div
    className={`flex items-center justify-center gap-1.5 ${className}`}
    role="progressbar"
    aria-valuenow={step}
    aria-valuemin={1}
    aria-valuemax={total}
    aria-label={`Step ${step} of ${total}`}
  >
    {/* The active pill breathes a soft gold glow — alive, not static.
        Reduced-motion holds it still (the glow stays, the pulse stops). */}
    <style>{`
      @keyframes cogDotBreathe {
        0%, 100% { box-shadow: 0 0 0 0 rgba(181,147,90,0.28); }
        50% { box-shadow: 0 0 6px 1.5px rgba(181,147,90,0.30); }
      }
      .cog-dot-breathe { animation: cogDotBreathe 2.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .cog-dot-breathe { animation: none; } }
    `}</style>
    {Array.from({ length: total }).map((_, i) => {
      const active = i === step - 1;
      const done = i < step - 1;
      return (
        <span
          key={i}
          className={`rounded-full transition-all duration-300 ${active ? "cog-dot-breathe" : ""}`}
          style={{
            height: 6,
            width: active ? 22 : 6,
            backgroundColor: active
              ? "#B5935A"
              : done
              ? "rgba(181,147,90,0.45)"
              : "rgba(0,0,0,0.10)",
          }}
        />
      );
    })}
  </div>
);

export default OnboardingProgress;
