export type InviteErrorCode =
  | 'INVITE_NOT_FOUND'
  | 'INVITE_REVOKED'
  | 'INVITE_EXHAUSTED'
  | 'INVITE_ALREADY_MEMBER'
  | 'ACCEPT_FAILED'
  | 'NETWORK_ERROR'
  | 'UNAUTHENTICATED';

export interface InviteErrorMeta {
  headline: string;
  body: string | null;
  ctaLabel: string;
  ctaAction: 'request_new' | 'open_song' | 'go_home' | 'retry';
  showInviterName: boolean; // true → replace "the owner" with inviter's first name in copy
}

export const INVITE_ERROR_META: Record<InviteErrorCode, InviteErrorMeta> = {
  INVITE_NOT_FOUND: {
    headline: "This invite link isn't valid.",
    body: "It may have been changed or removed.",
    ctaLabel: "Request a new invite",
    ctaAction: 'request_new',
    showInviterName: false,
  },
  INVITE_REVOKED: {
    headline: "This invite is no longer active.",
    body: "The link may have been removed.",
    ctaLabel: "Request new invite",
    ctaAction: 'request_new',
    showInviterName: true,
  },
  INVITE_EXHAUSTED: {
    headline: "This link has reached its limit.",
    body: "Ask for a personal invite link.",
    ctaLabel: "Request access",
    ctaAction: 'request_new',
    showInviterName: true,
  },
  INVITE_ALREADY_MEMBER: {
    headline: "You're already in this song.",
    body: null, // set dynamically: "You joined on June 2."
    ctaLabel: "Open song →",
    ctaAction: 'open_song',
    showInviterName: false,
  },
  ACCEPT_FAILED: {
    headline: "Something went wrong.",
    body: "We couldn't add you to the song. Please try again.",
    ctaLabel: "Try again",
    ctaAction: 'retry',
    showInviterName: false,
  },
  NETWORK_ERROR: {
    headline: "No connection.",
    body: "Check your internet and try again.",
    ctaLabel: "Retry",
    ctaAction: 'retry',
    showInviterName: false,
  },
  UNAUTHENTICATED: {
    headline: "Sign in to join.",
    body: "Enter your phone number to continue.",
    ctaLabel: "Continue",
    ctaAction: 'retry',
    showInviterName: false,
  },
};

export class InviteError extends Error {
  constructor(public code: InviteErrorCode) {
    super(code);
    this.name = 'InviteError';
  }
}

export function parseSupabaseError(err: unknown): InviteErrorCode {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('INVITE_NOT_FOUND')) return 'INVITE_NOT_FOUND';
  if (msg.includes('INVITE_REVOKED')) return 'INVITE_REVOKED';
  if (msg.includes('INVITE_EXHAUSTED')) return 'INVITE_EXHAUSTED';
  if (msg.includes('INVITE_ALREADY_MEMBER')) return 'INVITE_ALREADY_MEMBER';
  if (msg.includes('UNAUTHENTICATED')) return 'UNAUTHENTICATED';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch'))
    return 'NETWORK_ERROR';
  return 'ACCEPT_FAILED';
}
