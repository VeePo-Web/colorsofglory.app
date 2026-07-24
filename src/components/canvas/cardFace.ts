import type { CreatorColor } from "@/lib/canvas/creatorColors";
import type { GloryTone } from "@/lib/canvas/glorySpectrum";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

/**
 * The contract every typed card FACE implements. A face is presentational
 * only: it paints the inner content that makes a card read as EXACTLY its type
 * (a lyric in Playfair, a voice as a waveform, a hum as raw bars, a chord as
 * chips, a note on ruled paper) at a glance, before a word is read.
 *
 * Two color systems, two questions:
 *   `tone`  (glory spectrum) — WHAT kind of material: icon, eyebrow, stripe.
 *   `color` (creator)        — WHO made it: the dot + name only.
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
  tone: GloryTone;
  selected: boolean;
  /** This card is sounding right now — waveforms breathe. */
  playing?: boolean;
  /** Audio faces (voice/hum) only: one-tap audition. Absent → no play control
   *  (unplayable/legacy card). Provided by the orchestrator, wired to the
   *  shared canvasAudio voice in the host. */
  onPlay?: () => void;
}
