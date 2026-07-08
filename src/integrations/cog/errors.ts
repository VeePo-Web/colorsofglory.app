import { supabase } from "@/integrations/supabase/client";

/**
 * COG data-access error contract — the ONE error taxonomy every seam module
 * (`src/integrations/cog/*`) throws. No component ever sees a raw PostgREST /
 * RPC / storage / edge-function error string: everything is normalized to a
 * `CogError` carrying a stable `.code` the UI switches on (never the message).
 *
 * Three tools live here:
 *   - `toCogError(err)`     — maps a direct `.from()` / `.rpc()` / `.storage`
 *     error (PostgREST SQLSTATE + message) to a `CogErrorCode`.
 *   - `codeFromServer(raw)` — maps an edge function's envelope `code` or legacy
 *     `{ error: "<slug>" }` body string to a `CogErrorCode`, preserving the raw
 *     slug so quota/invite codes survive end-to-end.
 *   - `call<T>(fn, body)`   — edge-function wrapper: unwraps the envelope, reads
 *     the code out of a non-2xx Response body, throws a `CogError`.
 *
 * AUTH BOUNDARY DECISION (Step 3): `cog/auth.ts` keeps its OWN `AuthError` /
 * `AuthErrorCode` taxonomy and is deliberately NOT folded in here. Auth runs
 * before a session exists and maps provider failure modes (OTP expired, phone
 * provider disabled, geo-block, SMS cooldown/ceiling, rate-limit + retry-after)
 * to curated recovery copy — a disjoint problem from the data plane's FORBIDDEN
 * / QUOTA_* / INVITE_* codes. `AuthError` already never leaks a raw string, so
 * it meets the same "typed, coded, no-raw-message" guarantee on its own
 * boundary. Two focused unions beat one leaky god-enum.
 */

/** Canonical error codes. UI switches on these — never on free-text messages. */
export type CogErrorCode =
  | "INTERNAL"
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "METHOD_NOT_ALLOWED"
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

export class CogError extends Error {
  code: CogErrorCode | string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "CogError";
    this.code = code;
  }
}

/** Semantic codes, for message-token scanning in `toCogError`. */
const KNOWN_CODES: readonly CogErrorCode[] = [
  "INVALID_INPUT",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "METHOD_NOT_ALLOWED",
  "QUOTA_EXCEEDED_SONGS",
  "QUOTA_EXCEEDED_STORAGE",
  "SONG_NOT_FOUND",
  "SONG_DELETED",
  "NOT_A_MEMBER",
  "OWNER_CANNOT_LEAVE",
  "NEW_OWNER_NOT_MEMBER",
  "TRANSFER_BLOCKED_QUOTA",
  "INVITE_NOT_FOUND",
  "INVITE_EXPIRED",
  "INVITE_ALREADY_USED",
  "INVITE_EXHAUSTED",
];

/** Lowercase server slugs (edge `{ error }` bodies, RPC RAISE strings) → codes. */
const SERVER_CODE_MAP: Record<string, CogErrorCode> = {
  forbidden: "FORBIDDEN",
  permission_denied: "FORBIDDEN",
  not_authorized: "FORBIDDEN",
  unauthorized: "UNAUTHENTICATED",
  unauthenticated: "UNAUTHENTICATED",
  invalid_input: "INVALID_INPUT",
  bad_request: "INVALID_INPUT",
  method_not_allowed: "METHOD_NOT_ALLOWED",
  song_limit_reached: "QUOTA_EXCEEDED_SONGS",
  song_quota_exceeded: "QUOTA_EXCEEDED_SONGS",
  storage_limit_reached: "QUOTA_EXCEEDED_STORAGE",
  storage_quota_exceeded: "QUOTA_EXCEEDED_STORAGE",
  out_of_storage: "QUOTA_EXCEEDED_STORAGE",
  song_not_found: "SONG_NOT_FOUND",
  song_deleted: "SONG_DELETED",
  not_a_member: "NOT_A_MEMBER",
  owner_cannot_leave: "OWNER_CANNOT_LEAVE",
  new_owner_not_member: "NEW_OWNER_NOT_MEMBER",
  transfer_blocked_quota: "TRANSFER_BLOCKED_QUOTA",
  invite_not_found: "INVITE_NOT_FOUND",
  invite_expired: "INVITE_EXPIRED",
  invite_already_used: "INVITE_ALREADY_USED",
  invite_exhausted: "INVITE_EXHAUSTED",
};

/**
 * Map a server-provided code string (envelope `code`, `{ error: "<slug>" }`, or
 * a RAISEd RPC message) to a `CogError`. Canonical UPPER codes pass through;
 * known lowercase slugs are translated; anything else is preserved verbatim as
 * `.code` so the signal is never lost and message-matching callers still see
 * the slug. A human `message` (when present) becomes `.message`; otherwise the
 * raw code IS the message.
 */
export function codeFromServer(raw: string, message?: string): CogError {
  const trimmed = (raw ?? "").trim();
  const upper = trimmed.toUpperCase();
  if (upper === "INTERNAL" || (KNOWN_CODES as readonly string[]).includes(upper)) {
    return new CogError(upper, message ?? trimmed);
  }
  const mapped = SERVER_CODE_MAP[trimmed.toLowerCase()];
  if (mapped) return new CogError(mapped, message ?? trimmed);
  return new CogError(trimmed || "INTERNAL", message ?? (trimmed || undefined));
}

/**
 * Normalize ANY thrown value from a direct PostgREST / RPC / storage call into a
 * `CogError`. Idempotent: an existing `CogError` passes through.
 *
 * Resolution order:
 *   1. Already a `CogError` -> passthrough.
 *   2. Message carries a known code token (an RPC that RAISEd a semantic code as
 *      its message — QUOTA_EXCEEDED_STORAGE, INVITE_EXPIRED, …) -> that code, so
 *      quota/invite codes survive the direct-RPC path too.
 *   3. Known Postgres / PostgREST SQLSTATE -> semantic code (42501 -> FORBIDDEN,
 *      JWT/anon -> UNAUTHENTICATED).
 *   4. Message-shape fallbacks for RLS / auth when SQLSTATE is absent.
 *   5. Otherwise -> INTERNAL.
 */
export function toCogError(err: unknown): CogError {
  if (err instanceof CogError) return err;

  const e = (err ?? {}) as {
    code?: unknown;
    message?: unknown;
    error?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const pgCode = typeof e.code === "string" ? e.code : "";
  const message =
    typeof e.message === "string"
      ? e.message
      : typeof e.error === "string"
        ? e.error
        : "";

  // 2) An RPC that RAISEs a known code as its message -> preserve the semantics.
  const upper = message.toUpperCase();
  for (const code of KNOWN_CODES) {
    if (upper === code || upper.includes(code)) {
      return new CogError(code, message);
    }
  }

  // 3) Known Postgres / PostgREST SQLSTATE codes.
  switch (pgCode) {
    case "42501": // insufficient_privilege — RLS denied a write
      return new CogError("FORBIDDEN", message || "You don't have access to do that.");
    case "PGRST301": // JWT expired / auth required
    case "PGRST302": // anonymous, auth required
      return new CogError("UNAUTHENTICATED", message || "Please sign in and try again.");
  }

  // 4) Message-shape fallbacks when SQLSTATE is absent.
  const lower = message.toLowerCase();
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    lower.includes("insufficient_privilege")
  ) {
    return new CogError("FORBIDDEN", message);
  }
  if (
    lower.includes("jwt") ||
    lower.includes("not authenticated") ||
    lower.includes("unauthenticated")
  ) {
    return new CogError("UNAUTHENTICATED", message);
  }

  return new CogError("INTERNAL", message || "Something went wrong.");
}

// ── Edge-function wrapper ───────────────────────────────────────────────────

type FunctionErrorContext = { json?: () => Promise<unknown> };
type FunctionInvokeError = { context?: FunctionErrorContext; message?: string };

/**
 * Invoke a Supabase edge function and normalize the result.
 *
 * Success: returns `env.data` for `{ ok, data }` envelopes, or the raw payload
 * for functions that answer with a bare object.
 * Failure: throws a `CogError`. On a non-2xx, supabase-js hides the JSON body
 * behind `error.context`; we read it so both the `{ ok, code }` envelope AND a
 * legacy `{ error: "<slug>" }` body surface their real code (QUOTA_EXCEEDED_*,
 * INVITE_*, forbidden, song_limit_reached, …) instead of a generic
 * "non-2xx status code" string.
 */
export async function call<T = unknown>(fn: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });

  // Prefer the parsed Response body on a non-2xx; fall back to `data`.
  let payload: unknown = data;
  const fnErr = error as FunctionInvokeError | null;
  if (fnErr?.context && typeof fnErr.context.json === "function") {
    try {
      payload = await fnErr.context.json();
    } catch {
      /* keep `data` */
    }
  }

  const obj =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;

  // Structured envelope: { ok, code?, message?, data? }
  if (obj && "ok" in obj) {
    if (!obj.ok) {
      throw codeFromServer(
        typeof obj.code === "string" ? obj.code : "INTERNAL",
        typeof obj.message === "string" ? obj.message : undefined,
      );
    }
    return ((obj.data ?? obj) as unknown) as T;
  }

  // Legacy error body: { error: "<slug>", message?/detail? }
  const legacyCode =
    obj && typeof obj.error === "string"
      ? obj.error
      : obj && typeof obj.code === "string"
        ? obj.code
        : undefined;

  if (error) {
    if (legacyCode) {
      const msg =
        (obj && typeof obj.message === "string" && obj.message) ||
        (obj && typeof obj.detail === "string" && obj.detail) ||
        undefined;
      throw codeFromServer(legacyCode, msg || undefined);
    }
    throw toCogError(error);
  }

  // A 2xx that still carries a legacy error field.
  if (legacyCode) throw codeFromServer(legacyCode);

  return data as T;
}
