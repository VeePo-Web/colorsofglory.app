import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { SongAlbum } from "@/lib/library/albums";
import { coverColor } from "@/lib/library/format";

interface AlbumEditSheetProps {
  /** null = creating a new album. */
  album: SongAlbum | null;
  songs: SongRow[];
  /** Pre-selected songs when creating (e.g. "New album with this song"). */
  initialSongIds?: string[];
  onSave: (name: string, songIds: string[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * AlbumEditSheet — bottom sheet for naming an album and choosing its songs.
 * Songs are only ever referenced: removing an album never touches a song.
 */
const AlbumEditSheet = ({ album, songs, initialSongIds, onSave, onDelete, onClose }: AlbumEditSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(album?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(album?.songIds ?? initialSongIds ?? []),
  );

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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSave = name.trim().length > 0;

  return (
    <>
      {/* Scrim */}
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

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={album ? `Edit album ${album.name}` : "New album"}
        className="fixed inset-x-0 bottom-0 z-[800] mx-auto w-full max-w-[430px] rounded-t-3xl md:max-w-md"
        style={{
          backgroundColor: "var(--cog-cream-light)",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(28,26,23,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          aria-hidden
          className="mx-auto mb-3 mt-3 h-1 w-10 rounded-full"
          style={{ backgroundColor: "var(--cog-border)" }}
        />

        <div className="flex items-center justify-between px-5 pb-3">
          <h2
            className="text-[1.25rem] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
          >
            {album ? "Edit album" : "New album"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5">
          <input
            autoFocus={!album}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Worship EP, Christmas songs…"
            aria-label="Album name"
            className="w-full rounded-xl border px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cog-border-gold)]"
            style={{
              borderColor: "var(--cog-border)",
              color: "var(--cog-charcoal)",
              backgroundColor: "var(--cog-cream)",
              fontFamily: "var(--font-body)",
              fontSize: 16,
            }}
          />
        </div>

        <p
          className="px-6 pb-1.5 pt-4 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Songs in this album
        </p>

        {/* Song checklist */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {songs.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem]" style={{ color: "var(--cog-muted)" }}>
              Your songs will appear here once you have some.
            </p>
          ) : (
            songs.map((song) => {
              const on = selected.has(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => toggle(song.id)}
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${on ? "Remove" : "Add"} ${song.title}`}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--cog-cream)]"
                  style={{ minHeight: 48 }}
                >
                  <div
                    aria-hidden
                    className="shrink-0 rounded-lg"
                    style={{
                      width: 32,
                      height: 32,
                      background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
                      border: "1px solid var(--cog-border)",
                    }}
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold"
                    style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                  >
                    {song.title}
                  </span>
                  <div
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
                    style={{
                      backgroundColor: on ? "var(--cog-gold)" : "transparent",
                      border: on ? "none" : "1.5px solid var(--cog-border)",
                    }}
                  >
                    {on && <Check size={13} strokeWidth={3} color="white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 pt-3">
          {album && (
            <button
              onClick={() => onDelete(album.id)}
              className="rounded-xl px-4 py-3 text-[0.875rem] font-semibold transition-transform duration-150 active:scale-95"
              style={{ color: "var(--cog-warm-gray)" }}
            >
              Remove album
            </button>
          )}
          <button
            onClick={() => canSave && onSave(name, [...selected])}
            disabled={!canSave}
            className="flex-1 rounded-xl py-3.5 text-[0.9375rem] font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
            style={{
              backgroundColor: "var(--cog-gold)",
              fontFamily: "var(--font-body)",
              boxShadow: canSave ? "0 8px 22px -6px rgba(184,149,58,0.5)" : "none",
            }}
          >
            {album ? "Save album" : "Create album"}
          </button>
        </div>

        {album && (
          <p className="px-5 pt-2 text-center text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
            Removing an album never removes its songs.
          </p>
        )}
      </div>
    </>
  );
};

export default AlbumEditSheet;
