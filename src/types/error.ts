// ============================================================================
// COG error taxonomy — the SINGLE source of truth for edge-function errors.
// ============================================================================
// Every COG edge function returns an envelope `{ ok, code, message, data }`.
// The `code` is a stable machine key; the `message` is human copy that may be
// reworded at any time.
//
//   UI RULE: switch on `error.code` (the CogErrorCode union), NEVER on the
//   `error.message` string. Message strings are not a contract and will drift;
//   codes are the contract. Render copy from the code, not by string-matching
//   the message.
//
// `CogError` (a runtime class) and its guards live here alongside the code
// union so there is one import site: `import { CogError, CogErrorCode,
// isCogError, toCogError } from "@/types"`. The data-access files in
// src/integrations/cog/* import the class back from "@/types" and re-export it
// for their existing deep importers until the Step 10 codemod.
//
// AUTH BOUNDARY — DELIBERATELY SEPARATE: `AuthError` / `AuthErrorCode` in
// src/integrations/cog/auth.ts are NOT part of this taxonomy and are NOT folded
// in. Rationale: they originate at the Supabase auth SDK boundary (not COG edge
// functions), carry auth-only fields (`retryAfterSeconds` for COOLDOWN /
// RATE_LIMITED / CEILING), and use an auth-only code vocabulary (INVALID_OTP,
// GEO_BLOCKED, WEAK_PASSWORD, …). Merging would blur two boundaries and force an
// unrelated field onto every domain error. They stay a second, intentionally
// distinct taxonomy imported from "@/integrations/cog/auth". See
// docs/TYPE-CONTRACT.md for the recorded decision.
// ============================================================================

// Canonical edge-function error codes. Add new codes here (never inline a raw
// string at a call site when a stable code is meant).
export type CogErrorCode =
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
  | "INVITE_EXHAUSTED";

// Documented escape hatch: a genuinely-unknown code coming off the wire from a
// newer/older backend is still allowed, but every KNOWN code autocompletes and
// type-checks. `(string & {})` widens to string at runtime while preserving the
// literal union for editor completion.
export type CogErrorCodeLike = CogErrorCode | (string & {});

/**
 * The one error thrown by every COG data-access call. Consumers switch on
 * `.code` (a CogErrorCode) to choose copy/behavior; the message is display-only.
 */
export class CogError extends Error {
  /** Stable machine code. Known values autocomplete; unknown wire codes allowed. */
  readonly code: CogErrorCodeLike;

  constructor(code: CogErrorCodeLike, message?: string) {
    super(message ?? code);
    this.name = "CogError";
    this.code = code;
  }
}

/** Type guard: is this thrown value a CogError? */
export function isCogError(err: unknown): err is CogError {
  return err instanceof CogError;
}

/**
 * Coerce any thrown value into a CogError so callers always handle one shape.
 * - a CogError passes through unchanged;
 * - an object carrying `{ code?, message? }` (e.g. a Supabase/PostgREST error
 *   or an edge envelope) maps its `code`/`message`, defaulting to "INTERNAL";
 * - a bare string becomes an INTERNAL error with that message;
 * - anything else becomes a generic INTERNAL error.
 */
export function toCogError(err: unknown): CogError {
  if (err instanceof CogError) return err;
  if (err && typeof err === "object") {
    const o = err as { code?: unknown; message?: unknown };
    const code = typeof o.code === "string" && o.code ? o.code : "INTERNAL";
    const message = typeof o.message === "string" ? o.message : undefined;
    return new CogError(code, message);
  }
  if (typeof err === "string" && err) return new CogError("INTERNAL", err);
  return new CogError("INTERNAL");
}
