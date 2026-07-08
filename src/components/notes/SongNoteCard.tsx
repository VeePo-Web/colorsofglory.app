import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { SongNote } from "@/types";
import { relativeTime } from "@/lib/notes/relativeTime";

interface SongNoteCardProps {
  note: SongNote;
  /** Resolved author label — "You" for the current user, else a name/initials. */
  authorLabel: string;
  authorColor: string | null;
  /** Whether the current user may edit/remove this note (server is the real gate). */
  canEdit: boolean;
  /** True while an offline-queued note is still waiting to reach the DB. */
  isPending?: boolean;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}

const AUTOSAVE_MS = 900;

/** A note was edited if updated_at is meaningfully later than created_at. */
function wasEdited(note: SongNote): boolean {
  return new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1500;
}

const SongNoteCard = ({
  note,
  authorLabel,
  authorColor,
  canEdit,
  isPending = false,
  onUpdate,
  onDelete,
}: SongNoteCardProps) => {
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Keep the local draft in sync if the note changes from underneath us (e.g.
  // a reconciled server row) while we're not actively editing it.
  useEffect(() => {
    if (!editing) setDraft(note.body);
  }, [note.body, editing]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const commit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== note.body) onUpdate(note.id, trimmed);
  };

  const scheduleAutosave = (value: string) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => commit(value), AUTOSAVE_MS);
  };

  const finishEditing = () => {
    clearTimeout(saveTimer.current);
    commit(draft);
    setEditing(false);
  };

  const cancelEditing = () => {
    clearTimeout(saveTimer.current);
    setDraft(note.body);
    setEditing(false);
  };

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: isPending ? 0.72 : 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl px-4 py-3.5"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border)",
      }}
    >
      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              scheduleAutosave(e.target.value);
            }}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              }
            }}
            rows={3}
            aria-label="Edit note"
            className="w-full resize-none text-sm leading-relaxed outline-none bg-transparent"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={cancelEditing}
              aria-label="Cancel edit"
              className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ minWidth: 44, minHeight: 44, color: "var(--cog-muted)" }}
            >
              <X size={17} />
            </button>
            <button
              onClick={finishEditing}
              aria-label="Save edit"
              className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ minWidth: 44, minHeight: 44, color: "var(--cog-gold)" }}
            >
              <Check size={18} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
          >
            {note.body}
          </p>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: authorColor ?? "var(--cog-muted)" }}
                aria-hidden
              />
              <span
                className="text-xs truncate"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                {authorLabel}
                <span style={{ color: "var(--cog-muted)" }}>
                  {" · "}
                  {isPending ? "Offline — will sync" : relativeTime(note.created_at)}
                  {!isPending && wasEdited(note) ? " · edited" : ""}
                </span>
              </span>
            </div>

            {canEdit && !confirmingDelete && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Edit note"
                  className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                  style={{ minWidth: 44, minHeight: 44, color: "var(--cog-muted)" }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  aria-label="Delete note"
                  className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                  style={{ minWidth: 44, minHeight: 44, color: "var(--cog-muted)" }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}

            {canEdit && confirmingDelete && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs font-medium px-2 py-2 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", minHeight: 44 }}
                >
                  Keep
                </button>
                <button
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete(note.id);
                  }}
                  className="text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "#B4534B", fontFamily: "var(--font-body)", minHeight: 44 }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default SongNoteCard;
