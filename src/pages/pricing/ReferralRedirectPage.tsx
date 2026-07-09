import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import { resolveCode, attachReferral } from "@/integrations/cog/referrals";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * /r/:code — the referral share-link front door (F3).
 *
 * A friend tapping a songwriter's link lands HERE first, so it must be warm
 * and it must never dead-end:
 *  - The code is stashed immediately (sessionStorage "cog:referral-code") so
 *    checkout attribution survives refreshes — G1's UpgradePage reads this key
 *    and the ?ref= param; both are preserved exactly (see REFERRAL-CONTRACT).
 *  - resolveCode() personalizes the welcome ("Parker invited you"). If the
 *    code is invalid/expired the stash is cleared and the visitor still gets a
 *    warm generic welcome — never an error wall.
 *  - Signed-in visitors get attachReferral() fired best-effort (stashes the
 *    code server-side for checkout); anonymous visitors attribute at signup.
 *  - Whatever happens — resolve success, failure, or timeout — we continue to
 *    /upgrade (first-song-free pricing) after a short beat, with a visible
 *    Continue button the whole time.
 */

const RESOLVE_TIMEOUT_MS = 2500;
const CONTINUE_DELAY_MS = 1800;

type LandingStatus = "resolving" | "valid" | "unknown";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ReferralRedirectPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<LandingStatus>("resolving");
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [codeIsGood, setCodeIsGood] = useState(true);
  const navigatedRef = useRef(false);
  const reduceMotion = useMemo(prefersReducedMotion, []);

  const normalized = (code ?? "").trim().toUpperCase();

  // Stash immediately — attribution must survive a refresh even if resolution
  // is slow. Cleared below only on an explicit "this code doesn't exist".
  useEffect(() => {
    if (normalized) {
      try { sessionStorage.setItem("cog:referral-code", normalized); } catch { /* private mode */ }
    }
  }, [normalized]);

  const destination = (goodCode: boolean) =>
    goodCode && normalized ? `/upgrade?ref=${encodeURIComponent(normalized)}` : "/upgrade";

  const continueNow = (goodCode: boolean) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate(destination(goodCode), { replace: true });
  };

  // Resolve the code to personalize the welcome. Explicit "not ok" → drop the
  // code (no phantom discounts at checkout). Network error / timeout → keep it;
  // checkout validates again, so the visitor keeps the benefit of the doubt.
  useEffect(() => {
    if (!normalized) {
      setCodeIsGood(false);
      setStatus("unknown");
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setStatus((s) => (s === "resolving" ? "unknown" : s));
    }, RESOLVE_TIMEOUT_MS);

    resolveCode({ code: normalized })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setInviterName(res.owner_display_name ?? null);
          setStatus("valid");
          // Signed-in visitor: stash server-side for checkout, best-effort.
          if (user) attachReferral(normalized).catch(() => {/* checkout re-attaches */});
        } else {
          setCodeIsGood(false);
          try { sessionStorage.removeItem("cog:referral-code"); } catch { /* private mode */ }
          setStatus("unknown");
        }
      })
      .catch(() => { if (active) setStatus("unknown"); });

    return () => { active = false; window.clearTimeout(timeout); };
  }, [normalized, user]);

  // Auto-continue shortly after the welcome settles — nobody gets stranded.
  useEffect(() => {
    if (status === "resolving") return;
    const t = window.setTimeout(() => continueNow(codeIsGood), CONTINUE_DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, codeIsGood]);

  const headline =
    status === "valid" && inviterName
      ? `${inviterName} invited you`
      : "You've been invited";

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow — every landing feels like arriving somewhere kept */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 70%, rgba(184,149,58,0.18) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div
        className="relative flex flex-col items-center text-center"
        style={{
          maxWidth: "var(--max-w-app)",
          width: "100%",
          opacity: 1,
          animation: reduceMotion ? "none" : "cog-fade-up 400ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <style>{`@keyframes cog-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div className="mb-8">
          <CogBrand variant="stacked" size="md" />
        </div>

        <h1
          className="mb-3"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.75rem, 6vw, 2.25rem)",
            fontWeight: 600,
            color: "var(--cog-charcoal)",
            lineHeight: 1.15,
          }}
        >
          {headline}
        </h1>
        <p
          className="mb-10"
          style={{ fontFamily: "var(--font-body)", fontSize: "1rem", color: "var(--cog-warm-gray)", lineHeight: 1.6, maxWidth: 320 }}
        >
          Colors of Glory gives every song its own private room — lyrics, voice
          memos, and the people you write with, together in one place.
          <span style={{ color: "var(--cog-gold)", fontWeight: 600 }}> Your first song is free.</span>
        </p>

        <button
          type="button"
          onClick={() => continueNow(codeIsGood)}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
          style={{
            maxWidth: 320,
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
          }}
        >
          Start your first song
        </button>

        <p
          className="mt-4 text-xs"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
          role="status"
        >
          {status === "resolving" ? "Opening your invitation…" : "Taking you there…"}
        </p>
      </div>
    </div>
  );
};

export default ReferralRedirectPage;
