import type { IdeaCard } from "./canvasTypes";

export const IDEA_CARD_TYPE_LABELS: Record<IdeaCard["type"], string> = {
  lyric: "Lyric",
  voice: "Voice memo",
  chord: "Chord idea",
  note: "Note",
  scripture: "Scripture",
  story: "Story",
  arrangement: "Arrangement",
  comment: "Comment",
  file: "File",
};

