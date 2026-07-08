// ============================================================================
// Songwriting Credits — contribution ledger (COG Product 13).
// ============================================================================
// GREENFIELD / UI-DERIVED — there is NO DB table backing these types. Credits
// are currently DERIVED on the client from canvas cards + the live roster
// (src/lib/canvas/credits.ts + src/pages/CreditsPage.tsx). That fixture IS the
// spec until Lovable models a real ledger; these types canonicalize its shape.
//
// PROVENANCE: composed VIEW-MODEL, no source table. (Flagged in
// docs/TYPE-CONTRACT.md as a schema gap for Lovable.)
//
// ⚠️ NEVER conflate `Credit` (songwriting recognition — who wrote what) with the
// billing `credit_ledger` (MONEY — referral/reward balance). They are unrelated
// concepts that happen to share the English word "credit". Billing lives in
// ./billing and cog/ledger.ts; this file is contribution recognition only.
//
// Credits are EXPORTABLE — the Credits screen copies a plain-text block to the
// clipboard (creditsToText) for liner notes / bios; a future PDF/credits export
// serializes this same shape.
// ============================================================================
import type { DisplayRole } from "./role";

/**
 * Canonical vocabulary of contribution kinds, from the CreditsPage fixture and
 * the Credits Review mockup (download (21).webp: "Lyrics · Arrangement",
 * "Voice memo · Bridge idea", "Chord suggestion · Chorus review"). One member
 * of this union per kind of work a contributor can be credited for.
 */
export type ContributionType =
  | "lyrics"
  | "arrangement"
  | "voice_memo"
  | "chord_suggestion"
  | "original_idea"
  | "section_idea"
  | "review"
  | "comment"
  | "recording";

/** Runtime list of every ContributionType (source of truth for iteration). */
export const CONTRIBUTION_TYPES = [
  "lyrics",
  "arrangement",
  "voice_memo",
  "chord_suggestion",
  "original_idea",
  "section_idea",
  "review",
  "comment",
  "recording",
] as const satisfies readonly ContributionType[];

/** Human-facing singular label for each contribution kind. */
export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  lyrics: "Lyrics",
  arrangement: "Arrangement",
  voice_memo: "Voice memo",
  chord_suggestion: "Chord suggestion",
  original_idea: "Original idea",
  section_idea: "Section idea",
  review: "Review",
  comment: "Comment",
  recording: "Recording",
};

/**
 * One credited contribution. `count` rolls up repeats ("Voice memo ×3");
 * `sectionLabel` scopes a contribution to a section ("Bridge idea",
 * "Chorus review") when the credit is section-specific.
 */
export type Contribution = {
  type: ContributionType;
  /** How many of this kind (omit or 1 = singular). */
  count?: number;
  /** Section this contribution applies to, e.g. "Bridge", "Chorus". */
  sectionLabel?: string;
};

/**
 * One contributor's credit card on the Credits screen: their identity, their
 * display role, the owner crown, their aurora avatar color, and the list of
 * contributions they're recognized for. Owner sorts first, then by volume.
 */
export type Credit = {
  /** Stable identity — the contributor's user id (or fixture name key). */
  userId: string;
  name: string;
  /** Avatar initials (e.g. "PK"). */
  initials: string;
  /** UI role shown under the name (Owner / Contributor / Reviewer / Viewer). */
  role: DisplayRole;
  isOwner: boolean;
  /** Aurora / avatar accent color (hex) used for the ring + chips. */
  auroraColor: string;
  contributions: Contribution[];
};
