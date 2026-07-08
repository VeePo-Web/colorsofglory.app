/**
 * E2 · lane-local motion variants (CLAUDE.md §2.5). A1's shared
 * `src/lib/motion` library was removed in a working-tree rollback; these two
 * variants keep the activity feed self-contained. If the shared library
 * returns, collapse this to a re-export.
 */
import type { Variants } from "framer-motion";

/* Bezier duplicated from tokens --cog-ease-reveal (framer-motion cannot read
   CSS custom properties for easing). */
export const COG_EASE_REVEAL: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Card entrance — translateY 8→0 + fade, 400ms, reveal ease. */
export const cardEntrance: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: COG_EASE_REVEAL },
  },
};

/** Stagger container — 40–80ms between children. */
export const stagger = (childDelay = 0.05, initialDelay = 0): Variants => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: Math.min(Math.max(childDelay, 0.04), 0.08),
      delayChildren: initialDelay,
    },
  },
});
