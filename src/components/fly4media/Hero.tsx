import { useEffect, useRef, useState } from "react";
import HeroMedia from "./HeroMedia";
import { LinkButton } from "./Button";
import { INTRO_SESSION_KEY, INTRO_HERO_REVEAL_AT_MS } from "./Intro";
import hero from "@/assets/hero-drone.jpg";

interface Props {
  onContact: () => void;
}

/**
 * Compute the reveal offset for hero contents.
 * If the cinematic intro is about to play, delay the hero's animations so
 * they land *during* the veil dissolve instead of finishing behind a black veil.
 */
function getInitialRevealDelay(): number {
  if (typeof window === "undefined") return 0;
  if (window.location.pathname !== "/") return 0;
  if (new URLSearchParams(window.location.search).has("nointro")) return 0;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
  if (sessionStorage.getItem(INTRO_SESSION_KEY)) return 0;
  return INTRO_HERO_REVEAL_AT_MS;
}


export default function Hero({ onContact }: Props) {
  // When the intro is about to play, hold the hero animations until the
  // dissolve begins, then snap to 0 so the natural choreography runs.
  const [revealDelay, setRevealDelay] = useState<number>(getInitialRevealDelay);
  const [ledeOpen, setLedeOpen] = useState(false);
  const [noHover, setNoHover] = useState(false);
  const ledeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revealDelay === 0) return;
    const onExit = () => setRevealDelay(0);
    window.addEventListener("f4m:intro:exit", onExit as EventListener);
    return () => window.removeEventListener("f4m:intro:exit", onExit as EventListener);
  }, [revealDelay]);

  // Touch / no-hover devices: auto-reveal the lede after the headline lands.
  // On hover-capable devices, the existing hover/focus behavior is preserved.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const noHoverMQ = window.matchMedia("(hover: none)");
    const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!noHoverMQ.matches) return;
    setNoHover(true);
    if (reducedMQ.matches) {
      setLedeOpen(true);
      return;
    }
    const t = window.setTimeout(() => setLedeOpen(true), 900 + revealDelay);
    return () => window.clearTimeout(t);
  }, [revealDelay]);

  // Mobile-only: 8px upward parallax on the lede tied to scrollY 0–80.
  // Direct style mutation through a ref — no React re-renders, single rAF loop.
  useEffect(() => {
    if (!noHover) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let pending = false;
    const apply = () => {
      const p = Math.min(Math.max(window.scrollY / 80, 0), 1);
      if (ledeRef.current) {
        ledeRef.current.style.transform = `translate3d(0, ${(-8 * p).toFixed(2)}px, 0)`;
      }
      pending = false;
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [noHover]);

  // Offset original animation delays by the intro's dissolve mark so the
  // hero reveals land *as* the veil clears, not after a beat of black.
  const d = (base: number) => `${base + revealDelay}ms`;

  // Hover handlers — sub-text only fades in when the headline or CTAs are
  // hovered/focused on devices that actually hover. On touch we auto-reveal.
  const showLede = () => { if (!noHover) setLedeOpen(true); };
  const hideLede = () => { if (!noHover) setLedeOpen(false); };


  return (
    <section
      id="top"
      className="relative w-full overflow-hidden bg-[#0a0a0a] h-[100svh] md:h-[100dvh] max-h-[100dvh]"
    >
      {/* Media layer — full-viewport subject, not wallpaper */}
      <HeroMedia
        image={hero}
        alt="Aerial drone footage over the Canadian Rockies"
        priority
        sources={[
          { src: "/hero/hero-drone-mobile.mp4", type: "video/mp4", media: "(max-width: 768px)" },
          { src: "/hero/hero-drone.webm", type: "video/webm" },
          { src: "/hero/hero-drone.mp4",  type: "video/mp4" },
        ]}
        nextSources={[
          { src: "/hero/sabines-property.mp4", type: "video/mp4" },
        ]}
      />

      {/* Cinematic vignette — sits above the video layer (z:2) so copy reads */}
      <div className="absolute inset-0 hero-vignette z-10" aria-hidden />

      {/* Content — z-20 so it's always above every video frame */}
      <div className="relative z-20 container-x h-full hero-pt hero-pb pb-[max(28px,calc(env(safe-area-inset-bottom)+20px))] md:pb-0 flex flex-col justify-end md:justify-center">

        <div className="flex flex-col max-w-2xl lg:max-w-[52rem] md:flex-1 md:min-h-0 md:justify-center">

          {/* Headline — hovering it (or the CTAs) reveals the sub-text */}
          <h1
            className="hero-display wrap-editorial text-background t-reveal-track cursor-default"
            style={{ animationDelay: d(0) }}
            onMouseEnter={showLede}
            onMouseLeave={hideLede}
            onFocus={showLede}
            onBlur={hideLede}
            tabIndex={-1}
          >
            Your competitors
            <br />
            look ordinary
            <br />
            from up here.
          </h1>

          {/*
            Lede — hidden by default; only present when the headline or CTAs
            are hovered/focused. Subtle fade + slight rise, no layout shift
            (uses opacity + transform only; reserves its own height).
          */}
          {/*
            Lede — fantasy.co-grade reveal. Each word resolves independently
            from blur(6px) + translateY(14px) + opacity 0 → crisp, with a
            70ms cascade. A hairline draws in from the left at the same rate,
            anchoring the line. Reverses faster than it arrives (releases feel
            cheap if they linger). Reserves its own height so nothing shifts.
          */}
          <div
            ref={ledeRef}
            className={`hero-gap-lede max-w-[44ch] select-none will-change-transform ${noHover ? "" : "pointer-events-none"}`}
            style={{ transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            aria-hidden={noHover ? false : !ledeOpen}
          >
            {/* Hairline rule — draws in from the left, syncs with cascade */}
            <span
              aria-hidden
              className="block h-px bg-background/25 origin-left transition-transform ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: ledeOpen ? "scaleX(1)" : "scaleX(0)",
                transitionDuration: ledeOpen ? "900ms" : "420ms",
                width: "3.5rem",
                marginBottom: "1.1rem",
              }}
            />

            <p className="hero-lede text-background/85 font-light leading-[1.45]">
              {[
                { w: "What", prefix: true },
                { w: "if", prefix: true },
                { w: "perspective" },
                { w: "changed" },
                { w: "everything." },
              ].map((item, i, arr) => (
                <span
                  key={i}
                  className="inline-block transition-[opacity,transform,filter,letter-spacing] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity,filter]"
                  style={{
                    opacity: ledeOpen ? (item.prefix ? 0.5 : 1) : 0,
                    transform: ledeOpen ? "translateY(0)" : "translateY(14px)",
                    filter: ledeOpen ? "blur(0px)" : "blur(6px)",
                    letterSpacing: ledeOpen ? "0em" : "0.08em",
                    transitionDuration: ledeOpen ? "1200ms" : "520ms",
                    transitionDelay: ledeOpen ? `${i * 70}ms` : `${(arr.length - 1 - i) * 24}ms`,
                    fontStyle: item.prefix ? "normal" : "italic",
                    marginRight: i < arr.length - 1 ? "0.32em" : 0,
                  }}
                >
                  {item.w}
                </span>
              ))}
            </p>
          </div>

          {/* CTAs — hovering also reveals the sub-text on hover-capable devices */}
          <div
            className="mt-7 md:mt-0 md:hero-gap-cta flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-8 animate-fade-up"
            style={{ animationDelay: d(440) }}
            onMouseEnter={showLede}
            onMouseLeave={hideLede}
            onFocus={showLede}
            onBlur={hideLede}
          >
            <LinkButton to="/work" variant="light" className="w-full md:w-auto justify-center md:justify-start">
              View our work
            </LinkButton>

            <button
              onClick={onContact}
              data-cursor="hover"
              className="t-button text-background/70 hover:text-background transition-colors duration-[260ms] ease-[var(--ease-out-soft)] self-center md:self-auto"
            >
              Start a project
            </button>
          </div>

        </div>

        {/* Bottom bar — GPS coordinate. Desktop only. */}
        <div
          className="hidden md:flex items-end justify-between shrink-0 animate-fade-up"
          style={{ animationDelay: d(600) }}
        >
          <span className="t-micro text-background/25 tracking-[0.18em]">
            &ldquo;Looked like a film. Moved like a sales tool.&rdquo;&thinsp;&mdash;&thinsp;Joe, Cochrane, AB
          </span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 md:bottom-10 left-1/2 -translate-x-1/2 hidden md:block z-20"
        aria-hidden
      >
        <div className="w-px h-9 bg-background/20 hero-scroll-line" />
      </div>
    </section>
  );
}

