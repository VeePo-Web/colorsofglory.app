import { useRef, useState } from "react";

/**
 * useShelfReorder — long-press-and-drag reordering for a horizontal shelf
 * (the iOS home-screen grammar, kept calm). Hold a card still for 350ms to
 * lift it, slide sideways, release to drop; the new order commits on release.
 * Before the lift, native horizontal scrolling is untouched — moving the
 * finger early cancels the hold and the shelf just scrolls.
 */
export function useShelfReorder(ids: string[], onReorder: (ordered: string[]) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pressedId = useRef<string | null>(null);
  const dragging = useRef(false);
  const suppressClick = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // iOS: only a non-passive touchmove preventDefault can stop a scroll from
  // starting mid-gesture. Armed at lift time, removed on release.
  const blockScroll = useRef((ev: TouchEvent) => {
    if (dragging.current) ev.preventDefault();
  });
  const armScrollBlock = () =>
    document.addEventListener("touchmove", blockScroll.current, { passive: false });
  const disarmScrollBlock = () =>
    document.removeEventListener("touchmove", blockScroll.current);

  const endDrag = (clientX?: number) => {
    clearTimer();
    disarmScrollBlock();
    const id = pressedId.current;
    if (dragging.current && id) {
      const el = itemRefs.current[id];
      if (el) {
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.boxShadow = "";
        el.style.transition = "";
      }
      if (clientX !== undefined) {
        // Final index = how many other cards sit left of the release point.
        const others = ids.filter((x) => x !== id);
        let index = 0;
        for (const other of others) {
          const rect = itemRefs.current[other]?.getBoundingClientRect();
          if (rect && clientX > rect.left + rect.width / 2) index += 1;
        }
        const next = [...others.slice(0, index), id, ...others.slice(index)];
        if (next.join("|") !== ids.join("|")) onReorder(next);
      }
      suppressClick.current = true;
      dragging.current = false;
      setDraggingId(null);
    }
    pressedId.current = null;
    start.current = null;
  };

  const handlersFor = (id: string) => ({
    ref: (el: HTMLElement | null) => {
      itemRefs.current[id] = el;
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pressedId.current = id;
      start.current = { x: e.clientX, y: e.clientY };
      suppressClick.current = false;
      clearTimer();
      timer.current = window.setTimeout(() => {
        // Lift: from here the card follows the finger, not the scroll.
        dragging.current = true;
        setDraggingId(id);
        armScrollBlock();
        const el = itemRefs.current[id];
        if (el) {
          el.style.transition = "box-shadow 150ms ease";
          el.style.zIndex = "30";
          el.style.boxShadow = "0 12px 28px rgba(28,26,23,0.22)";
        }
      }, 350);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current || pressedId.current !== id) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (!dragging.current) {
        // Finger moved before the hold completed → the user is scrolling.
        if (Math.hypot(dx, dy) > 8) {
          clearTimer();
          pressedId.current = null;
          start.current = null;
        }
        return;
      }
      e.preventDefault();
      const el = itemRefs.current[id];
      if (el) el.style.transform = `translateX(${dx}px) scale(1.06)`;
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (pressedId.current === id) endDrag(dragging.current ? e.clientX : undefined);
    },
    onPointerCancel: () => endDrag(),
    onClickCapture: (e: React.MouseEvent) => {
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick.current = false;
      }
    },
    // While lifted, stop the browser from treating the move as a scroll.
    style: dragging.current && draggingId === id ? ({ touchAction: "none" } as const) : undefined,
  });

  return { handlersFor, draggingId };
}
