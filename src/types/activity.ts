// Activity feed domain types.
//
// SongActivityKind is a TYPE-LAYER-OWNED vocabulary: the DB stores the kind as a
// bare string, and this union is the canonical set the client renders. Payloads
// carry IDs + kinds only — never raw lyric/memo content (a hard product rule).
export type SongActivityKind =
  | "take_committed"
  | "capture_created"
  | "capture_promoted"
  | "memo_uploaded"
  | "memo_finalized"
  | "memo_transcribed"
  | "invite_accepted"
  | "member_left"
  | "owner_transferred"
  | "card_moved"
  | "card_linked"
  | "card_unlinked"
  | "card_grouped"
  | "card_section_set"
  | "card_promoted_final"
  | "card_deleted";

export type ActivityDigestRow = {
  kind: SongActivityKind;
  actor_user_id: string | null;
  event_count: number;
  last_at: string;
  sample_entity_ids: string[] | null;
};

export type RecapDigest = { digest: string; rows: ActivityDigestRow[] };
