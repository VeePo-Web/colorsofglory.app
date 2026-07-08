// Invite domain types.
//
// `SongInvite` is the generated `song_invites` row; `InvitePreview` is the
// public read shape the invite-preview edge function returns for the
// "You've been invited" screen (safe subset — no private song content).
import type { Database } from "@/integrations/supabase/types";

export type SongInvite = Database["public"]["Tables"]["song_invites"]["Row"];

export type InvitePreview = {
  song_id: string;
  song_title: string;
  lyrics_snippet: string | null;
  inviter_name: string;
  inviter_first_name: string;
  inviter_avatar_color: string | null;
  role: string;
  collaborator_count: number;
  collaborators: Array<{
    user_id: string;
    role: string;
    first_name: string | null;
    avatar_color: string | null;
    initials: string;
  }>;
  expires_at: string;
  uses_remaining: number;
};
