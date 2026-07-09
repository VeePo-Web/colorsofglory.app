/**
 * zLayers — the ONE vertical scale for every fixed/floating canvas surface.
 *
 * The canvas previously grew two competing sheet families (60/61 and 70/71)
 * on the far side of the z-500 tab bar, so half the modal sheets rendered
 * UNDER bottom navigation and their CTAs were untappable. Every surface now
 * takes its tier from here:
 *
 *   canvas overlays (quick-nav, dock, prompts)   < 100
 *   SongTabBar                                     500
 *   persistent feature bars / pills            510–540
 *   modal sheets (backdrop / sheet)            799 / 800
 *   coach marks                                   1000
 */
export const Z = {
  /** Inside the stage overlay: quick-nav pills, first-action prompt, dock. */
  canvasOverlay: 40,
  /** SongTabBar (owned by cog/SongTabBar; recorded here for the scale). */
  tabBar: 500,
  /** Collapsed pills (listen path, arrange) — above the tab bar, tiny. */
  pill: 520,
  /** Expanded persistent bars (listen transport, merge, arrange order). */
  bottomBar: 540,
  /** Every modal sheet's scrim. */
  sheetBackdrop: 799,
  /** Every modal sheet. Backdrops must block the tab bar and the bars. */
  sheet: 800,
  /** First-run coach marks sit above everything. */
  coachMark: 1000,
} as const;
