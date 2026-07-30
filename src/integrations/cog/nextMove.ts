/**
 * R51 — "The room always has one next move."
 *
 * Every other module in this folder answers a question the writer already
 * knew to ask. This one answers the question they never ask out loud:
 * *what now?*
 *
 * The room is full of doors — parts, takes, notes, people, suggestions, the
 * canvas. A first-time writer opens it and sees a workspace, not a next step.
 * `song_next_move` looks at the song's real state and returns EXACTLY ONE
 * action, never a list, never a dashboard: answer a person first, then start
 * the song, then file what's loose, then fill the emptiest part, then name it,
 * then invite someone, then offer the ending. When there is nothing worth
 * saying it returns `none` and the room stays silent.
 *
 * Read-only, membership-gated, role-aware (a viewer is never told to write).
 * No table, no counter, no streak — momentum, not gamification.
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type NextMoveKind =
  | "none"
  | "review_suggestion"
  | "first_part"
  | "file_memo"
  | "write_words"
  | "record_part"
  | "fill_part"
  | "name_song"
  | "invite"
  | "finish";

/** Where a tap should land. The UI maps these to routes/sheets — the server
 *  never knows about URLs. */
export type NextMoveTarget =
  | "suggestions"
  | "section_new"
  | "unfiled"
  | "section"
  | "title"
  | "people"
  | "finish";

export type NextMove = {
  kind: NextMoveKind;
  /** One plain sentence about the song. Absent when kind is "none". */
  headline?: string;
  /** Two or three words on the button. Always a verb. */
  action?: string;
  target_type?: NextMoveTarget;
  target_id?: string | null;
  count?: number;
};

const SILENT: NextMove = { kind: "none" };

/**
 * The single next move for this song, for this person, right now.
 *
 * Never throws for the caller's sake: a failure is indistinguishable from
 * "nothing to suggest", and a nudge is never worth an error state.
 */
export async function getNextMove(song_id: string): Promise<NextMove> {
  try {
    const { data, error } = await (supabase as any).rpc("song_next_move", {
      _song_id: song_id,
    });
    if (error) throw toCogError(error);
    return (data as NextMove) ?? SILENT;
  } catch {
    return SILENT;
  }
}

/** True when there is something worth showing. Guard the whole strip on this. */
export function hasMove(move: NextMove | null | undefined): move is NextMove {
  return !!move && move.kind !== "none" && !!move.action;
}

/**
 * A move the writer waved away should stay away for this visit only — never
 * forever (the song changes underneath them) and never across devices.
 * Key by kind + target so dismissing "Verse 2 has no words" doesn't also mute
 * "A suggested line is waiting".
 */
export function moveKey(move: NextMove): string {
  return `${move.kind}:${move.target_id ?? "-"}`;
}

const dismissed = new Set<string>();

export function dismissMove(move: NextMove): void {
  dismissed.add(moveKey(move));
}

export function isDismissed(move: NextMove): boolean {
  return dismissed.has(moveKey(move));
}

/** Clear on leaving the song, so the next visit starts honest. */
export function resetDismissals(): void {
  dismissed.clear();
}

/**
 * The move, filtered through this visit's dismissals. This is what the UI
 * should actually render from.
 */
export function visibleMove(move: NextMove | null | undefined): NextMove | null {
  if (!hasMove(move)) return null;
  return isDismissed(move) ? null : move;
}