import { useEffect, useState } from "react";
import { X, Check, ArrowRight, Archive, ArchiveRestore, Plus, Disc3, FileText, Mic, Pin, PinOff, ListChecks, Pencil, Trash2, LogOut } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { SongAlbum } from "@/lib/library/albums";
import { coverColor } from "@/lib/library/format";

interface SongActionsSheetProps {
  song: SongRow;
  albums: SongAlbum[];
  onToggleAlbum: (albumId: string) => void;
  onNewAlbum: () => void;
  onOpen: () => void;
  /** Route straight into another lane's surface for this song. */
  onQuickRoute: (surface: "canvas" | "sheet" | "voice") => void;
  pinned: boolean;
  onTogglePin: () => void;
  /** Enter Apple-Photos batch select, pre-seeded with this song. */
  onSelectMode: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  /** Owner only — opens the rename dialog on the page. */
  onRename: () => void;
  /** Owner only — fires after the inline confirm; permanent. */
  onDelete: () => void;
  /** Invited songs only — fires after the inline confirm. */
  onLeave: () => void;
  onClose: () => void;
}

/**
 * SongActionsSheet — the press-and-hold menu for a song (Apple's contextual
 * layer, as a thumb-first bottom sheet). Role-aware: owners get the full
 * organization set (open, rename, albums, archive/restore) plus Delete behind
 * an inline confirm; invited members get open + Leave. Nothing destructive
 * happens on a single tap.
 */
const SongActionsSheet = ({
  song,
  albums,
  onToggleAlbum,
  onNewAlbum,
  onOpen,
  onQuickRoute,
  pinned,
  onTogglePin,
  onSelectMode,
  onArchive,
  onUnarchive,
  onRename,
  onDelete,
  onLeave,
  onClose,
}: SongActionsSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const archived = song.status === "archived";
  const isOwner = song.my_role === "owner";

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rowClass =
    "flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors duration-150 hover:bg-[var(--cog-cream)] active:scale-[0.99]";

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[799]"
        style={{
          backgroundColor: "rgba(28,26,23,0.45)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 280ms ease",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${song.title}`}
        className="fixed inset-x-0 bottom-0 z-[800] mx-auto w-full max-w-[430px] rounded-t-3xl md:max-w-md"
        style={{
          backgroundColor: "var(--cog-cream-light)",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(28,26,23,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          maxHeight: "80dvh",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          aria-hidden
          className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full"
          style={{ backgroundColor: "var(--cog-border)" }}
        />

        {/* Song identity header */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-1">
          <div
            aria-hidden
            className="shrink-0 rounded-xl"
            style={{
              width: 40,
              height: 40,
              background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
              border: "1px solid var(--cog-border)",
            }}
          />
          <h2
            className="min-w-0 flex-1 truncate text-[1.125rem] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
          >
            {song.title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-1">
          {/* Open the room */}
          <button onClick={onOpen} className={rowClass} style={{ minHeight: 52 }}>
            <ArrowRight size={17} strokeWidth={2} style={{ color: "var(--cog-gold)" }} />
            <span
              className="flex-1 text-[0.9375rem] font-semibold"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              Open song
            </span>
          </button>

          {/* Rename — the title is the owner's to shape, any time */}
          {isOwner && (
            <button onClick={onRename} className={rowClass} style={{ minHeight: 48 }}>
              <Pencil size={16} strokeWidth={1.9} style={{ color: "var(--cog-warm-gray)" }} />
              <span
                className="flex-1 text-[0.9375rem]"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                Rename song
              </span>
            </button>
          )}

          {/* Pin — held at the top of the library, Apple Notes style */}
          {isOwner && !archived && (
            <button onClick={onTogglePin} className={rowClass} style={{ minHeight: 48 }}>
              {pinned ? (
                <PinOff size={16} strokeWidth={1.9} style={{ color: "var(--cog-warm-gray)" }} />
              ) : (
                <Pin size={16} strokeWidth={1.9} style={{ color: "var(--cog-gold)" }} />
              )}
              <span
                className="flex-1 text-[0.9375rem]"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                {pinned ? "Unpin song" : "Pin to top"}
              </span>
            </button>
          )}

          {/* Jump straight to another surface — "Open song" already opens the
              whiteboard, so these are the alternate rooms of the song. */}
          {!archived &&
            (
              [
                { surface: "sheet", label: "Open lyric sheet", Icon: FileText },
                { surface: "voice", label: "Voice memos", Icon: Mic },
              ] as const
            ).map(({ surface, label, Icon }) => (
              <button
                key={surface}
                onClick={() => onQuickRoute(surface)}
                className={rowClass}
                style={{ minHeight: 48 }}
              >
                <Icon size={16} strokeWidth={1.9} style={{ color: "var(--cog-warm-gray)" }} />
                <span
                  className="flex-1 text-[0.9375rem]"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                >
                  {label}
                </span>
              </button>
            ))}

          {/* Albums — instant placement, Apple "Add to Playlist" pattern */}
          {isOwner && !archived && (
            <>
              <p
                className="px-3 pb-1 pt-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                Albums
              </p>
              {albums.map((album) => {
                const inAlbum = album.songIds.includes(song.id);
                return (
                  <button
                    key={album.id}
                    onClick={() => onToggleAlbum(album.id)}
                    role="checkbox"
                    aria-checked={inAlbum}
                    aria-label={`${inAlbum ? "Remove from" : "Add to"} ${album.name}`}
                    className={rowClass}
                    style={{ minHeight: 48 }}
                  >
                    <Disc3 size={16} strokeWidth={1.8} style={{ color: "var(--cog-muted)" }} />
                    <span
                      className="min-w-0 flex-1 truncate text-[0.9375rem]"
                      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                    >
                      {album.name}
                    </span>
                    <div
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
                      style={{
                        backgroundColor: inAlbum ? "var(--cog-gold)" : "transparent",
                        border: inAlbum ? "none" : "1.5px solid var(--cog-border)",
                      }}
                    >
                      {inAlbum && <Check size={13} strokeWidth={3} color="white" />}
                    </div>
                  </button>
                );
              })}
              <button onClick={onNewAlbum} className={rowClass} style={{ minHeight: 48 }}>
                <Plus size={16} strokeWidth={2} style={{ color: "var(--cog-gold)" }} />
                <span
                  className="flex-1 text-[0.9375rem] font-semibold"
                  style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
                >
                  New album with this song
                </span>
              </button>
            </>
          )}

          {/* Select many — Apple Photos batch mode, seeded with this song */}
          {isOwner && (
            <>
              <div className="mx-3 my-2" style={{ borderTop: "1px solid var(--cog-border)" }} />
              <button onClick={onSelectMode} className={rowClass} style={{ minHeight: 52 }}>
                <ListChecks size={17} strokeWidth={2} style={{ color: "var(--cog-warm-gray)" }} />
                <span
                  className="flex-1 text-[0.9375rem]"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                >
                  Select songs
                </span>
              </button>

              {/* Archive / Restore — always reversible */}
              <button onClick={archived ? onUnarchive : onArchive} className={rowClass} style={{ minHeight: 52 }}>
                {archived ? (
                  <ArchiveRestore size={17} strokeWidth={2} style={{ color: "var(--cog-warm-gray)" }} />
                ) : (
                  <Archive size={17} strokeWidth={2} style={{ color: "var(--cog-warm-gray)" }} />
                )}
                <span
                  className="flex-1 text-[0.9375rem]"
                  style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                >
                  {archived ? "Restore song" : "Archive song"}
                </span>
              </button>
              {!archived && (
                <p className="px-3 pb-2 text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
                  Archived songs stay safe and readable in the Archived tab.
                </p>
              )}

              {/* Delete — the one destructive action; inline confirm, never one tap */}
              <div className="mx-3 my-2" style={{ borderTop: "1px solid var(--cog-border)" }} />
              {confirmingDelete ? (
                <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ minHeight: 52 }}>
                  <span
                    className="min-w-0 flex-1 text-[0.875rem]"
                    style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                  >
                    Delete “{song.title}”? This can’t be undone.
                  </span>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    autoFocus
                    className="shrink-0 rounded-lg px-3 text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", minHeight: 44 }}
                  >
                    Keep
                  </button>
                  <button
                    onClick={onDelete}
                    className="shrink-0 rounded-lg px-3 text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
                    style={{ color: "#C0392B", fontFamily: "var(--font-body)", minHeight: 44 }}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className={rowClass}
                  style={{ minHeight: 52 }}
                >
                  <Trash2 size={17} strokeWidth={2} style={{ color: "#C0392B" }} />
                  <span
                    className="flex-1 text-[0.9375rem]"
                    style={{ color: "#C0392B", fontFamily: "var(--font-body)" }}
                  >
                    Delete song
                  </span>
                </button>
              )}
            </>
          )}

          {/* Leave — an invited member steps out of the room; rejoining needs
              a fresh invite, so it gets the same inline-confirm respect */}
          {!isOwner && (
            <>
              <div className="mx-3 my-2" style={{ borderTop: "1px solid var(--cog-border)" }} />
              {confirmingLeave ? (
                <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ minHeight: 52 }}>
                  <span
                    className="min-w-0 flex-1 text-[0.875rem]"
                    style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                  >
                    Leave “{song.title}”? You’ll need a new invite to rejoin.
                  </span>
                  <button
                    onClick={() => setConfirmingLeave(false)}
                    autoFocus
                    className="shrink-0 rounded-lg px-3 text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", minHeight: 44 }}
                  >
                    Stay
                  </button>
                  <button
                    onClick={onLeave}
                    className="shrink-0 rounded-lg px-3 text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
                    style={{ color: "#C0392B", fontFamily: "var(--font-body)", minHeight: 44 }}
                  >
                    Leave
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingLeave(true)}
                  className={rowClass}
                  style={{ minHeight: 52 }}
                >
                  <LogOut size={17} strokeWidth={2} style={{ color: "var(--cog-warm-gray)" }} />
                  <span
                    className="flex-1 text-[0.9375rem]"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                  >
                    Leave this song
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SongActionsSheet;
