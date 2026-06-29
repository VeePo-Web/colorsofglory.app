import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendViaResend, COG_SENDERS } from "../_shared/resend.ts";

// Drains pending rows from public.notification_queue and sends them via Resend.
// If RESEND_API_KEY is not configured the function still marks rows as sent
// (logs to console) so the queue does not grow unbounded in dev.

const FROM = COG_SENDERS.referrals;
const BATCH = 25;

function subject(kind: string, amountCents: number | null): string {
  const usd = amountCents != null ? `$${(amountCents / 100).toFixed(2)}` : "";
  switch (kind) {
    case "reward_minted":   return `New referral reward — ${usd} pending`;
    case "reward_matured":  return `Your reward of ${usd} is ready for payout`;
    case "reward_paid":     return `Reward of ${usd} marked paid`;
    case "payout_approved": return `Payout of ${usd} approved`;
    case "payout_sent":     return `Payout of ${usd} sent`;
    case "payout_failed":   return `Payout of ${usd} failed — action needed`;
    default: return "Update from Colors of Glory";
  }
}

function body(kind: string, amountCents: number | null): string {
  const usd = amountCents != null ? `$${(amountCents / 100).toFixed(2)}` : "";
  const head = `<p style="font-family:Georgia,serif;font-size:18px;color:#1C1A17">Colors of Glory</p>`;
  const msg: Record<string, string> = {
    reward_minted:   `<p>A friend you referred just paid. Your reward of <b>${usd}</b> is pending — it becomes payable after the 30-day hold.</p>`,
    reward_matured:  `<p>Your reward of <b>${usd}</b> has matured and will be included in the next monthly payout draft.</p>`,
    reward_paid:     `<p>Your reward of <b>${usd}</b> has been marked paid. Thank you for bringing people into the room.</p>`,
    payout_approved: `<p>Your payout of <b>${usd}</b> has been approved and is queued for sending.</p>`,
    payout_sent:     `<p>Your payout of <b>${usd}</b> has been sent. Watch for it on your chosen payout method.</p>`,
    payout_failed:   `<p>Your payout of <b>${usd}</b> failed to send. Please update your payout method and contact support.</p>`,
  };
  return `<div style="background:#F5F0E8;padding:24px;color:#1C1A17;font-family:Inter,system-ui,sans-serif">${head}${msg[kind] ?? "<p>Update.</p>"}</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id, user_id, kind, payload, attempts")
    .is("sent_at", null)
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  let sent = 0, failed = 0, skipped = 0;

  for (const row of rows ?? []) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name, first_name")
        .eq("user_id", row.user_id)
        .maybeSingle();

      const email = profile?.email;
      if (!email) {
        await supabase.from("notification_queue").update({
          attempts: row.attempts + 1,
          last_error: "no_email_on_profile",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        skipped++;
        continue;
      }

      const amount = (row.payload as any)?.amount_cents ?? null;

      if (!resendKey || !lovableKey) {
        console.log("[notify-referral-event] would send:", row.kind, email, amount);
        await supabase.from("notification_queue").update({
          sent_at: new Date().toISOString(),
          last_error: "resend_not_configured_logged_only",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        sent++;
        continue;
      }

      const result = await sendViaResend({
        from: FROM,
        to: email,
        subject: subject(row.kind, amount),
        html: body(row.kind, amount),
        tags: [
          { name: "app", value: "cog" },
          { name: "category", value: "referral" },
          { name: "kind", value: row.kind },
        ],
      }).catch((e) => ({ ok: false, status: 0, body: String(e) } as const));

      if (!result.ok) {
        const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
        await supabase.from("notification_queue").update({
          attempts: row.attempts + 1,
          last_error: `resend_${result.status}:${String(text).slice(0, 200)}`,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        failed++;
        continue;
      }

      await supabase.from("notification_queue").update({
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      sent++;
    } catch (e) {
      await supabase.from("notification_queue").update({
        attempts: row.attempts + 1,
        last_error: String(e).slice(0, 300),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ scanned: rows?.length ?? 0, sent, failed, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});