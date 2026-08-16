/**
 * Album colors — Drive's folder-color law: your eye finds "the red one"
 * faster than reading. Eight muted, warm swatches chosen to sit quietly on
 * the cream sanctuary (never neon, never the brand gold — gold means action
 * and newness everywhere else in the library, so an album can't wear it as
 * identity). Stored on the album as a semantic KEY, never a raw value, so
 * the palette can be tuned here without migrating anyone's saved albums.
 *
 * Like a song's `cover_color` and a person's `avatarColor`, these are
 * content-identity colors (data), not interface chrome — the one place raw
 * values are correct, kept in this single seam.
 */
export interface AlbumColor {
  /** Persisted on the album — stable forever. */
  key: string;
  /** The simple word a child would say. Used in aria labels. */
  label: string;
  /** The saturated identity hue — icons, chips, the rail tint. */
  swatch: string;
  /** The pale field the cover wears — legible under charcoal text. */
  tint: string;
}

export const ALBUM_COLORS: AlbumColor[] = [
  { key: "honey", label: "Honey", swatch: "#C9A961", tint: "#F0E7CE" },
  { key: "clay",  label: "Clay",  swatch: "#B87A5C", tint: "#EFDFD5" },
  { key: "rose",  label: "Rose",  swatch: "#B5838D", tint: "#EFDFE2" },
  { key: "plum",  label: "Plum",  swatch: "#8E7397", tint: "#E6DFE9" },
  { key: "sky",   label: "Sky",   swatch: "#7189A0", tint: "#DEE5EB" },
  { key: "sage",  label: "Sage",  swatch: "#7D9471", tint: "#E1E8DC" },
  { key: "olive", label: "Olive", swatch: "#9A9260", tint: "#E9E6D3" },
  { key: "stone", label: "Stone", swatch: "#8C8577", tint: "#E7E4DF" },
];

const byKey = new Map(ALBUM_COLORS.map((c) => [c.key, c]));

/** Resolve a stored key to its color; unknown/absent → null (the mosaic cover stands). */
export function albumColor(key: string | null | undefined): AlbumColor | null {
  if (!key) return null;
  return byKey.get(key) ?? null;
}
