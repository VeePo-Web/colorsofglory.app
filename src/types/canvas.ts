// Song canvas / whiteboard domain types.
//
// PROVENANCE:
//   CanvasCard      — read shape of public.canvas_cards (hand-modeled subset,
//                     not a Tables<> alias). One card on the whiteboard.
//   CommitTakeResult — COMPOSED edge-function result (song_id + created card_ids).
// The canvas VOCABULARIES (IdeaCardType / IdeaCardStatus / zones /
// board card shapes) remain declared in src/lib/canvas/canvasTypes.ts — their
// canonical, canvas-agent-owned home — and are re-exported through the barrel so
// there is still a single import site (@/types).
export type {
  IdeaCardType,
  IdeaCardStatus,
  CanvasZone,
  CanvasObjectType,
  IdeaCard,
  CanvasNode,
  CanvasEdge,
  CanvasBoardTree,
  CanvasBoardCardType,
  CanvasBoardCardStatus,
  CanvasBoardDimReason,
  CanvasBoardCard,
  SongCanvasState,
} from "@/lib/canvas/canvasTypes";

export type CanvasCard = {
  id: string;
  song_id: string;
  created_by: string;
  take_id: string | null;
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind: string | null;
  label: string | null;
  body: string;
  start_ms: number | null;
  end_ms: number | null;
  position: number;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
  parent_card_id: string | null;
  group_id: string | null;
  tree_kind: "ideas" | "final";
  section_label: string | null;
  z_index: number;
};

export type CommitTakeResult = { song_id: string; card_ids: string[] };
