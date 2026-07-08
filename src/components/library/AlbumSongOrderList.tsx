import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { SongCard as SongRow } from "@/types";
import { coverColor } from "@/lib/library/format";

interface AlbumSongOrderListProps {
  songs: SongRow[];
  onReorder: (orderedIds: string[]) => void;
}

/**
 * AlbumSongOrderList — arrange the tracklist of an album (a body of songs
 * being written together). Each row carries a right-side grip; dragging *from
 * the grip* lifts the row and reorders live, so vertical scrolling and
 * tap-to-open are never in conflict (you must grab the handle, the Apple
 * Reminders/Music edit-mode grammar). Numbered like an album's track order.
 * Reorder runs on DOM refs; state commits once on release.
 */
const AlbumSongOrderList = ({ songs, onReorder }: AlbumSongOrderListProps) => {
  const [order, setOrder] = useState<string[]>(songs.map((s) => s.id));
  const byId = new Map(songs.map((s) => [s.id, s]));
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const startY = useRef(0);
  const liveOrder = useRef<string[]>(order);
  liveOrder.current = order;

  const rowMid = (id: string) => {
    const r = rowRefs.current[id]?.getBoundingClientRect();
    return r ? r.top + r.height / 2 : Infinity;
  };

  const onHandleDown = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragId.current = id;
    setDraggingId(id);
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const id = dragId.current;
    if (!id) return;
    const el = rowRefs.current[id];
    if (el) el.style.transform = `translateY(${e.clientY - startY.current}px)`;
    // Swap with whichever neighbour's midpoint the finger has crossed.
    const others = liveOrder.current.filter((x) => x !== id);
    let insert = others.length;
    for (let i = 0; i < others.length; i++) {
      if (e.clientY < rowMid(others[i])) {
        insert = i;
        break;
      }
    }
    const next = [...others.slice(0, insert), id, ...others.slice(insert)];
    if (next.join("|") !== liveOrder.current.join("|")) {
      if (el) {
        el.style.transform = "";
        startY.current = e.clientY;
      }
      setOrder(next);
    }
  };

  const endDrag = () => {
    const id = dragId.current;
    if (id && rowRefs.current[id]) rowRefs.current[id]!.style.transform = "";
    dragId.current = null;
    setDraggingId(null);
    onReorder(liveOrder.current);
  };

  return (
    <div className="flex flex-col gap-2" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {order.map((id, i) => {
        const song = byId.get(id);
        if (!song) return null;
        const lifted = draggingId === id;
        return (
          <div
            key={id}
            ref={(el) => {
              rowRefs.current[id] = el;
            }}
            className="flex select-none items-center gap-3 rounded-2xl bg-white p-3"
            style={{
              minHeight: 64,
              border: lifted ? "1.5px solid var(--cog-gold)" : "1px solid var(--cog-border)",
              boxShadow: lifted ? "0 12px 28px rgba(28,26,23,0.22)" : "0 1px 4px rgba(28,26,23,0.05)",
              zIndex: lifted ? 10 : undefined,
              position: lifted ? "relative" : undefined,
              touchAction: "none",
            }}
          >
            <span
              className="w-5 shrink-0 text-center text-[0.8125rem] font-bold"
              style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
              aria-hidden
            >
              {i + 1}
            </span>
            <div
              aria-hidden
              className="shrink-0 rounded-lg"
              style={{
                width: 36,
                height: 36,
                background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
                border: "1px solid var(--cog-border)",
              }}
            />
            <p
              className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
            >
              {song.title}
            </p>
            {/* Grip — the only drag surface; scrolling elsewhere stays native */}
            <div
              onPointerDown={onHandleDown(id)}
              role="button"
              aria-label={`Drag to reorder ${song.title}, position ${i + 1}`}
              className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-lg active:cursor-grabbing"
              style={{ color: "var(--cog-muted)", touchAction: "none" }}
            >
              <GripVertical size={18} strokeWidth={2} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AlbumSongOrderList;
