import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendViaResend, COG_SENDERS } from "../_shared/resend.ts";
import {
  firstCaptureWinEmail,
  firstCollaboratorEmail,
  firstSongNudgeEmail,
  gentleReturnEmail,
  humCaptureEmail,
  inviteNudgeEmail,
  inviteReminderEmail,
  lyricsChordsEmail,
  referralExplainerEmail,
  rewardEmail,
  roomReadyEmail,
  stalledSongEmail,
  UNSUB_URL_PLACEHOLDER,
  welcomeEmail,
  whatChangedEmail,
  yourWeekEmail,
  type RenderedTemplate,
} from "../_shared/email.ts";
import { canSend, unsubscribeUrl } from "../_shared/emailGovernance.ts";

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
  created_at: string;
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
        .eq("owner_user_id", row.user_id);
      if ((count ?? 0) > 0) return { skip: "already_has_song" };
      return { template: firstSongNudgeEmail(), from: COG_SENDERS.primary };
    }
    case "digest.what_changed": {
      const lines = Array.isArray(p.lines) ? (p.lines as string[]) : [];
      if (lines.length === 0) return { skip: "empty_digest" };
      // If they've visited the room since this was queued, they've already
      // seen the recap in-app — the email evaporates (sanctuary rule).
      const { data: pref } = await admin
        .from("song_notification_prefs")
        .select("last_seen_at")
        .eq("song_id", p.song_id as string)
        .eq("user_id", row.user_id)
        .maybeSingle();
      if (pref?.last_seen_at && pref.last_seen_at > row.created_at) {
        return { skip: "visited_since_queued" };
      }
      return {
        template: whatChangedEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
          lines,
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "edu.hum_capture": {
      // Evaporates if they've since recorded — a coach, not a newsletter.
      const { count } = await admin
        .from("voice_memos")
        .select("id", { count: "exact", head: true })
        .eq("author_user_id", row.user_id);
      if ((count ?? 0) > 0) return { skip: "already_recorded" };
      return {
        template: humCaptureEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "edu.lyrics_chords": {
      const songId = p.song_id as string | undefined;
      if (!songId) return { skip: "missing_song_id" };
      const { count } = await admin
        .from("song_lyrics")
        .select("id", { count: "exact", head: true })
        .eq("song_id", songId);
      if ((count ?? 0) > 0) return { skip: "already_has_lyrics" };
      return {
        template: lyricsChordsEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId,
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "collab.first_collaborator_owner": {
      return {
        template: firstCollaboratorEmail({
          inviteeName: (p.invitee_name as string) ?? "Your collaborator",
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "growth.referral_explainer": {
      return { template: referralExplainerEmail(), from: COG_SENDERS.referrals };
    }
    case "onboarding.first_capture_win": {
      return {
        template: firstCaptureWinEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "onboarding.room_ready": {
      return {
        template: roomReadyEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "onboarding.stalled_day3": {
      // Evaporates if the song has been touched since this was queued.
      const songId = p.song_id as string | undefined;
      if (!songId) return { skip: "missing_song_id" };
      const { count } = await admin
        .from("song_activity")
        .select("id", { count: "exact", head: true })
        .eq("song_id", songId)
        .gte("created_at", new Date(Date.now() - 72 * 3600 * 1000).toISOString());
      if ((count ?? 0) > 0) return { skip: "song_no_longer_stalled" };
      return {
        template: stalledSongEmail({
          songTitle: (p.song_title as string) ?? "Your song",
          songId,
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "digest.your_week": {
      return {
        template: yourWeekEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
          ideaCount: typeof p.idea_count === "number" ? p.idea_count : 1,
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "growth.invite_nudge": {
      // Evaporates if they've since sent an invite — the nudge's job is done.
      const { count } = await admin
        .from("song_invites")
        .select("id", { count: "exact", head: true })
        .eq("created_by_user_id", row.user_id)
        .gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString());
      if ((count ?? 0) > 0) return { skip: "already_invited_recently" };
      return {
        template: inviteNudgeEmail({
          songTitle: (p.song_title as string) ?? "your song",
          songId: (p.song_id as string) ?? "",
        }),
        from: COG_SENDERS.primary,
      };
    }
    case "retain.gentle_return": {
      return {
        template: gentleReturnEmail({
          songTitle: (p.song_title as string) ?? "Your song",
          songId: (p.song_id as string) ?? "",
        }),
        from: COG_SENDERS.primary,
      };
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
    .select("id, user_id, kind, category, payload, attempts, created_at")
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

  // §7 priority within a batch — when the daily cap admits only one email,
  // the winner should be the one that matters most:
  // collab.* > digest.what_changed > edu.* > growth.* > retain.* > rest.
  const prio = (r: QueueRow) => {
    if (r.category === "collab") return 0;
    if (r.kind === "digest.what_changed") return 1;
    if (r.category === "edu") return 2;
    if (r.category === "growth") return 3;
    if (r.category === "retain") return 4;
    return 5;
  };
  (rows ?? []).sort((a, b) => prio(a as QueueRow) - prio(b as QueueRow));

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

      // Lifecycle mail to a real user carries the RFC 8058 one-click
      // unsubscribe: tokenized URL in the footer placeholder + the
      // List-Unsubscribe headers Gmail/Yahoo require of bulk senders.
      let { html, text } = rendered.template;
      let headers: Record<string, string> | undefined;
      if (row.category && recipientIsUser) {
        const unsub = await unsubscribeUrl(row.user_id, row.category);
        html = html.split(UNSUB_URL_PLACEHOLDER).join(unsub);
        text = text.split(UNSUB_URL_PLACEHOLDER).join(unsub);
        headers = {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        };
      }

      const result = await sendViaResend({
        from: rendered.from,
        to,
        subject: rendered.template.subject,
        html,
        text,
        headers,
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
