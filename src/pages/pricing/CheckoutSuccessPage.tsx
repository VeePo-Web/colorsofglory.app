import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import { fetchCurrentPlan } from "@/lib/pricing/pricingApi";

const AUTO_NAVIGATE_MS = 3000;
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 8;

/**
 * Stripe redirects here after a successful payment (plan or storage add-on).
 * Two jobs beyond the warm confirmation:
 *   1. Bridge the webhook/plan-propagation delay — poll `current_plan` until
 *      the upgrade is visible, THEN refresh every cached billing read, so the
 *      songwriter never lands back on a gate that still thinks they're free.
 *   2. Return them to exactly what they were doing — the gate that sent them
 *      here stashed `cog:upgrade-return-to`.
 * The poll is reassurance, not a lock: if propagation is slow we still finish
 * warmly and the realtime billing subscription catches up in the background.
 */
const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  // "finalizing" while we wait for the plan to propagate; "ready" once it has
  // (or once we stop waiting — never a dead end either way).
  const [phase, setPhase] = useState<"finalizing" | "ready">("finalizing");
  const [countdown, setCountdown] = useState(3);
  const returnToRef = useRef<string>("/");

  useEffect(() => {
    try {
      returnToRef.current = sessionStorage.getItem("cog:upgrade-return-to") ?? "/";
      sessionStorage.removeItem("cog:upgrade-return-to");
      // The intent is fulfilled — clear any stale pending-checkout stash.
      sessionStorage.removeItem("cog:pending-checkout");
    } catch { /* non-fatal */ }
  }, []);

  // Poll plan propagation, then refresh every billing-derived cache so gates
  // (song quota, storage) unlock without a reload.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const finish = () => {
      if (cancelled) return;
      void queryClient.invalidateQueries();
      setPhase("ready");
    };

    const poll = async () => {
      attempts += 1;
      try {
        const plan = await fetchCurrentPlan();
        if (cancelled) return;
        if (plan !== "free") { finish(); return; }
      } catch { /* keep polling — transient */ }
      if (cancelled) return;
      if (attempts >= POLL_MAX_ATTEMPTS) { finish(); return; }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();
    return () => { cancelled = true; };
  }, [queryClient]);

  // Auto-return only once the upgrade is visible — no "still locked" flash.
  useEffect(() => {
    if (phase !== "ready") return;
    const interval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    const timer = setTimeout(
      () => navigate(returnToRef.current, { replace: true }),
      AUTO_NAVIGATE_MS,
    );
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [phase, navigate]);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#FAFAF6" }}
    >
      {/* Subtle gold glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(181,147,90,0.12) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col items-center text-center" style={{ maxWidth: 360 }}>
        {/* Logo */}
        <div className="mb-10">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Gold checkmark - celebration entrance */}
        <div
          className="flex items-center justify-center rounded-full mb-8 cog-success-badge"
          style={{
            width: 80,
            height: 80,
            backgroundColor: "rgba(181,147,90,0.12)",
            border: "2px solid rgba(181,147,90,0.35)",
          }}
        >
          <CheckCircle size={36} strokeWidth={1.5} style={{ color: "#B5935A" }} aria-hidden="true" />
        </div>

        {/* Copy - warm, not transactional */}
        <h1
          className="text-4xl font-bold mb-3 leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
        >
          You're in.
        </h1>
        <p className="text-base mb-10 leading-relaxed" style={{ color: "#666" }} role="status">
          {phase === "finalizing"
            ? "Your workspace is being finalized — this takes just a moment. Every song you write from here is protected, connected, and yours."
            : "Your workspace is ready. Every song you write from here is protected, connected, and yours."}
        </p>

        {/* Manual CTA - always available; the poll only paces the auto-return */}
        <GoldButton onClick={() => navigate(returnToRef.current, { replace: true })}>
          {phase === "finalizing" ? "Take me back" : "Pick up where I left off"}
        </GoldButton>

        <p className="text-xs mt-4" style={{ color: "#999" }} aria-live="polite">
          {phase === "finalizing"
            ? "Unlocking your plan…"
            : `Taking you back in ${countdown}…`}
        </p>

        {/* Support */}
        <p className="text-xs mt-8" style={{ color: "#CCC" }}>
          {sessionId ? "Your receipt is on its way. " : ""}Questions?{" "}
          <a
            href="mailto:people@colorsofglory.com"
            style={{ textDecoration: "underline", color: "inherit" }}
          >
            people@colorsofglory.com
          </a>
        </p>
      </div>

      <style>{`
        .cog-success-badge {
          animation: cog-success-scale 500ms cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes cog-success-scale {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cog-success-badge { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default CheckoutSuccessPage;
