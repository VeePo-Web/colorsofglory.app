import { useEffect, useState } from "react";
import { Disc3, Archive, ArchiveRestore } from "lucide-react";

interface SelectionBarProps {
  count: number;
  /** Archived tab flips the batch action to restore. */
  archivedTab?: boolean;
  onAddToAlbum: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

/**
 * SelectionBar — the Apple Photos selection toolbar: a calm bottom bar that
 * rises while batch-select is active, showing the running count and the
 * actions that apply to all chosen songs at once. Disabled-dim until at
 * least one song is picked. Sits above the tab bar, safe-area aware.
 */
const SelectionBar = ({ count, archivedTab = false, onAddToAlbum, onArchive, onRestore }: SelectionBarProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const active = count > 0;
  const btn =
    "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-transform duration-150 active:scale-95 disabled:opacity-40";

  return (
    <div
      role="toolbar"
      aria-label={`${count} selected`}
      className="fixed inset-x-0 z-[460] mx-auto w-full max-w-[430px] px-3 md:max-w-md"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
        transform: visible ? "translateY(0)" : "translateY(140%)",
        transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className="flex items-stretch gap-1 rounded-2xl px-2 py-1.5"
        style={{
          backgroundColor: "var(--cog-cream-light)",
          border: "1px solid var(--cog-border-gold)",
          boxShadow: "0 12px 32px rgba(28,26,23,0.18)",
        }}
      >
        {!archivedTab && (
          <button onClick={onAddToAlbum} disabled={!active} className={btn} aria-label="Add selected to album">
            <Disc3 size={19} strokeWidth={1.9} style={{ color: "var(--cog-gold)" }} />
            <span
              className="text-[0.6875rem] font-semibold"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              Add to album
            </span>
          </button>
        )}
        <button
          onClick={archivedTab ? onRestore : onArchive}
          disabled={!active}
          className={btn}
          aria-label={archivedTab ? "Restore selected" : "Archive selected"}
        >
          {archivedTab ? (
            <ArchiveRestore size={19} strokeWidth={1.9} style={{ color: "var(--cog-warm-gray)" }} />
          ) : (
            <Archive size={19} strokeWidth={1.9} style={{ color: "var(--cog-warm-gray)" }} />
          )}
          <span
            className="text-[0.6875rem] font-semibold"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
          >
            {archivedTab ? "Restore" : "Archive"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default SelectionBar;
