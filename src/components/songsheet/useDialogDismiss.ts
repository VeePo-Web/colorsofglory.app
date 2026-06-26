import { useEffect, useRef } from "react";

/**
 * Shared dialog a11y for the song-sheet bottom sheets: Escape closes, focus
 * moves into the sheet on open (return the ref to attach to the close button),
 * and focus is restored to wherever it was when the sheet closes. Pair with
 * role="dialog" aria-modal="true" on the sheet.
 */
export function useDialogDismiss(onClose: () => void) {
  const focusRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);
  return focusRef;
}
