import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasFeatureMutations } from "./mutations";

/**
 * useFinalArrangement — the F23 order model plus the relocated move-to-final /
 * return-to-ideas mechanics.
 *
 * The Final tree IS the arrangement: top-to-bottom y-order is the play order
 * (this matches the board's existing set-list numbering). Reordering swaps
 * column slots — positions persist through the store with the cards, so the
 * saved order survives reload. D2 owns this order model + reorder logic; the
 * on-canvas drag visual is D1's (its drop callback feeds applyOrder).
 */

export interface FinalArrangementApi {
  /** Final-tree cards in running order (top-to-bottom). */
  orderedFinalCards: CanvasBoardCard[];
  arranging: boolean;
  canArrange: boolean;
  begin: () => void;
  cancel: () => void;
  /** Swap a section with its neighbour: -1 = earlier, +1 = later. Applies immediately. */
  moveBy: (id: string, delta: number) => void;
  save: () => void;
  /** Relocated mechanics: promote an idea to Final / send a final card back. */
  moveToFinal: (cardId: string) => void;
  moveToIdeas: (finalCardId: string) => void;
}

interface UseFinalArrangementArgs {
  cards: CanvasBoardCard[];
  isViewer: boolean;
  mutations: Pick<CanvasFeatureMutations, "patchCards" | "promoteToFinal" | "returnToIdeas">;
  /** Column slot for the Nth final card (host layout constant). */
  finalSlot: (index: number) => { x: number; y: number };
  onMoment?: (title: string, destination: string, detail?: string) => void;
}

export function useFinalArrangement({
  cards,
  isViewer,
  mutations,
  finalSlot,
  onMoment,
}: UseFinalArrangementArgs): FinalArrangementApi {
  const [arranging, setArranging] = useState(false);
  // Snapshot of every final card's position at begin() — cancel/undo restores it.
  const snapshotRef = useRef<Array<{ id: string; patch: { x: number; y: number } }>>([]);

  const orderedFinalCards = useMemo(
    () =>
      cards
        .filter((c) => c.tree === "final" && !c.parentMemoId)
        .sort((a, b) => a.y - b.y),
    [cards],
  );

  const canArrange = !isViewer && orderedFinalCards.length >= 2;

  const begin = useCallback(() => {
    snapshotRef.current = orderedFinalCards.map((c) => ({
      id: c.id,
      patch: { x: c.x, y: c.y },
    }));
    setArranging(true);
  }, [orderedFinalCards]);

  const moveBy = useCallback(
    (id: string, delta: number) => {
      if (isViewer) return;
      const idx = orderedFinalCards.findIndex((c) => c.id === id);
      const swapIdx = idx + delta;
      if (idx < 0 || swapIdx < 0 || swapIdx >= orderedFinalCards.length) return;
      const a = orderedFinalCards[idx];
      const b = orderedFinalCards[swapIdx];
      mutations.patchCards([
        { id: a.id, patch: { x: b.x, y: b.y } },
        { id: b.id, patch: { x: a.x, y: a.y } },
      ]);
    },
    [isViewer, orderedFinalCards, mutations],
  );

  const cancel = useCallback(() => {
    if (snapshotRef.current.length > 0) mutations.patchCards(snapshotRef.current);
    setArranging(false);
  }, [mutations]);

  const save = useCallback(() => {
    const previous = snapshotRef.current;
    setArranging(false);
    onMoment?.("Arrangement saved", "Final tree", "Running order");
    toast("Running order saved", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => {
          if (previous.length > 0) mutations.patchCards(previous);
        },
      },
    });
  }, [mutations, onMoment]);

  const moveToFinal = useCallback(
    (cardId: string) => {
      if (isViewer) return;
      const source = cards.find((c) => c.id === cardId);
      if (!source || source.tree !== "ideas" || source.isDimmedReference) return;
      const finalCopy: CanvasBoardCard = {
        ...source,
        id: `${cardId}-final`,
        tree: "final",
        isDimmedReference: false,
        dimReason: undefined,
        ...finalSlot(orderedFinalCards.length),
        status: "approved",
      };
      mutations.promoteToFinal(cardId, finalCopy);
      onMoment?.("Approved idea", "Final tree", "Arrangement");
      toast("Idea moved to Final", {
        duration: 7000,
        action: {
          label: "Undo",
          onClick: () => mutations.returnToIdeas(finalCopy.id, cardId),
        },
      });
    },
    [isViewer, cards, orderedFinalCards.length, finalSlot, mutations, onMoment],
  );

  const moveToIdeas = useCallback(
    (finalCardId: string) => {
      if (isViewer) return;
      const sourceId = finalCardId.endsWith("-final")
        ? finalCardId.slice(0, -"-final".length)
        : null;
      mutations.returnToIdeas(finalCardId, sourceId);
      onMoment?.("Returned idea", "Ideas tree", "Arrangement");
    },
    [isViewer, mutations, onMoment],
  );

  return {
    orderedFinalCards,
    arranging,
    canArrange,
    begin,
    cancel,
    moveBy,
    save,
    moveToFinal,
    moveToIdeas,
  };
}
