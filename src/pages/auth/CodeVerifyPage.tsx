import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";
import OTPInput from "@/components/cog/OTPInput";
import OnboardingShell from "@/components/cog/OnboardingShell";

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

function toFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code ?? "";
  const msg = raw.toLowerCase();
  if (code === "otp_expired" || msg.includes("expired"))
    return "That code expired. Tap resend to get a new one.";
  if (msg.includes("invalid") || msg.includes("incorrect") || msg.includes("token"))
    return "That code didn't work. Check it and try again.";
  if (msg.includes("rate")) return "Too many attempts. Please wait a moment.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "We could not verify the code. Check your connection.";
  return "Something went wrong. Please try again.";
}

const CodeVerifyPage = () => {
  const navigate = useNavigate();

  const e164 = sessionStorage.getItem("cog:phone-e164") ?? "";
  const displayPhone = sessionStorage.getItem("cog:phone-display") ?? "your number";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!e164) navigate("/auth/login", { replace: true });
  }, [e164, navigate]);

  const routeAfterAuth = useCallback(async () => {
    // Pending checkout intent wins — bring the user straight back to /upgrade
    // where the resume effect will reopen Stripe Embedded Checkout.
    const pendingCheckout = sessionStorage.getItem("cog:pending-checkout");
    if (pendingCheckout) {
      navigate("/upgrade", { replace: true });
      return;
    }
    const inviteToken = sessionStorage.getItem("cog:invite-token");
    if (inviteToken) {
      navigate(`/invite/${inviteToken}`, { replace: true });
      return;
    }
    try {
      const { data } = await supabase.from("songs").select("id").limit(1);
      if (data && data.length > 0) {
        navigate("/", { replace: true });
      } else {
        navigate("/onboarding/intent", { replace: true });
      }
    } catch {
      navigate("/onboarding/intent", { replace: true });
    }
  }, [navigate]);

  const handleVerify = useCallback(async (code: string) => {
    if (!e164 || code.length < CODE_LENGTH || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: "sms",
      });
      if (verifyError) throw verifyError;
      // Non-blocking — update onboarding step for new users
      updateOnboardingStep('intent_selected').catch(() => {});
      await routeAfterAuth();
    } catch (err) {
      setError(toFriendlyError(err));
      setDigits(Array(CODE_LENGTH).fill(""));
    } finally {
      setIsVerifying(false);
    }
  }, [e164, isVerifying, routeAfterAuth]);

  const handleResend = async () => {
    if (!e164 || isResending || countdown > 0) return;
    setIsResending(true);
    setError(null);
    setDigits(Array(CODE_LENGTH).fill(""));
    setCountdown(RESEND_SECONDS);
    try {
      await supabase.auth.signInWithOtp({ phone: e164 });
    } catch {
      setError("We could not resend the code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const allFilled = digits.every((d) => d !== "");

  return (
    <OnboardingShell>
      {/* Logo */}
      <div className="pt-16 pb-10 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.6rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Check your phone
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        We sent a 6-digit code to{" "}
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>+1 ({displayPhone})</span>
      </p>

      {/* OTP boxes */}
      <div className="mb-3">
        <OTPInput
          length={CODE_LENGTH}
          value={digits}
          onChange={setDigits}
          onComplete={handleVerify}
          disabled={isVerifying}
          error={!!error}
        />
      </div>

      {/* Microcopy */}
      <p className="text-[13px] text-center mb-6" style={{ color: "#999" }}>
        Codes usually arrive within a few seconds.
      </p>

      {/* Error */}
      {error && (
        <p
          className="text-sm text-center mb-5"
          style={{ color: "#E05440" }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      {/* Verify CTA */}
      <GoldButton
        disabled={!allFilled}
        loading={isVerifying}
        loadingText="Verifying..."
        onClick={() => handleVerify(digits.join(""))}
      >
        Verify
      </GoldButton>

      {/* Resend + Change */}
      <div className="flex justify-between mt-5 text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0 || isResending}
          className="transition-opacity hover:opacity-70 disabled:opacity-40 underline"
          style={{ color: "#B5935A", fontFamily: "var(--font-body)" }}
        >
          {countdown > 0 ? `Resend code (${countdown}s)` : "Resend code"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/auth/login")}
          className="transition-opacity hover:opacity-70"
          style={{ color: "#999", fontFamily: "var(--font-body)" }}
        >
          Change number
        </button>
      </div>
    </OnboardingShell>
  );
};

export default CodeVerifyPage;
