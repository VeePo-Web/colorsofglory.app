import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Mail, Lock, KeyRound } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import {
  startEmailOtp,
  verifyEmailOtp,
  signInWithPassword,
  AuthError,
} from "@/integrations/cog/auth";
import { routeAfterAuth } from "@/lib/auth/postAuthRoute";
import { reconcileInviteToken } from "./inviteHandoff";

type Step = "email" | "code" | "password";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

// Only AuthError carries calm, user-facing copy. Anything else (a raw network or
// runtime Error) must never leak its technical message to the UI.
function friendly(err: unknown): string {
  if (err instanceof AuthError) return err.message;
  return "Something didn't work. Please try again.";
}

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const sendCode = async (target: string) => {
    const parsed = emailSchema.safeParse(target);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return false;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await startEmailOtp({ email: parsed.data, purpose: "reset" });
      setEmail(parsed.data);
      setInfo(`Code sent to ${parsed.data}.`);
      setCooldown(60);
      setStep("code");
      return true;
    } catch (err) {
      setError(friendly(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    await sendCode(email);
  };

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);
    setStep("password");
  };

  const handleResend = async () => {
    if (cooldown > 0 || submitting) return;
    await sendCode(email);
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) {
      setError(pw.error.issues[0]?.message ?? "Password too short");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await verifyEmailOtp({ email, code: code.trim(), purpose: "reset", password });
      await signInWithPassword({ email, password });
      reconcileInviteToken();
      await routeAfterAuth(navigate);
    } catch (err) {
      if (err instanceof AuthError && err.code === "INVALID_OTP") {
        setStep("code");
      }
      setError(friendly(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingShell>
      <div className="flex flex-1 flex-col pt-12 pb-10">
        <div className="mb-8 flex justify-center">
          <CogBrand variant="stacked" size="md" />
        </div>

        <h1
          className="text-center text-[1.75rem] leading-tight"
          style={{
            fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
            color: "#1C1A17",
            fontWeight: 600,
          }}
        >
          {step === "password" ? "Set a new password" : "Reset your password"}
        </h1>
        <p
          className="mt-2 text-center text-[0.9375rem]"
          style={{ color: "#6B6459" }}
        >
          {step === "email" && "We'll email you a 6-digit code."}
          {step === "code" && `Enter the code we sent to ${email}.`}
          {step === "password" && "Pick something you'll remember — at least 8 characters."}
        </p>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="mt-8 flex flex-col gap-3">
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Mail size={18} style={{ color: "#A09689" }} />
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                autoFocus={!prefillEmail}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
              />
            </div>
            {error && <p role="alert" className="text-center text-[0.875rem]" style={{ color: "var(--cog-record-red)" }}>{error}</p>}
            {info && <p role="status" className="text-center text-[0.875rem]" style={{ color: "#6B6459" }}>{info}</p>}
            <GoldButton type="submit" loading={submitting} loadingText="Sending…">
              Send code
            </GoldButton>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCodeSubmit} className="mt-8 flex flex-col gap-3">
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <KeyRound size={18} style={{ color: "#A09689" }} />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                autoFocus
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="flex-1 bg-transparent text-[1.125rem] tracking-[0.4em] outline-none"
                style={{ color: "#1C1A17", fontFamily: "'SF Mono', Menlo, monospace" }}
              />
            </div>
            {error && <p role="alert" className="text-center text-[0.875rem]" style={{ color: "var(--cog-record-red)" }}>{error}</p>}
            {info && !error && <p role="status" className="text-center text-[0.875rem]" style={{ color: "#6B6459" }}>{info}</p>}
            <GoldButton type="submit" disabled={code.length !== 6}>
              Continue
            </GoldButton>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || submitting}
              className="mt-1 text-center text-[0.875rem] underline-offset-4 transition hover:underline disabled:opacity-60"
              style={{ color: "#6B6459" }}
            >
              {cooldown > 0 ? `Resend available in ${cooldown}s` : submitting ? "Sending…" : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null); }}
              className="text-center text-[0.8125rem]"
              style={{ color: "#A09689" }}
            >
              Use a different email
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="mt-8 flex flex-col gap-3">
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Lock size={18} style={{ color: "#A09689" }} />
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsLock(e.getModifierState && e.getModifierState("CapsLock"))}
                onKeyDown={(e) => setCapsLock(e.getModifierState && e.getModifierState("CapsLock"))}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-[0.75rem] font-medium"
                style={{ color: "#6B6459" }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Lock size={18} style={{ color: "#A09689" }} />
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
              />
            </div>
            {capsLock && (
              <p className="text-center text-[0.8125rem]" style={{ color: "#B8953A" }}>
                Caps Lock is on.
              </p>
            )}
            {error && <p role="alert" className="text-center text-[0.875rem]" style={{ color: "var(--cog-record-red)" }}>{error}</p>}
            <GoldButton type="submit" loading={submitting} loadingText="Updating…">
              Update password & sign in
            </GoldButton>
          </form>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-[0.875rem]">
          <span style={{ color: "#6B6459" }}>Remembered it?</span>
          <Link
            to="/auth/email"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--cog-gold, #B8953A)" }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </OnboardingShell>
  );
};

export default ForgotPasswordPage;