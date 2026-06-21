/**
 * Invite API — REAL Supabase implementation.
 * Maps Claude's invite flow to Lovable's actual database schema.
 *
 * Key schema facts (from src/integrations/supabase/types.ts):
 *   table:   song_invites   (not invite_tokens)
 *   roles:   "owner" | "collaborator" | "viewer"  (no "reviewer" or "contributor")
 *   status:  "pending" | "accepted" | "revoked" | "expired"
 *   use_count (not current_uses), created_by_user_id (not created_by)
 *   accept:  accept_song_invite(_token: string, _user_id: string)  →  array result
 *   profile: profiles.display_name (single field, not first_name + last_name)
 *            profiles.phone_e164   (e164 format)
 *            profiles.user_id      (PK linking to auth.users)
 *
 * Role mapping (UI label → DB value):
 *   "Viewer"      → "viewer"
 *   "Contributor" → "collaborator"
 *   "Reviewer"    → "collaborator"  (DB has no reviewer — collapse for now)
 */

import { supabase } from '@/integrations/supabase/client';
import type { InviteContext } from './inviteContext';
import { InviteError, parseSupabaseError } from './inviteErrors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DbRole = 'owner' | 'collaborator' | 'viewer';
export type UiRole = InviteContext['assignedRole']; // 'viewer' | 'contributor' | 'reviewer'

export interface InvitePreview {
  status: 'valid';
  token: string;
  songId: string;
  songTitle: string;
  inviterFirstName: string;
  inviterLastName: string;
  inviterAvatarColor: string;
  assignedRole: UiRole;
  lyricsSnippet: string | null;
  collaborators: InviteContext['collaborators'];
  collaboratorCount: number;
  maxUses: number | null;
  currentUses: number;
}

export interface PhoneCheckResult {
  exists: boolean;
  firstName: string | null;
}

export interface AcceptResult {
  status: 'success' | 'already_member';
  songId: string;
  songTitle: string;
  role: UiRole;
}

export interface GeneratedInvite {
  tokenId: string;
  token: string;
  inviteUrl: string;
  assignedRole: string;
  maxUses: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map DB role → UI label */
export function dbRoleToUi(dbRole: string): UiRole {
  if (dbRole === 'viewer') return 'viewer';
  return 'contributor';  // owner + collaborator both map to contributor for display
}

/** Map UI label → DB role */
export function uiRoleToDb(uiRole: string): DbRole {
  if (uiRole === 'viewer') return 'viewer';
  return 'collaborator';  // contributor + reviewer both → collaborator
}

/** Aurora palette colors assigned by user_id hash */
const AVATAR_COLORS = ['#8070C4', '#4D8FD2', '#53AB8B', '#D4AE5C', '#C26A95'];
function avatarColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function avatarInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

// ─── previewInvite ────────────────────────────────────────────────────────────

/**
 * Preview an invite by token — safe before authentication.
 * Queries song_invites → songs → profiles → song_members.
 */
export async function previewInvite(token: string): Promise<InvitePreview> {
  // 1. Fetch the invite record
  const { data: invite, error: inviteErr } = await supabase
    .from('song_invites')
    .select('id, token, song_id, role, status, max_uses, use_count, created_by_user_id')
    .eq('token', token)
    .maybeSingle();

  if (inviteErr || !invite) throw new InviteError('INVITE_NOT_FOUND');
  if (invite.status === 'revoked') throw new InviteError('INVITE_REVOKED');
  if (invite.status === 'expired') throw new InviteError('INVITE_REVOKED');
  if (invite.use_count >= invite.max_uses) throw new InviteError('INVITE_EXHAUSTED');

  // Check if current user is already a member
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: existing } = await supabase
      .from('song_members')
      .select('id')
      .eq('song_id', invite.song_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) throw new InviteError('INVITE_ALREADY_MEMBER');
  }

  // 2. Fetch song
  const { data: song } = await supabase
    .from('songs')
    .select('id, title')
    .eq('id', invite.song_id)
    .single();

  // 3. Fetch inviter profile
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', invite.created_by_user_id)
    .maybeSingle();

  const inviterName = inviterProfile?.display_name ?? 'Someone';
  const [inviterFirst, ...inviterRest] = inviterName.split(' ');
  const inviterColor = avatarColor(invite.created_by_user_id);

  // 4. Fetch existing collaborators (max 5)
  const { data: members } = await supabase
    .from('song_members')
    .select('user_id, role, profiles!inner(display_name, avatar_url)')
    .eq('song_id', invite.song_id)
    .limit(5);

  const collaborators: InviteContext['collaborators'] = (members ?? []).map((m) => {
    const profile = (m as { profiles?: { display_name?: string } }).profiles;
    const name = profile?.display_name ?? 'Unknown';
    return {
      userId: m.user_id,
      firstName: name.split(' ')[0] ?? name,
      lastName: name.split(' ').slice(1).join(' '),
      avatarColor: avatarColor(m.user_id),
      avatarInitials: avatarInitials(name),
    };
  });

  return {
    status: 'valid',
    token,
    songId: song?.id ?? invite.song_id,
    songTitle: song?.title ?? 'Untitled Song',
    inviterFirstName: inviterFirst ?? inviterName,
    inviterLastName: inviterRest.join(' '),
    inviterAvatarColor: inviterColor,
    assignedRole: dbRoleToUi(invite.role),
    lyricsSnippet: null,  // Lovable schema has no lyrics_snippet on songs — fetch separately if needed
    collaborators,
    collaboratorCount: members?.length ?? 0,
    maxUses: invite.max_uses,
    currentUses: invite.use_count,
  };
}

// ─── checkPhoneRegistered ─────────────────────────────────────────────────────

/**
 * Check if a phone number already has a COG profile.
 * Queries profiles.phone_e164.
 */
export async function checkPhoneRegistered(e164: string): Promise<PhoneCheckResult> {
  const { data } = await supabase.rpc('check_phone_registered', { _phone: e164 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { exists: false, firstName: null };

  const firstName = row.display_name?.split(' ')[0] ?? null;
  return { exists: true, firstName };
}

// ─── acceptInvite ─────────────────────────────────────────────────────────────

/**
 * Accept an invite — calls Lovable's accept_song_invite RPC.
 * Signature: accept_song_invite(_token: string, _user_id: string)
 * Returns an ARRAY: { already_member, code, role, song_id }[]
 */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new InviteError('UNAUTHENTICATED');

  const { data, error } = await supabase.rpc('accept_song_invite', {
    _token: token,
    _user_id: user.id,
  });

  if (error) throw new InviteError(parseSupabaseError(error));

  // RPC returns an array — take the first element
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new InviteError('ACCEPT_FAILED');

  // Fetch song title for the result
  const { data: song } = await supabase
    .from('songs')
    .select('title')
    .eq('id', result.song_id)
    .maybeSingle();

  // Update onboarding step if first collaborator invite interaction
  updateOnboardingStep('first_collaborator_invited').catch(() => {});

  return {
    status: result.already_member ? 'already_member' : 'success',
    songId: result.song_id,
    songTitle: song?.title ?? 'the song',
    role: dbRoleToUi(result.role),
  };
}

// ─── saveName ────────────────────────────────────────────────────────────────

/**
 * Save display name to the user's profile.
 * Lovable uses display_name (single field), not first_name + last_name.
 */
export async function saveName(firstName: string, lastName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new InviteError('UNAUTHENTICATED');

  const displayName = `${firstName} ${lastName}`.trim();

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) throw new Error(`Failed to save name: ${error.message}`);
}

// ─── generateInviteToken ──────────────────────────────────────────────────────

/**
 * Generate an invite token — inserts into song_invites.
 * No RPC exists, so we INSERT directly.
 */
export async function generateInviteToken(
  songId: string,
  uiRole: string,
  maxUses: number
): Promise<GeneratedInvite> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new InviteError('UNAUTHENTICATED');

  const dbRole = uiRoleToDb(uiRole);

  // Generate a URL-safe random token
  const tokenBytes = new Uint8Array(18);
  crypto.getRandomValues(tokenBytes);
  const token = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const { data, error } = await supabase
    .from('song_invites')
    .insert({
      token,
      song_id: songId,
      created_by_user_id: user.id,
      role: dbRole,
      max_uses: maxUses,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create invite: ${error.message}`);

  return {
    tokenId: data.id,
    token,
    inviteUrl: `https://colorsofglory.app/join/${token}`,
    assignedRole: uiRole,
    maxUses,
  };
}

// ─── sendInvite ───────────────────────────────────────────────────────────────

export type InviteChannel = 'sms' | 'email';

export interface SendInviteResult {
  tokenId: string;
  token: string;
  inviteUrl: string;
  channel: InviteChannel;
  /** false → backend delivery unavailable; caller should fall back to copy/share. */
  delivered: boolean;
}

/** Loose contact classifier: anything with "@" is an email, else treated as a phone. */
export function classifyContact(contact: string): InviteChannel {
  return contact.includes('@') ? 'email' : 'sms';
}

/**
 * Send an invite directly to a person (the growth loop).
 *
 * Creates a single-use invite row, then asks the backend to deliver it. Delivery
 * itself (Twilio SMS / transactional email) is a Lovable edge function — this is
 * the frontend half of the contract. If the function isn't deployed yet, we
 * degrade gracefully: the invite row still exists, `delivered: false` is returned,
 * and the caller shows the copy/share link instead. No idea (or invite) is lost.
 *
 * Backend contract — edge function `send-invite`:
 *   body: { token, invite_url, channel: 'sms'|'email', to, song_id }
 *   returns: { delivered: boolean }   (sends via Twilio for sms / email provider)
 */
export async function sendInvite(
  songId: string,
  uiRole: string,
  contact: string,
): Promise<SendInviteResult> {
  const channel = classifyContact(contact);
  const to = channel === 'email' ? contact.trim().toLowerCase() : contact.replace(/\D/g, '');

  // Directed invites are single-use.
  const invite = await generateInviteToken(songId, uiRole, 1);

  try {
    const { data, error } = await supabase.functions.invoke('send-invite', {
      body: {
        token: invite.token,
        invite_url: invite.inviteUrl,
        channel,
        to,
        song_id: songId,
      },
    });
    if (error) throw error;
    const delivered = (data as { delivered?: boolean } | null)?.delivered ?? true;
    return { tokenId: invite.tokenId, token: invite.token, inviteUrl: invite.inviteUrl, channel, delivered };
  } catch {
    // Backend send not available yet — caller falls back to copy/share link.
    return { tokenId: invite.tokenId, token: invite.token, inviteUrl: invite.inviteUrl, channel, delivered: false };
  }
}

// ─── revokeInviteToken ────────────────────────────────────────────────────────

export async function revokeInviteToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('song_invites')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', tokenId);

  if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
}

// ─── requestNewInvite ─────────────────────────────────────────────────────────

/**
 * Request a new invite when a link is expired/full.
 * No table for this in Lovable's schema — currently a no-op that can be wired
 * to a notification system later.
 */
export async function requestNewInvite(token: string, phone?: string): Promise<void> {
  // Lovable schema has no invite_requests table yet.
  // Log intent for now — owner sees this via activity feed when wired.
  console.info('[invite] Request new invite for token:', token, 'phone:', phone);
}

// ─── Onboarding step updater ──────────────────────────────────────────────────

/**
 * Update the user's onboarding step — non-blocking, fire-and-forget.
 * Steps: not_started → intent_selected → ... → completed
 */
export async function updateOnboardingStep(step: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({
      onboarding_step: step as never,
      onboarding_updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
}
