import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PhoneLoginPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  const handleContinue = () => {
    if (phone.length >= 10) {
      navigate("/auth/verify");
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-8 pt-24 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Brand wordmark */}
        <p
          className="text-sm font-medium tracking-widest uppercase mb-12 text-center"
          style={{ color: "var(--cog-muted)" }}
        >
          Colors of Glory
        </p>

        {/* Headline */}
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

        {/* Phone input */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-4 mb-2"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border-light)",
          }}
        >
          <span className="text-xl">🇺🇸</span>
          <span className="text-base font-medium" style={{ color: "var(--cog-warm-gray)" }}>
            +1
          </span>
          <div className="w-px h-5" style={{ backgroundColor: "var(--cog-border-light)" }} />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="(555) 555-5555"
            className="flex-1 bg-transparent outline-none text-base"
            style={{
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)",
            }}
            maxLength={10}
          />
        </div>

        {/* Microcopy */}
        <p className="text-sm mb-8" style={{ color: "var(--cog-muted)" }}>
          We will send a secure one-time code. No password needed.
        </p>

        {/* Primary CTA */}
        <button
          onClick={handleContinue}
          disabled={phone.length < 10}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: phone.length >= 10 ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
          }}
        >
          Continue
        </button>

        {/* Secondary: email */}
        <button
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
