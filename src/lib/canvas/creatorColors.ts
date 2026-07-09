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

// Warm-earth hues only: the locked palette forbids corporate blue/cool tones,
// and system gold (#B8953A) is RESERVED for system states (CTAs, merge ring,
// waveforms) — no collaborator hashes to it, so a gold ring always means the
// system, never a person.
export const AURORA_COLORS: Record<string, CreatorColor> = {
  clay: { base: '#C0754F', dark: '#8A4A2B', glow: 'rgba(192,117,79,0.18)',  bg: 'rgba(192,117,79,0.09)',  dim: 'rgba(192,117,79,0.35)'  },
  sage: { base: '#53AB8B', dark: '#2E7A60', glow: 'rgba(83,171,139,0.18)',  bg: 'rgba(83,171,139,0.09)',  dim: 'rgba(83,171,139,0.35)'  },
  plum: { base: '#A16E9E', dark: '#6E4470', glow: 'rgba(161,110,158,0.18)', bg: 'rgba(161,110,158,0.09)', dim: 'rgba(161,110,158,0.35)' },
  rose: { base: '#C26A95', dark: '#8A3A65', glow: 'rgba(194,106,149,0.18)', bg: 'rgba(194,106,149,0.09)', dim: 'rgba(194,106,149,0.35)' },
  moss: { base: '#8F9B5A', dark: '#5C6633', glow: 'rgba(143,155,90,0.18)',  bg: 'rgba(143,155,90,0.09)',  dim: 'rgba(143,155,90,0.35)'  },
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

// Status chip color mapping — warm tones only (no corporate blue/purple).
export const STATUS_COLORS: Record<string, { bg: string; text: string; icon?: string }> = {
  raw:         { bg: 'rgba(28,26,23,0.05)',         text: '#6B6459' },
  shortlisted: { bg: 'rgba(184,149,58,0.14)',       text: '#8A6D2A' },
  approved:    { bg: 'rgba(83,171,139,0.12)',       text: '#2E7A60',   icon: '✓' },
  review:      { bg: 'rgba(161,110,158,0.14)',      text: '#6E4470' },
  meaning:     { bg: 'rgba(212,174,92,0.12)',       text: '#A07830',   icon: '✦' },
};
