import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  onContact: () => void;
}

const NAV: { label: string; to: string }[] = [
  { label: "Work", to: "/work" },
  { label: "Services", to: "/services" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
];

/**
 * Full-viewport menu overlay — fantasy.co register.
 *
 * Shares motion vocabulary with the cinematic intro veil and the hero lede:
 * the same #0a0a0a ground, the same cubic-bezier(0.22,1,0.36,1), the same
 * per-word blur-to-sharp cascade. The menu is "the studio, looked at
 * differently" — not a utility panel.
 */
export default function MenuOverlay({ open, onClose, onContact }: Props) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const handleContact = () => {
    onClose();
    // Wait a frame so the close animation can begin before the modal opens
    requestAnimationFrame(() => onContact());
  };

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[90] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      {/* Veil — same vocabulary as the intro */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className="absolute inset-0 w-full h-full bg-[#0a0a0a] origin-top transition-transform duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: open ? "scaleY(1)" : "scaleY(0)",
        }}
      />

      {/* Film grain — depth, prevents flat digital black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay transition-opacity duration-500"
        style={{
          opacity: open ? 0.05 : 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: open ? 1 : 0,
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 h-[100svh] w-full container-x flex flex-col overflow-hidden"
        style={{
          opacity: open ? 1 : 0,
          transition: "opacity 320ms cubic-bezier(0.22,1,0.36,1)",
          transitionDelay: open ? "260ms" : "0ms",
        }}
      >
        {/* Top bar — close button mirrors the Menu trigger position */}
        <div className="flex items-center justify-end h-16 md:h-20 shrink-0">
          <button
            onClick={onClose}
            data-cursor="hover"
            aria-label="Close menu"
            className="group flex items-center gap-3 text-white/80 hover:text-white transition-colors duration-300"
          >
            <span className="t-nav">Close</span>
            <span className="relative block w-4 h-4">
              <span className="absolute top-1/2 left-0 right-0 h-px bg-current rotate-45" />
              <span className="absolute top-1/2 left-0 right-0 h-px bg-current -rotate-45" />
            </span>
          </button>
        </div>

        {/* Body — two columns: oversized link list + slim contact rail */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 pb-[max(2rem,env(safe-area-inset-bottom))] lg:pb-10">


          {/* Link list */}
          <nav
            aria-label="Primary"
            className="lg:col-span-9 flex flex-col justify-center gap-1 sm:gap-2 lg:gap-3"
          >
            {[...NAV, { label: "Contact", to: "__contact" }].map((item, i) => {
              const active = item.to !== "__contact" && isActive(item.to);
              const sharedClass =
                "group relative inline-flex items-baseline gap-5 w-fit text-white/90 hover:text-white transition-colors duration-300";
              const sharedStyle = {
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0px) translateX(0)" : "translateY(18px)",
                filter: open ? "blur(0px)" : "blur(6px)",
                transition:
                  "opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1), filter 900ms cubic-bezier(0.22,1,0.36,1)",
                transitionDelay: open ? `${360 + i * 90}ms` : "0ms",
              } as const;

              const inner = (
                <>
                  {/* Active marker — small left rule, quieter than an underline */}
                  <span
                    aria-hidden
                    className="block h-[2px] bg-white/70 transition-[width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      width: active ? "28px" : "0px",
                      opacity: active ? 1 : 0,
                    }}
                  />
                  <span className="text-[clamp(2.25rem,9vh,5.5rem)] leading-[0.95] tracking-[-0.03em] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-3">
                    {item.label}
                  </span>
                </>
              );

              if (item.to === "__contact") {
                return (
                  <button
                    key={item.to}
                    onClick={handleContact}
                    data-cursor="hover"
                    className={`${sharedClass} text-left`}
                    style={sharedStyle}
                  >
                    {inner}
                  </button>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  data-cursor="hover"
                  className={sharedClass}
                  style={sharedStyle}
                >
                  {inner}
                </Link>
              );
            })}
          </nav>

          {/* Slim contact rail */}
          <aside
            className="lg:col-span-3 flex flex-col justify-end gap-3 mt-auto text-white/55"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(14px)",
              transition:
                "opacity 800ms cubic-bezier(0.22,1,0.36,1), transform 800ms cubic-bezier(0.22,1,0.36,1)",
              transitionDelay: open ? "680ms" : "0ms",
            }}
          >
            <p className="t-micro text-white/40">Contact</p>
            <a
              href="mailto:tobyrennick@gmail.com"
              data-cursor="hover"
              className="block t-body text-white/80 hover:text-white transition-colors duration-300"
            >
              tobyrennick@gmail.com
            </a>
            <a
              href="tel:+14038189686"
              data-cursor="hover"
              className="block t-body text-white/80 hover:text-white transition-colors duration-300"
            >
              +1 403 818 9686
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
