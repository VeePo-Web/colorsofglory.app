export type IdeaCardType =
  | "lyric"
  | "voice"
  | "chord"
  | "note"
  | "scripture"
  | "story"
  | "arrangement"
  | "comment"
  | "file";

export type IdeaCardStatus =
  | "raw"
  | "shortlisted"
  | "pending_review"
  | "added_to_final"
  | "archived";

export type CanvasZone =
  | "root"
  | "ideas"
  | "sections"
  | "review"
  | "parking_lot"
  | "final_staging";

export type CanvasObjectType =
  | "root_song"
  | "idea_card"
  | "section_node"
  | "review_group"
  | "final_placeholder";

export interface IdeaCard {
  id: string;
  songId: string;
  type: IdeaCardType;
  title: string;
  preview?: string;
  body?: string;
  contributorId: string;
  contributorName: string;
  contributorColor: string;
  sourceType?: "quick_capture" | "voice_memo" | "import" | "transcript" | "manual" | "comment";
  sectionId?: string;
  status: IdeaCardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasNode {
  id: string;
  songId: string;
  objectType: CanvasObjectType;
  objectId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zone: CanvasZone;
  collapsed?: boolean;
}

export interface CanvasEdge {
  id: string;
  songId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: "branch" | "reference" | "suggestion" | "moved_to_final";
}

export interface SongCanvasState {
  song: {
    id: string;
    title: string;
  };
  cardsById: Record<string, IdeaCard>;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  lastStatus: string;
}

