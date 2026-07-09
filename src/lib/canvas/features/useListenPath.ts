import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasFeatureMutations } from "./mutations";
import {
  memoIdForCard,
  pauseCanvasAudio,
  playMemoOnCanvas,
  preloadMemo,
  stopCanvasAudio,
} from "./canvasAudio";

/**
 * useListenPath — the F20 state machine: tap cards to build a queue, press
 * play, and the queue actually plays card by card in order. Voice/hum takes
 * audition through the shared canvas audio element; non-audio cards get a
 * readable dwell before auto-advancing.
 */

/** How long a non-audio card (lyric, chord, note…) stays "playing" before advancing. */
const DWELL_MS = 3500;
/** Grace period before skipping past a take that failed to load. */
const ERROR_SKIP_MS = 1200;

export interface ListenPathApi {
  queue: string[];
  step: number;
  playing: boolean;
  /** Toggle a card in/out of the queue (card face / overflow "Listen Path" action). */
  toggleCard: (id: string) => void;
  removeCard: (id: string) => void;
  clear: () => void;
  playPause: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  /** Persist the sequence as the song's saved listen path. */
  save: () => void;
  /** Replace the queue with `ids` and start playing from the top ("Play Final"). */
  playAll: (ids: string[]) => void;
  /** A pending upload's card id became the real memo id — keep the queue true. */
  replaceCardId: (oldId: string, newId: string) => void;
}

interface UseListenPathArgs {
  cards: CanvasBoardCard[];
  mutations: Pick<CanvasFeatureMutations, "saveListenPath">;
  /** Restored queue from the store, applied once on mount. */
  initialQueue?: string[];
  /** Fired when playback lands on a step — the host flies the board there. */
  onStepChange?: (cardId: string) => void;
}

export function useListenPath({ cards, mutations, initialQueue, onStepChange }: UseListenPathArgs): ListenPathApi {
  const [queue, setQueue] = useState<string[]>(() => initialQueue ?? []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const dwellRef = useRef<number | null>(null);
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;

  const clearDwell = useCallback(() => {
    if (dwellRef.current != null) {
      window.clearTimeout(dwellRef.current);
      dwellRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    clearDwell();
    stopCanvasAudio();
    setPlaying(false);
  }, [clearDwell]);

  /** Play the queue from `index`, auto-advancing to the end. */
  const playStep = useCallback(
    (index: number) => {
      const q = queueRef.current;
      if (index < 0 || index >= q.length) {
        // Path finished — rest at the top, ready to replay.
        clearDwell();
        stopCanvasAudio();
        setPlaying(false);
        setStep(0);
        return;
      }
      clearDwell();
      setStep(index);
      setPlaying(true);
      const card = cardsRef.current.find((c) => c.id === q[index]);
      const advance = () => playStep(index + 1);
      if (!card) {
        // A queue entry whose card left the board: skip instantly — never
        // dwell 3.5s of dead silence on a phantom stop.
        advance();
        return;
      }
      onStepChangeRef.current?.(card.id);
      const isAudio =
        (card.type === "voice" || card.type === "hum") && !card.isProcessing;
      const memoId = isAudio ? memoIdForCard(card.id) : null;
      // Tighten the seam to the NEXT stop: warm its signed URL while this one
      // sounds, so the advance doesn't wait on a network round-trip.
      const nextCard = cardsRef.current.find((c) => c.id === q[index + 1]);
      const nextMemoId =
        nextCard && (nextCard.type === "voice" || nextCard.type === "hum") && !nextCard.isProcessing
          ? memoIdForCard(nextCard.id)
          : null;
      if (nextMemoId) void preloadMemo(nextMemoId);
      if (memoId) {
        void playMemoOnCanvas(memoId, {
          onEnded: advance,
          onError: () => {
            dwellRef.current = window.setTimeout(advance, ERROR_SKIP_MS);
          },
        });
      } else {
        stopCanvasAudio();
        dwellRef.current = window.setTimeout(advance, DWELL_MS);
      }
    },
    [clearDwell],
  );

  const toggleCard = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const idx = prev.indexOf(id);
        if (idx !== -1) {
          if (idx === step) stopPlayback();
          // The step FOLLOWS the playing card: removing an earlier stop must
          // not silently shift which card the pointer means.
          else if (idx < step) setStep((s) => Math.max(0, s - 1));
          return prev.filter((x) => x !== id);
        }
        return [...prev, id];
      });
    },
    [step, stopPlayback],
  );

  const removeCard = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const idx = prev.indexOf(id);
        if (idx === step) stopPlayback();
        else if (idx !== -1 && idx < step) setStep((s) => Math.max(0, s - 1));
        return prev.filter((x) => x !== id);
      });
    },
    [step, stopPlayback],
  );

  const clear = useCallback(() => {
    // Clearing a hand-built path deserves an Undo — it's minutes of curation.
    const prevQueue = queueRef.current;
    const prevStep = step;
    stopPlayback();
    setQueue([]);
    setStep(0);
    if (prevQueue.length > 1) {
      toast("Listen path cleared", {
        duration: 7000,
        action: {
          label: "Undo",
          onClick: () => {
            setQueue(prevQueue);
            queueRef.current = prevQueue;
            setStep(Math.min(prevStep, prevQueue.length - 1));
          },
        },
      });
    }
  }, [step, stopPlayback]);

  const playPause = useCallback(() => {
    if (playing) {
      clearDwell();
      pauseCanvasAudio();
      setPlaying(false);
    } else {
      playStep(step);
    }
  }, [playing, step, clearDwell, playStep]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(queueRef.current.length - 1, index));
      if (playing) playStep(clamped);
      else setStep(clamped);
    },
    [playing, playStep],
  );

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const prev = useCallback(() => goTo(step - 1), [goTo, step]);

  const save = useCallback(() => {
    mutations.saveListenPath(queueRef.current);
    // Honest copy: the interim store is device-local until A4/Lovable land.
    toast("Listen path saved on this device", {
      description: `${queueRef.current.length} ${queueRef.current.length === 1 ? "card" : "cards"} in order`,
    });
  }, [mutations]);

  /** Seed the queue from an ordered id list and play from the top. */
  const playAll = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setQueue(ids);
      queueRef.current = ids;
      playStep(0);
    },
    [playStep],
  );

  /** Keep queue + saved path truthful when a pending card id becomes real. */
  const replaceCardId = useCallback((oldId: string, newId: string) => {
    setQueue((prev) => {
      if (!prev.includes(oldId)) return prev;
      const next = prev.map((id) => (id === oldId ? newId : id));
      queueRef.current = next;
      return next;
    });
  }, []);

  // Keep step valid as the queue shrinks; silence on empty.
  useEffect(() => {
    if (queue.length === 0) {
      setStep(0);
    } else if (step >= queue.length) {
      setStep(queue.length - 1);
    }
  }, [queue.length, step]);

  // Never leave audio running after the canvas unmounts.
  useEffect(() => {
    return () => {
      clearDwell();
      stopCanvasAudio();
    };
  }, [clearDwell]);

  return { queue, step, playing, toggleCard, removeCard, clear, playPause, next, prev, goTo, save, playAll, replaceCardId };
}
