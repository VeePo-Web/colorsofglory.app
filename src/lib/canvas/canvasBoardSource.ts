import { loadVoiceMemosForCanvas } from "@/lib/canvas/canvasLoader";
import { DEMO_BOARD } from "@/lib/canvas/demoBoard";
import { cardWidth, clampToBoard } from "@/lib/canvas/canvasGeometry";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import type { CanvasBoardCard, CanvasBoardTree } from "@/lib/canvas/canvasTypes";

/**
 * canvasBoardSource — the INTERIM board store seam the render layer reads/writes
 * through, so the canvas surface + host own NO hardcoded card array and touch
 * localStorage nowhere directly. This is the exact seam A4's `useCanvasStore`
 * replaces: swap these four functions for store selectors/actions and no render
 * code changes.
 *
 * ── Target A4 shape (what D1 wants from useCanvasStore) ─────────────────────
 *   const board   = useCanvasStore(s => s.boardCards(songId));  // CanvasBoardCard[]
 *   const setCard = useCanvasStore(s => s.moveCard);            // (id,x,y) => void
 *   const addCard = useCanvasStore(s => s.addCard);             // (card)   => void
 *   // hydration + persistence live inside the store (realtime + RPC), so the
 *   // host loses initialBoard/writeBoard/hydrateBoard entirely.
 * Until then, these functions provide the same contract over localStorage +
 * the existing canvasLoader adapter. See docs/CANVAS-RENDER-CONTRACT.md §8.
 */

const CARDS_KEY = (songId: string) => `cog:canvas-cards-${songId}`;

/**
 * Migration guard: boards saved on the old 2400px canvas can hold positions
 * outside the new 1600px board (or on the wrong side of the moved divider).
 * Clamp every card into bounds AND into its own tree's half so nothing loads
 * unreachable or visually mis-zoned.
 */
function normalizeCard(card: CanvasBoardCard): CanvasBoardCard {
  const w = cardWidth(card.type);
  const clamped = clampToBoard(card.x, card.y, card.type);
  let x = clamped.x;
  const y = clamped.y;
  if (card.tree === "ideas" && x + w / 2 >= DIVIDER_X) x = DIVIDER_X - w - 24;
  if (card.tree === "final" && x + w / 2 < DIVIDER_X) x = DIVIDER_X + 24;
  return x === card.x && y === card.y ? card : { ...card, x, y };
}

/** The board to open with: a saved board wins (even if empty), else the demo
 *  route's sample tree (through this seam, never inline), else an empty room. */
export function initialBoard(songId: string): CanvasBoardCard[] {
  try {
    const stored = localStorage.getItem(CARDS_KEY(songId));
    // Respect a saved board exactly — including an empty one. A songwriter who
    // clears their canvas must not have demo cards resurrected on reload.
    if (stored) {
      const parsed = JSON.parse(stored) as CanvasBoardCard[];
      if (Array.isArray(parsed)) return parsed.map(normalizeCard);
    }
  } catch {
    // Fall through to a clean start.
  }
  // Only the explicit demo route shows samples; no real song is ever pre-filled
  // with someone else's words.
  return songId === "demo" ? DEMO_BOARD : [];
}

/** A (tree, section) group that collapses into one SectionCluster node. */
export interface CardCluster {
  id: string;
  sectionLabel: string;
  tree: CanvasBoardTree;
  cardIds: string[];
}

/** A zone-section is dense enough to collapse into a stack at/above this count. */
export const CLUSTER_THRESHOLD = 5;

/**
 * INTERIM cluster flag: which (tree, section) groups are dense enough to
 * collapse into a SectionCluster. A4's `useCanvasStore` owns this flag (it's a
 * product/layout decision, not a render one); the render layer only CONSUMES
 * the result. Dimmed references never cluster. Documented for A4 in
 * docs/CANVAS-RENDER-CONTRACT.md §8.
 */
export function clusterFlags(cards: CanvasBoardCard[]): CardCluster[] {
  const groups = new Map<string, CanvasBoardCard[]>();
  for (const c of cards) {
    if (!c.section || c.isDimmedReference) continue;
    const key = `${c.tree}::${c.section}`;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }
  const out: CardCluster[] = [];
  for (const [key, list] of groups) {
    if (list.length < CLUSTER_THRESHOLD) continue;
    const sep = key.indexOf("::");
    out.push({
      id: `cluster-${key}`,
      tree: key.slice(0, sep) as CanvasBoardTree,
      sectionLabel: key.slice(sep + 2),
      cardIds: list.map((c) => c.id),
    });
  }
  return out;
}

/** Persist the board (interim; A4's store owns this once it lands). */
export function writeBoard(songId: string, cards: CanvasBoardCard[]): void {
  try {
    localStorage.setItem(CARDS_KEY(songId), JSON.stringify(cards));
  } catch {
    // A full quota is non-fatal — the in-memory board stays usable.
  }
}

/**
 * Pull this song's real voice memos from the backend (via the canvasLoader
 * adapter) shaped as board cards. The host merges these in by id so a
 * collaborator's new memo appears without a reload. Empty/failed → [].
 */
export async function hydrateBoard(songId: string): Promise<CanvasBoardCard[]> {
  try {
    const db = await loadVoiceMemosForCanvas(songId);
    return db.nodes
      .filter((node) => node.objectType === "idea_card")
      .map((node): CanvasBoardCard | null => {
        const card = db.cards[node.objectId];
        if (!card) return null;
        return {
          id: card.id,
          tree: "ideas",
          type: "voice",
          title: card.title,
          body: card.body || card.preview || "",
          meta: card.preview || "Voice memo",
          section: "Raw idea",
          contributor: card.contributorName,
          status: "raw",
          accent: card.contributorColor,
          x: node.x,
          y: node.y,
        };
      })
      .filter((card): card is CanvasBoardCard => Boolean(card));
  } catch {
    // The local canvas remains usable when backend hydration is unavailable.
    return [];
  }
}
