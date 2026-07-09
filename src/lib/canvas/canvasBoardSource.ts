import { supabase } from "@/integrations/supabase/client";
import { listCanvasCards, type CanvasCard as ServerCanvasCard } from "@/integrations/cog/canvas";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import {
  decodeSuggestion,
  SUGGESTION_SECTION_KIND,
  type PendingLineSuggestion,
} from "@/lib/canvas/lineSuggestions";
import { DEMO_BOARD } from "@/lib/canvas/demoBoard";
import {
  cardWidth,
  clampToBoard,
  finalColumnSlot,
  ideaColumnSlot,
} from "@/lib/canvas/canvasGeometry";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import type { CanvasBoardCard, CanvasBoardCardType, CanvasBoardTree } from "@/lib/canvas/canvasTypes";

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

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SERVER_ID_RE = new RegExp(`^db-(voice|card)-${UUID}$`, "i");
const SERVER_CARD_RE = new RegExp(`^db-card-(${UUID})$`, "i");

/** True for cards whose truth lives on the server (hydrated rows). EXACT
 *  match — a locally derived id like `db-voice-<uuid>-final` is a LOCAL card
 *  (a prefix match once let the pruner destroy promoted copies). */
export function isServerCardId(id: string): boolean {
  return SERVER_ID_RE.test(id);
}

/** The canvas_cards uuid behind a hydrated board card id (null for local
 *  cards and voice-memo mirrors — memos have no server board position). */
export function serverCardId(id: string): string | null {
  const m = SERVER_CARD_RE.exec(id);
  return m ? m[1] : null;
}

/** Persist the board (interim; A4's store owns this once it lands). Server
 *  rows ARE persisted — they carry local board state (a promoted memo's tree)
 *  and feed offline reads like the credits ledger; the hydrate merge prunes
 *  rows the server no longer returns, so nothing resurrects. */
export function writeBoard(songId: string, cards: CanvasBoardCard[]): void {
  try {
    localStorage.setItem(CARDS_KEY(songId), JSON.stringify(cards));
  } catch {
    // A full quota is non-fatal — the in-memory board stays usable.
  }
}

const SERVER_KIND_TO_TYPE: Record<ServerCanvasCard["kind"], CanvasBoardCardType> = {
  lyrics: "lyric",
  chords: "chord",
  scripture: "scripture",
  idea: "note",
  section: "section",
};

const TYPE_TITLES: Record<CanvasBoardCardType, string> = {
  lyric: "Lyric", voice: "Voice memo", hum: "Hum", chord: "Chord idea",
  note: "Idea", scripture: "Scripture note", section: "Section",
};

export interface HydratedBoard {
  cards: CanvasBoardCard[];
  /** Line-suggestion carrier rows, routed OFF the board into the review lane. */
  suggestions: PendingLineSuggestion[];
  /** Whether each source answered — the host prunes stale db-* cards ONLY for
   *  sources that actually responded (never on an offline failure). */
  memosOk: boolean;
  cardsOk: boolean;
}

// ─── Review tombstones ──────────────────────────────────────────────────────
// The server has no review_state column yet, so an owner's "Not this one" on a
// server row would resurrect on the next hydrate. Tombstones remember the
// decision on THIS device (cross-device decisions need the backend column —
// filed in the handoff). Undo removes the tombstone.

const TOMBSTONES_KEY = (songId: string) => `cog:canvas-tombstones-${songId}`;

export function readTombstones(songId: string): Set<string> {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY(songId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function addTombstone(songId: string, cardId: string): void {
  const next = readTombstones(songId);
  next.add(cardId);
  try {
    localStorage.setItem(TOMBSTONES_KEY(songId), JSON.stringify([...next]));
  } catch {
    /* non-fatal */
  }
}

export function removeTombstone(songId: string, cardId: string): void {
  const next = readTombstones(songId);
  next.delete(cardId);
  try {
    localStorage.setItem(TOMBSTONES_KEY(songId), JSON.stringify([...next]));
  } catch {
    /* non-fatal */
  }
}

function formatDurationMs(ms: number | null): string {
  if (!ms) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

/**
 * Pull this song's server board: voice memos AND canvas_cards rows (the rows
 * Capture mode's Say-It-Structured writes — this is where an idea captured on
 * the porch shows up in the song's room). Contributor display names resolve in
 * the host from the roster (`createdBy` carries the user id); "" means
 * unresolved, never a fabricated "You".
 */
export async function hydrateBoard(songId: string): Promise<HydratedBoard> {
  const [memosRes, cardsRes] = await Promise.allSettled([
    supabase
      .from("voice_memos")
      .select("id, title, duration_ms, status, created_at, author_user_id")
      .eq("song_id", songId)
      .not("status", "in", '("failed","deleted")')
      // Newest first — an ascending window pinned the 60 OLDEST memos and a
      // busy song's fresh takes never reached other devices.
      .order("created_at", { ascending: false })
      .limit(120),
    listCanvasCards(songId),
  ]);

  const out: CanvasBoardCard[] = [];
  const suggestions: PendingLineSuggestion[] = [];
  let memosOk = false;
  let cardsOk = false;

  if (memosRes.status === "fulfilled" && !memosRes.value.error && memosRes.value.data) {
    memosOk = true;
    // Reverse so slot fallbacks still lay out oldest-at-top.
    [...memosRes.value.data].reverse().forEach((row, i) => {
      const isProcessing = row.status === "uploading" || row.status === "uploaded";
      out.push({
        id: `db-voice-${row.id}`,
        tree: "ideas",
        type: "voice",
        title: row.title || `Voice memo ${i + 1}`,
        body: "",
        meta: formatDurationMs(row.duration_ms),
        section: "Raw idea",
        contributor: "",
        status: "raw",
        // Deterministic from the author id (roster names refine later) — an
        // empty accent broke every `${accent}30` concatenation downstream.
        accent: getCreatorColor(row.author_user_id ?? row.id).base,
        ...ideaColumnSlot(i),
        durationMs: row.duration_ms ?? undefined,
        isProcessing,
        createdBy: row.author_user_id ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.created_at,
        lastActivityAt: row.created_at,
        reviewState: "none",
        contributionType: "melody",
      });
    });
  }

  if (cardsRes.status === "fulfilled") {
    cardsOk = true;
    cardsRes.value.forEach((row, i) => {
      // Carrier rows are proposals, not board material — route them to the
      // review lane and never paint them as cards.
      if (row.section_kind === SUGGESTION_SECTION_KIND) {
        const payload = decodeSuggestion(row.body);
        if (payload) {
          suggestions.push({
            id: row.id,
            songId,
            cardId: row.parent_card_id ? `db-card-${row.parent_card_id}` : "",
            originalLine: payload.originalLine,
            proposedLine: payload.proposedLine,
            contributor: payload.contributor,
            section: payload.section,
            createdAt: new Date(row.created_at).getTime(),
            fromServer: true,
            createdBy: row.created_by,
          });
        }
        return;
      }
      const type = SERVER_KIND_TO_TYPE[row.kind] ?? "note";
      const tree: CanvasBoardTree = row.tree_kind === "final" ? "final" : "ideas";
      const fallback = tree === "final" ? finalColumnSlot(i) : ideaColumnSlot(i);
      const serverPositioned = row.x != null && row.y != null;
      out.push({
        id: `db-card-${row.id}`,
        tree,
        type,
        title: row.label || row.section_label || TYPE_TITLES[type],
        body: row.body,
        meta: "",
        section: row.section_label ?? row.section_kind ?? "Raw idea",
        contributor: "",
        status: tree === "final" ? "approved" : "raw",
        accent: getCreatorColor(row.created_by || row.id).base,
        x: row.x ?? fallback.x,
        y: row.y ?? fallback.y,
        serverPositioned,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastActivityAt: row.updated_at,
        reviewState: "none",
        contributionType:
          type === "lyric" ? "lyrics" : type === "chord" ? "chords"
          : type === "scripture" ? "meaning" : type === "section" ? "arrangement" : "feedback",
      });
    });
  }

  return { cards: out.map(normalizeCard), suggestions, memosOk, cardsOk };
}
