import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { sendPhoneOtp, verifyPhoneOtp, AuthError } from "@/integrations/cog/auth";
import { routeAfterAuth } from "@/lib/auth/postAuthRoute";
import { useWebOtpAutofill } from "@/lib/auth/useWebOtpAutofill";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OTPInput from "@/components/cog/OTPInput";
import OnboardingShell from "@/components/cog/OnboardingShell";

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

function toFriendlyError(err: unknown): string {
  // verifyPhoneOtp / sendPhoneOtp already throw AuthError with calm, honest copy.
  if (err instanceof AuthError) return err.message;
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  if (msg.includes("expired"))
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
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!e164) navigate("/auth/login", { replace: true });
  }, [e164, navigate]);

  const handleVerify = useCallback(async (code: string) => {
    if (!e164 || code.length < CODE_LENGTH || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      await verifyPhoneOtp(e164, code);
      // The centralized router decides where they land (invite / onboarding / home).
      await routeAfterAuth(navigate);
    } catch (err) {
      setError(toFriendlyError(err));
      setDigits(Array(CODE_LENGTH).fill(""));
    } finally {
      setIsVerifying(false);
    }
  }, [e164, isVerifying, navigate]);

  // Lowest-friction path: auto-read the SMS code (Android Chrome), fill, submit.
  // Progressive — no-ops where unsupported; manual entry always still works.
  const handleAutoCode = useCallback((code: string) => {
    const next = code.slice(0, CODE_LENGTH).split("");
    setDigits([...next, ...Array(Math.max(0, CODE_LENGTH - next.length)).fill("")]);
    if (next.length >= CODE_LENGTH) void handleVerify(code.slice(0, CODE_LENGTH));
  }, [handleVerify]);

  useWebOtpAutofill(!isVerifying, handleAutoCode);

  const handleResend = async () => {
    if (!e164 || isResending || countdown > 0) return;
    setIsResending(true);
    setError(null);
    setResent(false);
    setDigits(Array(CODE_LENGTH).fill(""));
    setCountdown(RESEND_SECONDS);
    try {
      await sendPhoneOtp(e164);
      setResent(true);
    } catch (err) {
      setError(toFriendlyError(err));
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
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>+1 {displayPhone}</span>
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
      <p
        className="text-[13px] text-center mb-6 transition-colors"
        style={{ color: resent ? "#7A8B5A" : "#999" }}
        aria-live="polite"
      >
        {resent ? "New code sent — check your messages." : "Codes usually arrive within a few seconds."}
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
