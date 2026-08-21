import { useEffect, useState } from "react";

/**
 * LayerFlowScrim — ONE persistent dim under the layer flow's sheet
 * hand-offs (G7, the unbroken dim). The flow stack→record→review→stack used
 * to let each sheet mount its own scrim: three times in one flow a scrim
 * unmounted and the next re-faded from zero, flashing full-brightness canvas
 * for a frame or two — and the two scrims weren't even the same tone.
 *
 * The host renders this once, `active` while ANY sheet of the flow is up;
 * the sheets themselves render with `scrim={false}` and cross-slide over an
 * unbroken dim. Fades in once, fades out once (it stays mounted through the
 * exit fade). Clicks route to whatever dismissal the CURRENT top sheet
 * allows — undefined while a live take must not be discarded.
 */
export function LayerFlowScrim({
  active,
  onDismiss,
}: {
  active: boolean;
  onDismiss?: () => void;
}) {
  const [mounted, setMounted] = useState(active);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!mounted) return null;
  return (
    <div
      onClick={active ? onDismiss : undefined}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 799,
        // The canonical tone — one value, owned here (the sheets' two scrims
        // disagreed: 0.65/blur12 vs 0.55/blur10, a visible brightness step).
        backgroundColor: "rgba(28,26,23,0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        opacity: shown ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: active ? "auto" : "none",
      }}
    />
  );
}
