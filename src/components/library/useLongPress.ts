import { useRef } from "react";

/**
 * useLongPress — Apple's press-and-hold. Fires after 450ms of a still touch
 * (>10px of movement = the user is scrolling, so we cancel). Right-click
 * fires the same action on desktop. After a long-press fires, the trailing
 * click is swallowed so the card doesn't also open.
 */
export function useLongPress(onLongPress?: () => void) {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  if (!onLongPress) return {};

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      fired.current = false;
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, 450);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!startPos.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startPos.current.x;
      const dy = e.touches[0].clientY - startPos.current.y;
      if (Math.hypot(dx, dy) > 10) clear();
    },
    onTouchEnd: () => clear(),
    onTouchCancel: () => clear(),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
