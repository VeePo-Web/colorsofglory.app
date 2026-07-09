import { loadVoiceMemosForCanvas } from "@/lib/canvas/canvasLoader";
import { DEMO_BOARD } from "@/lib/canvas/demoBoard";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

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

/** The board to open with: a saved board wins (even if empty), else the demo
 *  route's sample tree (through this seam, never inline), else an empty room. */
export function initialBoard(songId: string): CanvasBoardCard[] {
  try {
    const stored = localStorage.getItem(CARDS_KEY(songId));
    // Respect a saved board exactly — including an empty one. A songwriter who
    // clears their canvas must not have demo cards resurrected on reload.
    if (stored) {
      const parsed = JSON.parse(stored) as CanvasBoardCard[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fall through to a clean start.
  }
  // Only the explicit demo route shows samples; no real song is ever pre-filled
  // with someone else's words.
  return songId === "demo" ? DEMO_BOARD : [];
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
