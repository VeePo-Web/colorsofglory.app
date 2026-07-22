// SDK wrapper for the unified email surface.
// Frontend + Claude Code use this instead of calling edge functions ad-hoc.

import { supabase } from "@/integrations/supabase/client";

export type EmailStatus =
  | "queued" | "sent" | "delivered" | "opened" | "clicked"
  | "bounced" | "complained" | "suppressed" | "failed" | "duplicate";

export interface SendTransactionalArgs {
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
  from?: string;
  replyTo?: string;
  userId?: string;
}

export async function sendTransactionalEmail(args: SendTransactionalArgs): Promise<{
  ok: boolean; status: EmailStatus; logId?: string; messageId?: string; error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("send-transactional-email", { body: args });
  if (error) {
    let detail = error.message;
    try {
      // deno-lint-ignore no-explicit-any
      const ctx = (error as any).context;
      if (ctx?.json) detail = JSON.stringify(await ctx.json());
      else if (ctx?.text) detail = await ctx.text();
    } catch { /* keep original */ }
    return { ok: false, status: "failed", error: detail };
  }
  return data as { ok: boolean; status: EmailStatus; logId?: string; messageId?: string };
}

export interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  category: string | null;
  recipient_email: string;
  subject: string | null;
  status: EmailStatus;
  sent_at: string | null;
  delivered_at: string | null;
  first_opened_at: string | null;
  first_clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  open_count: number;
  click_count: number;
  error: string | null;
  created_at: string;
}

/** Latest send per message_id — matches the dashboard dedup rule. */
export async function listMyRecentEmails(limit = 25): Promise<EmailLogRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return [];
  const { data, error } = await supabase
    .from("email_send_log")
    .select(
      "id,message_id,template_name,category,recipient_email,subject,status,sent_at,delivered_at,first_opened_at,first_clicked_at,bounced_at,complained_at,open_count,click_count,error,created_at",
    )
    .eq("recipient_email", user.email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EmailLogRow[];
}