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

// ─── Whiteboard render/feature card ──────────────────────────────────────────
// The shape the canvas board + D2 feature bars/hooks consume. Canonical home is
// here so no component imports it from SongCanvasExperience. Filed for A2's
// @/types barrel in docs/CANVAS-FEATURES-CONTRACT.md.

export type CanvasBoardTree = "ideas" | "final";

export type CanvasBoardCardType =
  | "lyric"
  | "voice"
  | "hum"
  | "chord"
  | "note"
  | "scripture"
  | "section";

export type CanvasBoardCardStatus =
  | "raw"
  | "shortlisted"
  | "approved"
  | "meaning"
  | "review";

/** Why a card is rendered dimmed — always kept, never deleted. */
export type CanvasBoardDimReason = "moved_to_final" | "merged" | "compare_kept";

/** Owner-review lifecycle for a collaborator's idea (COG Product 11). */
export type CanvasReviewState = "none" | "pending" | "kept" | "approved" | "dismissed";

/** What kind of work this card credits its creator with (credits ledger). */
export type CanvasContributionType =
  | "lyrics"
  | "melody"
  | "chords"
  | "arrangement"
  | "meaning"
  | "feedback";

export interface CanvasBoardCard {
  id: string;
  tree: CanvasBoardTree;
  type: CanvasBoardCardType;
  title: string;
  body: string;
  meta: string;
  section: string;
  contributor: string;
  status: CanvasBoardCardStatus;
  accent: string;
  x: number;
  y: number;
  /** Set when this voice memo is a layer recorded over a base ("Record over this"). */
  parentMemoId?: string;
  /** Recording length for stack playback/labels; voice cards only. */
  durationMs?: number;
  /** Real per-take amplitude peaks (voice_memos.waveform_peaks); voice cards. */
  waveformPeaks?: number[] | null;
  /** Melody Lens relative pitch contour (server column or device store). */
  pitchContour?: number[] | null;
  /** Owner has reviewed this contributor idea (kept it in Ideas). Clears it from the review queue. */
  reviewed?: boolean;
  isDimmedReference?: boolean;
  dimReason?: CanvasBoardDimReason;
  isProcessing?: boolean;
  /** Provenance: the two idea cards this section was merged from (F22). */
  mergedFrom?: [string, string];
  /** Provenance: the Ideas card a Final copy was promoted from (F23). Replaces
   *  the legacy "-final" id-suffix convention; both are honored on read. */
  sourceCardId?: string;
  /** Hydration flag: this server row carries a REAL x/y (vs a client-side
   *  fallback slot) — only then may the merge apply server positions. */
  serverPositioned?: boolean;

  // ── Collaboration-ready metadata ─────────────────────────────────────────
  // Populated wherever identity/time is known today; the collaboration agent
  // maps these 1:1 onto canvas_cards columns. See CANVAS_COLLABORATION_HANDOFF.md.
  /** Creating user's id (auth user id). `contributor` stays the display name. */
  createdBy?: string;
  updatedBy?: string;
  /** ISO timestamps. */
  createdAt?: string;
  updatedAt?: string;
  lastActivityAt?: string;
  /** Comments attached to this card (comment surface is future work). */
  commentCount?: number;
  reviewState?: CanvasReviewState;
  contributionType?: CanvasContributionType;
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

