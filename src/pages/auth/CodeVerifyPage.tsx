import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { sendPhoneOtp, verifyPhoneOtp, AuthError } from "@/integrations/cog/auth";
import { routeAfterAuth } from "@/lib/auth/postAuthRoute";
import { reconcileInviteToken } from "./inviteHandoff";
import { useWebOtpAutofill } from "@/lib/auth/useWebOtpAutofill";
import { useTurnstile } from "@/lib/auth/useTurnstile";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";
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
  // While the code arrives, fetch the two commonest post-auth destinations.
  useIdlePrefetch(
    () => import("@/pages/onboarding/FirstIntentPage"),
    () => import("@/pages/ReturningHomePage"),
  );
  // Invisible CAPTCHA so resend also satisfies the floor (no-op without a key).
  const { containerRef: turnstileRef, getToken } = useTurnstile();

  const e164 = sessionStorage.getItem("cog:phone-e164") ?? "";
  const displayPhone = sessionStorage.getItem("cog:phone-display") ?? "your number";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [success, setSuccess] = useState(false);
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
      // Subtle "you're in" beat — flash the cells gold for a moment, then route.
      // Reduced-motion users skip the pause. Keep the form locked through it.
      setSuccess(true);
      // Tasteful success confirmation (Android only; iOS has no vibrate API).
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
      const reduce = typeof window !== "undefined" && !!window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await new Promise((r) => setTimeout(r, reduce ? 0 : 500));
      // Ensure a deep-link invite survives auth (flat token ← context blob), then
      // let the centralized router decide (invite / onboarding / home).
      reconcileInviteToken();
      await routeAfterAuth(navigate);
    } catch (err) {
      setError(toFriendlyError(err));
      setDigits(Array(CODE_LENGTH).fill(""));
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
      const captchaToken = await getToken();
      await sendPhoneOtp(e164, captchaToken);
      setResent(true);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setIsResending(false);
    }
  };

  const allFilled = digits.every((d) => d !== "");

  // Desktop has no SMS autofill/WebOTP — let the user paste the code in one tap
  // (read it from the clipboard, fill, submit). Fails silent if the browser blocks
  // clipboard reads; manual entry and Ctrl+V into the field still work.
  const canPasteCode =
    typeof navigator !== "undefined" && !!navigator.clipboard && "readText" in navigator.clipboard;
  const handlePasteCode = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const code = (text ?? "").replace(/\D/g, "").slice(0, CODE_LENGTH);
      if (code.length === CODE_LENGTH) {
        setDigits(code.split(""));
        void handleVerify(code);
      }
    } catch {
      /* clipboard blocked / empty — no-op */
    }
  }, [handleVerify]);

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
          success={success}
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

      {/* One-tap paste — the only low-friction path on desktop (no SMS autofill there). */}
      {canPasteCode && !isVerifying && (
        <button
          type="button"
          onClick={handlePasteCode}
          className="mx-auto -mt-3 mb-6 block text-[13px] transition-opacity hover:opacity-70"
          style={{ color: "#B5935A", fontFamily: "var(--font-body)", textDecoration: "underline" }}
        >
          Paste code
        </button>
      )}

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

      {/* Escape hatch — never trap a user whose SMS doesn't arrive. Surfaces once
          the first resend window has passed so it doesn't distract early. */}
      {countdown <= 0 && (
        <button
          type="button"
          onClick={() => navigate("/auth/email")}
          className="mt-6 text-[13px] text-center w-full py-2 transition-opacity hover:opacity-70"
          style={{ color: "#999", fontFamily: "var(--font-body)" }}
        >
          Didn't get a code?{" "}
          <span style={{ color: "#B5935A", textDecoration: "underline" }}>Use email instead</span>
        </button>
      )}

      {/* Invisible Turnstile CAPTCHA mount for resend (renders nothing without a key). */}
      <div ref={turnstileRef} />
    </OnboardingShell>
  );
};

export default CodeVerifyPage;
