import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";
import { type SongMemberRole } from "./songs";

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
  if (error) throw toCogError(error);
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
  if (error) throw toCogError(error);
  return (data as SongMemberRole | null) ?? null;
}
/* ── R18: People board + membership management ─────────────────────── */

export type PendingInvite = {
  id: string;
  role: SongMemberRole;
  invited_email: string | null;
  invited_phone: string | null;
  created_at: string;
  expires_at: string;
  use_count: number;
  max_uses: number;
};

export type PeopleBoardMember = SongMember & {
  is_me: boolean;
  last_seen_at: string | null;
  contribution_count: number;
};

export type PeopleBoard = {
  my_role: SongMemberRole;
  can_manage: boolean;
  members: PeopleBoardMember[];
  pending_invites: PendingInvite[];
};

/** Everyone in the song + (owner only) invites still waiting. One request. */
export async function getPeopleBoard(songId: string): Promise<PeopleBoard> {
  const { data, error } = await supabase.rpc("song_people_board", { _song_id: songId });
  if (error) throw toCogError(error);
  const raw = (data ?? {}) as Record<string, unknown>;
  const members = ((raw.members ?? []) as Array<Record<string, unknown>>).map((row) => ({
    user_id: row.user_id as string,
    role: row.role as SongMemberRole,
    joined_at: row.joined_at as string,
    display_name: (row.display_name as string | null) ?? null,
    first_name: (row.first_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    avatar_color: (row.avatar_color as string | null) ?? null,
    initials: initialsFrom(row.display_name as string | null, row.first_name as string | null),
    is_me: Boolean(row.is_me),
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    contribution_count: Number(row.contribution_count ?? 0),
  }));
  return {
    my_role: raw.my_role as SongMemberRole,
    can_manage: Boolean(raw.can_manage),
    members,
    pending_invites: (raw.pending_invites ?? []) as PendingInvite[],
  };
}

/** Owner only. Move a member between 'collaborator' and 'viewer'. */
export async function setMemberRole(
  songId: string,
  userId: string,
  role: Exclude<SongMemberRole, "owner">,
): Promise<void> {
  const { error } = await supabase.rpc("set_song_member_role", {
    _song_id: songId,
    _user_id: userId,
    _role: role,
  });
  if (error) throw toCogError(error);
}

/** Owner removes a collaborator, or a member removes themselves. */
export async function removeMember(songId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_song_member", {
    _song_id: songId,
    _user_id: userId,
  });
  if (error) throw toCogError(error);
}

/** Owner only. Cancel an invite that hasn't been accepted yet. */
export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_song_invite", { _invite_id: inviteId });
  if (error) throw toCogError(error);
}
