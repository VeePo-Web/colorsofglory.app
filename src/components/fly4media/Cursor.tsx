import { useEffect, useRef } from "react";

/**
 * Desktop ring cursor with hover/press states + subtle magnetic pull
 * for [data-magnetic] elements. Single rAF loop, GPU-only transforms.
 */
export default function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ring = ringRef.current;
    if (!ring) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let cx = mx;
    let cy = my;
    let raf = 0;
    let ready = false;

    let magnetEl: HTMLElement | null = null;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!ready) {
        ready = true;
        ring.classList.add("is-ready");
      }
      const target = e.target as HTMLElement | null;
      const isHover = !!target?.closest(
        '[data-cursor="hover"], a, button, input, textarea, [role="button"]',
      );
      ring.classList.toggle("is-hover", isHover);

      const newMagnet = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (newMagnet !== magnetEl) {
        if (magnetEl) {
          magnetEl.style.removeProperty("--mx");
          magnetEl.style.removeProperty("--my");
        }
        magnetEl = newMagnet;
      }
    };

    const onDown = () => ring.classList.add("is-press");
    const onUp = () => ring.classList.remove("is-press");

    const tick = () => {
      cx += (mx - cx) * 0.22;
      cy += (my - cy) * 0.22;
      ring.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

      if (magnetEl) {
        const r = magnetEl.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;
        const dx = mx - ex;
        const dy = my - ey;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(r.width, r.height) * 0.9 + 40;
        if (dist < radius) {
          const k = (1 - dist / radius) * 0.18; // max ~6px on small buttons
          magnetEl.style.setProperty("--mx", `${dx * k}px`);
          magnetEl.style.setProperty("--my", `${dy * k}px`);
        } else {
          magnetEl.style.removeProperty("--mx");
          magnetEl.style.removeProperty("--my");
        }
      }

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
      if (magnetEl) {
        magnetEl.style.removeProperty("--mx");
        magnetEl.style.removeProperty("--my");
      }
    };
  }, []);

  return <div ref={ringRef} className="cursor-ring" aria-hidden="true" />;
}
