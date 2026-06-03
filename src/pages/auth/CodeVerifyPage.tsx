import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const formatPhoneDisplay = (raw: string | null) => {
  const digits = (raw ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return "+1 (555) 555-5555";
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const CodeVerifyPage = () => {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [phoneDisplay] = useState(() =>
    formatPhoneDisplay(sessionStorage.getItem("cog:onboarding-phone")),
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleDigit = (idx: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    setError(null);

    if (char && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (char && idx === 5) {
      const code = [...next].join("");
      if (code.length === 6) handleVerify(code);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    setError(null);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) handleVerify(pasted);
  };

  const handleVerify = (codeOverride?: string) => {
    const code = codeOverride ?? digits.join("");
    if (code.length < 6) return;
    setIsSubmitting(true);
    setError(null);
    // Simulated OTP verify — Lovable wires real Supabase auth
    setTimeout(() => {
      setIsSubmitting(false);
      navigate("/onboarding/intent");
    }, 900);
  };

  const allFilled = digits.every((d) => d !== "");

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
        className="relative flex flex-col flex-1 px-8 pt-16 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Back */}
        <button
          onClick={() => navigate("/auth/login")}
          className="flex items-center gap-1.5 text-sm mb-10 transition-opacity hover:opacity-70 w-fit"
          style={{ color: "var(--cog-warm-gray)" }}
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Brand */}
        <p
          className="text-sm font-medium tracking-widest uppercase mb-10 text-center"
          style={{ color: "var(--cog-muted)" }}
        >
          Colors of Glory
        </p>

        {/* Headline */}
        <h1
          className="text-4xl font-semibold mb-2 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Check your phone
        </h1>

        <p className="text-base mb-10 text-center" style={{ color: "var(--cog-warm-gray)" }}>
          We sent a 6-digit code to
          <br />
          <span style={{ color: "var(--cog-charcoal)", fontWeight: 500 }}>{phoneDisplay}</span>
        </p>

        {/* OTP boxes */}
        <div className="flex gap-2.5 justify-center mb-3" onPaste={handlePaste}>
          {digits.map((d, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              aria-label={`Code digit ${idx + 1}`}
              className="text-center text-2xl font-semibold rounded-2xl transition-all duration-150 outline-none"
              style={{
                width: 48,
                height: 64,
                backgroundColor: "var(--cog-cream-light)",
                border: d
                  ? "1.5px solid var(--cog-gold)"
                  : "1.5px solid var(--cog-border)",
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-body)",
                boxShadow: d ? "0 0 0 3px rgba(184,149,58,0.12)" : "none",
              }}
            />
          ))}
        </div>

        {/* Microcopy */}
        <p className="text-sm text-center mb-8" style={{ color: "var(--cog-muted)" }}>
          Codes usually arrive within a few seconds.
        </p>

        {/* Error */}
        {error && (
          <p
            className="text-sm text-center mb-4"
            style={{ color: "#8B3A3A" }}
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {/* Verify CTA */}
        <button
          onClick={() => handleVerify()}
          disabled={!allFilled || isSubmitting}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40 mb-4"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: allFilled ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
          }}
        >
          {isSubmitting ? "Verifying..." : "Verify"}
        </button>

        {/* Secondary actions */}
        <div className="flex justify-between text-sm mt-2">
          <button
            disabled={resendCountdown > 0}
            className="transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: "var(--cog-gold-alt)", fontFamily: "var(--font-body)" }}
          >
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Resend code"}
          </button>
          <button
            onClick={() => navigate("/auth/login")}
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            Change number
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeVerifyPage;
