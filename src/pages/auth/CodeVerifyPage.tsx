import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { sendPhoneOtp, verifyPhoneOtp } from "@/integrations/cog/auth";
import { routeAfterAuth } from "@/lib/auth/postAuthRoute";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
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

  const handleVerify = useCallback(async (code: string) => {
    if (!e164 || code.length < CODE_LENGTH || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      await verifyPhoneOtp(e164, code);
      // Tasteful success confirmation (Android only; iOS has no vibrate API).
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
      // The centralized router decides where they land (invite / onboarding / home).
      await routeAfterAuth(navigate);
    } catch (err) {
      setError(toFriendlyError(err));
      setDigits(Array(CODE_LENGTH).fill(""));
    } finally {
      setIsVerifying(false);
    }
  }, [e164, isVerifying, navigate]);

  // WebOTP — one-tap autofill on Android Chrome. Progressive enhancement: silent
  // where unsupported (iOS uses native QuickType). Fires once the SMS is domain-bound
  // (`@host #code`); harmless until then. Aborts on unmount.
  useEffect(() => {
    if (typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as unknown as CredentialRequestOptions)
      .then((cred) => {
        const clean = ((cred as { code?: string } | null)?.code ?? "")
          .replace(/\D/g, "")
          .slice(0, CODE_LENGTH);
        if (clean.length === CODE_LENGTH) {
          setDigits(clean.split(""));
          void handleVerify(clean);
        }
      })
      .catch(() => {
        /* dismissed / unsupported / aborted — stay silent */
      });
    return () => ac.abort();
  }, [handleVerify]);

  const handleResend = async () => {
    if (!e164 || isResending || countdown > 0) return;
    setIsResending(true);
    setError(null);
    setDigits(Array(CODE_LENGTH).fill(""));
    setCountdown(RESEND_SECONDS);
    try {
      await sendPhoneOtp(e164);
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

      {/* Never a dead end — escape to email if the SMS never arrives */}
      <button
        type="button"
        onClick={() => navigate("/auth/email")}
        className="mt-4 text-sm text-center w-full py-2 transition-opacity hover:opacity-70 underline"
        style={{ color: "#B5935A", fontFamily: "var(--font-body)" }}
      >
        Use email instead
      </button>
    </OnboardingShell>
  );
};

export default CodeVerifyPage;
