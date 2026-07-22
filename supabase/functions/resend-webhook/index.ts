import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Resend webhook — verified via SVIX signature (RESEND_WEBHOOK_SECRET).
// Handles the full event set: sent/delivered/opened/clicked/bounced/
// complained/delivery_delayed/failed. Updates email_send_log per event
// (idempotent) and writes email_suppressions on bounce/complaint so
// canSend() fails closed on the next send.

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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const messageId = (data.email_id as string | undefined) ?? (data.id as string | undefined) ?? undefined;
  const recipient = data.email as string | undefined ?? (Array.isArray(data.to) ? data.to[0] as string : undefined);
  const eventTs = (data.created_at as string | undefined) ?? new Date().toISOString();

  // 1) Update send_log by message_id (idempotent per event).
  if (messageId) {
    try {
      const { data: log } = await admin
        .from("email_send_log")
        .select("id,status,open_count,click_count,delivered_at,first_opened_at,first_clicked_at")
        .eq("message_id", messageId)
        .maybeSingle();
      if (log) {
        const patch: Record<string, unknown> = {};
        switch (eventType) {
          case "email.sent":
            patch.status = "sent";
            patch.sent_at = eventTs;
            break;
          case "email.delivered":
            patch.status = "delivered";
            if (!log.delivered_at) patch.delivered_at = eventTs;
            break;
          case "email.opened":
            patch.status = "opened";
            if (!log.first_opened_at) patch.first_opened_at = eventTs;
            patch.open_count = (log.open_count as number ?? 0) + 1;
            break;
          case "email.clicked":
            patch.status = "clicked";
            if (!log.first_clicked_at) patch.first_clicked_at = eventTs;
            patch.click_count = (log.click_count as number ?? 0) + 1;
            break;
          case "email.bounced":
            patch.status = "bounced";
            patch.bounced_at = eventTs;
            patch.error = (data.bounce_type as string) ?? "bounced";
            break;
          case "email.complained":
            patch.status = "complained";
            patch.complained_at = eventTs;
            break;
          case "email.failed":
          case "email.delivery_delayed":
            patch.error = eventType;
            break;
          default:
            break;
        }
        if (Object.keys(patch).length > 0) {
          await admin.from("email_send_log").update(patch).eq("id", log.id as string);
        }
      }
    } catch (e) {
      console.error("[resend-webhook] send_log_update_failed", String(e));
    }
  }

  // 2) Reputation-damaging events → email_suppressions.
  if (["email.bounced", "email.complained", "email.delivery_delayed"].includes(eventType) && recipient) {
    try {
      let userId: string | null = null;
      const { data: users } = await admin
        .from("profiles").select("id").eq("email", recipient).limit(1);
      if (users && users.length > 0) userId = users[0].id as string;

      const reason = eventType === "email.bounced" ? "bounce"
        : eventType === "email.complained" ? "complaint"
        : "delivery_delayed";
      const expiresAt = reason === "delivery_delayed"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await admin.from("email_suppressions").upsert(
        { user_id: userId, category: "all", reason, expires_at: expiresAt },
        { onConflict: "user_id,category" },
      );
    } catch (e) {
      console.error("[resend-webhook] suppression_failed", String(e));
    }
  }

  return jsonResponse({ received: true, event: eventType }, 200);
});
