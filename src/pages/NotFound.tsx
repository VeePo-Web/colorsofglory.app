import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Home, LogIn } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Page not found - Colors of Glory";
  }, [location.pathname]);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 52% at 50% 82%, rgba(184,149,58,0.16) 0%, transparent 68%)",
        }}
      />

      <main
        className="relative mx-auto flex min-h-screen w-full flex-col justify-center px-6 py-16"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <Link
          to="/"
          className="mb-12 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)" }}
        >
          <ArrowLeft size={16} />
          Songs
        </Link>

        <p
          className="text-xs font-medium tracking-widest uppercase mb-5"
          style={{ color: "var(--cog-muted)" }}
        >
          Colors of Glory
        </p>

        <div
          className="mb-8 inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: "rgba(184,149,58,0.12)",
            color: "var(--cog-gold-alt)",
            border: "1px solid rgba(184,149,58,0.22)",
          }}
        >
          Page not found
        </div>

        <h1
          className="mb-4 font-semibold leading-tight"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            fontSize: "clamp(2.5rem, 12vw, 4.5rem)",
          }}
        >
          This song room is not here.
        </h1>

        <p className="mb-10 text-base leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
          The link may have changed, expired, or been typed incorrectly. Your songs are still safe.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: "var(--cog-gold)",
              fontFamily: "var(--font-body)",
              boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
            }}
          >
            <Home size={18} strokeWidth={1.7} />
            Go to songs
          </Link>

          <Link
            to="/auth/login"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-transform duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)",
            }}
          >
            <LogIn size={17} strokeWidth={1.7} />
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
