import WhatChangedRecapSheet from "@/components/canvas/WhatChangedRecapSheet";
import { useCanvasRecap } from "@/lib/canvas/collab/useCanvasRecap";

/**
 * D3 collab: auto-shows the "what changed since you left" recap (Product 12)
 * when — and only when — a RETURNING collaborator has real changes to see,
 * sourced from the server activity feed since their last visit.
 *
 * Complements the manual recap (the room's "See the full recap" button, fed
 * by on-board cards): this gate is the time-windowed, return-visit half. All
 * judgment lives in useCanvasRecap — visit anchor, own changes excluded,
 * first visits silent, at most 5 grouped lines. Renders nothing the rest of
 * the time, so the canvas stays calm.
 */
const CanvasRecapGate = ({ songId }: { songId: string }) => {
  const { shouldShow, items, dismiss } = useCanvasRecap(songId);
  if (!shouldShow) return null;
  return <WhatChangedRecapSheet songId={songId} items={items} onDismiss={dismiss} />;
};

export default CanvasRecapGate;
