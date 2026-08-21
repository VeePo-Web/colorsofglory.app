/**
 * The Canvas has ONE bottom action surface at a time — the radical-simplicity
 * law. The default creation dock (Practice / Record memo / Add part) yields
 * whenever a FOCUSED workflow owns the bottom of the screen, so the songwriter
 * never faces two competing action bars (and two "primary" actions) at once.
 *
 * The workflow bars are fixed to `bottom: 0`; the dock floats just above them,
 * so without this it stays visible underneath an active weave / merge / arrange
 * / expanded listen path. Pure + exported so the exclusivity is unit-tested.
 *
 * A COLLAPSED listen path (a queue exists but is minimized) is deliberately not
 * counted — the quiet pill is meant to coexist with the dock; only ENTERING the
 * path (expanding its transport) makes it dominant.
 */
export interface BottomSurfaceState {
  weaveActive: boolean;
  arranging: boolean;
  mergeSelectionCount: number;
  listenPathExpanded: boolean;
  listenPathQueueCount: number;
  /**
   * Which canvas the songwriter is on. The expanded listen transport
   * (ListenPathBar) is map-idiom — it can only RENDER on the map — so on the
   * feed its expanded flag must never count as a bottom workflow. Counting it
   * there hid the creation dock with nothing in its place, permanently: the
   * only collapse control lives on the map-gated bar. Absent = map (legacy).
   */
  view?: "feed" | "map";
}

export function isBottomWorkflowActive(s: BottomSurfaceState): boolean {
  return (
    s.weaveActive ||
    s.arranging ||
    s.mergeSelectionCount > 0 ||
    (s.view !== "feed" && s.listenPathExpanded && s.listenPathQueueCount > 0)
  );
}
