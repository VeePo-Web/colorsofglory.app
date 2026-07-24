import { useEffect, useRef, type RefObject } from "react";

/**
 * Modal focus safety for a hand-rolled bottom sheet / dialog. Attach the
 * returned ref to the `role="dialog" aria-modal="true"` element and give that
 * element `tabIndex={-1}` + `outline: "none"`.
 *
 * On open, focus moves INTO the dialog — but only if nothing inside it is
 * already focused, so a sheet that autofocuses its own field (an edit form) or
 * a CTA keeps that caret. Tab is trapped inside the dialog, Escape closes it,
 * and focus returns to whatever triggered it on close. One hook so every
 * hand-rolled sheet behaves the same (the proven LineLabSheet pattern).
 *
 * `onClose` is read from a live ref, so passing an inline callback each render
 * never re-subscribes the listeners or re-fires the focus move.
 */
export function useModalFocusTrap(onClose: () => void): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const el = ref.current;
      if (el && !el.contains(document.activeElement)) el.focus();
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}
