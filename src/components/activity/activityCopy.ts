/**
 * E2 · SongActivityKind → calm copy map — the single source of plain-English
 * event language for the activity feed AND D3's on-canvas recap sheet.
 * Published contract: docs/ACTIVITY-CONTRACT.md.
 *
 * THE CONTENT RULE (law): sentences are built from actor + kind + count ONLY.
 * Nothing here accepts payload text, so no raw lyric or memo content can ever
 * pass through this map. Keep it that way.
 *
 * Voice: warm, plain, human — "Sarah added a voice memo", never
 * "memo_uploaded event (1)". No jargon, no anxiety.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Eraser,
  FileText,
  KeyRound,
  Layers,
  Lightbulb,
  Link2,
  Mic,
  Move,
  Sprout,
  Star,
  Tag,
  Unlink,
  UserMinus,
  UserPlus,
  Waves,
} from "lucide-react";
import type { SongActivityKind } from "@/types";

/** Which song surface a tapped card should open. */
export type ActivitySurface = "voice" | "people" | "canvas" | "room";

export interface ActivityKindCopy {
  icon: LucideIcon;
  /** Count-aware calm sentence. Actor is a display name, never content. */
  sentence: (actor: string, count: number) => string;
  /** Quiet second line — still content-free, same for every event. */
  sub: string;
  surface: ActivitySurface;
}

/** Display name for events whose actor is unknown or has left. */
export const UNKNOWN_ACTOR = "Someone";

const one = (n: number) => n <= 1;

export const ACTIVITY_KIND_COPY: Record<SongActivityKind, ActivityKindCopy> = {
  take_committed: {
    icon: Waves,
    sentence: (a, n) => (one(n) ? `${a} recorded a new take` : `${a} recorded ${n} new takes`),
    sub: "A fresh recording to listen to",
    surface: "voice",
  },
  capture_created: {
    icon: Lightbulb,
    sentence: (a, n) => (one(n) ? `${a} captured an idea` : `${a} captured ${n} ideas`),
    sub: "A raw spark, kept safe in the song",
    surface: "canvas",
  },
  capture_promoted: {
    icon: Sprout,
    sentence: (a, n) =>
      one(n) ? `${a} shaped an idea into the song` : `${a} shaped ${n} ideas into the song`,
    sub: "From spark to section",
    surface: "canvas",
  },
  memo_uploaded: {
    icon: Mic,
    sentence: (a, n) => (one(n) ? `${a} added a voice memo` : `${a} added ${n} voice memos`),
    sub: "New audio in the song's voice shelf",
    surface: "voice",
  },
  memo_finalized: {
    icon: Mic,
    sentence: (a, n) =>
      one(n) ? `${a} finished a voice memo` : `${a} finished ${n} voice memos`,
    sub: "Marked ready to build on",
    surface: "voice",
  },
  memo_transcribed: {
    icon: FileText,
    sentence: (a, n) =>
      one(n)
        ? `A voice memo of ${a}'s was written into words`
        : `${n} of ${a}'s voice memos were written into words`,
    sub: "Sung ideas, now on the page",
    surface: "voice",
  },
  invite_accepted: {
    icon: UserPlus,
    sentence: (a) => `${a} joined the song`,
    sub: "Welcome them in",
    surface: "people",
  },
  member_left: {
    icon: UserMinus,
    sentence: (a) => `${a} left the song`,
    sub: "Their contributions stay remembered",
    surface: "people",
  },
  owner_transferred: {
    icon: KeyRound,
    sentence: (a) => `${a} passed the song to a new owner`,
    sub: "A new hand carries it from here",
    surface: "people",
  },
  card_moved: {
    icon: Move,
    sentence: (a, n) =>
      one(n) ? `${a} rearranged an idea on the canvas` : `${a} rearranged ideas on the canvas`,
    sub: "The shape of the song is shifting",
    surface: "canvas",
  },
  card_linked: {
    icon: Link2,
    sentence: (a, n) =>
      one(n) ? `${a} connected two ideas` : `${a} connected ideas together`,
    sub: "Threads coming together",
    surface: "canvas",
  },
  card_unlinked: {
    icon: Unlink,
    sentence: (a, n) =>
      one(n) ? `${a} separated two ideas` : `${a} separated some ideas`,
    sub: "Giving each idea its own room",
    surface: "canvas",
  },
  card_grouped: {
    icon: Layers,
    sentence: (a, n) =>
      one(n) ? `${a} gathered ideas into a group` : `${a} gathered ideas into groups`,
    sub: "Kindred ideas, side by side",
    surface: "canvas",
  },
  card_section_set: {
    icon: Tag,
    sentence: (a, n) =>
      one(n) ? `${a} placed an idea in a section` : `${a} placed ${n} ideas in sections`,
    sub: "Finding where each idea belongs",
    surface: "canvas",
  },
  card_promoted_final: {
    icon: Star,
    sentence: (a, n) =>
      one(n)
        ? `${a} moved an idea into the final song`
        : `${a} moved ${n} ideas into the final song`,
    sub: "One step closer to finished",
    surface: "canvas",
  },
  card_deleted: {
    icon: Eraser,
    sentence: (a, n) =>
      one(n) ? `${a} tidied away an idea` : `${a} tidied away ${n} ideas`,
    sub: "Cleared from the canvas",
    surface: "canvas",
  },
};

/** Fallback for kinds this build doesn't know yet — calm, never broken. */
export const FALLBACK_KIND_COPY: ActivityKindCopy = {
  icon: Activity,
  sentence: (a, n) => (one(n) ? `${a} made a change` : `${a} made ${n} changes`),
  sub: "Something in the song moved forward",
  surface: "room",
};

/** Copy for a kind string coming off the wire (tolerates unknown kinds). */
export function copyForKind(kind: string): ActivityKindCopy {
  return ACTIVITY_KIND_COPY[kind as SongActivityKind] ?? FALLBACK_KIND_COPY;
}

/** Calm sentence for an event group. Null actor → "Someone". */
export function activitySentence(kind: string, actor: string | null, count = 1): string {
  return copyForKind(kind).sentence(actor?.trim() || UNKNOWN_ACTOR, Math.max(1, count));
}

/** Where a tapped card should take you. Redirect routes resolve to the canvas layer. */
export function activityHref(songId: string, kind: string): string {
  switch (copyForKind(kind).surface) {
    case "voice":
      return `/songs/${songId}/voice`;
    case "people":
      return `/songs/${songId}/people`;
    case "canvas":
      return `/songs/${songId}/canvas`;
    default:
      return `/songs/${songId}/room`;
  }
}
