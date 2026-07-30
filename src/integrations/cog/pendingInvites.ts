/**
 * THE INVITE NOBODY ANSWERED (R48).
 *
 * An invitation that goes unanswered is invisible today: the sender assumes the
 * person is in the room, the person never got the link, and the song quietly
 * stays a solo project. This module surfaces the waiting invitations and gives
 * one calm way to follow up — without sending anything the writer didn't ask for.
 *
 * Pure data-access + pure helpers. No React, no toast, no UI.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";
import type { Database } from "@/integrations/supabase/types";

export type SongRole = Database["public"]["Enums"]["song_member_role"];

export type PendingInvite = {
  id: string;
  token: string;
  invited_email: string | null;
  invited_phone: string | null;
  role: SongRole;
  created_by_user_id: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
  waiting_days: number;
};

/** Everyone invited to this song who hasn't walked in yet. Newest first. */
export async function fetchPendingInvites(songId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase.rpc("song_pending_invites", { _song_id: songId });
  if (error) throw toCogError(error);
  return (data ?? []) as PendingInvite[];
}

/**
 * Give an invitation fresh life — the same link keeps working for another two
 * weeks. Once per day per invitation; a second attempt throws `nudged_recently`.
 */
export async function nudgeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("nudge_song_invite", { _invite_id: inviteId });
  if (error) throw toCogError(error);
}

/** Was this nudged too recently? Used to render the button as already-done. */
export function isNudgeCooldown(err: unknown): boolean {
  return String((err as { message?: string })?.message ?? "").includes("nudged_recently");
}

/** Who the invite is for, in the shortest honest form. */
export function inviteWho(invite: PendingInvite): string {
  return invite.invited_email ?? invite.invited_phone ?? "someone";
}

/** The one line under a pending row: "Invited 6 days ago · hasn't opened it yet". */
export function waitingLine(invite: PendingInvite): string {
  const days = invite.waiting_days;
  const when =
    days <= 0 ? "Invited today" : days === 1 ? "Invited yesterday" : `Invited ${days} days ago`;
  return invite.is_expired ? `${when} · the link has run out` : `${when} · not opened yet`;
}

/** The shareable link for an invite token — for "copy link" / native share. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/** Only invitations that are stale enough to be worth mentioning. */
export function worthFollowingUp(invites: PendingInvite[]): PendingInvite[] {
  return invites.filter((i) => i.is_expired || i.waiting_days >= 3);
}
