import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasFeatureMutations } from "./mutations";
import { memoIdForCard, pauseCanvasAudio, playMemoOnCanvas, stopCanvasAudio } from "./canvasAudio";

/**
 * useCompareMode — the F21 state machine: open two same-section variants side
 * by side, audition each for real (one at a time, shared audio element),
 * persist the chosen direction non-destructively. "Keep both" leaves both
 * active; the un-chosen card is dimmed and kept, never deleted.
 */

export interface CompareModeApi {
  /** The open A/B pair, or null when the sheet is closed. */
  pair: [CanvasBoardCard, CanvasBoardCard] | null;
  playingId: string | null;
  /** True when this card has a same-section, same-tree partner to compare against. */
  canCompare: (card: CanvasBoardCard) => boolean;
  open: (cardId: string) => void;
  close: () => void;
  togglePlay: (cardId: string) => void;
  choose: (winnerId: string) => void;
  keepBoth: () => void;
}

interface UseCompareModeArgs {
  cards: CanvasBoardCard[];
  isViewer: boolean;
  mutations: Pick<CanvasFeatureMutations, "patchCards">;
  onMoment?: (title: string, destination: string, detail?: string) => void;
}

function findPartner(cards: CanvasBoardCard[], card: CanvasBoardCard): CanvasBoardCard | undefined {
  return cards.find(
    (c) =>
      c.id !== card.id &&
      c.tree === card.tree &&
      c.section === card.section &&
      !c.isDimmedReference &&
      !c.parentMemoId,
  );
}

export function useCompareMode({ cards, isViewer, mutations, onMoment }: UseCompareModeArgs): CompareModeApi {
  const [pairIds, setPairIds] = useState<[string, string] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const pair = useMemo<[CanvasBoardCard, CanvasBoardCard] | null>(() => {
    if (!pairIds) return null;
    const a = cards.find((c) => c.id === pairIds[0]);
    const b = cards.find((c) => c.id === pairIds[1]);
    return a && b ? [a, b] : null;
  }, [cards, pairIds]);

  const canCompare = useCallback(
    (card: CanvasBoardCard) =>
      !card.isDimmedReference && !card.parentMemoId && Boolean(findPartner(cards, card)),
    [cards],
  );

  const open = useCallback(
    (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const partner = findPartner(cards, card);
      if (!partner) return;
      setPairIds([card.id, partner.id]);
    },
    [cards],
  );

  const close = useCallback(() => {
    stopCanvasAudio();
    setPlayingId(null);
    setPairIds(null);
  }, []);

  const togglePlay = useCallback(
    (cardId: string) => {
      if (playingId === cardId) {
        pauseCanvasAudio();
        setPlayingId(null);
        return;
      }
      const memoId = memoIdForCard(cardId);
      if (!memoId) return;
      setPlayingId(cardId);
      void playMemoOnCanvas(memoId, {
        onEnded: () => setPlayingId((prev) => (prev === cardId ? null : prev)),
        onError: () => setPlayingId((prev) => (prev === cardId ? null : prev)),
      });
    },
    [playingId],
  );

  const choose = useCallback(
    (winnerId: string) => {
      if (isViewer || !pair) return;
      const winner = pair.find((c) => c.id === winnerId);
      const loser = pair.find((c) => c.id !== winnerId);
      if (!winner || !loser) return;
      // Snapshot for a clean, lossless undo.
      const before = [winner, loser].map((c) => ({
        id: c.id,
        patch: {
          status: c.status,
          isDimmedReference: c.isDimmedReference,
          dimReason: c.dimReason,
        },
      }));
      mutations.patchCards([
        { id: winner.id, patch: { status: winner.tree === "ideas" ? "shortlisted" : winner.status } },
        { id: loser.id, patch: { isDimmedReference: true, dimReason: "compare_kept" } },
      ]);
      onMoment?.("Direction chosen", winner.section || "Ideas tree", winner.title);
      toast("Direction saved — the other idea is kept", {
        duration: 7000,
        action: { label: "Undo", onClick: () => mutations.patchCards(before) },
      });
    },
    [isViewer, pair, mutations, onMoment],
  );

  const keepBoth = useCallback(() => {
    // Nothing to persist — both stay active. Calm confirmation only.
    toast("Both ideas stay active");
  }, []);

  return { pair, playingId, canCompare, open, close, togglePlay, choose, keepBoth };
}
