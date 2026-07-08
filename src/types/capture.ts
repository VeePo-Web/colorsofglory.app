// Quick-capture domain types.
//
// PROVENANCE: IdeaCapture — read shape of public.idea_captures (hand-modeled
// subset, not a Tables<> alias): a captured fragment that can later be promoted
// into a canvas card (promoted_card_id). The write DTOs
// (QuickCaptureInput / PromoteCaptureInput / PromoteCaptureResult) stay with
// their edge-function callers in src/integrations/cog/capture.ts.
export type IdeaCapture = {
  id: string;
  song_id: string | null;
  author_user_id: string;
  title: string | null;
  lyric_snippet: string | null;
  scripture_ref: string | null;
  tags: string[];
  section_id: string | null;
  voice_memo_id: string | null;
  created_at: string;
  updated_at: string;
  promoted_card_id?: string | null;
};
