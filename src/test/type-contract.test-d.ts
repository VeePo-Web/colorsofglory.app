// ============================================================================
// TYPE CONTRACT — compile-time guard rails for the @/types public surface (A2).
// ============================================================================
// These `expectTypeOf` assertions lock the SHAPE of the public type surface.
// They are enforced two ways, both in CI:
//   • `npm run typecheck` (tsc) — this file lives under src, so tsconfig.app.json
//     compiles it; a mismatched assertion is a compile error.
//   • `npm run test:types`      — `vitest --typecheck` collects this `.test-d.ts`
//     file and reports the same assertions as tests.
//
// A deliberate break (e.g. adding "reviewer" to SongMemberRole, or dropping a key
// from SongDetail.counts) fails BOTH. The sibling `type-contract.test.ts` covers
// the runtime half (enum arrays, label maps, barrel value exports).
//
// Assertions use `toEqualTypeOf` (bidirectional exact equality) so the surface
// can neither GROW nor SHRINK silently.
// ============================================================================
import { expectTypeOf } from "vitest";

import type {
  SongMemberRole,
  DisplayRole,
  SongDetail,
  CogErrorCode,
  SectionKind,
  MemoStatus,
  TranscriptionStatus,
  VersionKind,
  SongStatus,
  InviteStatus,
  OnboardingStep,
  SubPlan,
  EntitlementTier,
  ContributionType,
  Song,
  SongMember,
  VoiceMemo,
} from "@/types";
import {
  SECTION_KINDS,
  MEMO_STATUSES,
  TRANSCRIPTION_STATUSES,
  VERSION_KINDS,
  SONG_STATUSES,
  INVITE_STATUSES,
  ONBOARDING_STEPS,
  SUB_PLANS,
  ENTITLEMENT_TIERS,
  CONTRIBUTION_TYPES,
} from "@/types";
import type { Database } from "@/integrations/supabase/types";

// ── SongMemberRole: exactly the three STORED roles, never reviewer/contributor ──
expectTypeOf<SongMemberRole>().toEqualTypeOf<"owner" | "collaborator" | "viewer">();
// Adding "reviewer" (or "contributor") to the stored union breaks this equality.
expectTypeOf<SongMemberRole>().not.toEqualTypeOf<
  "owner" | "collaborator" | "viewer" | "reviewer"
>();

// ── DisplayRole: exactly the four UI roles ──────────────────────────────────
expectTypeOf<DisplayRole>().toEqualTypeOf<"owner" | "contributor" | "reviewer" | "viewer">();

// ── SongDetail.counts: exact key shape (all number, no extra/missing keys) ──
expectTypeOf<SongDetail["counts"]>().toEqualTypeOf<{
  sections: number;
  lyrics_filled: number;
  voice_memos: number;
  notes: number;
  collaborators: number;
  pending_suggestions: number;
}>();

// ── CogErrorCode: the full known-code set (locks additions AND removals) ─────
expectTypeOf<CogErrorCode>().toEqualTypeOf<
  | "INTERNAL"
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "METHOD_NOT_ALLOWED"
  | "OFFLINE"
  | "QUOTA_EXCEEDED_SONGS"
  | "QUOTA_EXCEEDED_STORAGE"
  | "SONG_NOT_FOUND"
  | "SONG_DELETED"
  | "NOT_A_MEMBER"
  | "OWNER_CANNOT_LEAVE"
  | "NEW_OWNER_NOT_MEMBER"
  | "TRANSFER_BLOCKED_QUOTA"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_ALREADY_USED"
  | "INVITE_EXHAUSTED"
>();
// Sanity: a couple of known codes are members of the union.
expectTypeOf<"FORBIDDEN">().toMatchTypeOf<CogErrorCode>();
expectTypeOf<"INVITE_EXPIRED">().toMatchTypeOf<CogErrorCode>();

// ── Each enum const array's element type IS its enum type (no hand-drift) ────
expectTypeOf<(typeof SECTION_KINDS)[number]>().toEqualTypeOf<SectionKind>();
expectTypeOf<(typeof MEMO_STATUSES)[number]>().toEqualTypeOf<MemoStatus>();
expectTypeOf<(typeof TRANSCRIPTION_STATUSES)[number]>().toEqualTypeOf<TranscriptionStatus>();
expectTypeOf<(typeof VERSION_KINDS)[number]>().toEqualTypeOf<VersionKind>();
expectTypeOf<(typeof SONG_STATUSES)[number]>().toEqualTypeOf<SongStatus>();
expectTypeOf<(typeof INVITE_STATUSES)[number]>().toEqualTypeOf<InviteStatus>();
expectTypeOf<(typeof ONBOARDING_STEPS)[number]>().toEqualTypeOf<OnboardingStep>();
expectTypeOf<(typeof SUB_PLANS)[number]>().toEqualTypeOf<SubPlan>();
expectTypeOf<(typeof ENTITLEMENT_TIERS)[number]>().toEqualTypeOf<EntitlementTier>();
expectTypeOf<(typeof CONTRIBUTION_TYPES)[number]>().toEqualTypeOf<ContributionType>();

// ── Enums DERIVE from the generated schema (never a forked union) ───────────
expectTypeOf<SongMemberRole>().toEqualTypeOf<Database["public"]["Enums"]["song_member_role"]>();
expectTypeOf<SectionKind>().toEqualTypeOf<Database["public"]["Enums"]["section_kind"]>();
expectTypeOf<SubPlan>().toEqualTypeOf<Database["public"]["Enums"]["sub_plan"]>();

// ── Barrel re-exports the public TYPE set (the imports above already prove the
//    names resolve from "@/types"; these lock their derivation). ─────────────
expectTypeOf<Song>().toEqualTypeOf<Database["public"]["Tables"]["songs"]["Row"]>();
expectTypeOf<VoiceMemo>().toEqualTypeOf<Database["public"]["Tables"]["voice_memos"]["Row"]>();
expectTypeOf<SongMember>().not.toBeAny();
expectTypeOf<SongMember["role"]>().toEqualTypeOf<SongMemberRole>();
