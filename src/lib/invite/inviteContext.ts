/**
 * Invite context — travels through all 5 invite screens via sessionStorage.
 * Populated by previewInvite() on Screen A, enriched as user progresses.
 * Lovable replaces the mock implementations in inviteApi.ts when backend is ready.
 */

export type InviteRole = 'viewer' | 'contributor' | 'reviewer';

export interface InviteCollaborator {
  userId: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  avatarInitials: string;
}

export interface InviteContext {
  // From token lookup (Screen A)
  token: string;
  songId: string;
  songTitle: string;
  inviterFirstName: string;
  inviterLastName: string;
  inviterAvatarColor: string;
  assignedRole: InviteRole;
  lyricsSnippet: string | null;
  collaborators: InviteCollaborator[];
  collaboratorCount: number;
  maxUses: number | null;
  currentUses: number;

  // Set during the flow
  verifiedPhone: string | null;  // e164 after OTP
  userId: string | null;
  isExistingUser: boolean;
  existingFirstName: string | null;
  firstName: string | null;
  lastName: string | null;
}

const STORAGE_KEY = 'cog:invite-context';

export function saveInviteContext(updates: Partial<InviteContext>): void {
  try {
    const current = loadInviteContext() ?? ({} as InviteContext);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
  } catch {
    // storage unavailable — continue without persistence
  }
}

export function loadInviteContext(): InviteContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InviteContext) : null;
  } catch {
    return null;
  }
}

export function clearInviteContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Formats "Parker, Sarah, and Caleb" / "Parker and 2 others" from collaborator list */
export function formatCollaboratorNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length <= 4) {
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others`;
}

/** Assigns a consistent aurora palette color from user ID */
const AVATAR_COLORS = ['#8070C4', '#4D8FD2', '#53AB8B', '#D4AE5C', '#C26A95'];
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAvatarInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
