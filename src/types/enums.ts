// ============================================================================
// Canonical domain ENUM surface — one shape per concept, one import site.
// ============================================================================
// TYPE-CONTRACT LAW (docs/TYPE-CONTRACT.md rule 2): DERIVE from the generated
// schema — never fork or retype a union. Every enum here is either
//   (a) `Enums<'x'>` aliasing a real DB enum, with its runtime `as const` array
//       taken from the generated `Constants.public.Enums.x` (zero hand-typed
//       values), or
//   (b) a TYPE-LAYER-OWNED vocabulary the DB stores as a bare string (we own the
//       canonical union) — those live in their domain file and are re-exported by
//       the barrel; see the pointer comment near the bottom of this file.
//
// Label maps (`*_LABELS`) exist ONLY for enums that surface to users. Enums that
// are pure internal state (e.g. onboarding_step) get a type + runtime array but
// no label map.
//
// NOTE: SongMemberRole lives in ./role (single home) to avoid a barrel collision.
// The DB `section_kind` type is surfaced here as `SectionKind`; a DIFFERENT,
// UI-oriented `SectionKind` in src/lib/capture/transcriptModel.ts is a separate,
// non-barrel concept (the snapshot codec keeps its own private alias).
// ============================================================================
import type { Enums } from "@/integrations/supabase/types";
import { Constants } from "@/integrations/supabase/types";

// ─── section_kind (user-facing: section labels) ─────────────────────────────
export type SectionKind = Enums<"section_kind">;
export const SECTION_KINDS = Constants.public.Enums.section_kind;
export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  pre_chorus: "Pre-Chorus",
  intro: "Intro",
  outro: "Outro",
  hook: "Hook",
  tag: "Tag",
  other: "Other",
};

// ─── memo_status (user-facing: voice-memo card lifecycle) ───────────────────
export type MemoStatus = Enums<"memo_status">;
export const MEMO_STATUSES = Constants.public.Enums.memo_status;
export const MEMO_STATUS_LABELS: Record<MemoStatus, string> = {
  uploading: "Uploading",
  ready: "Ready",
  failed: "Failed",
  deleted: "Deleted",
  uploaded: "Uploaded",
  finalized: "Finalized",
  transcribed: "Transcribed",
  archived: "Archived",
};

// ─── transcription_status (user-facing: transcription progress) ─────────────
export type TranscriptionStatus = Enums<"transcription_status">;
export const TRANSCRIPTION_STATUSES = Constants.public.Enums.transcription_status;
export const TRANSCRIPTION_STATUS_LABELS: Record<TranscriptionStatus, string> = {
  pending: "Pending",
  processing: "Transcribing",
  ready: "Ready",
  failed: "Failed",
  skipped: "Skipped",
};

// ─── version_kind (user-facing: version-history timeline) ───────────────────
export type VersionKind = Enums<"version_kind">;
export const VERSION_KINDS = Constants.public.Enums.version_kind;
export const VERSION_KIND_LABELS: Record<VersionKind, string> = {
  manual: "Manual save",
  auto: "Auto-save",
  restore_point: "Restore point",
};

// ─── song_status (user-facing: catalog filters / badges) ────────────────────
export type SongStatus = Enums<"song_status">;
export const SONG_STATUSES = Constants.public.Enums.song_status;
export const SONG_STATUS_LABELS: Record<SongStatus, string> = {
  active: "Active",
  archived: "Archived",
  deleted: "Deleted",
  locked: "Locked",
};

// ─── invite_status (user-facing: invite management) ─────────────────────────
export type InviteStatus = Enums<"invite_status">;
export const INVITE_STATUSES = Constants.public.Enums.invite_status;
export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

// ─── onboarding_step (internal state machine — NO label map) ────────────────
// The ordered progression the onboarding flow advances through. Never rendered
// verbatim, so no *_LABELS map; the array preserves DB declaration order.
export type OnboardingStep = Enums<"onboarding_step">;
export const ONBOARDING_STEPS = Constants.public.Enums.onboarding_step;

// ─── Plans: two DISTINCT axes ───────────────────────────────────────────────
// sub_plan  = the billing plan actually held (free | starter | pro | founder_pro).
// plan_tier = coarse entitlement (free | pro). Kept separate on purpose.
//
// `EntitlementTier` (not `PlanTier`) names the coarse DB enum because a richer
// `PlanTier` pricing-config OBJECT already exists in ./billing — do not conflate.
export type SubPlan = Enums<"sub_plan">;
export const SUB_PLANS = Constants.public.Enums.sub_plan;

export type EntitlementTier = Enums<"plan_tier">;
export const ENTITLEMENT_TIERS = Constants.public.Enums.plan_tier;

/**
 * True when a sub_plan grants the "Pro" entitlement.
 * Mirrors the DB `is_pro_user` / `current_plan(...) IN ('pro','founder_pro')`
 * rule: `pro` and `founder_pro` are Pro; `starter` and `free` are not.
 */
export function isPro(plan: SubPlan): boolean {
  return plan === "pro" || plan === "founder_pro";
}

/**
 * True for any paid sub_plan (`starter` | `pro` | `founder_pro`), mirroring the
 * migrations' paid set. Distinct from `isPro`: `starter` is paid but not Pro.
 */
export function isPaidPlan(plan: SubPlan): boolean {
  return plan !== "free";
}

// ─── TYPE-LAYER-OWNED VOCABULARIES (DB stores bare string; we own the union) ──
// These are already first-class barrel exports from their domain files — do NOT
// re-export here (a second star-export of the same name collides the barrel):
//   • SongActivityKind ............ ./activity  (values authored in cog/activity.ts)
//   • IdeaCardType / IdeaCardStatus  ./canvas → src/lib/canvas/canvasTypes.ts
// Their runtime kind→copy maps stay with the owning feature (activity feed / canvas).
