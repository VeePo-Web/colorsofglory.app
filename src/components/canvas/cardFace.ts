import type { CreatorColor } from "@/lib/canvas/creatorColors";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

/**
 * The contract every typed card FACE implements. A face is presentational
 * only: it paints the inner content that makes a card read as EXACTLY its type
 * (a lyric in Playfair, a voice as a waveform, a hum as raw bars, a chord as
 * chips, a note on ruled paper) at a glance, before a word is read.
 *
 * The frame (CardShell), position, drag visuals, selection ring, the uniform
 * badges (listen-path #, arrangement #, merge ring, pending marker) and the
 * selected action row all belong to the CanvasCard orchestrator — a face never
 * renders them. This keeps every type visually distinct while the interaction
 * layer stays uniform and D2/D3-driven.
 */
export interface CardFaceProps {
  card: CanvasBoardCard;
  color: CreatorColor;
  selected: boolean;
}
