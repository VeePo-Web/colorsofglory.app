/**
 * Main-app write layer (A3 · data access).
 *
 * The canonical TanStack `useMutation` hooks for every non-memo write in the
 * primary app — create song, quick capture, commit take, canvas card move,
 * invite, accept invite. (Memo save has its own resilience-heavy hook,
 * `useMemoSave`.) Every hook:
 *   - runs through a `cog/*` seam fn, so the error is ALWAYS a normalized
 *     `CogError` — a component switches on `mutation.error.code`, never a raw
 *     message;
 *   - invalidates the RIGHT keys via A4's single invalidation policy
 *     (`@/lib/cache/invalidation` — `invalidationMap` + `invalidateFor`), so the
 *     "what goes stale when X happens" rule lives in one reviewable table and
 *     the read hooks (`useAppQueries`) refresh automatically;
 *   - wires the UX-critical writes (capture, card move) through A4's optimistic
 *     helper so they feel instant and roll back cleanly on failure.
 *
 * NOTE (A3 · Step 7): the task anticipated A4's invalidation policy not being
 * ready and said to inline the documented `qk` set with a TODO to swap. A4's
 * policy DID ship (`invalidationMap`/`invalidateFor`, green under
 * client-state.test), so these hooks CONSUME it directly rather than
 * duplicating the key sets — one source of truth for both read and write.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { qk } from "@/hooks/queryKeys";
import { invalidationMap, invalidateFor } from "@/lib/cache/invalidation";
import {
  beginOptimistic,
  rollbackOptimistic,
  type OptimisticContext,
} from "@/lib/cache/optimistic";
import { CogError } from "@/integrations/cog/errors";
import {
  createSong,
  createInvite,
  acceptInvite,
  type Song,
  type SongInvite,
} from "@/integrations/cog/songs";
import { quickCapture, type QuickCaptureInput, type IdeaCapture } from "@/integrations/cog/capture";
import {
  commitTakeToCanvas,
  moveCard,
  bulkMoveCards,
  type CommitTakeInput,
  type CommitTakeResult,
  type CanvasCard,
  type BulkMoveItem,
} from "@/integrations/cog/canvas";

// ── Create song ─────────────────────────────────────────────────────────────

type CreateSongInput = Parameters<typeof createSong>[0];

/**
 * Create a new song. The song-quota gate is a MOMENT, not a toast: a free-tier
 * user who hits their second song is routed to the upgrade screen instead of
 * seeing an error. Any OTHER failure stays on `mutation.error` (a `CogError`)
 * for the caller to switch on. On success the catalog + billing quota are
 * invalidated and `onCreated` fires with the new song.
 */
export function useCreateSong(options?: {
  /** Where a QUOTA_EXCEEDED_SONGS lands. Default `/upgrade?source=song_gate`. */
  upgradeTo?: string;
  /** Called with the created song (e.g. to navigate into its room). */
  onCreated?: (song: Song) => void;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();

  return useMutation<{ song: Song }, CogError, CreateSongInput>({
    mutationFn: (input) => createSong(input),
    onSuccess: async ({ song }) => {
      await invalidateFor(client, invalidationMap.createSong());
      options?.onCreated?.(song);
    },
    onError: (err) => {
      if (err.code === "QUOTA_EXCEEDED_SONGS") {
        // Routing target lives in the caller's lane; the hook owns detecting the
        // quota moment and driving the redirect (never a toast).
        navigate(options?.upgradeTo ?? "/upgrade?source=song_gate");
      }
    },
  });
}

// ── Quick capture ─────────────────────────────────────────────────────────────

function makeOptimisticCapture(input: QuickCaptureInput): IdeaCapture {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    song_id: input.song_id ?? null,
    author_user_id: "me",
    title: input.title ?? null,
    lyric_snippet: input.lyric_snippet ?? null,
    scripture_ref: input.scripture_ref ?? null,
    tags: input.tags ?? [],
    section_id: input.section_id ?? null,
    voice_memo_id: input.voice_memo_id ?? null,
    created_at: now,
    updated_at: now,
    promoted_card_id: null,
  };
}

/**
 * Save a quick capture. The card appears INSTANTLY (optimistic prepend into the
 * captures list — the song's, or the global unfiled inbox when unscoped), then
 * on settle we invalidate the captures list, the song-detail counts, and the
 * catalog (a scoped capture bumps `last_activity_at`, which reorders the grid).
 * A failure rolls the optimistic card back.
 */
export function useQuickCapture() {
  const client = useQueryClient();

  return useMutation<string, CogError, QuickCaptureInput, OptimisticContext<IdeaCapture[]>>({
    mutationFn: (input) => quickCapture(input),
    onMutate: (input) => {
      const key = input.song_id ? qk.captures(input.song_id) : qk.unfiledCaptures();
      return beginOptimistic<IdeaCapture[]>(client, key, (prev) => [
        makeOptimisticCapture(input),
        ...(prev ?? []),
      ]);
    },
    onError: (_err, _input, ctx) => {
      rollbackOptimistic(client, ctx);
    },
    onSettled: (_data, _err, input) => {
      const keys = input.song_id
        ? [...invalidationMap.quickCapture(input.song_id), qk.songs()]
        : [qk.unfiledCaptures()];
      return invalidateFor(client, keys);
    },
  });
}

// ── Commit take onto the canvas ───────────────────────────────────────────────

/**
 * Commit a transcribed take onto a song's canvas. IDEMPOTENT — the `commit-take`
 * edge function dedupes by take, so a double-tap (or an outbox retry) resolves
 * to the same cards instead of duplicating them.
 *
 * On success we invalidate the committed song's room — canvas + activity +
 * detail counts + memos (+ the catalog, for the new-song path). This does NOT
 * trigger a full board refetch: the live whiteboard reads via realtime
 * (`subscribeSongRoom`), not this query, so the new cards arrive over the
 * channel and the invalidations only refresh cache-backed observers.
 */
export function useCommitTake() {
  const client = useQueryClient();

  return useMutation<CommitTakeResult, CogError, CommitTakeInput>({
    mutationFn: (input) => commitTakeToCanvas(input),
    onSuccess: async (result) => {
      await invalidateFor(client, [...invalidationMap.commitTake(result.song_id), qk.songs()]);
    },
  });
}

// ── Canvas card move (optimistic, no board refetch) ───────────────────────────

interface MoveCardVars {
  cardId: string;
  x: number;
  y: number;
  z?: number;
}

/**
 * Move one canvas card. Optimistic to the bone: the card's new position is
 * written into the cached board immediately and the cheap `canvas_move_card`
 * upsert runs in the background. There is deliberately NO success invalidation —
 * the optimistic position IS the truth, and skipping the settle-refetch is what
 * keeps a drag from reloading the whole board. Only a FAILED move resyncs
 * (rollback + targeted invalidate) so a card never sticks in a wrong spot.
 */
export function useMoveCard(songId: string) {
  const client = useQueryClient();
  const key = qk.canvas(songId);

  return useMutation<CanvasCard, CogError, MoveCardVars, OptimisticContext<CanvasCard[]>>({
    mutationFn: ({ cardId, x, y, z }) => moveCard(cardId, x, y, z),
    onMutate: ({ cardId, x, y, z }) =>
      beginOptimistic<CanvasCard[]>(client, key, (prev) =>
        (prev ?? []).map((c) =>
          c.id === cardId ? { ...c, x, y, z_index: z ?? c.z_index } : c,
        ),
      ),
    onError: (_err, _vars, ctx) => {
      rollbackOptimistic(client, ctx);
      void client.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Move many canvas cards in one cheap batched upsert (`canvas_bulk_move`) — the
 * Listen Path / arrange flows. Same optimistic-only contract as {@link useMoveCard}:
 * all positions update in the cache at once, no full-board refetch on success,
 * rollback + resync only on failure.
 */
export function useBulkMoveCards(songId: string) {
  const client = useQueryClient();
  const key = qk.canvas(songId);

  return useMutation<number, CogError, BulkMoveItem[], OptimisticContext<CanvasCard[]>>({
    mutationFn: (items) => bulkMoveCards(items),
    onMutate: (items) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      return beginOptimistic<CanvasCard[]>(client, key, (prev) =>
        (prev ?? []).map((c) => {
          const move = byId.get(c.id);
          return move ? { ...c, x: move.x, y: move.y, z_index: move.z ?? c.z_index } : c;
        }),
      );
    },
    onError: (_err, _vars, ctx) => {
      rollbackOptimistic(client, ctx);
      void client.invalidateQueries({ queryKey: key });
    },
  });
}

// ── Invites ───────────────────────────────────────────────────────────────────

type CreateInviteInput = Parameters<typeof createInvite>[0];

/**
 * Create a song invite (the growth loop). An invite doesn't add a member yet, so
 * we only refresh the activity feed (where "invite sent" can surface). Errors
 * are `CogError` — the caller switches on `.code` (e.g. FORBIDDEN when a
 * non-owner tries to invite).
 */
export function useInviteMember() {
  const client = useQueryClient();

  return useMutation<{ invite: SongInvite }, CogError, CreateInviteInput>({
    mutationFn: (input) => createInvite(input),
    onSuccess: async (_data, input) => {
      await invalidateFor(client, [qk.activity(input.song_id)]);
    },
  });
}

/**
 * Accept an invite by token. The RESULT (or the `CogError.code` on failure) is
 * what drives which screen the caller renders — `INVITE_EXPIRED`,
 * `INVITE_NOT_FOUND`, `INVITE_ALREADY_USED`, `INVITE_EXHAUSTED`, `FORBIDDEN`,
 * `UNAUTHENTICATED` each map to a distinct screen; never a toast of `.message`.
 * On success the catalog gains the song, so we invalidate `qk.songs()` and the
 * newly-joined room.
 */
export function useAcceptInvite() {
  const client = useQueryClient();

  return useMutation<
    { song_id: string; role: string; already_member: boolean },
    CogError,
    string
  >({
    mutationFn: (token) => acceptInvite(token),
    onSuccess: async (result) => {
      await invalidateFor(client, [...invalidationMap.acceptInvite(), qk.song(result.song_id)]);
    },
  });
}
