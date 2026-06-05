export type CanvasRole = "owner" | "contributor" | "reviewer" | "viewer";

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

export type IdeaCardStatus = "raw" | "shortlisted" | "pending_review" | "added_to_final" | "archived";

export type CanvasNodeType = "root_song" | "idea_card" | "section_node" | "review_group" | "final_placeholder";

export type CanvasZone = "root" | "ideas" | "sections" | "review" | "parking_lot" | "final_staging";

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
  objectType: CanvasNodeType;
  objectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zone: CanvasZone;
  collapsed?: boolean;
}

export interface CanvasEdge {
  id: string;
  songId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: "source" | "branch" | "review" | "final";
}

export interface CanvasPermissions {
  role: CanvasRole;
  canCreate: boolean;
  canMove: boolean;
  canAddToFinal: boolean;
  canRecord: boolean;
}

export interface SongCanvasState {
  songId: string;
  song: {
    id: string;
    title: string;
    key?: string;
    bpm?: number;
    status: "active" | "archived" | "read_only";
  };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  cardsById: Record<string, IdeaCard>;
  permissions: CanvasPermissions;
  lastStatus: string;
}

export interface AddIdeaInput {
  title: string;
  preview: string;
  type: IdeaCardType;
}
