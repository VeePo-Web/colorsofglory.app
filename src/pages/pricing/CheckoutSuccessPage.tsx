import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";

const AUTO_NAVIGATE_MS = 3000;

/**
 * Stripe redirects here after a successful payment.
 * Shows a warm confirmation and auto-navigates to the song catalog.
 */
const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(3);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      console.log("[checkout] success session_id=", sessionId);
    }
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    const timer = setTimeout(() => navigate("/", { replace: true }), AUTO_NAVIGATE_MS);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [navigate, searchParams]);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#FAFAF6" }}
    >
      {/* Subtle gold glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(181,147,90,0.12) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col items-center text-center" style={{ maxWidth: 360 }}>
        {/* Logo */}
        <div className="mb-10">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Gold checkmark - celebration entrance */}
        <div
          className="flex items-center justify-center rounded-full mb-8"
          style={{
            width: 80,
            height: 80,
            backgroundColor: "rgba(181,147,90,0.12)",
            border: "2px solid rgba(181,147,90,0.35)",
            animation: "cog-success-scale 500ms cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <CheckCircle size={36} strokeWidth={1.5} style={{ color: "#B5935A" }} />
        </div>

        {/* Copy - warm, not transactional */}
        <h1
          className="text-4xl font-bold mb-3 leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
        >
          You're in.
        </h1>
        <p className="text-base mb-10 leading-relaxed" style={{ color: "#666" }}>
          {sessionId
            ? "Your workspace is being finalized. Every song you write from here is protected, connected, and yours."
            : "Your workspace is ready. Every song you write from here is protected, connected, and yours."}
        </p>

        {/* Manual CTA - auto-navigate handles it but user can tap now */}
        <GoldButton onClick={() => navigate("/", { replace: true })}>
          Open my songs
        </GoldButton>

        <p className="text-xs mt-4" style={{ color: "#999" }}>
          Taking you there in {countdown}...
        </p>

        {/* Support */}
        <p className="text-xs mt-8" style={{ color: "#CCC" }}>
          Questions?{" "}
          <a
            href="mailto:help@colorsofglory.com"
            style={{ textDecoration: "underline", color: "inherit" }}
          >
            help@colorsofglory.com
          </a>
        </p>
      </div>

      <style>{`
        @keyframes cog-success-scale {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CheckoutSuccessPage;
