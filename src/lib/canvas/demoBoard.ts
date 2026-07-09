import { getCreatorColor } from "@/lib/canvas/creatorColors";
import { finalColumnSlot, ideaColumnSlot } from "@/lib/canvas/canvasGeometry";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

/**
 * DEMO_BOARD — the sample room shown ONLY on the `/songs/demo/canvas` route.
 *
 * Lives here (data layer), never in the render layer or the host component, so
 * the canvas surface owns no hardcoded card array. Fed through the board source
 * seam (canvasBoardSource) exactly like real backend rows, so dev/visual QA
 * sees a populated tree even though the dev backend returns no rows. A real
 * song is always a private, empty room until its owner adds the first idea.
 */
export const DEMO_BOARD: CanvasBoardCard[] = [
  {
    id: "hum-1", tree: "ideas", type: "hum",
    title: "First melody hum",
    body: "Soft lift into the chorus. Keep the ache in the first two notes.",
    meta: "0:12", section: "Raw idea", contributor: "Parker", status: "raw",
    accent: getCreatorColor("Parker").base, durationMs: 12000, ...ideaColumnSlot(0),
  },
  {
    id: "verse-line", tree: "ideas", type: "lyric",
    title: "Verse image",
    body: "I waited in the quiet / You painted morning gold.",
    meta: "Lyric fragment", section: "Verse 1", contributor: "Sarah", status: "shortlisted",
    accent: getCreatorColor("Sarah").base, ...ideaColumnSlot(1),
  },
  {
    id: "meaning-psalm", tree: "ideas", type: "scripture",
    title: "Meaning anchor",
    body: "Psalm 46:10 — Be still before the second verse turns upward.",
    meta: "Scripture", section: "Meaning", contributor: "Parker", status: "meaning",
    accent: getCreatorColor("Parker").base, ...ideaColumnSlot(2),
  },
  {
    id: "chorus-core", tree: "final", type: "section",
    title: "Chorus center",
    body: "You are glory in the waiting / Fire in the night.",
    meta: "Approved lyric", section: "Chorus", contributor: "Parker", status: "approved",
    accent: getCreatorColor("Parker").base, ...finalColumnSlot(0),
  },
  {
    id: "chord-bed", tree: "final", type: "chord",
    title: "Warm progression",
    body: "C - G - Am - F", meta: "Key C · 74 BPM", section: "Arrangement",
    contributor: "Caleb", status: "approved",
    accent: getCreatorColor("Caleb").base, ...finalColumnSlot(1),
  },
];
