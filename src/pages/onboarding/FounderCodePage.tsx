import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

const FounderCodePage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeCode = (raw: string) =>
    raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);

  const handleUnlock = () => {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    setIsSubmitting(true);
    setError(null);
    // Simulated redemption — Lovable wires real server-side validation
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1000);
  };

  const handleStartSong = () => {
    navigate("/onboarding/start-song");
  };

  const handleSkip = () => {
    navigate("/onboarding/intent");
  };

  if (isSuccess) {
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
              "radial-gradient(ellipse 70% 55% at 50% 80%, rgba(184,149,58,0.18) 0%, transparent 65%)",
          }}
        />

        <div
          className="relative flex flex-col flex-1 items-center justify-center px-6 py-16"
          style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
        >
          {/* Brand */}
          <div className="flex justify-center mb-12">
            <CogLogo size="sm" />
          </div>

          {/* Success icon */}
          <div
            className="flex items-center justify-center rounded-full mb-8"
            style={{
              width: 72,
              height: 72,
              backgroundColor: "rgba(184,149,58,0.12)",
              border: "1.5px solid rgba(184,149,58,0.30)",
            }}
          >
            <CheckCircle size={34} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
          </div>

          <h1
            className="text-4xl font-semibold mb-3 text-center"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--cog-charcoal)",
              lineHeight: 1.1,
            }}
          >
            Founder access unlocked
          </h1>

          <p
            className="text-base text-center mb-14"
            style={{ color: "var(--cog-warm-gray)", maxWidth: 280 }}
          >
            Your Pro workspace is ready.
          </p>

          <button
            onClick={handleStartSong}
            className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: "var(--cog-gold)",
              fontFamily: "var(--font-body)",
              boxShadow: "0 4px 24px rgba(184,149,58,0.40)",
            }}
          >
            Start a song
          </button>
        </div>
      </div>
    );
  }

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
        className="relative flex flex-col flex-1 px-6"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Back */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        {/* Brand */}
        <div className="flex justify-center mb-10">
          <CogLogo size="sm" />
        </div>

        {/* Headline */}
        <h1
          className="text-4xl font-semibold mb-2 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          Have a founder code?
        </h1>

        <p className="text-base mb-10 text-center" style={{ color: "var(--cog-warm-gray)" }}>
          Enter it here to unlock your private access.
        </p>

        {/* Code input */}
        <div className="mb-3">
          <label
            htmlFor="founder-code"
            className="sr-only"
          >
            Founder code
          </label>
          <input
            id="founder-code"
            type="text"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="FOUNDER-X7K92Q"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-2xl px-4 py-4 text-center text-lg font-semibold tracking-widest outline-none transition-all duration-150"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: code
                ? "1.5px solid var(--cog-gold)"
                : "1.5px solid var(--cog-border)",
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)",
              boxShadow: code ? "0 0 0 3px rgba(184,149,58,0.10)" : "none",
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <p
            className="text-sm text-center mb-3"
            style={{ color: "#8B3A3A" }}
            aria-live="polite"
          >
            {error}
          </p>
        )}

        <div className="mb-8" />

        {/* Unlock CTA */}
        <button
          onClick={handleUnlock}
          disabled={!code.trim() || isSubmitting}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40 mb-4"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: code ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
          }}
        >
          {isSubmitting ? "Unlocking access..." : "Unlock access"}
        </button>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          I will do this later
        </button>
      </div>
    </div>
  );
};

export default FounderCodePage;
