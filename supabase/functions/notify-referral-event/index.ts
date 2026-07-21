import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendViaResend, COG_SENDERS } from "../_shared/resend.ts";
import {
  firstSongNudgeEmail,
  inviteReminderEmail,
  rewardEmail,
  welcomeEmail,
  type RenderedTemplate,
} from "../_shared/email.ts";
import { canSend } from "../_shared/emailGovernance.ts";

// The GOVERNED email outbox drain (docs/email/COG-EMAIL-SYSTEM.md §1/§7/§8).
//
// Historically this function drained only referral reward kinds; it is now
// the one multi-category worker for every queued email. Its laws:
//   · rows send only once `scheduled_for` has passed
//   · lifecycle rows (category set) pass the canSend gate — suppressions,
//     rolling caps, quiet hours (deferred rows are rescheduled, not dropped)
//   · reward kinds stay transactional (no gate) — money mail always sends
//   · a recipient can be a NON-USER (payload.to_email) — e.g. an invite
//     reminder to someone who hasn't signed up yet
//   · unknown kinds are parked (sent_at set + flagged) so the queue can
//     never wedge behind a bad row
//   · when Resend keys are absent, everything logs-only and drains (dev)
//
// THE PRIVACY FENCE: payloads carry only titles, names, kinds, tokens —
// never lyric/memo/note content. Templates enforce the same.

const BATCH = 25;

const REWARD_KINDS = new Set([
  "reward_minted",
  "reward_matured",
  "reward_paid",
  "payout_approved",
  "payout_sent",
  "payout_failed",
]);

type QueueRow = {
  id: string;
  user_id: string;
  kind: string;
  category: string | null;
  payload: Record<string, unknown>;
  attempts: number;
};

// deno-lint-ignore no-explicit-any
async function renderRow(admin: any, row: QueueRow): Promise<
  | { template: RenderedTemplate; from: string; toOverride?: string }
  | { skip: string }
> {
  const p = row.payload ?? {};

  if (REWARD_KINDS.has(row.kind)) {
    const amount = typeof p.amount_cents === "number" ? p.amount_cents : null;
    return { template: rewardEmail(row.kind, amount), from: COG_SENDERS.referrals };
  }

  switch (row.kind) {
    case "onboarding.welcome": {
      return {
        template: welcomeEmail({ firstName: (p.first_name as string) ?? null }),
        from: COG_SENDERS.primary,
      };
    }
    case "onboarding.first_song_nudge": {
      // Only if they STILL have no song — the nudge evaporates on success.
      const { count } = await admin
        .from("songs")
        .select("id", { count: "exact", head: true })
        .eq("created_by", row.user_id);
      if ((count ?? 0) > 0) return { skip: "already_has_song" };
      return { template: firstSongNudgeEmail(), from: COG_SENDERS.primary };
    }
    case "collab.invite_reminder": {
      // Exactly once, and only while the invite is still pending.
      const inviteId = p.invite_id as string | undefined;
      if (!inviteId) return { skip: "missing_invite_id" };
      const { data: invite } = await admin
        .from("song_invites")
        .select("status, token, invited_email")
        .eq("id", inviteId)
        .maybeSingle();
      if (!invite || invite.status !== "pending") return { skip: "invite_resolved" };
      if (!invite.invited_email) return { skip: "no_invited_email" };
      return {
        template: inviteReminderEmail({
          inviterName: (p.inviter_name as string) ?? "A songwriter",
          songTitle: (p.song_title as string) ?? "a song",
          token: invite.token,
        }),
        from: COG_SENDERS.primary,
        toOverride: invite.invited_email,
      };
    }
    default:
      return { skip: "unknown_kind" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id, user_id, kind, category, payload, attempts")
    .is("sent_at", null)
    .lt("attempts", 5)
    .lte("scheduled_for", nowIso)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  let sent = 0, failed = 0, skipped = 0, deferred = 0;

  const mark = (id: string, patch: Record<string, unknown>) =>
    supabase.from("notification_queue").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);

  // Park a row DEAD (attempts=5) so it neither retries nor pollutes the
  // rolling-cap counts — sent_at is reserved for real deliveries only.
  const park = (id: string, reason: string) =>
    mark(id, { attempts: 5, last_error: reason });

  for (const row of (rows ?? []) as QueueRow[]) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name, first_name, timezone")
        .eq("user_id", row.user_id)
        .maybeSingle();

      const rendered = await renderRow(supabase, row);
      if ("skip" in rendered) {
        // Parked, not retried — a stale/unknown row must never wedge the queue.
        await park(row.id, `skipped_${rendered.skip}`);
        skipped++;
        continue;
      }

      const to = rendered.toOverride ?? (row.payload?.to_email as string | undefined) ?? profile?.email;
      if (!to) {
        await mark(row.id, { attempts: row.attempts + 1, last_error: "no_email_on_profile" });
        skipped++;
        continue;
      }

      // Lifecycle rows pass the calm gate — but only when the recipient IS
      // the queue's user (caps + quiet hours protect a USER's inbox; a
      // non-user invitee has no history to cap and gets exactly one
      // reminder by construction). Deferred rows reschedule, never drop.
      const recipientIsUser = to === profile?.email;
      if (row.category && recipientIsUser) {
        const verdict = await canSend(supabase, row.user_id, row.category, profile?.timezone);
        if (!verdict.allow) {
          if (verdict.deferUntil) {
            await mark(row.id, { scheduled_for: verdict.deferUntil });
            deferred++;
          } else {
            await park(row.id, verdict.reason);
            skipped++;
          }
          continue;
        }
      }

      if (!resendKey || !lovableKey) {
        console.log("[email-drain] would send:", row.kind, to);
        await mark(row.id, { sent_at: nowIso, last_error: "resend_not_configured_logged_only" });
        sent++;
        continue;
      }

      const result = await sendViaResend({
        from: rendered.from,
        to,
        subject: rendered.template.subject,
        html: rendered.template.html,
        text: rendered.template.text,
        tags: [
          { name: "app", value: "cog" },
          { name: "category", value: row.category ?? (REWARD_KINDS.has(row.kind) ? "growth" : "system") },
          { name: "kind", value: row.kind.replace(/[^a-zA-Z0-9_-]/g, "_") },
        ],
      }).catch((e) => ({ ok: false, status: 0, body: String(e) } as const));

      if (!result.ok) {
        const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
        await mark(row.id, {
          attempts: row.attempts + 1,
          last_error: `resend_${result.status}:${String(text).slice(0, 200)}`,
        });
        failed++;
        continue;
      }

      await mark(row.id, { sent_at: new Date().toISOString(), last_error: null });
      sent++;
    } catch (e) {
      await mark(row.id, { attempts: row.attempts + 1, last_error: String(e).slice(0, 300) });
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ scanned: rows?.length ?? 0, sent, failed, skipped, deferred }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
