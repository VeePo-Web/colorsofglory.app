// Unified send + log helper. Every transactional email in Colors of Glory
// should go through here so email_send_log has one row per attempt.
//
// Writes a `queued` row first, calls Resend, then updates the row to `sent`
// (with the Resend message_id), `failed`, or `suppressed`. The message_id
// links webhook deliveries back to the send.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendViaResend, ResendSendResult } from "./resend.ts";
import { RenderedTemplate } from "./email.ts";

export interface SendAndLogArgs {
  templateName: string;
  category?: string | null;
  recipientEmail: string;
  userId?: string | null;
  rendered: RenderedTemplate;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string | null;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
  /** Extra JSON metadata to store on the send_log row. */
  meta?: Record<string, unknown>;
  /** Optional pre-check: if the recipient is suppressed, skip send and record `suppressed`. */
  suppressed?: { reason: string } | null;
}

export interface SendAndLogResult {
  ok: boolean;
  status: "sent" | "suppressed" | "failed" | "duplicate";
  logId?: string;
  messageId?: string;
  error?: string;
}

function makeAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function sendAndLog(args: SendAndLogArgs, adminClient?: SupabaseClient): Promise<SendAndLogResult> {
  const admin = adminClient ?? makeAdmin();
  const recipient = args.recipientEmail.trim().toLowerCase();

  // Idempotency short-circuit — if we've already logged this key, don't resend.
  if (args.idempotencyKey) {
    const { data: existing } = await admin
      .from("email_send_log")
      .select("id,status,message_id")
      .eq("idempotency_key", args.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: existing.status !== "failed",
        status: "duplicate",
        logId: existing.id as string,
        messageId: (existing.message_id as string | null) ?? undefined,
      };
    }
  }

  // Insert queued row up-front (so a mid-send crash still leaves a trace).
  const { data: inserted, error: insertErr } = await admin
    .from("email_send_log")
    .insert({
      template_name: args.templateName,
      category: args.category ?? null,
      recipient_email: recipient,
      user_id: args.userId ?? null,
      subject: args.rendered.subject,
      idempotency_key: args.idempotencyKey ?? null,
      status: args.suppressed ? "suppressed" : "queued",
      suppression_reason: args.suppressed?.reason ?? null,
      meta: args.meta ?? {},
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[sendAndLog] insert failed", insertErr.message);
    return { ok: false, status: "failed", error: insertErr.message };
  }
  const logId = inserted!.id as string;

  if (args.suppressed) {
    return { ok: false, status: "suppressed", logId };
  }

  let result: ResendSendResult;
  try {
    result = await sendViaResend({
      to: recipient,
      subject: args.rendered.subject,
      html: args.rendered.html,
      text: args.rendered.text,
      from: args.from,
      replyTo: args.replyTo,
      tags: args.tags ?? [
        { name: "app", value: "cog" },
        { name: "template", value: args.templateName },
      ],
      headers: {
        // Correlate webhook deliveries → send_log row.
        "X-Cog-Log-Id": logId,
        "X-Cog-Template": args.templateName,
        ...(args.headers ?? {}),
      },
    });
  } catch (e) {
    await admin.from("email_send_log")
      .update({ status: "failed", error: String(e) })
      .eq("id", logId);
    return { ok: false, status: "failed", logId, error: String(e) };
  }

  if (!result.ok) {
    await admin.from("email_send_log")
      .update({
        status: "failed",
        error: `resend_${result.status}`,
        meta: { ...(args.meta ?? {}), resend_body: result.body },
      })
      .eq("id", logId);
    return { ok: false, status: "failed", logId, error: `resend_${result.status}` };
  }

  await admin.from("email_send_log")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      message_id: result.id ?? null,
    })
    .eq("id", logId);

  return { ok: true, status: "sent", logId, messageId: result.id };
}