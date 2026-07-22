// Single send path for every transactional email — external callers (SDK,
// other edge functions) hit this instead of hand-rolling HTML.
//
// Contract:
//   POST { templateName, recipientEmail, templateData, idempotencyKey?,
//          category?, from?, replyTo?, userId? }
//   → { ok, status, logId, messageId? }
//
// Auth: requires a signed-in user JWT OR the service role key in
// Authorization. Prevents random spam through this endpoint.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getTemplate } from "../_shared/email-registry.ts";
import { canSend } from "../_shared/emailGovernance.ts";
import { sendAndLog } from "../_shared/sendAndLog.ts";
import { COG_SENDERS } from "../_shared/resend.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const FROM_BY_CATEGORY: Record<string, string> = {
  auth: COG_SENDERS.security,
  money: COG_SENDERS.referrals,
  growth: COG_SENDERS.referrals,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceCaller = auth === `Bearer ${serviceRole}`;

  let callerUserId: string | null = null;
  if (!isServiceCaller) {
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    callerUserId = userData.user.id;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const templateName = String(body.templateName ?? "");
  const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
  const templateData = (body.templateData ?? {}) as Record<string, unknown>;
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : null;
  const from = body.from ? String(body.from) : undefined;
  const replyTo = body.replyTo ? String(body.replyTo) : undefined;
  const requestedUserId = body.userId ? String(body.userId) : null;

  if (!templateName || !recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return json({ error: "invalid_request" }, 400);
  }

  const template = getTemplate(templateName);
  if (!template) return json({ error: "unknown_template" }, 404);

  // Non-service callers can only send to themselves (safety fence).
  if (!isServiceCaller) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", callerUserId!)
      .maybeSingle();
    if ((profile?.email ?? "").toLowerCase() !== recipientEmail) {
      return json({ error: "forbidden_recipient" }, 403);
    }
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);

  // Governance check — respect suppressions + user prefs (auth mail is always allowed).
  let suppressed: { reason: string } | null = null;
  const govUserId = requestedUserId ?? callerUserId ?? null;
  if (template.category !== "auth" && template.category !== "collab" && govUserId) {
    // Look up recipient timezone once.
    const { data: prof } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", govUserId)
      .maybeSingle();
    const gate = await canSend(admin, govUserId, template.category, prof?.timezone ?? null);
    if (!gate.allow) suppressed = { reason: gate.reason ?? "blocked" };
  }

  let rendered;
  try {
    rendered = template.render(templateData);
  } catch (e) {
    return json({ error: "render_failed", detail: String(e) }, 400);
  }

  const result = await sendAndLog({
    templateName,
    category: template.category,
    recipientEmail,
    userId: requestedUserId ?? callerUserId ?? null,
    rendered,
    from: from ?? FROM_BY_CATEGORY[template.category] ?? COG_SENDERS.primary,
    replyTo,
    idempotencyKey,
    suppressed,
    meta: { via: "send-transactional-email" },
  }, admin);

  return json(result, result.ok || result.status === "suppressed" || result.status === "duplicate" ? 200 : 502);
});