/**
 * libraryCalm — the library's subtraction brain.
 *
 * The catalog had grown seven stacked surfaces before the first song:
 * tabs (with two empty administrative concepts), search/sort/view controls
 * over a four-song list, TWO "pick up where you left off" cards, and an
 * albums shelf inviting a brand-new writer to organize nothing. The Apple
 * rule this module encodes: **the default screen is your songs and one
 * action.** Everything else must EARN its place — appearing only when the
 * library is big enough (or the state real enough) for it to actually help.
 *
 * Pure decisions, no React — every gate is testable and lives in one place.
 */

/** Below this many songs in the active tab, search/sort/view are noise —
 *  the whole list fits a screen and your eye is faster than a filter. */
export const CONTROLS_THRESHOLD = 8;

/** Tabs exist to separate real bodies of songs. A solo writer with nothing
 *  invited and nothing archived gets a clean title, not three doors where
 *  two open onto empty rooms. The tabs return the moment either count does. */
export function showLibraryTabs(counts: { Invited: number; Archived: number }): boolean {
  return counts.Invited > 0 || counts.Archived > 0;
}

/** Search/sort/view appear when the active list outgrows a single glance. */
export function showLibraryControls(activeTabCount: number): boolean {
  return activeTabCount >= CONTROLS_THRESHOLD;
}

/** The albums shelf appears once albums EXIST, or once the library is big
 *  enough that filing becomes a real need — never as premature homework. */
export function showAlbumsShelf(albumCount: number, ownedCount: number): boolean {
  return albumCount > 0 || ownedCount >= CONTROLS_THRESHOLD;
}

/**
 * ONE continue moment, ever. A practice session to resume outranks the
 * last-touched song (it's the more specific intent); with neither, none.
 * Two stacked "pick up where you left off" cards was the single loudest
 * piece of clutter on the page.
 */
export function continueMoment(
  hasPracticeSession: boolean,
  hasContinueSong: boolean,
): "practice" | "song" | null {
  if (hasPracticeSession) return "practice";
  if (hasContinueSong) return "song";
  return null;
}
