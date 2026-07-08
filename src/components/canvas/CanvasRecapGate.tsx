import WhatChangedRecapSheet from "@/components/canvas/WhatChangedRecapSheet";
import { useCanvasRecap } from "@/lib/canvas/collab/useCanvasRecap";

/**
 * D3 collab: mounts the "what changed since you left" recap (Product 12)
 * when — and only when — a returning collaborator has real changes to see.
 *
 * All the judgment lives in useCanvasRecap (visit anchor, own-changes
 * excluded, first visits quiet, ≤5 grouped lines). Renders nothing the rest
 * of the time, so the canvas stays calm.
 */
const CanvasRecapGate = ({ songId }: { songId: string }) => {
  const { shouldShow, items, dismiss } = useCanvasRecap(songId);
  if (!shouldShow) return null;
  return <WhatChangedRecapSheet items={items} onDismiss={dismiss} />;
};

export default CanvasRecapGate;
