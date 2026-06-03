import { useEffect, useRef, useState } from "react";
import mark from "@/assets/fly4media-mark.png";
import heroPoster from "@/assets/hero-drone.jpg";

/**
 * Fly4MEdia intro — v7 "Aperture"
 *
 * Re-timed for a real hold beat, then a clean rack-out.
 *
 *   0     →  500    mark fade in
 *   500   → 1300    hairline draws (800ms)
 *   1300  → 1850    word-1 fades in (550ms)
 *   1850  → 2500    word-2 rack focus (650ms; blur 2px → 0 by 60%)
 *   2500  → 3100    HOLD — 600ms of stillness
 *   3100  → 3700    intro layer crossfades out (600ms)
 *
 *   Hero begins its own reveal at 2900ms so the dissolve overlaps the
 *   last 200ms of the hold and the full fade.
 */

const SESSION_KEY = "f4m:intro:v8";
const REPLAY_KEY = "f4m:intro:replay";

const T_HOLD_END = 3100;
const T_FADE = 600;
const T_TOTAL = T_HOLD_END + T_FADE; // 3700

export const INTRO_SESSION_KEY = SESSION_KEY;
export const INTRO_HERO_REVEAL_AT_MS = 2900;

/**
 * Warm the hero LCP image the moment this module evaluates — runs before
 * React even renders the Intro, giving the browser the full intro duration
 * to decode the poster. No-op on the server.
 */
if (typeof document !== "undefined" && !document.head.querySelector('link[data-f4m-hero-preload]')) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = heroPoster;
  link.setAttribute("fetchpriority", "high");
  link.setAttribute("data-f4m-hero-preload", "");
  document.head.appendChild(link);
}

/* Routes are eagerly bundled in App.tsx, so there's nothing to prefetch here
 * beyond the hero poster (handled above at module-eval time). */

const Intro = () => {
  const [mounted, setMounted] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.location.pathname !== "/") return false;
    if (new URLSearchParams(window.location.search).has("nointro")) return false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    if (sessionStorage.getItem(REPLAY_KEY)) {
      sessionStorage.removeItem(REPLAY_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return true;
    }
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    return true;
  });
  const [exiting, setExiting] = useState(false);
  const [runId, setRunId] = useState(0);
  const finishedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onReplay = () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      sessionStorage.removeItem(SESSION_KEY);
      finishedRef.current = false;
      setExiting(false);
      setRunId((n) => n + 1);
      setMounted(true);
    };
    window.addEventListener("f4m:intro:replay", onReplay);
    return () => window.removeEventListener("f4m:intro:replay", onReplay);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    document.body.classList.add("intro-active");

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      // Retire compositor layers before unmount so we don't leak them.
      const root = rootRef.current;
      if (root) {
        root.querySelectorAll<HTMLElement>(".intro-mark, .intro-hairline, .intro-word-1, .intro-word-2")
          .forEach((el) => { el.style.willChange = "auto"; });
      }
      setMounted(false);
      document.body.classList.remove("intro-active");
    };

    const timers = [
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent("f4m:intro:exit")),
        INTRO_HERO_REVEAL_AT_MS,
      ),
      window.setTimeout(() => setExiting(true), T_HOLD_END),
      window.setTimeout(finish, T_TOTAL),
    ];

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.body.classList.remove("intro-active");
    };
  }, [mounted, runId]);

  if (!mounted) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a] ${
        exiting ? "intro-layer-out" : ""
      }`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <img
          src={mark}
          alt=""
          width={50}
          height={50}
          decoding="sync"
          fetchPriority="high"
          className="intro-mark h-[50px] w-[50px]"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <span className="intro-hairline mt-7 block h-px bg-white/55" />
        <p
          className="mt-7 select-none"
          style={{
            fontSize: "13px",
            letterSpacing: "0.12em",
            fontWeight: 400,
            lineHeight: 1.4,
          }}
        >
          <span className="intro-word-1 text-white">Perspective</span>{" "}
          <span className="intro-word-2 text-white">changes everything.</span>
        </p>
      </div>
    </div>
  );
};

export default Intro;
