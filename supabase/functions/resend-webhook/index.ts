import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Resend webhook — listens for `email.bounced`, `email.complained`, and
// `email.delivery_delayed` events. Verified via SVIX signature using
// RESEND_WEBHOOK_SECRET. On verified bounce/complaint, we write an
// `email_suppressions` row so canSend() fails closed on the next send.

function base64UrlDecode(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64UrlEncode(b: ArrayBuffer): string {
  const bytes = new Uint8Array(b);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importSecret(secretB64: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(secretB64);
  return await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function verifySvix(
  secret: string,
  payload: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
): Promise<boolean> {
  try {
    const key = await importSecret(secret);
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
    const mac = await crypto.subtle.sign("HMAC", key, signed);
    const expected = `v1,${base64UrlEncode(mac)}`;
    // Resend may include multiple signatures in the header separated by spaces.
    const signatures = signatureHeader.split(/\s+/).filter(Boolean);
    return signatures.includes(expected);
  } catch (e) {
    console.error("[resend-webhook] verifySvix failed", String(e));
    return false;
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
    return jsonResponse({ error: "not_configured" }, 500);
  }

  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";
  if (!id || !timestamp || !signature) {
    return jsonResponse({ error: "missing_headers" }, 400);
  }

  const payload = await req.text();
  if (!(await verifySvix(secret, payload, id, timestamp, signature))) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let event: { type?: string; data?: { email?: string; type?: string; [k: string]: unknown } };
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ error: "bad_payload" }, 400);
  }

  const eventType = event.type ?? "";
  const data = event.data ?? {};

  // Only act on delivery failures that damage reputation.
  if (!["email.bounced", "email.complained", "email.delivery_delayed"].includes(eventType)) {
    return jsonResponse({ received: true, action: "ignored" }, 200);
  }

  const email = data.email as string | undefined;
  if (!email) {
    return jsonResponse({ received: true, action: "no_email" }, 200);
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the user by email. If the address doesn't match a user we still
    // suppress it as an unowned email so future sends to that address are
    // blocked. (user_id can be NULL.)
    let userId: string | null = null;
    const { data: users, error: userErr } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (!userErr && users && users.length > 0) {
      userId = users[0].id as string;
    }

    const reason = eventType === "email.bounced" ? "bounce" : eventType === "email.complained" ? "complaint" : "delivery_delayed";

    // Bounces/complaints suppress the whole address permanently. Delivery
    // delays suppress for 30 days as a cooling-off period.
    const expiresAt = reason === "delivery_delayed" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

    const { error: upsertErr } = await admin
      .from("email_suppressions")
      .upsert(
        { user_id: userId, category: "all", reason, expires_at: expiresAt },
        { onConflict: "user_id,category" },
      );
    if (upsertErr) {
      console.error("[resend-webhook] suppression_upsert_failed", upsertErr.message);
    }
  } catch (e) {
    console.error("[resend-webhook] suppression_failed", String(e));
  }

  return jsonResponse({ received: true, action: "suppressed" }, 200);
});
