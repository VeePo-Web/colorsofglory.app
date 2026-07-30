/**
 * R59 — The room has two surfaces.
 *
 * The spec lists ten routes under /song/:id (lyrics, voice, notes, people,
 * versions, activity, credits, canvas...). Ten destinations is nine chances
 * to be lost. Everything the room does is either "the song as it stands" or
 * "the ideas around it" — so the room is exactly two surfaces, and every
 * other concept opens *in place* over whichever one you are on.
 *
 * This module is the single source of truth for that. Any UI that wants to
 * take the user somewhere asks here; if a destination isn't in this file, it
 * doesn't exist.
 */

/** The only two things you can *be on*. */
export type RoomSurface = "song" | "ideas";

/** The only things that can *open over* a surface. Sheets, never pages. */
export type RoomOverlay =
  | "people"        // who's here + invite
  | "history"       // versions + recently removed, one timeline
  | "credits"
  | "share"
  | "search"
  | "settings";     // key, tempo, title, finish, duplicate

export type RoomDestination =
  | { surface: RoomSurface; sectionId?: string; takeId?: string; overlay?: never }
  | { overlay: RoomOverlay; surface?: never };

export const ROOM_SURFACES: ReadonlyArray<{ id: RoomSurface; label: string }> = [
  { id: "song", label: "Song" },
  { id: "ideas", label: "Ideas" },
];

/**
 * Legacy spec routes → where they actually go now.
 * Anything mapping to an overlay must NOT be a page.
 */
const LEGACY: Record<string, RoomDestination> = {
  lyrics: { surface: "song" },
  voice: { surface: "song" },
  notes: { surface: "song" },
  chords: { surface: "song" },
  canvas: { surface: "ideas" },
  people: { overlay: "people" },
  versions: { overlay: "history" },
  activity: { overlay: "history" },
  credits: { overlay: "credits" },
};

export function resolveLegacyRoute(segment: string): RoomDestination {
  return LEGACY[segment] ?? { surface: "song" };
}

/** Canonical URL for a destination. Overlays never change the path. */
export function roomPath(songId: string, dest: RoomDestination): string {
  if (dest.overlay !== undefined) return `/song/${songId}`;
  const base = dest.surface === "ideas" ? `/song/${songId}/ideas` : `/song/${songId}`;
  if (dest.sectionId) return `${base}#s-${dest.sectionId}`;
  if (dest.takeId) return `${base}#t-${dest.takeId}`;
  return base;
}

/** Parse a path back into a destination (for restoring `song_room_state`). */
export function parseRoomPath(pathname: string, hash = ""): RoomDestination {
  const surface: RoomSurface = /\/ideas\/?$/.test(pathname) ? "ideas" : "song";
  const id = hash.replace(/^#/, "");
  if (id.startsWith("s-")) return { surface, sectionId: id.slice(2) };
  if (id.startsWith("t-")) return { surface, takeId: id.slice(2) };
  return { surface };
}

/**
 * Where a feed / activity item should take you. Every item resolves to a
 * place *inside* a surface — never to a detail page, never to a dead end.
 */
export function destinationForEvent(event: {
  entity_type: string;
  section_id?: string | null;
  take_id?: string | null;
  card_id?: string | null;
}): RoomDestination {
  if (event.card_id) return { surface: "ideas" };
  if (event.take_id) return { surface: "song", takeId: event.take_id };
  if (event.section_id) return { surface: "song", sectionId: event.section_id };
  if (event.entity_type === "member" || event.entity_type === "invite") return { overlay: "people" };
  if (event.entity_type === "version") return { overlay: "history" };
  return { surface: "song" };
}
