// Send governance — the §7 guardrails as ONE gate every lifecycle send
// passes through. This is the difference between "spreads fast" and "gets
// marked as spam" (docs/email/COG-EMAIL-SYSTEM.md §7).
//
// Rules enforced here:
//   · suppression: global ('all') or per-category, honoring expiry
//   · rolling caps: max 1 lifecycle email / 24h, max 3 / rolling 7 days
//   · quiet hours: no lifecycle delivery 9pm–7am recipient-local
// Transactional mail NEVER passes through this gate — it always sends.

// deno-lint-ignore-file no-explicit-any

export type CanSendResult =
  | { allow: true }
  | { allow: false; reason: string; deferUntil?: string };

const MAX_PER_24H = 1;
const MAX_PER_7D = 3;
const QUIET_START_HOUR = 21; // 9pm local
const QUIET_END_HOUR = 7; // 7am local
const DEFAULT_TZ = "America/Denver";

/** Recipient-local hour, resilient to bad/missing timezone strings. */
export function localHour(now: Date, timezone: string | null | undefined): number {
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || DEFAULT_TZ,
      hour: "numeric",
      hour12: false,
    }).format(now);
    const h = parseInt(s, 10);
    return Number.isFinite(h) ? h % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

/** Is this local hour inside quiet hours (21:00–06:59)? */
export function inQuietHours(hour: number): boolean {
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** Next 8am-ish recipient-local moment, expressed as a UTC ISO string. */
export function nextMorning(now: Date, timezone: string | null | undefined): string {
  // Walk forward in 30-min steps until the local clock exits quiet hours —
  // clock math beats timezone-offset math (DST-proof, zero deps).
  const step = 30 * 60 * 1000;
  let t = now.getTime();
  for (let i = 0; i < 48; i++) {
    t += step;
    if (!inQuietHours(localHour(new Date(t), timezone))) break;
  }
  return new Date(t).toISOString();
}

/**
 * The gate. `admin` is a service-role supabase client. Never throws — an
 * internal failure FAILS CLOSED for lifecycle mail (calm beats leaky).
 */
export async function canSend(
  admin: any,
  userId: string,
  category: string,
  timezone: string | null | undefined,
): Promise<CanSendResult> {
  try {
    const nowIso = new Date().toISOString();

    // 1a) User preference center (unsubscribed_all + per-category switch).
    // Maps the L11 §7 category namespaces to the preference boolean columns.
    const PREF_COL: Record<string, string> = {
      collab: "song_activity",
      digest: "weekly_recaps",
      edu: "tips_guides",
      growth: "invite_suggestions",
      retain: "encouragement",
      care: "encouragement",
      onboarding: "encouragement",
      money: "product_news",
    };
    const prefCol = PREF_COL[category];
    if (prefCol) {
      const { data: pref } = await admin
        .from("email_preferences")
        .select(`unsubscribed_all, ${prefCol}`)
        .eq("user_id", userId)
        .maybeSingle();
      if (pref?.unsubscribed_all) return { allow: false, reason: "pref_paused_all" };
      if (pref && (pref as any)[prefCol] === false) {
        return { allow: false, reason: `pref_off_${prefCol}` };
      }
    }

    // 1b) Nudge dismissals — respect suppressed_until for this kind.
    const { data: dism } = await admin
      .from("nudge_dismissals")
      .select("suppressed_until")
      .eq("user_id", userId)
      .eq("kind", category)
      .maybeSingle();
    if (dism?.suppressed_until && dism.suppressed_until > nowIso) {
      return { allow: false, reason: "nudge_suppressed", deferUntil: dism.suppressed_until };
    }

    // 1c) Suppressions (global 'all' + this category), honoring expiry.
    const { data: sup } = await admin
      .from("email_suppressions")
      .select("category, expires_at")
      .eq("user_id", userId)
      .in("category", ["all", category]);
    for (const s of sup ?? []) {
      if (!s.expires_at || s.expires_at > nowIso) {
        return { allow: false, reason: `suppressed_${s.category}` };
      }
    }

    // 2) Rolling caps — counted from the queue's own send history. Only
    // lifecycle rows carry a category, so transactional history never
    // burns a user's calm budget.
    const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const week = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: dayCount } = await admin
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("category", "is", null)
      .gte("sent_at", day);
    if ((dayCount ?? 0) >= MAX_PER_24H) {
      return { allow: false, reason: "cap_24h", deferUntil: new Date(Date.now() + 12 * 3600 * 1000).toISOString() };
    }
    const { count: weekCount } = await admin
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("category", "is", null)
      .gte("sent_at", week);
    if ((weekCount ?? 0) >= MAX_PER_7D) {
      return { allow: false, reason: "cap_7d", deferUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString() };
    }

    // 3) Quiet hours — defer to the recipient's morning, never drop.
    const now = new Date();
    if (inQuietHours(localHour(now, timezone))) {
      return { allow: false, reason: "quiet_hours", deferUntil: nextMorning(now, timezone) };
    }

    return { allow: true };
  } catch (e) {
    return { allow: false, reason: `governance_error:${String(e).slice(0, 120)}` };
  }
}

// ── One-click unsubscribe tokens (RFC 8058) ──────────────────────────────
// Stateless HMAC tokens: no schema, unguessable, scoped to the user. The
// secret is EMAIL_UNSUB_SECRET (falls back to the service-role key, which
// HMAC never reveals). token = base64url(userId).base64url(hmac(userId)).

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret =
    Deno.env.get("EMAIL_UNSUB_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "cog-dev";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function makeUnsubToken(userId: string): Promise<string> {
  const key = await hmacKey();
  const data = new TextEncoder().encode(userId);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return `${b64url(data)}.${b64url(sig)}`;
}

/** Returns the userId when the token is authentic, else null. Never throws. */
export async function verifyUnsubToken(token: string): Promise<string | null> {
  try {
    const [dataPart, sigPart] = token.split(".");
    if (!dataPart || !sigPart) return null;
    const data = b64urlDecode(dataPart);
    const sig = b64urlDecode(sigPart);
    const key = await hmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, sig, data);
    return ok ? new TextDecoder().decode(data) : null;
  } catch {
    return null;
  }
}

/** The one-click unsubscribe URL for a user+category (RFC 8058 target). */
export async function unsubscribeUrl(userId: string, category: string): Promise<string> {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const token = await makeUnsubToken(userId);
  return `${base}/functions/v1/email-unsubscribe?t=${encodeURIComponent(token)}&c=${encodeURIComponent(category)}`;
}

/**
 * Enqueue helper — the one way lifecycle emails enter the outbox. Dedupe is
 * a DB constraint (partial unique index), so double-enqueue is impossible,
 * not just unlikely. Never throws.
 */
export async function enqueueEmail(
  admin: any,
  args: {
    user_id: string;
    kind: string;
    category: string;
    payload?: Record<string, unknown>;
    scheduled_for?: string;
    dedupe_key?: string;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("notification_queue").insert({
      user_id: args.user_id,
      kind: args.kind,
      category: args.category,
      payload: args.payload ?? {},
      scheduled_for: args.scheduled_for ?? new Date().toISOString(),
      dedupe_key: args.dedupe_key ?? null,
    });
    if (error && !String(error.message ?? "").includes("duplicate")) {
      console.error("[email] enqueue_failed", args.kind, error.message);
    }
  } catch (e) {
    console.error("[email] enqueue_failed", args.kind, String(e));
  }
}
