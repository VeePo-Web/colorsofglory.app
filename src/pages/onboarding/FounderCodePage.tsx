import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";

const normalizeCode = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);

const FounderCodePage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = () => {
    if (!code.trim()) return;
    setIsSubmitting(true);
    setError(null);
    // Lovable wires real server-side founder code validation
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 900);
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div
        className="relative min-h-screen flex flex-col"
        style={{ backgroundColor: "#FAFAF6" }}
      >
        {/* Warm glow — right corner only, from reference image */}
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 90% 90%, rgba(181,147,90,0.13) 0%, transparent 65%)",
          }}
        />

        <div
          className="relative flex flex-col flex-1 items-center justify-between px-6 py-16"
          style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}
        >
          {/* Top section — headline only, very clean like reference image */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1
              className="text-[2.8rem] font-bold text-center mb-4 leading-[1.05]"
              style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
            >
              Founder access unlocked
            </h1>
            <p className="text-[1.0625rem] text-center" style={{ color: "#666" }}>
              Your Pro workspace is ready.
            </p>
          </div>

          {/* Bottom CTA — matches reference: gold pill at bottom of screen */}
          <div className="w-full">
            <GoldButton onClick={() => navigate("/onboarding/earn")}>
              Start a song
            </GoldButton>
          </div>
        </div>
      </div>
    );
  }

  // ── Entry state ───────────────────────────────────────────────────────────
  return (
    <OnboardingShell>
      {/* Back */}
      <div className="pt-14 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "#999", minHeight: 44 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>
      </div>

      {/* Logo */}
      <div className="pb-8 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Have a founder code?
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        Enter it here to unlock your private access.
      </p>

      {/* Code input — centered pill style from reference */}
      <div className="mb-4">
        <label htmlFor="founder-code" className="sr-only">
          Founder code
        </label>
        <input
          id="founder-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value));
            if (error) setError(null);
          }}
          placeholder="FOUNDER-X7K92Q"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl px-4 text-center text-[1.125rem] font-semibold tracking-widest"
          style={{
            height: 60,
            backgroundColor: "#FFFFFF",
            border: code
              ? "1.5px solid #B5935A"
              : "1.5px solid rgba(0,0,0,0.10)",
            color: "#1A1A1A",
            fontFamily: "var(--font-body)",
            boxShadow: code
              ? "0 0 0 3px rgba(181,147,90,0.10)"
              : "0 1px 4px rgba(0,0,0,0.05)",
            outline: "none",
            transition: "border 150ms, box-shadow 150ms",
            caretColor: "#B5935A",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <p
          className="text-sm text-center mb-4"
          style={{ color: "#E05440" }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      <div className="mb-6" />

      {/* Unlock CTA */}
      <GoldButton
        disabled={!code.trim()}
        loading={isSubmitting}
        loadingText="Unlocking access..."
        onClick={handleUnlock}
      >
        Unlock access
      </GoldButton>

      {/* Skip — underlined link from reference */}
      <button
        onClick={() => navigate("/onboarding/intent")}
        className="text-[0.9375rem] text-center w-full py-4 transition-opacity hover:opacity-70 underline"
        style={{ color: "#999", fontFamily: "var(--font-body)" }}
      >
        I'll do this later
      </button>
    </OnboardingShell>
  );
};

export default FounderCodePage;
