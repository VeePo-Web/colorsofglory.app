import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Mail, Lock } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
  requestPasswordReset,
  AuthError,
} from "@/integrations/cog/auth";

type Mode = "signin" | "signup";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Keep it under 72 characters");

function friendly(err: unknown): string {
  if (err instanceof AuthError) return err.message;
  return err instanceof Error ? err.message : "Something didn't work. Please try again.";
}

const EmailAuthPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setInfo(null);

    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      setError(emailParsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    const pwParsed = passwordSchema.safeParse(password);
    if (!pwParsed.success) {
      setError(pwParsed.error.issues[0]?.message ?? "Password too short");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithPassword({ email: emailParsed.data, password });
        navigate("/", { replace: true });
      } else {
        const { needsConfirmation } = await signUpWithPassword({
          email: emailParsed.data,
          password,
        });
        if (needsConfirmation) {
          setInfo("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
          setPassword("");
          setConfirmPassword("");
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch (err) {
      console.error("[auth]", (err as { code?: string } | null)?.code ?? "unknown");
      setError(friendly(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("[auth:google]", (err as { code?: string } | null)?.code ?? "unknown");
      setError(friendly(err));
    }
  };

  const handleForgot = async () => {
    setError(null);
    setInfo(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Enter your email above, then tap forgot password.");
      return;
    }
    setResetting(true);
    try {
      await requestPasswordReset(parsed.data);
      setInfo("If an account exists for that email, a reset link is on the way. The link expires in 1 hour.");
      setResetCooldown(30);
      const interval = window.setInterval(() => {
        setResetCooldown((s) => {
          if (s <= 1) {
            window.clearInterval(interval);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setResetting(false);
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
          Welcome to Colors of Glory
        </h1>
        <p
          className="mt-2 text-center text-[0.9375rem]"
          style={{ color: "#6B6459", fontFamily: "var(--font-body, Inter, system-ui, sans-serif)" }}
        >
          {mode === "signin"
            ? "Sign in to keep writing."
            : "Create an account to start your first song."}
        </p>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Sign in or create account"
          className="mx-auto mt-8 flex w-full max-w-xs rounded-full p-1"
          style={{ backgroundColor: "rgba(184,149,58,0.10)" }}
        >
          {(["signin", "signup"] as Mode[]).map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => switchMode(m)}
                className="flex-1 rounded-full py-2 text-[0.875rem] font-medium transition-all"
                style={{
                  backgroundColor: active ? "#FFFFFF" : "transparent",
                  color: active ? "#1C1A17" : "#6B6459",
                  boxShadow: active ? "0 1px 4px rgba(28,26,23,0.06)" : "none",
                  fontFamily: "var(--font-body, Inter, system-ui, sans-serif)",
                }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Mail size={18} style={{ color: "#A09689" }} />
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
                aria-label="Email"
              />
            </div>
          </label>

          <label className="block">
            <span className="sr-only">Password</span>
            <div
              className="flex items-center gap-3 rounded-2xl px-4"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
            >
              <Lock size={18} style={{ color: "#A09689" }} />
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-[1rem] outline-none"
                style={{ color: "#1C1A17" }}
                aria-label="Password"
              />
            </div>
          </label>

          {mode === "signup" && (
            <label className="block">
              <span className="sr-only">Confirm password</span>
              <div
                className="flex items-center gap-3 rounded-2xl px-4"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(28,26,23,0.10)", height: 56 }}
              >
                <Lock size={18} style={{ color: "#A09689" }} />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="flex-1 bg-transparent text-[1rem] outline-none"
                  style={{ color: "#1C1A17" }}
                  aria-label="Confirm password"
                />
              </div>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="text-center text-[0.875rem]"
              style={{ color: "#9B2E2E" }}
            >
              {error}
            </p>
          )}
          {info && (
            <p
              role="status"
              className="text-center text-[0.875rem]"
              style={{ color: "#6B6459" }}
            >
              {info}
            </p>
          )}

          <div className="mt-2">
            <GoldButton
              type="submit"
              loading={submitting}
              loadingText={mode === "signin" ? "Signing in…" : "Creating…"}
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </GoldButton>
          </div>

          {mode === "signin" && (
            <button
              type="button"
              onClick={handleForgot}
              disabled={resetting || resetCooldown > 0}
              className="mt-1 text-center text-[0.875rem] underline-offset-4 transition hover:underline disabled:opacity-60"
              style={{ color: "#6B6459" }}
            >
              {resetting
                ? "Sending reset link…"
                : resetCooldown > 0
                ? `Resend available in ${resetCooldown}s`
                : "Forgot password?"}
            </button>
          )}
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ backgroundColor: "rgba(28,26,23,0.12)" }} />
          <span
            className="text-[0.75rem] uppercase tracking-wider"
            style={{ color: "#A09689" }}
          >
            or
          </span>
          <span className="h-px flex-1" style={{ backgroundColor: "rgba(28,26,23,0.12)" }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-full transition-all active:scale-[0.98]"
          style={{
            height: 56,
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(28,26,23,0.14)",
            color: "#1C1A17",
            fontFamily: "var(--font-body, Inter, system-ui, sans-serif)",
            fontWeight: 500,
            fontSize: "1rem",
          }}
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <p
          className="mt-8 text-center text-[0.75rem]"
          style={{ color: "#A09689" }}
        >
          By continuing you agree to our{" "}
          <Link to="#" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="#" className="underline">
            Privacy
          </Link>
          .
        </p>
      </div>
    </OnboardingShell>
  );
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A8.997 8.997 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A8.997 8.997 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
    />
  </svg>
);

export default EmailAuthPage;