import { useEffect, useState } from "react";
import { X, Music, Disc3 } from "lucide-react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

interface NewSheetProps {
  /** Inside an album, a new song starts there — the Song row says so. */
  albumName: string | null;
  /** The free-tier gate check runs after tapping Song; the row waits honestly. */
  checkingSong: boolean;
  onSong: () => void;
  onAlbum: () => void;
  onClose: () => void;
}

/**
 * NewSheet — the library's ONE door for making things (Drive's "+ New").
 *
 * Two rows, always the same two rows: a Song (a room for one song) or an
 * Album (a folder of songs). Every browse-surface "New album" affordance
 * retired into this door, so creation lives in exactly one place — and the
 * Album row doubles as the teacher: people discover what an album is here,
 * the way Drive teaches Folder through its + New menu.
 */
const NewSheet = ({ albumName, checkingSong, onSong, onAlbum, onClose }: NewSheetProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const dialogRef = useModalFocusTrap(onClose);

  const rowClass =
    "flex w-full items-center gap-3.5 rounded-2xl px-3.5 text-left transition-colors duration-150 hover:bg-[var(--cog-cream)] active:scale-[0.99] disabled:opacity-60";

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New — start a song or an album"
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[811] mx-auto w-full max-w-[430px] rounded-t-3xl md:max-w-md"
        style={{
          outline: "none",
          backgroundColor: "var(--cog-cream-light)",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(28,26,23,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div aria-hidden className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full" style={{ backgroundColor: "var(--cog-border)" }} />

        <div className="flex items-center justify-between px-5 pb-1 pt-1">
          <h2
            className="text-[1.125rem] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
          >
            New
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

        <div className="px-3 pb-1">
          <button
            onClick={onSong}
            disabled={checkingSong}
            aria-busy={checkingSong}
            className={rowClass}
            style={{ minHeight: 64 }}
            aria-label={albumName ? `Song — starts in ${albumName}` : "Song — a room for one song"}
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--cog-gold-pale)" }}
            >
              <Music size={18} strokeWidth={1.9} style={{ color: "var(--cog-gold)" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[0.9375rem] font-semibold"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                Song
              </span>
              <span
                className="block truncate text-[0.8125rem]"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                {checkingSong
                  ? "One moment…"
                  : albumName
                  ? `Starts in “${albumName}”`
                  : "A room for one song"}
              </span>
            </span>
          </button>

          <button
            onClick={onAlbum}
            className={rowClass}
            style={{ minHeight: 64 }}
            aria-label="Album — a folder of songs"
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--cog-cream-dark)" }}
            >
              <Disc3 size={18} strokeWidth={1.8} style={{ color: "var(--cog-warm-gray)" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[0.9375rem] font-semibold"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
              >
                Album
              </span>
              <span
                className="block truncate text-[0.8125rem]"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                A folder of songs — an EP or a set
              </span>
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default NewSheet;
