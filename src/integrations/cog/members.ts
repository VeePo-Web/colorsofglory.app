import { supabase } from "@/integrations/supabase/client";
import { CogError, type SongMemberRole } from "./songs";

export type SongMember = {
  user_id: string;
  role: SongMemberRole;
  joined_at: string;
  display_name: string | null;
  first_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  initials: string;
};

function initialsFrom(name: string | null, firstName: string | null): string {
  const source = (name ?? firstName ?? "").trim();
  if (!source) return "•";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "•";
}

/** All members of a song. Caller must be a member; otherwise returns []. */
export async function listMembers(songId: string): Promise<SongMember[]> {
  const { data, error } = await supabase.rpc("list_song_members", { _song_id: songId });
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    user_id: row.user_id as string,
    role: row.role as SongMemberRole,
    joined_at: row.joined_at as string,
    display_name: (row.display_name as string | null) ?? null,
    first_name: (row.first_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    avatar_color: (row.avatar_color as string | null) ?? null,
    initials: initialsFrom(
      row.display_name as string | null,
      row.first_name as string | null,
    ),
  }));
}

/** Signed-in user's role in a song, or null if not a member. */
export async function myRole(songId: string): Promise<SongMemberRole | null> {
  const { data, error } = await supabase.rpc("my_song_role", { _song_id: songId });
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return (data as SongMemberRole | null) ?? null;
}