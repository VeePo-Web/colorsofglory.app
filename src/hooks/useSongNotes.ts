/**
 * Query + mutation hooks for the song-level notes pad (C5).
 *
 * Thin React face over the cog/notes.ts data seam. All reads/writes go through
 * that seam; these hooks add caching, optimistic updates, and invalidation.
 *
 * Optimistic model (add / update / remove): onMutate cancels in-flight fetches,
 * snapshots the cache, and applies the change immediately so the pad feels
 * instant; onError rolls back to the snapshot (the page preserves the composed
 * text); onSettled invalidates so the server row reconciles the optimistic one.
 */

import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  addNote as addNoteApi,
  listSongNotes,
  removeNote as removeNoteApi,
  updateNote as updateNoteApi,
} from "@/integrations/cog/notes";
import type { SongNote } from "@/types";

/** The signed-in user's id (React-layer), via the same getUser() query pattern the app uses. */
export function useCurrentUserId(): string | undefined {
  const { data } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 5 * 60 * 1000,
  });
  return data?.id;
}

/** Canonical cache key for a song's notes. */
export const songNotesKey = (songId: string) => ["song-notes", songId] as const;

export function useSongNotes(songId: string) {
  return useQuery({
    queryKey: songNotesKey(songId),
    queryFn: () => listSongNotes(songId),
    enabled: Boolean(songId),
  });
}

type Snapshot = { previous: SongNote[] | undefined };

export function useAddNote(songId: string) {
  const qc = useQueryClient();
  const uid = useCurrentUserId();

  return useMutation<SongNote, Error, string, Snapshot>({
    mutationFn: (body: string) => addNoteApi(songId, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: songNotesKey(songId) });
      const previous = qc.getQueryData<SongNote[]>(songNotesKey(songId));
      const now = new Date().toISOString();
      const optimistic: SongNote = {
        id: `optimistic-${now}`,
        song_id: songId,
        author_user_id: uid ?? "",
        body: body.trim(),
        section_id: null,
        created_at: now,
        updated_at: now,
      };
      qc.setQueryData<SongNote[]>(songNotesKey(songId), (old) => [optimistic, ...(old ?? [])]);
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) qc.setQueryData(songNotesKey(songId), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: songNotesKey(songId) });
    },
  });
}

export function useUpdateNote(songId: string) {
  const qc = useQueryClient();

  return useMutation<SongNote, Error, { id: string; body: string }, Snapshot>({
    mutationFn: ({ id, body }) => updateNoteApi(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: songNotesKey(songId) });
      const previous = qc.getQueryData<SongNote[]>(songNotesKey(songId));
      const now = new Date().toISOString();
      qc.setQueryData<SongNote[]>(songNotesKey(songId), (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, body: body.trim(), updated_at: now } : n)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(songNotesKey(songId), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: songNotesKey(songId) });
    },
  });
}

export function useRemoveNote(songId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string, Snapshot>({
    mutationFn: (id: string) => removeNoteApi(id, songId),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: songNotesKey(songId) });
      const previous = qc.getQueryData<SongNote[]>(songNotesKey(songId));
      qc.setQueryData<SongNote[]>(songNotesKey(songId), (old) => (old ?? []).filter((n) => n.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(songNotesKey(songId), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: songNotesKey(songId) });
    },
  });
}
