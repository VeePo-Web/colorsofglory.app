import { useEffect, useState } from "react";
import { X, Plus, Disc3 } from "lucide-react";
import type { SongAlbum } from "@/lib/library/albums";

interface BatchAlbumSheetProps {
  count: number;
  albums: SongAlbum[];
  onPick: (albumId: string) => void;
  onNewAlbum: () => void;
  onClose: () => void;
}

/**
 * BatchAlbumSheet — after picking several songs, choose one album to drop
 * them all into (Apple Photos "Add to Album"). Additive only: songs already
 * in the album are left as-is, so tapping is always safe.
 */
const BatchAlbumSheet = ({ count, albums, onPick, onNewAlbum, onClose }: BatchAlbumSheetProps) => {
  const [visible, setVisible] = useState(false);

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
        className="fixed inset-0 z-[810]"
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
        aria-label={`Add ${count} songs to an album`}
        className="fixed inset-x-0 bottom-0 z-[811] mx-auto w-full max-w-[430px] rounded-t-3xl md:max-w-md"
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
        <div aria-hidden className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full" style={{ backgroundColor: "var(--cog-border)" }} />

        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <h2
            className="text-[1.125rem] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
          >
            Add {count} {count === 1 ? "song" : "songs"} to…
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

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-1">
          <button onClick={onNewAlbum} className={rowClass} style={{ minHeight: 52 }}>
            <Plus size={17} strokeWidth={2} style={{ color: "var(--cog-gold)" }} />
            <span
              className="flex-1 text-[0.9375rem] font-semibold"
              style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
            >
              New album
            </span>
          </button>

          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => onPick(album.id)}
              className={rowClass}
              style={{ minHeight: 52 }}
              aria-label={`Add to ${album.name}`}
            >
              <Disc3 size={16} strokeWidth={1.8} style={{ color: "var(--cog-muted)" }} />
              <span
                className="min-w-0 flex-1 truncate text-[0.9375rem]"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                {album.name}
              </span>
              <span className="text-[0.75rem]" style={{ color: "var(--cog-muted)" }}>
                {album.songIds.length}
              </span>
            </button>
          ))}

          {albums.length === 0 && (
            <p className="px-3 py-4 text-center text-[0.8125rem]" style={{ color: "var(--cog-muted)" }}>
              No albums yet — create one to gather these songs.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default BatchAlbumSheet;
