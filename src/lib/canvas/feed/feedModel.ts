import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { finalRunningOrder } from "@/lib/canvas/canvasGeometry";

/**
 * feedModel — the pure organize-brain of the Glory Feed (the canvas's
 * mobile-first vertical lens).
 *
 * The feed's whole job is the journey the spatial map never taught:
 * spark → filed under a song part → chosen → heard as a song. So the Ideas
 * page is grouped by SONG PART, with unfiled sparks first (they're the ones
 * asking "where do I belong?"), and everything already woven into the Final
 * song resting quietly at the end — visible, never deleted, never loud.
 *
 * No React, no DOM — pure functions over the same CanvasBoardCard array the
 * spatial map renders. One data model, two lenses.
 */

export const SPARKS_GROUP = "New sparks";
export const USED_GROUP = "Already in the song";

/** Section labels that mean "not filed anywhere yet". */
const UNFILED = new Set(["", "raw idea", "layer"]);

export interface FeedGroup {
  /** Display label — a song part ("Verse 1", "Chorus") or SPARKS_GROUP/USED_GROUP. */
  label: string;
  cards: CanvasBoardCard[];
}

const isLayer = (c: CanvasBoardCard) => Boolean(c.parentMemoId);

/** Newest first when both sides carry createdAt; otherwise keep source order. */
function newestFirst(cards: CanvasBoardCard[]): CanvasBoardCard[] {
  return [...cards].sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * The Ideas page: unfiled sparks first, then song parts in first-seen order,
 * then the dimmed "already in the song" references last. Voice-memo layers
 * never appear (they live inside their base take's stack).
 */
export function ideasFeedGroups(cards: CanvasBoardCard[]): FeedGroup[] {
  const sparks: CanvasBoardCard[] = [];
  const used: CanvasBoardCard[] = [];
  const sections = new Map<string, CanvasBoardCard[]>();

  for (const c of cards) {
    if (c.tree !== "ideas" || isLayer(c)) continue;
    if (c.isDimmedReference) {
      used.push(c);
      continue;
    }
    const label = (c.section ?? "").trim();
    if (UNFILED.has(label.toLowerCase())) {
      sparks.push(c);
      continue;
    }
    const bucket = sections.get(label);
    if (bucket) bucket.push(c);
    else sections.set(label, [c]);
  }

  const groups: FeedGroup[] = [];
  if (sparks.length > 0) groups.push({ label: SPARKS_GROUP, cards: newestFirst(sparks) });
  for (const [label, bucket] of sections) groups.push({ label, cards: bucket });
  if (used.length > 0) groups.push({ label: USED_GROUP, cards: used });
  return groups;
}

/**
 * The Final page: the arrangement in running order — the SAME comparator the
 * map's set-list numbers and Play-the-song use (column-major, stable past 10
 * wrapped parts). Layers excluded.
 */
export function finalFeedCards(cards: CanvasBoardCard[]): CanvasBoardCard[] {
  return cards
    .filter((c) => c.tree === "final" && !isLayer(c))
    .sort(finalRunningOrder);
}

/** Count of live (undimmed, non-layer) ideas — drives the Ideas tab badge. */
export function liveIdeaCount(cards: CanvasBoardCard[]): number {
  return cards.filter((c) => c.tree === "ideas" && !isLayer(c) && !c.isDimmedReference).length;
}

// ── View preference (feed is the phone default; the map stays one tap away) ──

const VIEW_KEY = "cog:canvas-view";

export type CanvasViewMode = "feed" | "map";

export function readCanvasView(viewportWidth: number): CanvasViewMode {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "feed" || stored === "map") return stored;
  } catch {
    /* storage unavailable — fall through to the device default */
  }
  // Phones live in the flow; big screens open the spatial room.
  return viewportWidth < 1024 ? "feed" : "map";
}

export function writeCanvasView(view: CanvasViewMode): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* preference is a nicety; the session state still rules */
  }
}
