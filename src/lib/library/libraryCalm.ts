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

/** ONE shelf (C6): active songs live together whoever made them — Drive
 *  would never ask "who created this folder?" before showing you your music.
 *  Provenance ("Shared with me") is a quiet lens beside the faces, not a
 *  door. The only remaining tab split is Archived — a genuinely different
 *  state of song — and it appears only once something is actually archived. */
export function showLibraryTabs(archivedCount: number): boolean {
  return archivedCount > 0;
}

/** Search/sort/view appear when the active list outgrows a single glance. */
export function showLibraryControls(activeTabCount: number): boolean {
  return activeTabCount >= CONTROLS_THRESHOLD;
}

/** The albums shelf appears once albums EXIST — never as premature homework
 *  or an empty creation ad. Making the FIRST album lives behind the library's
 *  one "+ New" door (NewSheet), the way Drive teaches Folder through its
 *  + New menu: everyone opens that door for every new song, so the Album row
 *  is the discovery surface. */
export function showAlbumsShelf(albumCount: number): boolean {
  return albumCount > 0;
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
