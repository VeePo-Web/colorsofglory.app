import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyUnsubToken } from "../_shared/emailGovernance.ts";

// One-click unsubscribe (RFC 8058) — no login, honored immediately, safe to
// hit repeatedly. GET renders a tiny branded confirmation (and performs the
// unsubscribe — footer clicks are GETs); POST is the mail-client one-click
// (List-Unsubscribe-Post: List-Unsubscribe=One-Click). Writes the same
// email_suppressions store canSend() reads — one source of truth.
// verify_jwt is OFF for this function (supabase/config.toml).

const VALID_CATEGORIES = new Set([
  "onboarding", "edu", "collab", "digest", "growth", "retain", "money", "care", "all",
]);

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:48px 16px;background:#EDE7DA;font-family:'Helvetica Neue',Arial,sans-serif;color:#1C1A17;">
<div style="max-width:480px;margin:0 auto;background:#FAF7F2;border:1px solid rgba(28,26,23,0.10);border-radius:16px;padding:32px;text-align:center;">
<div style="font-family:Georgia,serif;font-size:14px;letter-spacing:0.14em;text-transform:uppercase;color:#B8953A;margin-bottom:16px;">Colors of Glory</div>
<p style="font-family:Georgia,serif;font-size:20px;margin:0 0 12px;"><strong>${title}</strong></p>
<p style="font-size:15px;line-height:1.6;color:#6B6459;margin:0;">${body}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const rawCategory = url.searchParams.get("c") ?? "all";
  const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "all";

  const userId = await verifyUnsubToken(token);
  if (!userId) {
    return req.method === "POST"
      ? new Response("invalid_token", { status: 400 })
      : page("That link has expired.", "You can manage every email preference from Settings inside Colors of Glory.");
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Idempotent: the unique (user_id, category) constraint makes repeats a no-op.
    const { error } = await admin
      .from("email_suppressions")
      .upsert(
        { user_id: userId, category, reason: "unsubscribe", expires_at: null },
        { onConflict: "user_id,category" },
      );
    if (error) console.error("[email-unsubscribe] upsert_failed", error.message);
  } catch (e) {
    console.error("[email-unsubscribe] failed", String(e));
  }

  if (req.method === "POST") {
    // RFC 8058: a 2xx with no body is all the mail client needs.
    return new Response(null, { status: 200 });
  }

  const label = category === "all" ? "non-essential email" : `these emails`;
  return page(
    "You're unsubscribed.",
    `You won't receive ${label} from Colors of Glory anymore. Service messages about your account and songs still arrive. You can change this anytime in Settings → Notifications.`,
  );
});
