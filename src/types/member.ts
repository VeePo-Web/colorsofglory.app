// Song member (collaborator) domain types.
//
// PROVENANCE: SongMember — COMPOSED read view (list_song_members RPC):
// public.song_members joined to the member's profiles row (display_name,
// first_name, avatar_*). Not a 1:1 row alias. `role` is the DB storage role
// (canonical home ./role).
import type { SongMemberRole } from "./role";

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
