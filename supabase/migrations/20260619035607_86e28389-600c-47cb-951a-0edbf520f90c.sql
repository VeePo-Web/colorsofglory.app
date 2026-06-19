
ALTER TABLE public.canvas_cards
  ADD COLUMN IF NOT EXISTS source_capture_id uuid NULL
    REFERENCES public.idea_captures(id) ON DELETE SET NULL;

ALTER TABLE public.idea_captures
  ADD COLUMN IF NOT EXISTS promoted_card_id uuid NULL
    REFERENCES public.canvas_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS canvas_cards_source_capture_idx
  ON public.canvas_cards (source_capture_id);

CREATE UNIQUE INDEX IF NOT EXISTS canvas_cards_one_promotion_per_capture
  ON public.canvas_cards (source_capture_id)
  WHERE source_capture_id IS NOT NULL;
