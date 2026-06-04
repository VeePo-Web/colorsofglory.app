/**
 * Invite API layer.
 * MOCK MODE: all functions return realistic fake data with simulated latency.
 * When Lovable delivers the Supabase backend, swap each mock for the real call.
 * Swap pattern: replace the body of each function with the supabase.rpc() call
 * documented in docs/LOVABLE-INVITE-BACKEND-PROMPT.md.
 */

import type { InviteContext } from './inviteContext';
import { InviteError } from './inviteErrors';

// ─── Toggle ──────────────────────────────────────────────────────────────────
const USE_MOCK = true; // ← set to false when Lovable backend is ready

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvitePreview {
  status: 'valid';
  token: string;
  songId: string;
  songTitle: string;
  inviterFirstName: string;
  inviterLastName: string;
  inviterAvatarColor: string;
  assignedRole: InviteContext['assignedRole'];
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
  role: InviteContext['assignedRole'];
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_COLLABORATORS: InviteContext['collaborators'] = [
  { userId: 'u1', firstName: 'Parker',  lastName: 'Kim',    avatarColor: '#D4AE5C', avatarInitials: 'PK' },
  { userId: 'u2', firstName: 'Sarah',   lastName: 'Miller', avatarColor: '#53AB8B', avatarInitials: 'SM' },
  { userId: 'u3', firstName: 'Caleb',   lastName: 'Rivera', avatarColor: '#8070C4', avatarInitials: 'CR' },
];

const MOCK_LYRICS_SNIPPET =
  "Lord, I wait for You...\nIn this stillness, I find my strength.\nGrace in the waiting, peace in the storm.";

// ─── API functions ─────────────────────────────────────────────────────────────

/**
 * Preview an invite by token — safe to call before authentication.
 * Throws InviteError on invalid/expired/capacity tokens.
 *
 * REAL: await supabase.rpc('preview_invite', { p_token: token })
 */
export async function previewInvite(token: string): Promise<InvitePreview> {
  if (USE_MOCK) {
    await delay(700);
    // Special test tokens for error states
    if (token === 'expired' || token === 'revoked')  throw new InviteError('INVITE_REVOKED');
    if (token === 'full')                             throw new InviteError('INVITE_EXHAUSTED');
    if (token === 'invalid')                          throw new InviteError('INVITE_NOT_FOUND');
    if (token === 'joined')                           throw new InviteError('INVITE_ALREADY_MEMBER');
    // All other tokens → valid invite
    return {
      status: 'valid',
      token,
      songId: '1',
      songTitle: 'Grace in the Waiting',
      inviterFirstName: 'Parker',
      inviterLastName: 'Kim',
      inviterAvatarColor: '#D4AE5C',
      assignedRole: 'contributor',
      lyricsSnippet: MOCK_LYRICS_SNIPPET,
      collaborators: MOCK_COLLABORATORS,
      collaboratorCount: MOCK_COLLABORATORS.length,
      maxUses: 5,
      currentUses: 2,
    };
  }

  // ── REAL (uncomment when Lovable backend is ready) ──────────────────────────
  // const { data, error } = await supabase.rpc('preview_invite', { p_token: token });
  // if (error) throw new InviteError(parseSupabaseError(error));
  // if (data.status === 'error' || data.status === 'invalid') throw new InviteError(data.error_code);
  // if (data.status === 'already_member') throw new InviteError('INVITE_ALREADY_MEMBER');
  // return data as InvitePreview;
  throw new Error('Real backend not yet available');
}

/**
 * Check if a phone number already has a COG account.
 * Used to detect existing users and show the 1-tap "Welcome back" path.
 *
 * REAL: await supabase.rpc('check_phone_registered', { p_phone: e164 })
 */
export async function checkPhoneRegistered(e164: string): Promise<PhoneCheckResult> {
  if (USE_MOCK) {
    await delay(300);
    // Simulate existing user for a specific number
    if (e164 === '+15555550001') return { exists: true, firstName: 'Parker' };
    return { exists: false, firstName: null };
  }

  // ── REAL ────────────────────────────────────────────────────────────────────
  // const { data, error } = await supabase.rpc('check_phone_registered', { p_phone: e164 });
  // if (error) return { exists: false, firstName: null };
  // return data as PhoneCheckResult;
  throw new Error('Real backend not yet available');
}

/**
 * Accept an invite — atomically joins the song and logs the activity.
 * Must be called after the user is authenticated.
 *
 * REAL: await supabase.rpc('accept_invite', { p_token: token })
 */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  if (USE_MOCK) {
    await delay(500);
    return {
      status: 'success',
      songId: '1',
      songTitle: 'Grace in the Waiting',
      role: 'contributor',
    };
  }

  // ── REAL ────────────────────────────────────────────────────────────────────
  // const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  // if (error) throw new InviteError(parseSupabaseError(error));
  // return data as AcceptResult;
  throw new Error('Real backend not yet available');
}

/**
 * Save first + last name to the user's profile after accepting.
 *
 * REAL: await supabase.from('profiles').upsert({ id: userId, first_name, last_name })
 */
export async function saveName(firstName: string, lastName: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300);
    return;
  }

  // ── REAL ────────────────────────────────────────────────────────────────────
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) throw new InviteError('UNAUTHENTICATED');
  // const { error } = await supabase.from('profiles').upsert({
  //   id: user.id, first_name: firstName, last_name: lastName, updated_at: new Date().toISOString()
  // });
  // if (error) throw new Error('Failed to save name');
}

/**
 * Request a new invite from the song owner when the link is expired/full.
 *
 * REAL: await supabase.rpc('request_new_invite', { p_token: token, p_phone: phone })
 */
export async function requestNewInvite(token: string, phone?: string): Promise<void> {
  if (USE_MOCK) {
    await delay(400);
    return;
  }

  // ── REAL ────────────────────────────────────────────────────────────────────
  // await supabase.rpc('request_new_invite', { p_token: token, p_phone: phone ?? null });
}
