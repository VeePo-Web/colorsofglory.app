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
  AuthError,
} from "@/integrations/cog/auth";
import { routeAfterAuth } from "@/lib/auth/postAuthRoute";
import { reconcileInviteToken } from "./inviteHandoff";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";

type Mode = "signin" | "signup";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Keep it under 72 characters");

// Only AuthError carries calm, user-facing copy. Anything else (a raw network or
// runtime Error) must never leak its technical message to the UI.
function friendly(err: unknown): string {
  if (err instanceof AuthError) return err.message;
  return "Something didn't work. Please try again.";
}

const EmailAuthPage = () => {
  const navigate = useNavigate();
  // While they type credentials, fetch the two commonest post-auth destinations
  // so sign-in lands instantly (same treatment as the phone verify screen).
  useIdlePrefetch(
    () => import("@/pages/onboarding/FirstIntentPage"),
    () => import("@/pages/ReturningHomePage"),
  );
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
        reconcileInviteToken();
        await routeAfterAuth(navigate);
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
          reconcileInviteToken();
          await routeAfterAuth(navigate);
        }
      }
    } catch (err) {
      console.error("[auth]", (err as { code?: string } | null)?.code ?? "unknown");
      setError(friendly(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = () => {
    const parsed = emailSchema.safeParse(email);
    navigate("/auth/forgot-password", {
      state: { email: parsed.success ? parsed.data : email },
    });
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
                className="flex-1 rounded-full text-[0.875rem] font-medium transition-all"
                style={{
                  minHeight: 44,
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
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
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
                enterKeyHint={mode === "signup" ? "next" : "go"}
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
              style={{ color: "var(--cog-record-red)" }}
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
              className="mt-1 text-center text-[0.875rem] underline-offset-4 transition hover:underline disabled:opacity-60"
              style={{ color: "#6B6459" }}
            >
              Forgot password?
            </button>
          )}
        </form>

        {/* Phone OTP entry */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[0.875rem]">
          <span style={{ color: "#6B6459" }}>Prefer your phone?</span>
          <Link
            to="/auth/login"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--cog-gold, #B8953A)" }}
          >
            Text me a code →
          </Link>
        </div>

        <p
          className="mt-8 text-center text-[0.75rem]"
          style={{ color: "#A09689" }}
        >
          {/* Real links, new tab — the typed email/password state survives. */}
          By continuing you agree to our{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            Privacy
          </a>
          .
        </p>
      </div>
    </OnboardingShell>
  );
};

export default EmailAuthPage;