import type { DragEvent } from "react";

/**
 * songDrag — Drive's physical filing gesture (C5): drag a song onto an album
 * and it files. Desktop-only by capability (`pointer: fine`), not by
 * viewport — an iPad with a trackpad gets it, a phone never does, and on
 * touch the DOM stays byte-identical (no draggable attribute at all).
 *
 * HTML5 drag-and-drop is the right engine here precisely because touch
 * browsers don't implement it: the gate and the mechanism are the same
 * thing. The long-press checklist remains the universal (and accessible)
 * filing path everywhere — this gesture is an accelerator, never the door.
 *
 * Filing is ADDITIVE (a song can sit on two albums, and that's just true),
 * so the drag advertises `copy` — the plus-cursor tells the truth.
 */
export const SONG_DRAG_TYPE = "application/x-cog-song";

export function isFinePointer(): boolean {
  try {
    return window.matchMedia("(pointer: fine)").matches;
  } catch {
    return false;
  }
}

/** Spread onto a song card/row button. Empty on touch — zero DOM delta. */
export function songDragProps(songId: string): {
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLElement>) => void;
} {
  if (!isFinePointer()) return {};
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData(SONG_DRAG_TYPE, songId);
      e.dataTransfer.effectAllowed = "copy";
    },
  };
}

/** True while a song (and only a song) is being dragged over — the only
 *  signal available during dragover, when payloads can't be read yet. */
export function dragHasSong(e: { dataTransfer: { types: readonly string[] } }): boolean {
  return Array.from(e.dataTransfer.types).includes(SONG_DRAG_TYPE);
}

/** The dropped song id, at drop time. Null for foreign drags (files, text). */
export function readDraggedSong(e: { dataTransfer: { getData: (t: string) => string } }): string | null {
  const id = e.dataTransfer.getData(SONG_DRAG_TYPE);
  return id || null;
}
