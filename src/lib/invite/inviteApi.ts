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
import { call, CogError } from '@/integrations/cog/errors';
import { pendingInviteToken } from '@/lib/onboarding/onboardingStep';
import type { InviteContext } from './inviteContext';
import { InviteError, parseSupabaseError, type InviteErrorCode } from './inviteErrors';

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
  /** Uses left on the link, from the server. Null when the server didn't say. */
  usesRemaining: number | null;
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

// ─── Edge-function error bridge ──────────────────────────────────────────────

/**
 * Map a failed edge-function call (CogError) onto the invite flow's own error
 * language. `fallback` is the code for anything non-semantic (a 500, a shape
 * surprise): ACCEPT_FAILED renders as a calm "Something went wrong · Try
 * again", which is the honest affordance for a transient server error too.
 */
function toInviteError(err: unknown, fallback: InviteErrorCode = 'ACCEPT_FAILED'): InviteError {
  if (err instanceof InviteError) return err;
  if (err instanceof CogError) {
    switch (err.code) {
      case 'INVITE_NOT_FOUND': return new InviteError('INVITE_NOT_FOUND');
      case 'INVITE_EXPIRED': return new InviteError('INVITE_EXPIRED');
      case 'INVITE_ALREADY_USED':
      case 'INVITE_EXHAUSTED': return new InviteError('INVITE_EXHAUSTED');
      case 'UNAUTHENTICATED': return new InviteError('UNAUTHENTICATED');
      case 'OFFLINE': return new InviteError('NETWORK_ERROR');
      case 'INVALID_INPUT': return new InviteError('INVITE_NOT_FOUND');
    }
    if (err.code === 'INVITE_REVOKED') return new InviteError('INVITE_REVOKED');
  }
  return new InviteError(parseSupabaseError(err) === 'ACCEPT_FAILED' ? fallback : parseSupabaseError(err));
}

// ─── previewInvite ────────────────────────────────────────────────────────────

/** Shape of the song-invite-preview edge function's `data` payload. */
type EdgePreviewData = {
  song_id: string;
  song_title: string | null;
  lyrics_snippet: string | null;
  inviter_name: string | null;
  inviter_first_name: string | null;
  inviter_avatar_color: string | null;
  role: string;
  collaborator_count: number;
  collaborators: Array<{
    user_id: string;
    role: string;
    first_name: string | null;
    avatar_color: string | null;
    initials: string | null;
  }>;
  expires_at: string;
  uses_remaining: number | null;
};

/**
 * Preview an invite by token — safe before authentication.
 *
 * Goes through the `song-invite-preview` edge function (service role), because
 * RLS correctly hides songs/profiles/members from anon AND hides the invite row
 * itself from a signed-in non-member — the exact person this screen exists for.
 * The direct-table read this replaced could never show the song's name to the
 * people being invited into it.
 */
export async function previewInvite(token: string): Promise<InvitePreview> {
  let d: EdgePreviewData;
  try {
    d = await call<EdgePreviewData>('song-invite-preview', { token });
  } catch (err) {
    throw toInviteError(err, 'NETWORK_ERROR');
  }

  // Already in this song? Guide them in instead of re-joining. (A member can
  // read their own membership row under RLS; anon simply skips this.)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: existing } = await supabase
      .from('song_members')
      .select('id')
      .eq('song_id', d.song_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) throw new InviteError('INVITE_ALREADY_MEMBER');
  }

  // The preview function deliberately keeps answering for a fully-used link so
  // already-accepted people can be guided in (handled above) — for everyone
  // else, a link with nothing left is honestly "at its limit".
  if (d.uses_remaining !== null && d.uses_remaining <= 0) {
    throw new InviteError('INVITE_EXHAUSTED');
  }

  const inviterName = (d.inviter_name ?? d.inviter_first_name ?? 'Someone').trim();
  const [inviterFirst, ...inviterRest] = inviterName.split(/\s+/);

  const collaborators: InviteContext['collaborators'] = (d.collaborators ?? []).map((m) => ({
    userId: m.user_id,
    firstName: m.first_name ?? 'Someone',
    lastName: '',
    avatarColor: m.avatar_color ?? avatarColor(m.user_id),
    avatarInitials: m.initials ?? avatarInitials(m.first_name ?? '·'),
  }));

  return {
    status: 'valid',
    token,
    songId: d.song_id,
    songTitle: d.song_title ?? 'Untitled Song',
    inviterFirstName: d.inviter_first_name ?? inviterFirst ?? 'Someone',
    inviterLastName: inviterRest.join(' '),
    inviterAvatarColor: d.inviter_avatar_color ?? avatarColor(inviterName),
    assignedRole: dbRoleToUi(d.role),
    lyricsSnippet: d.lyrics_snippet,
    collaborators,
    collaboratorCount: d.collaborator_count ?? collaborators.length,
    usesRemaining: d.uses_remaining,
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
 * Accept an invite — through the `song-invite-accept` edge function, never the
 * raw RPC. The edge function is the version of this act that closes the loop:
 * it writes the `invite_accepted` activity event and sends the inviter their
 * "someone stepped into your song" email — and it returns failures as real
 * error codes instead of the RPC's in-band rows, so a dead link can never
 * masquerade as success.
 */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  let result: { song_id: string; role: string; already_member: boolean };
  try {
    result = await call<{ song_id: string; role: string; already_member: boolean }>(
      'song-invite-accept',
      { token },
    );
  } catch (err) {
    throw toInviteError(err);
  }
  if (!result?.song_id) throw new InviteError('ACCEPT_FAILED');

  // The invite is consumed — a later re-auth in this tab must not detour
  // through it again.
  pendingInviteToken.clear();

  // Fetch song title for the result (we are a member now).
  const { data: song } = await supabase
    .from('songs')
    .select('title')
    .eq('id', result.song_id)
    .maybeSingle();

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

/** The link for a token, on THIS environment — preview/staging links must
 *  never quietly exit into production. */
function inviteUrlFor(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://colorsofglory.app';
  return `${origin}/join/${token}`;
}

/**
 * The song's standing invite link — ONE key per song per role.
 *
 * Reuses the newest still-valid link the owner already made before minting a
 * new one, so re-opening the share sheet hands out the same door key instead
 * of silently accumulating live, unlisted tokens. Falls through to minting
 * when none exists (or the reuse lookup fails for any reason).
 */
export async function generateInviteToken(
  songId: string,
  uiRole: string,
  maxUses: number
): Promise<GeneratedInvite> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new InviteError('UNAUTHENTICATED');

  const dbRole = uiRoleToDb(uiRole);

  try {
    const { data: existing } = await supabase
      .from('song_invites')
      .select('id, token, max_uses, use_count, expires_at')
      .eq('song_id', songId)
      .eq('role', dbRole)
      .eq('created_by_user_id', user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && (existing.use_count ?? 0) < (existing.max_uses ?? 0)) {
      return {
        tokenId: existing.id,
        token: existing.token,
        inviteUrl: inviteUrlFor(existing.token),
        assignedRole: uiRole,
        maxUses: existing.max_uses,
      };
    }
  } catch {
    // Reuse is an optimization, never a blocker — mint a fresh link below.
  }

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
    inviteUrl: inviteUrlFor(token),
    assignedRole: uiRole,
    maxUses,
  };
}

// ─── Onboarding step updater ──────────────────────────────────────────────────

/**
 * Canonical onboarding step order. Mirrors the DB `onboarding_step` enum and
 * lets us advance monotonically without an extra RPC round-trip.
 * `dismissed` is treated as terminal (never auto-advanced past).
 */
const ONBOARDING_STEP_ORDER = [
  'not_started',
  'intent_selected',
  'referral_program_seen',
  'founder_code_seen',
  'first_song_created',
  'first_idea_captured',
  'first_voice_memo_added',
  'first_lyrics_added',
  'first_collaborator_invited',
  'completed',
] as const;

function stepRank(step: string | null | undefined): number {
  if (step === 'dismissed') return Number.MAX_SAFE_INTEGER;
  const i = ONBOARDING_STEP_ORDER.indexOf(step as (typeof ONBOARDING_STEP_ORDER)[number]);
  return i === -1 ? 0 : i;
}

/**
 * Advance the user's onboarding step — non-blocking, fire-and-forget, and
 * **monotonic**: it never regresses a returning user to an earlier step, so the
 * post-auth resume router always reflects the furthest point they reached.
 * Steps: not_started → intent_selected → ... → completed
 */
export async function updateOnboardingStep(step: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Read current step and only move forward.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_step')
    .eq('user_id', user.id)
    .maybeSingle();

  if (stepRank(step) <= stepRank(profile?.onboarding_step)) return;

  await supabase
    .from('profiles')
    .update({
      onboarding_step: step as never,
      onboarding_updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
}
