import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityEvent } from "@/integrations/cog/activity";
import {
  addCardReaction,
  listCardReactions,
  removeCardReaction,
  subscribeCardReactions,
  type CardReactionKind,
} from "@/integrations/cog/reactions";
import {
  amenSummaries,
  amensAsActivity,
  applyToggle,
  confirmOp,
  deviceActorId,
  mergeServerRows,
  readAmenState,
  writeAmenState,
  type AmenNameResolver,
  type AmenState,
  type AmenSummary,
} from "./amens";

/**
 * D3 collab: the Amens hook — one per canvas host.
 *
 * Optimistic to the tap (state changes synchronously, persisted to the
 * device store), then a background flusher replays the op queue against the
 * `card_reactions` seam with retry on reconnect. Demo rooms and the
 * not-yet-deployed table both degrade to pure device-local warmth — the
 * chip never knows the difference.
 */

const FLUSH_RETRY_MS = 30_000;

export type UseAmensResult = {
  summaries: Map<string, AmenSummary>;
  /** One tap = amen; tap again = quietly withdraw. Never throws. */
  toggleAmen: (cardId: string, kind?: CardReactionKind) => void;
  /** Others' amens as synthetic activity rows for the recap fold-in. */
  amenEvents: ActivityEvent[];
};

export function useAmens(
  songId: string,
  opts: { userId?: string | null; isDemo?: boolean; resolveName?: AmenNameResolver },
): UseAmensResult {
  const { userId, isDemo = false, resolveName } = opts;
  const myId = userId ?? deviceActorId();
  const [state, setState] = useState<AmenState>(() => readAmenState(songId));
  const stateRef = useRef(state);
  stateRef.current = state;
  const flushing = useRef(false);

  // Every state change lands in the device store — offline reloads keep it.
  useEffect(() => {
    writeAmenState(songId, state);
  }, [songId, state]);

  // Song switch: reload that song's slice.
  useEffect(() => {
    setState(readAmenState(songId));
  }, [songId]);

  const refreshFromServer = useCallback(async () => {
    if (isDemo) return;
    const rows = await listCardReactions(songId);
    // null = couldn't read (missing table / offline) — merging that as
    // emptiness would wipe others' amens and mis-complete pending removes.
    if (rows === null) return;
    setState((s) => mergeServerRows(s, rows, myId));
  }, [songId, isDemo, myId]);

  const flush = useCallback(async () => {
    if (isDemo || flushing.current) return;
    flushing.current = true;
    try {
      // Replay a SNAPSHOT of the queue in order (stateRef lags React's
      // commit — re-reading it mid-loop replayed the same op). confirmOp
      // handles the toggle-while-in-flight race; a failure stops the pass
      // and the retry loop keeps order.
      const queue = [...stateRef.current.unsynced];
      for (const op of queue) {
        if (op.op === "add") {
          const row = await addCardReaction({ song_id: songId, card_id: op.card_id, kind: op.kind });
          if (!row) return;
          setState((s) => confirmOp(s, op, row));
        } else {
          const ok = await removeCardReaction({
            song_id: songId,
            card_id: op.card_id,
            kind: op.kind,
          });
          if (!ok) return;
          setState((s) =>
            confirmOp(s, op, {
              id: "",
              song_id: songId,
              card_id: op.card_id,
              user_id: myId,
              kind: op.kind,
              note_text: null,
              created_at: op.created_at,
            }),
          );
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [songId, isDemo, myId]);

  // Initial load + realtime + reconnect retry loop.
  useEffect(() => {
    if (isDemo) return;
    void refreshFromServer().then(() => flush());
    const unsubscribe = subscribeCardReactions(songId, () => void refreshFromServer());
    const onOnline = () => void flush().then(() => refreshFromServer());
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => {
      if (stateRef.current.unsynced.length > 0) void flush();
    }, FLUSH_RETRY_MS);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [songId, isDemo, refreshFromServer, flush]);

  const toggleAmen = useCallback(
    (cardId: string, kind: CardReactionKind = "amen") => {
      setState((s) => applyToggle(s, cardId, kind, myId, new Date().toISOString()));
      // Flush on the next tick so the optimistic paint always lands first.
      window.setTimeout(() => void flush(), 0);
    },
    [myId, flush],
  );

  const summaries = useMemo(
    () => amenSummaries(state, myId, resolveName),
    [state, myId, resolveName],
  );
  const amenEvents = useMemo(
    () => amensAsActivity(state, myId, resolveName),
    [state, myId, resolveName],
  );

  return { summaries, toggleAmen, amenEvents };
}
