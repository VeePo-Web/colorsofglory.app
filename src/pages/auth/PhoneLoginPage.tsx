import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CogLogo from "@/components/cog/CogLogo";

const formatPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const PhoneLoginPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phone.length < 10) {
      setError("Enter a complete phone number and we will send your code.");
      return;
    }

    sessionStorage.setItem("cog:onboarding-phone", phone);
    navigate("/auth/verify");
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-8 pt-24 pb-12 md:justify-center md:pt-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="flex justify-center mb-12">
          <CogLogo size="sm" />
        </div>

        <h1
          className="text-4xl font-semibold mb-2"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Welcome
        </h1>

        <p className="text-base mb-10" style={{ color: "var(--cog-warm-gray)" }}>
          Enter your phone number to continue.
        </p>

        <form onSubmit={handleContinue}>
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-4 mb-2"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: error
                ? "1.5px solid rgba(139,58,58,0.45)"
                : "1.5px solid var(--cog-border-light)",
            }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: "rgba(184,149,58,0.12)",
                color: "var(--cog-gold-alt)",
              }}
              aria-hidden
            >
              US
            </span>
            <span className="text-base font-medium" style={{ color: "var(--cog-warm-gray)" }}>
              +1
            </span>
            <div className="w-px h-5" style={{ backgroundColor: "var(--cog-border-light)" }} />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={formatPhone(phone)}
              onChange={(event) => {
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                setError(null);
              }}
              placeholder="(555) 555-5555"
              aria-label="Phone number"
              aria-describedby="phone-help phone-error"
              className="flex-1 bg-transparent outline-none text-base"
              style={{
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-body)",
              }}
            />
          </div>

          <p id="phone-help" className="text-sm mb-3" style={{ color: "var(--cog-muted)" }}>
            We will send a secure one-time code. No password needed.
          </p>

          {error && (
            <p
              id="phone-error"
              className="text-sm mb-5"
              style={{ color: "#8B3A3A" }}
              aria-live="polite"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: "var(--cog-gold)",
              fontFamily: "var(--font-body)",
              boxShadow: phone.length >= 10 ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
            }}
          >
            Continue
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-center w-full py-2 transition-opacity duration-150 hover:opacity-70"
          style={{ color: "var(--cog-gold-alt)", fontFamily: "var(--font-body)" }}
        >
          Use email instead
        </button>
      </div>
    </div>
  );
};

export default PhoneLoginPage;
