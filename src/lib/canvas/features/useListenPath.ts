import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasFeatureMutations } from "./mutations";
import {
  memoIdForCard,
  pauseCanvasAudio,
  playMemoOnCanvas,
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
}

interface UseListenPathArgs {
  cards: CanvasBoardCard[];
  mutations: Pick<CanvasFeatureMutations, "saveListenPath">;
  /** Restored queue from the store, applied once on mount. */
  initialQueue?: string[];
}

export function useListenPath({ cards, mutations, initialQueue }: UseListenPathArgs): ListenPathApi {
  const [queue, setQueue] = useState<string[]>(() => initialQueue ?? []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const dwellRef = useRef<number | null>(null);

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
      const isAudio =
        card && (card.type === "voice" || card.type === "hum") && !card.isProcessing;
      const memoId = isAudio ? memoIdForCard(card.id) : null;
      const advance = () => playStep(index + 1);
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
        if (prev.includes(id)) {
          if (prev.indexOf(id) === step) stopPlayback();
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
        if (prev.indexOf(id) === step) stopPlayback();
        return prev.filter((x) => x !== id);
      });
    },
    [step, stopPlayback],
  );

  const clear = useCallback(() => {
    stopPlayback();
    setQueue([]);
    setStep(0);
  }, [stopPlayback]);

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
    toast("Listen path saved", {
      description: `${queueRef.current.length} ${queueRef.current.length === 1 ? "card" : "cards"} in order`,
    });
  }, [mutations]);

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

  return { queue, step, playing, toggleCard, removeCard, clear, playPause, next, prev, goTo, save };
}
