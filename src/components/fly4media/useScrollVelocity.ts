import { useEffect } from "react";

/**
 * Writes a clamped 0..1 scroll velocity to <html> as --scroll-vel.
 * Decays each frame so fast flicks blur slightly, then settle instantly.
 * No-op on reduced motion / low-end devices.
 */
export function useScrollVelocity() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cores = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? 8;
    if (cores < 4) return;

    const root = document.documentElement;
    let lastY = window.scrollY;
    let vel = 0;
    let raf = 0;

    const tick = () => {
      const y = window.scrollY;
      const delta = Math.abs(y - lastY);
      lastY = y;
      // Map ~50px/frame → 1.0
      const target = Math.min(delta / 50, 1);
      vel += (target - vel) * 0.35;
      if (vel < 0.002) vel = 0;
      root.style.setProperty("--scroll-vel", vel.toFixed(3));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      root.style.removeProperty("--scroll-vel");
    };
  }, []);
}
