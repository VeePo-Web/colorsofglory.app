import type { Variants, Transition } from "framer-motion";

/**
 * COG shared framer-motion variant library (CLAUDE.md §2.5).
 *
 * These JS variants MIRROR the CSS entrance classes in index.css
 * (.cog-page-enter, .cog-sheet-enter, .cog-stagger) so the two motion systems
 * never diverge. Durations are in seconds (framer-motion), matching the
 * millisecond tokens in tokens.css: fast 150 / base 250 / slow 400 / modal 600.
 *
 * Easing mirrors the token cubic-beziers:
 *   --cog-ease        → standard UI transitions
 *   --cog-ease-reveal → content entrance
 */

export const COG_EASE = [0.25, 0.46, 0.45, 0.94] as const; // --cog-ease
export const COG_EASE_REVEAL = [0.22, 1, 0.36, 1] as const; // --cog-ease-reveal

export const DUR = {
  fast: 0.15, // --dur-fast  150ms
  base: 0.25, // --dur-base  250ms
  slow: 0.4, //  --dur-slow  400ms
  modal: 0.6, // --dur-modal 600ms
} as const;

/** Card / surface entrance — translateY 8→0 + fade, 400ms reveal easing. */
export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: COG_EASE_REVEAL },
  },
};

/** Route enter — slide in from the right (24px), 250ms standard easing. */
export const pageSlideIn: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DUR.base, ease: COG_EASE },
  },
};

/** Route exit — slide out to the right (24px), 250ms standard easing. */
export const pageSlideOut: Variants = {
  visible: { opacity: 1, x: 0 },
  exit: {
    opacity: 0,
    x: 24,
    transition: { duration: DUR.base, ease: COG_EASE },
  },
};

/** Bottom sheet — rise from 24px below, reveal easing (mirrors .cog-sheet-enter). */
export const sheetIn: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: COG_EASE_REVEAL },
  },
};

/**
 * Stagger container — reveals children 40–80ms apart (mirrors .cog-stagger).
 * Pair with `cardEntrance` on each child.
 */
export const stagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

/** Button press — scale to 0.97 on tap, 150ms. Use as a `whileTap`. */
export const buttonPress = { scale: 0.97 } as const;

/** Shared tap transition for buttonPress. */
export const buttonPressTransition: Transition = {
  duration: DUR.fast,
  ease: COG_EASE,
};
