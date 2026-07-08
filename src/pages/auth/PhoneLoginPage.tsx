import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPhoneOtp, AuthError } from "@/integrations/cog/auth";
import { useTurnstile } from "@/lib/auth/useTurnstile";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";

// ─── helpers ─────────────────────────────────────────────────────────────────

const DIGITS_MAX = 10;

function formatDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Launch scope: US & Canada (NANP). Both share the +1 country code and the same
// 10-digit format, so a single +1 path serves both correctly. International
// numbers are out of scope for launch — see the scope note under the field.
function toE164(digits: string): string {
  return `+1${digits}`;
}

function toFriendlyError(err: unknown): string {
  // sendPhoneOtp already throws AuthError with calm, honest, self-serve copy.
  // (It no longer dead-ends unrelated errors on a "contact support" message.)
  if (err instanceof AuthError) return err.message;
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  if (msg.includes("invalid phone")) return "Enter a valid US or Canada phone number.";
  if (msg.includes("network") || msg.includes("fetch")) return "We could not send the code. Check your connection and try again.";
  return "We could not send the code. Please try again.";
}

// ─── component ───────────────────────────────────────────────────────────────

const PhoneLoginPage = () => {
  const navigate = useNavigate();
  // While they type their number, fetch the verify screen (primary path) and the
  // email fallback (visible link below) so either next tap is instant.
  useIdlePrefetch(
    () => import("@/pages/auth/CodeVerifyPage"),
    () => import("@/pages/auth/EmailAuthPage"),
  );
  // Invisible CAPTCHA token (no-op until VITE_TURNSTILE_SITE_KEY is set).
  const { containerRef: turnstileRef, getToken } = useTurnstile();
  // Pre-fill the last number entered this session so "Change number" lands on a
  // ready-to-edit field — no retyping a 10-digit number to fix one digit.
  const [digits, setDigits] = useState(
    () => (sessionStorage.getItem("cog:phone-digits") ?? "").replace(/\D/g, "").slice(0, DIGITS_MAX),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = digits.length === DIGITS_MAX;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let d = e.target.value.replace(/\D/g, "");
    // Forgive a pasted/autofilled US country code: "+1 (555) 555-1234" → 11 digits
    // starting with 1. Without this we'd keep the leading 1 and drop the last digit.
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    setDigits(d.slice(0, DIGITS_MAX));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const e164 = toE164(digits);

    try {
      const captchaToken = await getToken();
      await sendPhoneOtp(e164, captchaToken);

      // Store for display in verify screen + to pre-fill on "Change number"
      sessionStorage.setItem("cog:phone-e164", e164);
      sessionStorage.setItem("cog:phone-display", formatDisplay(digits));
      sessionStorage.setItem("cog:phone-digits", digits);

      navigate("/auth/phone/verify");
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingShell>
      {/* Top safe area + logo */}
      <div className="pt-16 pb-10 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.6rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Welcome
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        Enter your phone number to continue.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Phone input card */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 mb-2 transition-all duration-150"
          style={{
            height: 64,
            backgroundColor: "#FFFFFF",
            // Calm-error contract: the field stays neutral; the error is carried
            // by the inline text below, never a red border. A valid number gets a
            // soft gold ring; otherwise the resting hairline border.
            border: isValid
              ? "1.5px solid var(--cog-gold)"
              : "1.5px solid rgba(0,0,0,0.12)",
            boxShadow: isValid
              ? "0 0 0 3px rgba(181,147,90,0.10)"
              : "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {/* Flag — US & Canada share the +1 (NANP) dialing code at launch. */}
          <span className="text-xl leading-none" aria-hidden="true">🇺🇸</span>

          {/* Country code */}
          <span
            className="text-base font-medium"
            style={{ color: "#666", fontFamily: "var(--font-body)", flexShrink: 0 }}
            aria-label="Country code plus one, United States and Canada"
          >
            +1
          </span>

          {/* Divider */}
          <div
            className="self-stretch my-3"
            style={{ width: 1, backgroundColor: "rgba(0,0,0,0.10)" }}
          />

          {/* Number input */}
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            enterKeyHint="go"
            value={formatDisplay(digits)}
            onChange={handleChange}
            placeholder="(555) 555-5555"
            aria-label="Phone number"
            aria-describedby={error ? "phone-hint phone-error" : "phone-hint"}
            className="flex-1 bg-transparent outline-none text-base"
            style={{
              color: "#1A1A1A",
              fontFamily: "var(--font-body)",
              caretColor: "#B5935A",
            }}
          />
        </div>

        {/* Microcopy */}
        <p
          id="phone-hint"
          className="text-[13px] text-center mb-3"
          style={{ color: "#999" }}
        >
          We'll send a secure one-time code. No password needed.
          <br />
          <span style={{ color: "#B0A695" }}>US &amp; Canada numbers · </span>
          <button
            type="button"
            onClick={() => navigate("/auth/email")}
            className="underline transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-gold)" }}
          >
            elsewhere, use email
          </button>
        </p>

        {/* Quiet trust line — reassures before asking for a phone number. */}
        <p
          className="text-[12px] text-center mb-4"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
        >
          Your number is used to verify access, not shown inside song rooms.
        </p>

        {/* Inline error */}
        {error && (
          <p
            id="phone-error"
            className="text-sm text-center mb-4"
            style={{ color: "#E05440" }}
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {/* CTA */}
        <GoldButton
          type="submit"
          disabled={!isValid}
          loading={isSubmitting}
          loadingText="Sending code..."
        >
          Continue
        </GoldButton>
      </form>

      {/* Invisible Turnstile CAPTCHA widget mount (renders nothing without a key). */}
      <div ref={turnstileRef} />

      {/* Email fallback */}
      <button
        type="button"
        onClick={() => navigate("/auth/email")}
        className="mt-4 text-sm text-center w-full py-2 transition-opacity hover:opacity-70 underline"
        style={{ color: "#B5935A", fontFamily: "var(--font-body)" }}
      >
        Use email instead
      </button>

      {/* Demo fast-track — dev-only; never ships in production builds. */}
      {import.meta.env.DEV && (
        <div className="mt-auto pb-8 pt-10">
          <div
            className="h-px mx-auto mb-4 w-12"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          />
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-[11px] text-center w-full py-1.5 transition-opacity hover:opacity-60"
            style={{ color: "#BBBBBB", fontFamily: "var(--font-body)" }}
          >
            Preview demo ›
          </button>
        </div>
      )}
    </OnboardingShell>
  );
};

export default PhoneLoginPage;
