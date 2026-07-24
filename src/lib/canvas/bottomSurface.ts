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
}

export function isBottomWorkflowActive(s: BottomSurfaceState): boolean {
  return (
    s.weaveActive ||
    s.arranging ||
    s.mergeSelectionCount > 0 ||
    (s.listenPathExpanded && s.listenPathQueueCount > 0)
  );
}
