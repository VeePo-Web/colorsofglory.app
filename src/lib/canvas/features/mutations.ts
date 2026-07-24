import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

/**
 * CanvasFeatureMutations — the store surface D2's feature hooks write through.
 *
 * D2 owns the interaction state machines (src/lib/canvas/features/); the STORE
 * that applies + persists these mutations is A4's lane. Until A4 publishes
 * useCanvasStore, the host (SongCanvasExperience) implements this interface
 * over its existing card state — swapping the implementation must not require
 * touching any hook in this folder. Exact signatures are filed in
 * docs/CANVAS-FEATURES-CONTRACT.md.
 *
 * Every mutation is non-destructive: cards are dimmed or re-filed, never
 * deleted, and each has a reverse used by the hooks' Undo paths.
 */
export interface CanvasFeatureMutations {
  /** F22: add the merged section; dim (never delete) both parents. */
  applyMerge(parentAId: string, parentBId: string, merged: CanvasBoardCard): void;
  /** Undo for applyMerge: remove the merged section, restore both parents. */
  revertMerge(mergedId: string, parentAId: string, parentBId: string): void;
  /** Move-to-Final: add the final-tree copy; the source stays as a dimmed reference. */
  promoteToFinal(sourceId: string, finalCopy: CanvasBoardCard): void;
  /** Reverse of promoteToFinal: remove the final copy, restore the idea source. */
  returnToIdeas(finalCardId: string, sourceId: string | null): void;
  /** Field-level patches — compare decisions, arrangement slot swaps, undo snapshots. */
  patchCards(patches: Array<{ id: string; patch: Partial<CanvasBoardCard> }>): void;
  /** F20: persist the listen-path sequence for this song. */
  saveListenPath(orderedCardIds: string[]): void;
}

/** Small non-card feature state the store persists per song (interim: host-owned). */
export interface CanvasFeatureMeta {
  listenPath?: string[];
}

/** Collision-safe card id (replaces the old `merged-${a}-${b}-${Date.now()}` scheme). */
export function newFeatureCardId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

/**
 * Move-to-Final as a pure, idempotent card-array transform: dim the source
 * (never delete) and append the final-tree copy.
 *
 * Idempotent BY THE COPY'S ID. "Add to Final" uses a deterministic
 * `${sourceId}-final` id, and the moveToFinal callback closes over `cards`; a
 * fast double-tap (common on a laggy phone) fires the SECOND tap before the
 * first dim has flushed, so the stale closure passes its guard again. Without
 * this check the copy would be `.concat`ed twice — two cards sharing one id,
 * a React key collision and a phantom duplicate in the arrangement. If the
 * copy already exists we return the SAME array (no dim, no re-render).
 *
 * Shared by the host's mutation impl and any future useCanvasStore so the
 * guarantee can't diverge between them.
 */
export function applyPromoteToFinal(
  cards: CanvasBoardCard[],
  sourceId: string,
  finalCopy: CanvasBoardCard,
): CanvasBoardCard[] {
  if (cards.some((c) => c.id === finalCopy.id)) return cards;
  return cards
    .map((c) =>
      c.id === sourceId
        ? { ...c, isDimmedReference: true, dimReason: "moved_to_final" as const }
        : c,
    )
    .concat(finalCopy);
}
