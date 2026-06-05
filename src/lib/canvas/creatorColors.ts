/**
 * Aurora Creator Color System
 * Each collaborator gets a deterministic color from the COG mark's aurora palette.
 * The same userId ALWAYS produces the same color — no randomness at runtime.
 */

export interface CreatorColor {
  base: string;   // full color — border, icon, creator dot
  dark: string;   // darkened — readable text on white
  glow: string;   // 18% opacity — box-shadow
  bg: string;     // 9% opacity — icon background, chip background
  dim: string;    // 35% opacity — dimmed border
}

export const AURORA_COLORS: Record<string, CreatorColor> = {
  gold:   { base: '#D4AE5C', dark: '#A07830', glow: 'rgba(212,174,92,0.18)',  bg: 'rgba(212,174,92,0.09)',  dim: 'rgba(212,174,92,0.35)'  },
  teal:   { base: '#53AB8B', dark: '#2E7A60', glow: 'rgba(83,171,139,0.18)',  bg: 'rgba(83,171,139,0.09)',  dim: 'rgba(83,171,139,0.35)'  },
  purple: { base: '#8070C4', dark: '#5040A0', glow: 'rgba(128,112,196,0.18)', bg: 'rgba(128,112,196,0.09)', dim: 'rgba(128,112,196,0.35)' },
  blue:   { base: '#4D8FD2', dark: '#2A5EA0', glow: 'rgba(77,143,210,0.18)',  bg: 'rgba(77,143,210,0.09)',  dim: 'rgba(77,143,210,0.35)'  },
  rose:   { base: '#C26A95', dark: '#8A3A65', glow: 'rgba(194,106,149,0.18)', bg: 'rgba(194,106,149,0.09)', dim: 'rgba(194,106,149,0.35)' },
} as const;

const COLOR_KEYS = Object.keys(AURORA_COLORS);

/** Returns a deterministic aurora color for a userId or display name. */
export function getCreatorColor(userIdOrName: string): CreatorColor {
  let hash = 0;
  for (let i = 0; i < userIdOrName.length; i++) {
    hash = userIdOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AURORA_COLORS[COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length]];
}

/** Get initials from a display name ("Parker Kim" → "PK", "Parker" → "PA") */
export function getCreatorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Status chip color mapping
export const STATUS_COLORS: Record<string, { bg: string; text: string; icon?: string }> = {
  raw:         { bg: 'rgba(0,0,0,0.05)',            text: '#999' },
  shortlisted: { bg: 'rgba(77,143,210,0.12)',       text: '#2A5EA0' },
  approved:    { bg: 'rgba(83,171,139,0.12)',       text: '#2E7A60',   icon: '✓' },
  review:      { bg: 'rgba(128,112,196,0.12)',      text: '#5040A0' },
  meaning:     { bg: 'rgba(212,174,92,0.12)',       text: '#A07830',   icon: '✦' },
};
