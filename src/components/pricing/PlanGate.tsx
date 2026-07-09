import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Where a gate came from — becomes `?source=` on /upgrade so the pricing page
 * greets the songwriter with the right context line. Add new sources here AND
 * to `gateMessages` in pages/pricing/UpgradePage.tsx.
 */
export type UpgradeSource =
  | "song_gate"
  | "song_gate_free"
  | "song_gate_starter"
  | "storage"
  | "versions"
  | "exports"
  | "settings";

/** The one canonical link into the upgrade moment. */
export function upgradeHref(source: UpgradeSource): string {
  return `/upgrade?source=${encodeURIComponent(source)}`;
}

interface PlanGateProps {
  /** Serif headline, e.g. "Version history grows with Pro". */
  title: string;
  /** One calm sentence of value — what the capability protects or unlocks. */
  body: string;
  /** Routes the CTA to the right upgrade context. */
  source: UpgradeSource;
  /** CTA label. Default "See plans". */
  ctaLabel?: string;
  /** Optional secondary action (e.g. "Not now") — omit to render none. */
  onDismiss?: () => void;
  /** Optional extra content (e.g. a preview of the locked thing). */
  children?: ReactNode;
}

/**
 * The ONE calm plan-gate pattern (G1 · Key Decision 9). Render this wherever a
 * capability is plan-gated — version history depth, exports, song count,
 * storage — instead of a bespoke banner or a toast. It is an invitation card,
 * not a wall: warm cream, one gold CTA into the right upgrade context, no
 * badge counts, no urgency copy. It never hides existing content — mount it
 * IN PLACE OF the locked new action only.
 *
 * The gate POLICY (what is locked) always comes from the server
 * (`getMyBillingStatus()` — song_quota, storage, plan). This component only
 * renders the moment.
 */
const PlanGate = ({ title, body, source, ctaLabel = "See plans", onDismiss, children }: PlanGateProps) => {
  const navigate = useNavigate();

  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border-gold)",
        boxShadow: "0 4px 24px rgba(184,149,58,0.12)",
      }}
      role="region"
      aria-label={title}
    >
      <div
        className="flex items-center justify-center rounded-full mx-auto mb-3"
        style={{
          width: 40,
          height: 40,
          backgroundColor: "rgba(184,149,58,0.12)",
          border: "1.5px solid rgba(184,149,58,0.25)",
        }}
      >
        <Sparkles size={18} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} aria-hidden="true" />
      </div>

      <h3
        className="text-lg font-semibold mb-1.5"
        style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.2 }}
      >
        {title}
      </h3>
      <p
        className="text-sm mb-4 leading-relaxed"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        {body}
      </p>

      {children}

      <button
        onClick={() => navigate(upgradeHref(source))}
        className="w-full rounded-2xl font-semibold text-sm text-white transition-all duration-150 active:scale-[0.97]"
        style={{
          minHeight: 46,
          backgroundColor: "var(--cog-gold)",
          fontFamily: "var(--font-body)",
          boxShadow: "0 4px 20px rgba(184,149,58,0.30)",
        }}
      >
        {ctaLabel}
      </button>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="w-full text-sm text-center py-2.5 mt-1 transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Not now
        </button>
      )}
    </div>
  );
};

export default PlanGate;
