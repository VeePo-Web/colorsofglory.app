import { getAvatarColor, getAvatarInitials } from "@/lib/invite/inviteContext";

/**
 * THE BAND SHELF's index — pure logic, no I/O.
 *
 * The band is not a table: it EMERGES from per-song memberships (research:
 * no bands/teams entity exists in the backend). These functions turn raw
 * `song_members` + `profiles` rows into the two things the library needs:
 * who my people are (the face chips) and which songs each person is part of
 * (the filter). Kept pure so the rules are unit-testable without Supabase.
 */

export interface BandMemberRow {
  song_id: string;
  user_id: string;
  role: string;
}

export interface BandProfileRow {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  avatar_color: string | null;
}

export interface BandPerson {
  userId: string;
  /** Full display name — "Sarah Levine". */
  name: string;
  /** What the chip says — first name only, the band's own register. */
  firstName: string;
  avatarColor: string;
  initials: string;
  /** How many of MY songs this person is part of. */
  songCount: number;
}

export interface BandIndex {
  /** songId → member userIds (includes me — membership truth, unfiltered). */
  membersBySong: Map<string, Set<string>>;
  /** Everyone in my songs EXCEPT me, most-shared first then alphabetical. */
  people: BandPerson[];
}

/** Join member rows to profile rows client-side (NEVER the `profiles!inner`
 *  embed — song_members has no FK to profiles, the embed silently fails). */
export function buildBandIndex(
  memberRows: BandMemberRow[],
  profileRows: BandProfileRow[],
  myUserId: string | null,
): BandIndex {
  const profileById = new Map(profileRows.map((p) => [p.user_id, p]));
  const membersBySong = new Map<string, Set<string>>();
  const songCounts = new Map<string, number>();

  for (const row of memberRows) {
    let set = membersBySong.get(row.song_id);
    if (!set) {
      set = new Set();
      membersBySong.set(row.song_id, set);
    }
    if (!set.has(row.user_id)) {
      set.add(row.user_id);
      if (row.user_id !== myUserId) {
        songCounts.set(row.user_id, (songCounts.get(row.user_id) ?? 0) + 1);
      }
    }
  }

  const people: BandPerson[] = [...songCounts.entries()].map(([userId, songCount]) => {
    const profile = profileById.get(userId);
    const name = (profile?.display_name ?? "").trim() || "Someone";
    const firstName = (profile?.first_name ?? "").trim() || name.split(/\s+/)[0] || "Someone";
    const parts = name.split(/\s+/);
    return {
      userId,
      name,
      firstName,
      avatarColor: profile?.avatar_color || getAvatarColor(userId),
      initials: getAvatarInitials(parts[0] ?? firstName, parts.slice(1).join(" ")),
      songCount,
    };
  });

  // Most-shared people first (your closest co-writers), ties alphabetical —
  // a stable order so the chips never reshuffle underfoot.
  people.sort((a, b) => b.songCount - a.songCount || a.firstName.localeCompare(b.firstName));

  return { membersBySong, people };
}

/**
 * AND semantics: the songs EVERY selected person is part of — "the songs
 * Craig and Parker wrote together". One selection = that person's songs.
 */
export function songMatchesPeople(
  songId: string,
  selectedUserIds: string[],
  membersBySong: BandIndex["membersBySong"],
): boolean {
  if (selectedUserIds.length === 0) return true;
  const members = membersBySong.get(songId);
  if (!members) return false;
  return selectedUserIds.every((id) => members.has(id));
}

/**
 * The face row earns its place only when the library actually holds a band:
 * at least one other person. A solo writer never sees band chrome (the
 * library's calm-gating law).
 */
export function shouldShowPeopleRow(people: BandPerson[]): boolean {
  return people.length >= 1;
}

/** "Sarah" / "Sarah & Caleb" / "Sarah, Caleb & Parker" — the filtered-state header. */
export function peopleFilterLabel(selected: BandPerson[]): string {
  const names = selected.map((p) => p.firstName);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
