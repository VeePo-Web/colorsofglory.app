import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Adds .page-enter to <main> briefly on each route change so children fade-up softly.
 * Pure CSS, no blocking, no library.
 */
export function usePageEnter() {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.classList.remove("page-enter");
    // force reflow so animation re-runs
    void (main as HTMLElement).offsetWidth;
    main.classList.add("page-enter");
    const t = window.setTimeout(() => main.classList.remove("page-enter"), 700);
    return () => window.clearTimeout(t);
  }, [pathname]);
}
