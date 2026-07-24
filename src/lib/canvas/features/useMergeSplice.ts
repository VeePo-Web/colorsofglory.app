import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { newFeatureCardId, type CanvasFeatureMutations } from "./mutations";

/**
 * useMergeSplice — the F22 state machine: select exactly two idea cards,
 * merge them into a new section that records both parents as provenance
 * (`mergedFrom`), with a real Undo. Parents are dimmed, never deleted.
 */

export interface MergeSpliceApi {
  selection: string[];
  toggleSelect: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  /** Reverse A and B — the preview updates live, so order is a choice, not a surprise. */
  swapSelection: () => void;
  executeMerge: () => void;
}

interface UseMergeSpliceArgs {
  cards: CanvasBoardCard[];
  isViewer: boolean;
  mutations: Pick<CanvasFeatureMutations, "applyMerge" | "revertMerge">;
  onMoment?: (title: string, destination: string, detail?: string) => void;
}

export function useMergeSplice({ cards, isViewer, mutations, onMoment }: UseMergeSpliceArgs): MergeSpliceApi {
  const [selection, setSelection] = useState<string[]>([]);
  // A double-tap on "Create draft" fires the 2nd press before setSelection([])
  // re-renders executeMerge, so the stale closure still sees two selected cards
  // and would persist a SECOND merged draft (fresh id, no key collision but a
  // real duplicate on the server). This latch stops the re-entry; it releases
  // when the selection clears (a fresh 2-card selection can merge again).
  const executeInFlightRef = useRef(false);

  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }, []);

  const removeFromSelection = useCallback((id: string) => {
    setSelection((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearSelection = useCallback(() => setSelection([]), []);

  const swapSelection = useCallback(() => {
    setSelection((prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
  }, []);

  const executeMerge = useCallback(() => {
    if (isViewer || selection.length !== 2 || executeInFlightRef.current) return;
    const [idA, idB] = selection;
    const cardA = cards.find((c) => c.id === idA);
    const cardB = cards.find((c) => c.id === idB);
    if (!cardA || !cardB) return;
    // Latch AFTER the early returns so a not-found merge can't wedge it shut.
    executeInFlightRef.current = true;

    const contributors =
      cardA.contributor === cardB.contributor
        ? cardA.contributor
        : `${cardA.contributor} & ${cardB.contributor}`;
    const merged: CanvasBoardCard = {
      id: newFeatureCardId("merged"),
      tree: "ideas",
      type: "section",
      title: `${cardA.title} + ${cardB.title}`,
      body: [cardA.body, cardB.body].filter(Boolean).join("\n\n"),
      meta: `Merged from ${cardA.title} and ${cardB.title}`,
      section: cardA.section || cardB.section || "Merged section",
      contributor: contributors,
      status: "raw",
      accent: cardA.accent,
      x: Math.round((cardA.x + cardB.x) / 2),
      y: Math.round((cardA.y + cardB.y) / 2) + 60,
      mergedFrom: [idA, idB],
    };

    mutations.applyMerge(idA, idB, merged);
    setSelection([]);
    onMoment?.("Ideas merged", "Ideas tree", "New section created");
    toast("Ideas merged into a new section", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => mutations.revertMerge(merged.id, idA, idB),
      },
    });
  }, [isViewer, selection, cards, mutations, onMoment]);

  // Release the latch once the merge's setSelection([]) lands (or the selection
  // otherwise drops below two) — the next real 2-card selection can merge again.
  useEffect(() => {
    if (selection.length !== 2) executeInFlightRef.current = false;
  }, [selection.length]);

  return { selection, toggleSelect, removeFromSelection, clearSelection, swapSelection, executeMerge };
}
