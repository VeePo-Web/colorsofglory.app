import { supabase } from "@/integrations/supabase/client";

/**
 * R31 — Hand the song to someone who isn't in the app.
 *
 * A share link is read-only: title, key/tempo, sections and lyrics, and
 * optionally the takes. It never exposes notes, people, activity, or any write
 * path. Owners create and revoke; anyone with the link can open it signed-out.
 */

export type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  include_audio: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  is_live: boolean;
};

export type ShareLinksBoard = { can_manage: boolean; links: ShareLink[] };

export type SharedSongView = {
  song: {
    title: string;
    key_signature: string | null;
    tempo_bpm: number | null;
    time_signature: string | null;
    dedication: string | null;
    updated_at: string;
  };
  owner_name: string;
  include_audio: boolean;
  sections: {
    section_id: string;
    label: string;
    kind: string;
    position: number;
    plain_text: string;
    content: unknown | null;
  }[];
  takes: {
    take_id: string;
    name: string;
    duration_ms: number | null;
    waveform_peaks: number[] | null;
    storage_path: string;
    created_at: string;
  }[];
};

export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}

export async function fetchShareLinks(songId: string): Promise<ShareLinksBoard> {
  const { data, error } = await supabase.rpc("song_share_links_board", { _song_id: songId } as never);
  if (error) {
    if (error.message.includes("not_a_member")) throw new Error("You're not in this song.");
    throw new Error("Couldn't load the share links.");
  }
  return data as unknown as ShareLinksBoard;
}

export async function createShareLink(args: {
  songId: string;
  label?: string;
  includeAudio?: boolean;
  expiresInDays?: number | null;
}): Promise<ShareLink> {
  const { data, error } = await supabase.rpc("create_song_share_link", {
    _song_id: args.songId,
    _label: args.label ?? null,
    _include_audio: args.includeAudio ?? true,
    _expires_in_days: args.expiresInDays ?? null,
  } as never);
  if (error) {
    if (error.message.includes("owner_only")) throw new Error("Only the song owner can share this song.");
    throw new Error("Couldn't create the link. Try again.");
  }
  return data as unknown as ShareLink;
}

export async function revokeShareLink(linkId: string): Promise<ShareLink> {
  const { data, error } = await supabase.rpc("revoke_song_share_link", { _link_id: linkId } as never);
  if (error) {
    if (error.message.includes("owner_only")) throw new Error("Only the song owner can turn off a link.");
    if (error.message.includes("link_not_found")) throw new Error("That link is already gone.");
    throw new Error("Couldn't turn off the link.");
  }
  return data as unknown as ShareLink;
}

export type SharedViewError = "link_not_found" | "link_revoked" | "link_expired" | "song_unavailable" | "unknown";

/** Public read — works signed out. Throws an Error whose `.message` is human copy. */
export async function fetchSharedSong(token: string): Promise<SharedSongView> {
  const { data, error } = await supabase.rpc("song_shared_view", { _token: token } as never);
  if (error) {
    const m = error.message;
    if (m.includes("link_revoked")) throw new Error("This link was turned off.");
    if (m.includes("link_expired")) throw new Error("This link has expired.");
    if (m.includes("link_not_found")) throw new Error("This link isn't valid.");
    if (m.includes("song_unavailable")) throw new Error("This song is no longer available.");
    throw new Error("Couldn't open this song.");
  }
  return data as unknown as SharedSongView;
}
