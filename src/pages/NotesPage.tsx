import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import SongNoteCard from "@/components/notes/SongNoteCard";
import { useSongTitle } from "@/lib/songContext";
import { listMembers } from "@/integrations/cog/members";
import { addNote as addNoteApi } from "@/integrations/cog/notes";
import type { SongMember, SongNote } from "@/types";
import {
  songNotesKey,
  useAddNote,
  useCurrentUserId,
  useRemoveNote,
  useSongNotes,
  useUpdateNote,
} from "@/hooks/useSongNotes";
import {
  clearDraft,
  enqueuePending,
  getDraft,
  listPending,
  removePending,
  setDraft,
  type PendingNote,
} from "@/lib/notes/pendingNotes";

type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

/** A pending (offline) note rendered as a SongNote-shaped optimistic row. */
function pendingAsNote(p: PendingNote, songId: string, uid: string | undefined): SongNote {
  return {
    id: p.tempId,
    song_id: songId,
    author_user_id: uid ?? "",
    body: p.body,
    section_id: null,
    created_at: p.createdAt,
    updated_at: p.createdAt,
  };
}

const NotesPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const uid = useCurrentUserId();
  const qc = useQueryClient();

  const notesQuery = useSongNotes(songId);
  const addNote = useAddNote(songId);
  const updateNote = useUpdateNote(songId);
  const removeNote = useRemoveNote(songId);

  const membersQuery = useQuery({
    queryKey: ["song-members", songId],
    queryFn: () => listMembers(songId),
    enabled: Boolean(songId),
    staleTime: 5 * 60 * 1000,
  });
  const memberById = useMemo(() => {
    const map = new Map<string, SongMember>();
    (membersQuery.data ?? []).forEach((m) => map.set(m.user_id, m));
    return map;
  }, [membersQuery.data]);

  const [note, setNote] = useState<string>(() => getDraft(songId));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [pending, setPending] = useState<PendingNote[]>(() => listPending(songId));
  const composeRef = useRef<HTMLTextAreaElement>(null);

  // ── Never-lost: mirror the in-progress compose text to a per-song draft so an
  // interrupted session (reload / backgrounded tab) recovers the unsaved words.
  useEffect(() => {
    setDraft(songId, note);
  }, [songId, note]);

  // Re-seed compose + pending when the song changes.
  useEffect(() => {
    setNote(getDraft(songId));
    setPending(listPending(songId));
  }, [songId]);

  // ── Offline queue: flush pending notes to the DB on mount + on reconnect.
  const flush = useCallback(async () => {
    const items = listPending(songId);
    if (!items.length) return;
    let changed = false;
    // Oldest first so restored order reads naturally.
    for (const p of [...items].reverse()) {
      try {
        await addNoteApi(songId, p.body);
        removePending(songId, p.tempId);
        changed = true;
      } catch {
        break; // still offline / failing — leave the remainder queued
      }
    }
    setPending(listPending(songId));
    if (changed) {
      void qc.invalidateQueries({ queryKey: songNotesKey(songId) });
      setStatus((s) => (s === "offline" && !listPending(songId).length ? "idle" : s));
    }
  }, [songId, qc]);

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    if (typeof navigator === "undefined" || navigator.onLine) void flush();
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  // ── Instant capture: on a fresh, empty pad, focus the compose field.
  useEffect(() => {
    if (!notesQuery.isLoading && (notesQuery.data?.length ?? 0) === 0 && pending.length === 0) {
      composeRef.current?.focus();
    }
  }, [notesQuery.isLoading, notesQuery.data, pending.length]);

  const handleSave = async () => {
    const body = note.trim();
    if (!body) return;

    // Offline: queue it, show it optimistically, flush on reconnect. Never lost.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueuePending(songId, body);
      setPending(listPending(songId));
      setNote("");
      clearDraft(songId);
      setStatus("offline");
      return;
    }

    setStatus("saving");
    try {
      await addNote.mutateAsync(body);
      setNote("");
      clearDraft(songId);
      setStatus("saved");
      window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch {
      // Online write failed for a non-network reason — KEEP the text, offer retry.
      setStatus("error");
    }
  };

  const handleUpdate = (noteId: string, body: string) => {
    updateNote.mutate({ id: noteId, body });
  };

  const handleDelete = (noteId: string) => {
    removeNote.mutate(noteId);
  };

  const serverNotes = notesQuery.data ?? [];
  const hasContent = serverNotes.length > 0 || pending.length > 0;
  const isEmpty = !notesQuery.isLoading && !notesQuery.isError && !hasContent;
  const canSave = note.trim().length > 0 && !addNote.isPending;

  const statusText = (() => {
    switch (status) {
      case "saving":
        return { text: "Saving…", color: "var(--cog-warm-gray)" };
      case "saved":
        return { text: "Saved", color: "#53AB8B" };
      case "offline":
        return { text: "Offline — will sync", color: "var(--cog-warm-gray)" };
      case "error":
        return { text: "Couldn't save — tap Save to try again", color: "#B4534B" };
      default:
        return pending.length ? { text: "Offline — will sync", color: "var(--cog-warm-gray)" } : null;
    }
  })();

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)" }}>
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6"
        style={{
          maxWidth: "var(--max-w-app)",
          margin: "0 auto",
          width: "100%",
          paddingBottom: "calc(200px + env(safe-area-inset-bottom))",
        }}
      >
        {/* Header */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)", minHeight: 44 }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Notes
        </h1>
        {songTitle && (
          <p className="text-sm mb-8" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
            {songTitle}
          </p>
        )}
        {!songTitle && <div className="mb-8" />}

        {/* Compose field — raw thoughts render in Inter, never Playfair. */}
        <div
          className="rounded-2xl mb-4 overflow-hidden"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
        >
          <textarea
            ref={composeRef}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (status === "error" || status === "saved") setStatus("idle");
            }}
            placeholder="A thought, prayer, scripture, or production note…"
            aria-label="Write a note"
            rows={6}
            className="w-full resize-none px-5 py-5 text-base leading-relaxed outline-none bg-transparent"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
          />
        </div>

        {/* Notes list */}
        {notesQuery.isLoading && (
          <div className="flex flex-col gap-2.5" aria-label="Loading notes">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl px-4 py-5"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)", opacity: 0.6 }}
              >
                <div className="h-3 w-3/4 rounded-full mb-2" style={{ backgroundColor: "rgba(184,149,58,0.12)" }} />
                <div className="h-3 w-1/2 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.12)" }} />
              </div>
            ))}
          </div>
        )}

        {notesQuery.isError && (
          <div
            className="rounded-xl px-4 py-4 flex items-center justify-between gap-3"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
              We couldn't load your notes just now.
            </p>
            <button
              onClick={() => void notesQuery.refetch()}
              className="text-sm font-semibold shrink-0"
              style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
            >
              Try again
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center text-center pt-8 px-4">
            <p
              className="text-lg mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
            >
              A quiet place for loose thoughts
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", maxWidth: 280 }}
            >
              Jot the first one — a prayer, a scripture, or a line that isn't ready to be a lyric yet. It's kept the
              moment you save it.
            </p>
          </div>
        )}

        {hasContent && (
          <>
            <h2
              className="text-sm font-semibold uppercase tracking-wider mb-4 mt-2"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
            >
              Previous notes
            </h2>

            <div className="flex flex-col gap-2.5">
              {pending.map((p) => (
                <SongNoteCard
                  key={p.tempId}
                  note={pendingAsNote(p, songId, uid)}
                  authorLabel="You"
                  authorColor={memberById.get(uid ?? "")?.avatar_color ?? null}
                  canEdit={false}
                  isPending
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}

              {serverNotes.map((n) => {
                const mine = Boolean(uid) && n.author_user_id === uid;
                const member = memberById.get(n.author_user_id);
                const authorLabel = mine
                  ? "You"
                  : member?.display_name || member?.first_name || "Collaborator";
                return (
                  <SongNoteCard
                    key={n.id}
                    note={n}
                    authorLabel={authorLabel}
                    authorColor={member?.avatar_color ?? null}
                    canEdit={mine}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Sticky save bar — floats just above the song tab bar, clears the safe area. */}
      <div
        className="fixed px-6 pt-4 w-full"
        style={{
          background: "linear-gradient(to top, var(--cog-cream) 70%, transparent 100%)",
          maxWidth: "var(--max-w-app)",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(72px + env(safe-area-inset-bottom))",
          paddingBottom: 12,
        }}
      >
        <div className="h-5 mb-1 flex items-center justify-center" aria-live="polite">
          {statusText && (
            <span className="text-xs" style={{ color: statusText.color, fontFamily: "var(--font-body)" }}>
              {statusText.text}
            </span>
          )}
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: canSave ? "0 4px 20px rgba(184,149,58,0.35)" : "none",
          }}
        >
          Save note
        </button>
      </div>
      <SongTabBar activeTab="notes" />
    </div>
  );
};

export default NotesPage;
