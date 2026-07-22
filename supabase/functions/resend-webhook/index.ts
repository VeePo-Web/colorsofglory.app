// Resend delivery webhook. Turns hard bounces + spam complaints into
// email_suppressions rows so canSend() will never mail that person again.
// Signature check uses RESEND_WEBHOOK_SECRET (svix-compatible headers).
// verify_jwt = false (see supabase/config.toml).

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-timestamp, svix-signature",
};

async function verifySvix(body: string, headers: Headers): Promise<boolean> {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return true; // dev: allow when unconfigured
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(rawSecret + "=".repeat((4 - rawSecret.length % 4) % 4)), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const toSign = new TextEncoder().encode(`${id}.${ts}.${body}`);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, toSign));
  const expected = btoa(String.fromCharCode(...sig));
  return sigHeader.split(" ").some((p) => p.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const raw = await req.text();
  if (!(await verifySvix(raw, req.headers))) {
    return new Response(JSON.stringify({ error: "bad_signature" }), { status: 401, headers: cors });
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response("bad_json", { status: 400 }); }

  const type: string = evt?.type ?? "";
  const to: string | undefined = Array.isArray(evt?.data?.to) ? evt.data.to[0] : evt?.data?.to;
  if (!to) return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await admin
    .from("profiles").select("user_id").eq("email", to.toLowerCase()).maybeSingle();
  const userId = profile?.user_id;

  if (userId && (type === "email.bounced" || type === "email.complained")) {
    const isHard = type === "email.complained" ||
      (evt?.data?.bounce?.type ?? "").toLowerCase().includes("hard");
    if (isHard) {
      await admin.from("email_suppressions").upsert(
        {
          user_id: userId,
          category: "all",
          reason: type === "email.complained" ? "complaint" : "hard_bounce",
          expires_at: null,
        },
        { onConflict: "user_id,category" },
      );
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});