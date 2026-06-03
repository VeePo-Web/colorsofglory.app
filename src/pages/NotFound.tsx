import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Page not found — Fly4MEdia";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-background flex flex-col">

      {/* Minimal nav — home link only */}
      <nav className="container-x pt-8 md:pt-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 t-eyebrow text-background/50 hover:text-background transition-colors duration-200"
        >
          ← Fly4MEdia
        </Link>
      </nav>

      {/* Main content — left-anchored, vertically centered */}
      <div className="flex-1 container-x flex flex-col justify-center py-20">

        {/* Ghost 404 behind the headline */}
        <div className="relative">
          <span
            className="absolute -top-8 md:-top-14 left-0 text-[clamp(8rem,25vw,18rem)] font-bold leading-none text-background/[0.03] select-none pointer-events-none tabular-nums"
            aria-hidden
          >
            404
          </span>

          <p className="t-eyebrow text-background/40 mb-6 relative">
            Error / 404
          </p>
          <h1 className="t-display-2 text-background mb-6 relative max-w-[14ch]">
            Lost signal.
          </h1>
          <p className="t-lede text-background/55 mb-14 max-w-md relative">
            The page you&rsquo;re looking for has drifted out of frame.
          </p>
        </div>

        {/* Navigation options */}
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 t-button text-background border border-background/20 hover:border-background/60 px-6 py-3 transition-colors duration-200"
          >
            <span>Return home</span>
            <span aria-hidden>↗</span>
          </Link>
          <Link
            to="/work"
            className="inline-flex items-center gap-2 t-button text-background/55 hover:text-background transition-colors duration-200 px-2 py-3"
          >
            Browse work
          </Link>
          <Link
            to="/services"
            className="inline-flex items-center gap-2 t-button text-background/55 hover:text-background transition-colors duration-200 px-2 py-3"
          >
            Services
          </Link>
        </div>
      </div>

      {/* Footer line */}
      <div className="container-x pb-8 md:pb-10 border-t border-background/10 pt-6">
        <p className="t-micro text-background/25">
          © {new Date().getFullYear()} Fly4MEdia · Alberta, Canada
        </p>
      </div>

    </div>
  );
};

export default NotFound;
