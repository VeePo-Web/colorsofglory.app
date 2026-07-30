/**
 * HUB data seam (R27 · "The room answers in one glance").
 *
 * The song hub screen (Lyrics · Voice · Chords · Notes · People) only needs
 * five counts, five timestamps, and a short list of things waiting for you.
 * `song_hub_board` returns exactly that in one small request — it does NOT
 * pull cards, memos or captures like `song_room_bootstrap` does.
 *
 * Use this for the hub. Use `getSongRoomBootstrap` only for the canvas.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export interface HubTile {
  updated_at: string | null;
}

export interface HubBoard {
  song: {
    id: string;
    title: string;
    status: string;
    key_signature: string | null;
    tempo_bpm: number | null;
    time_signature: string | null;
    is_locked: boolean;
    lyrics_snippet: string | null;
    dedication: string | null;
    last_activity_at: string | null;
  };
  role: "owner" | "collaborator" | "viewer" | null;
  can_write: boolean;
  lyrics: HubTile & { section_count: number; line_count: number; preview: string | null };
  voice: HubTile & { memo_count: number; take_count: number; total_duration_ms: number };
  chords: HubTile & { progression_count: number };
  notes: HubTile & { open_count: number; pinned_count: number };
  people: {
    member_count: number;
    pending_invite_count: number;
    avatars: Array<{
      user_id: string;
      display_name: string | null;
      avatar_url: string | null;
      avatar_color: string | null;
    }>;
  };
  waiting: {
    unseen_activity: number;
    open_suggestions: number;
    unfiled_captures: number;
    failed_transcripts: number;
  };
}

/** Everything the hub screen needs, in one small request. */
export async function getHubBoard(songId: string): Promise<HubBoard> {
  const { data, error } = await supabase.rpc("song_hub_board", { _song_id: songId });
  if (error) throw toCogError(error);
  return data as unknown as HubBoard;
}

/**
 * The single next thing worth doing in this room, or null when the room is calm.
 * Order is deliberate: things other people are waiting on come before your own
 * blank panels. Never return more than one — the hub shows at most one nudge.
 */
export function nextAction(board: HubBoard):
  | { kind: "suggestions" | "activity" | "captures" | "transcripts" | "lyrics" | "voice" | "people"; label: string; to: string }
  | null {
  const w = board.waiting;
  const id = board.song.id;
  if (w.open_suggestions > 0 && board.can_write)
    return { kind: "suggestions", label: `${w.open_suggestions} suggested ${w.open_suggestions === 1 ? "line" : "lines"}`, to: `/song/${id}/lyrics` };
  if (w.unseen_activity > 0)
    return { kind: "activity", label: "See what changed", to: `/song/${id}/activity` };
  if (w.unfiled_captures > 0)
    return { kind: "captures", label: `${w.unfiled_captures} ${w.unfiled_captures === 1 ? "idea" : "ideas"} to file`, to: `/song/${id}/canvas` };
  if (w.failed_transcripts > 0)
    return { kind: "transcripts", label: "A take needs another try", to: `/song/${id}/voice` };
  if (board.can_write && board.voice.take_count === 0)
    return { kind: "voice", label: "Record the first idea", to: `/song/${id}/voice` };
  if (board.can_write && board.lyrics.line_count === 0)
    return { kind: "lyrics", label: "Write the first line", to: `/song/${id}/lyrics` };
  if (board.role === "owner" && board.people.member_count <= 1)
    return { kind: "people", label: "Invite someone in", to: `/song/${id}/people` };
  return null;
}

/** "3 sections · 24 lines" style subtitles, already pluralised. */
export function tileSubtitle(board: HubBoard, tile: "lyrics" | "voice" | "chords" | "notes" | "people"): string {
  const n = (v: number, one: string, many = `${one}s`) => `${v} ${v === 1 ? one : many}`;
  switch (tile) {
    case "lyrics":
      return board.lyrics.section_count === 0 ? "Nothing written yet" : `${n(board.lyrics.section_count, "section")} · ${n(board.lyrics.line_count, "line")}`;
    case "voice":
      return board.voice.take_count === 0 ? "No takes yet" : n(board.voice.take_count, "take");
    case "chords":
      return board.chords.progression_count === 0
        ? board.song.key_signature ?? "No chords yet"
        : n(board.chords.progression_count, "progression");
    case "notes":
      return board.notes.open_count === 0 ? "All clear" : n(board.notes.open_count, "note");
    case "people":
      return board.people.pending_invite_count > 0
        ? `${n(board.people.member_count, "person", "people")} · ${board.people.pending_invite_count} invited`
        : n(board.people.member_count, "person", "people");
  }
}