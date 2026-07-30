/**
 * R41 — "Two people, one section."
 *
 * The room already knows WHO is here (`subscribeSongPresence`) and it already
 * refuses to overwrite someone's words (`saveSectionGuarded` returns a
 * conflict). What was missing is the quiet middle: knowing, *while you type*,
 * that someone else is standing in the same verse.
 *
 * A conflict dialog is a failure state. This module is how the room avoids
 * ever needing one — a soft, ephemeral signal of where each person is.
 *
 * Entirely channel state: nothing is written to a table, nothing is logged to
 * the feed, no lyric content ever leaves the client. Only a section id and a
 * flag for "actively typing".
 */
import { supabase } from "@/integrations/supabase/client";

export type RoomFocus = {
  userId: string;
  name: string;
  color: string;
  initials: string;
  /** Section the person is looking at, or null when they're on the hub. */
  sectionId: string | null;
  /** True only while keystrokes are landing — decays on its own. */
  typing: boolean;
  /** Client clock; used to age out stale metas. */
  at: number;
};

/** A focus goes stale if the tab froze without leaving the channel. */
const STALE_MS = 45_000;
/** Typing flag decays this long after the last keystroke. */
const TYPING_IDLE_MS = 4_000;
/** Never send more than one update per this window. */
const THROTTLE_MS = 800;

export type FocusHandle = {
  /** Call when the user opens/closes a section. Cheap, throttled, idempotent. */
  setSection: (sectionId: string | null) => void;
  /** Call on every keystroke. The flag clears itself when typing stops. */
  ping: () => void;
  /** Leave the channel. */
  stop: () => void;
};

/**
 * Track and observe where everyone is in this song.
 *
 * `onChange` receives every OTHER member (never yourself), stale entries
 * removed, so the caller can render straight from it.
 */
export function subscribeRoomFocus(
  song_id: string,
  self: Omit<RoomFocus, "sectionId" | "typing" | "at">,
  onChange: (others: RoomFocus[]) => void,
): FocusHandle {
  let sectionId: string | null = null;
  let typing = false;
  let lastSent = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let joined = false;
  let stopped = false;

  const channel = supabase.channel(`focus:song:${song_id}`, {
    config: { presence: { key: self.userId } },
  });

  const emit = () => {
    const state = channel.presenceState<RoomFocus>();
    const now = Date.now();
    const byUser = new Map<string, RoomFocus>();
    for (const metas of Object.values(state)) {
      const meta = metas[0];
      if (!meta?.userId || meta.userId === self.userId) continue;
      if (now - (meta.at ?? 0) > STALE_MS) continue;
      byUser.set(meta.userId, meta);
    }
    onChange(Array.from(byUser.values()));
  };

  const push = () => {
    if (!joined || stopped) return;
    lastSent = Date.now();
    void channel.track({ ...self, sectionId, typing, at: Date.now() } satisfies RoomFocus);
  };

  /** Coalesce bursts of keystrokes into at most one message per window. */
  const schedule = () => {
    if (pendingTimer) return;
    const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastSent));
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      push();
    }, wait);
  };

  channel
    .on("presence", { event: "sync" }, emit)
    .on("presence", { event: "join" }, emit)
    .on("presence", { event: "leave" }, emit)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        joined = true;
        push();
      }
    });

  return {
    setSection(next) {
      if (next === sectionId) return;
      sectionId = next;
      typing = false;
      schedule();
    },
    ping() {
      if (!typing) {
        typing = true;
        schedule();
      }
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        typing = false;
        schedule();
      }, TYPING_IDLE_MS);
    },
    stop() {
      stopped = true;
      if (pendingTimer) clearTimeout(pendingTimer);
      if (typingTimer) clearTimeout(typingTimer);
      void channel.untrack();
      supabase.removeChannel(channel);
    },
  };
}

/** Everyone currently standing in one section. */
export function focusIn(others: RoomFocus[], sectionId: string): RoomFocus[] {
  return others.filter((o) => o.sectionId === sectionId);
}

/**
 * The one calm line to show above a section, or null for silence.
 * First names only, never more than two named people, never a count badge.
 */
export function focusLine(others: RoomFocus[], sectionId: string): string | null {
  const here = focusIn(others, sectionId);
  if (here.length === 0) return null;
  const names = here.map((o) => (o.name || "Someone").split(" ")[0]);
  const anyTyping = here.some((o) => o.typing);
  const verb = anyTyping ? "is writing here" : "is here";
  if (names.length === 1) return `${names[0]} ${verb}`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are ${anyTyping ? "writing here" : "here"}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are here`;
}
