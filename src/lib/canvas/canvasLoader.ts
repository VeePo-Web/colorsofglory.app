import { supabase } from "@/integrations/supabase/client";
import type { IdeaCard, SongCanvasState, CanvasNode, CanvasEdge } from "./canvasTypes";

/**
 * Fetches real voice_memos from Supabase and merges them into the canvas state.
 * Positions are assigned algorithmically; existing sessionStorage positions take priority.
 *
 * This is the bridge between Lovable's Supabase backend and the canvas.
 * When Lovable adds a canvas_nodes table this file becomes the adapter layer.
 */

const CARD_W = 210;
const CARD_H = 132;

function placeCard(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 220 + col * (CARD_W + 40),
    y: 740 + row * (CARD_H + 36),
  };
}

function formatDurationMs(ms: number | null): string {
  if (!ms) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type LoadResult = {
  cards: Record<string, IdeaCard>;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export async function loadVoiceMemosForCanvas(songId: string): Promise<LoadResult> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("id, title, duration_ms, section_id, status, created_at, author_user_id")
    .eq("song_id", songId)
    .not("status", "in", '("failed","deleted")')
    .order("created_at", { ascending: true })
    .limit(40);

  if (error || !data || data.length === 0) {
    return { cards: {}, nodes: [], edges: [] };
  }

  const cards: Record<string, IdeaCard> = {};
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  data.forEach((row, i) => {
    const cardId = `db-voice-${row.id}`;
    const nodeId = `node-db-voice-${row.id}`;
    const isProcessing = row.status === "uploading" || row.status === "uploaded";
    const duration = formatDurationMs(row.duration_ms);

    const card: IdeaCard = {
      id: cardId,
      songId,
      type: "voice",
      title: row.title || `Voice Memo ${i + 1}`,
      preview: `🎙 ${duration}${isProcessing ? " · Uploading…" : ""}`,
      contributorId: row.author_user_id,
      contributorName: "You",
      contributorColor: "#D4AE5C",
      sourceType: "voice_memo",
      status: isProcessing ? "raw" : "raw",
      createdAt: row.created_at,
      updatedAt: row.created_at,
    };

    const pos = placeCard(i);
    const node: CanvasNode = {
      id: nodeId,
      songId,
      objectType: "idea_card",
      objectId: cardId,
      ...pos,
      width: CARD_W,
      height: CARD_H,
      zone: "ideas",
    };

    const edge: CanvasEdge = {
      id: `edge-db-voice-${row.id}`,
      songId,
      fromNodeId: "root-song",
      toNodeId: nodeId,
      relationType: "branch",
    };

    cards[cardId] = card;
    nodes.push(node);
    edges.push(edge);
  });

  return { cards, nodes, edges };
}

/**
 * Merge real DB cards into an existing canvas state.
 * Only adds cards that don't already have a node on canvas.
 * Preserves user-dragged positions from sessionStorage.
 */
export function mergeDBCardsIntoCanvas(state: SongCanvasState, db: LoadResult): SongCanvasState {
  if (Object.keys(db.cards).length === 0) return state;

  const existingObjectIds = new Set(state.nodes.map((n) => n.objectId));
  const newNodes = db.nodes.filter((n) => !existingObjectIds.has(n.objectId));
  const newCardIds = new Set(newNodes.map((n) => n.objectId));
  const newCards: Record<string, IdeaCard> = {};
  for (const id of newCardIds) {
    if (db.cards[id]) newCards[id] = db.cards[id];
  }
  const newEdges = db.edges.filter((e) =>
    newNodes.some((n) => n.id === e.toNodeId)
  );

  if (newNodes.length === 0) return state;

  return {
    ...state,
    nodes: [...state.nodes, ...newNodes],
    edges: [...state.edges, ...newEdges],
    cardsById: { ...state.cardsById, ...newCards },
    lastStatus: `Loaded ${newNodes.length} voice memo${newNodes.length === 1 ? "" : "s"} from this song.`,
  };
}
