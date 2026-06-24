import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPhoneOtp } from "@/integrations/cog/auth";
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

function toE164(digits: string): string {
  return `+1${digits}`;
}

function toFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code ?? "";
  const msg = raw.toLowerCase();
  if (code === "phone_provider_disabled" || msg.includes("unsupported phone provider") || msg.includes("provider")) {
    return "SMS sign-in isn't available yet. Please contact support or try again shortly.";
  }
  if (code === "over_sms_send_rate_limit" || msg.includes("rate")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (msg.includes("invalid phone")) return "Enter a valid US phone number.";
  if (msg.includes("network") || msg.includes("fetch")) return "We could not send the code. Check your connection and try again.";
  return "We could not send the code. Please try again.";
}

// ─── component ───────────────────────────────────────────────────────────────

const PhoneLoginPage = () => {
  const navigate = useNavigate();
  const [digits, setDigits] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = digits.length === DIGITS_MAX;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, DIGITS_MAX);
    setDigits(raw);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const e164 = toE164(digits);

    try {
      await sendPhoneOtp(e164);

      // Store for display in verify screen
      sessionStorage.setItem("cog:phone-e164", e164);
      sessionStorage.setItem("cog:phone-display", formatDisplay(digits));

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
            border: error
              ? "1.5px solid #E05440"
              : isValid
              ? "1.5px solid #B5935A"
              : "1.5px solid rgba(0,0,0,0.12)",
            boxShadow: isValid && !error
              ? "0 0 0 3px rgba(181,147,90,0.10)"
              : "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {/* Flag */}
          <span className="text-xl leading-none" aria-hidden="true">🇺🇸</span>

          {/* Country code */}
          <span
            className="text-base font-medium"
            style={{ color: "#666", fontFamily: "var(--font-body)", flexShrink: 0 }}
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
            enterKeyHint="send"
            autoFocus
            value={formatDisplay(digits)}
            onChange={handleChange}
            placeholder="(555) 555-5555"
            aria-label="Phone number"
            aria-describedby="phone-hint phone-error"
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
