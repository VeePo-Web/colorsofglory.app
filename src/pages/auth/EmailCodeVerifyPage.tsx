import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  startEmailOtp,
  completeEmailSignup,
  verifyEmailOtp,
  signInWithPassword,
  AuthError,
} from "@/integrations/cog/auth";
import { routeAfterAuth } from "@/lib/auth/postAuthRoute";
import { reconcileInviteToken } from "./inviteHandoff";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OTPInput from "@/components/cog/OTPInput";
import OnboardingShell from "@/components/cog/OnboardingShell";

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

type Purpose = "signup" | "login";

function toFriendlyError(err: unknown): string {
  if (err instanceof AuthError) return err.message;
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  if (msg.includes("expired")) return "That code expired. Tap resend to get a new one.";
  if (msg.includes("invalid") || msg.includes("incorrect") || msg.includes("token"))
    return "That code didn't work. Check it and try again.";
  if (msg.includes("rate")) return "Too many attempts. Please wait a moment.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "We could not verify the code. Check your connection.";
  return "Something went wrong. Please try again.";
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown = name.slice(0, Math.min(2, name.length));
  return `${shown}${"•".repeat(Math.max(1, name.length - shown.length))}@${domain}`;
}

const EmailCodeVerifyPage = () => {
  const navigate = useNavigate();
  useIdlePrefetch(
    () => import("@/pages/onboarding/FirstIntentPage"),
    () => import("@/pages/ReturningHomePage"),
  );

  const email = (typeof window !== "undefined" && sessionStorage.getItem("cog:email-address")) || "";
  const purpose = ((typeof window !== "undefined" &&
    sessionStorage.getItem("cog:email-purpose")) || "signup") as Purpose;

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
    if (!email) navigate("/auth/email", { replace: true });
  }, [email, navigate]);

  const handleVerify = useCallback(
    async (code: string) => {
      if (!email || code.length < CODE_LENGTH || isVerifying) return;
      setIsVerifying(true);
      setError(null);
      try {
        if (purpose === "signup") {
          const password = sessionStorage.getItem("cog:email-password") ?? "";
          if (!password) throw new AuthError("UNKNOWN", "Your session expired. Please start again.");
          await completeEmailSignup({ email, password, code });
        } else {
          await verifyEmailOtp({ email, code, purpose: "login" });
          const password = sessionStorage.getItem("cog:email-password") ?? "";
          if (password) await signInWithPassword({ email, password });
        }
        sessionStorage.removeItem("cog:email-password");
        setSuccess(true);
        const reduce =
          typeof window !== "undefined" &&
          !!window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        await new Promise((r) => setTimeout(r, reduce ? 0 : 500));
        reconcileInviteToken();
        await routeAfterAuth(navigate);
      } catch (err) {
        setError(toFriendlyError(err));
        setDigits(Array(CODE_LENGTH).fill(""));
        setIsVerifying(false);
      }
    },
    [email, purpose, isVerifying, navigate],
  );

  const handleResend = async () => {
    if (!email || isResending || countdown > 0) return;
    setIsResending(true);
    setError(null);
    setResent(false);
    setDigits(Array(CODE_LENGTH).fill(""));
    setCountdown(RESEND_SECONDS);
    try {
      await startEmailOtp({ email, purpose });
      setResent(true);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setIsResending(false);
    }
  };

  const allFilled = digits.every((d) => d !== "");

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
      <div className="pt-16 pb-10 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      <h1
        className="text-[2.6rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Check your email
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        We sent a 6-digit code to{" "}
        <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{maskEmail(email)}</span>
      </p>

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

      <p
        className="text-[13px] text-center mb-6 transition-colors"
        style={{ color: resent ? "#7A8B5A" : "#999" }}
        aria-live="polite"
      >
        {resent ? "New code sent — check your inbox." : "Codes usually arrive within a few seconds."}
      </p>

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

      <GoldButton
        disabled={!allFilled}
        loading={isVerifying}
        loadingText="Verifying..."
        onClick={() => handleVerify(digits.join(""))}
      >
        Verify
      </GoldButton>

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
          onClick={() => {
            sessionStorage.removeItem("cog:email-password");
            navigate("/auth/email");
          }}
          className="transition-opacity hover:opacity-70"
          style={{ color: "#999", fontFamily: "var(--font-body)" }}
        >
          Change email
        </button>
      </div>

      {countdown <= 0 && (
        <button
          type="button"
          onClick={() => navigate("/auth/login")}
          className="mt-6 text-[13px] text-center w-full py-2 transition-opacity hover:opacity-70"
          style={{ color: "#999", fontFamily: "var(--font-body)" }}
        >
          Didn't get a code?{" "}
          <span style={{ color: "#B5935A", textDecoration: "underline" }}>Text me instead</span>
        </button>
      )}
    </OnboardingShell>
  );
};

export default EmailCodeVerifyPage;