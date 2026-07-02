import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";

/**
 * Shared calm reading layout for /terms and /privacy.
 * Opened in a new tab from onboarding/invite screens, so "close" guidance
 * beats in-app navigation; window.history covers direct visits.
 */
const LegalLayout = ({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) => (
  <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
    <div className="pointer-events-none fixed inset-0 cog-glow" />
    <div className="relative mx-auto w-full px-6 pb-20" style={{ maxWidth: 640 }}>
      <div className="pt-12 pb-2">
        <button
          onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "var(--cog-warm-gray)", minHeight: 44 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
      </div>

      <div className="flex justify-center pb-8">
        <CogBrand variant="stacked" size="sm" />
      </div>

      <h1
        className="mb-2 text-center text-[2rem] font-bold leading-tight"
        style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
      >
        {title}
      </h1>
      <p className="mb-10 text-center text-[0.8125rem]" style={{ color: "var(--cog-muted)" }}>
        Last updated: {updated}
      </p>

      <div className="flex flex-col gap-8">{children}</div>
    </div>
  </div>
);

export const LegalSection = ({ heading, children }: { heading: string; children: ReactNode }) => (
  <section>
    <h2
      className="mb-2 text-[1.125rem] font-semibold"
      style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
    >
      {heading}
    </h2>
    <p className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
      {children}
    </p>
  </section>
);

export default LegalLayout;
