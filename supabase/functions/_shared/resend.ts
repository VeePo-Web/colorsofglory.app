// Shared Resend sender for Colors of Glory.
// Routes all outbound mail through the Lovable Connector Gateway, signed with
// LOVABLE_API_KEY + RESEND_API_KEY (auto-provisioned by the linked connector).
//
// Verified sender domain: colorsofglory.app
//   - hello@colorsofglory.app        → general / marketing-adjacent transactional
//   - security@colorsofglory.app     → auth codes, password resets
//   - referrals@colorsofglory.app    → reward + payout notifications

const GATEWAY = "https://connector-gateway.lovable.dev/resend";

export const COG_SENDERS = {
  primary: "Colors of Glory <hello@colorsofglory.app>",
  security: "Colors of Glory Security <security@colorsofglory.app>",
  referrals: "Colors of Glory Referrals <referrals@colorsofglory.app>",
} as const;

export interface ResendSendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

export interface ResendSendResult {
  id?: string;
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * Send a single transactional email via Resend (through the connector gateway).
 * Throws on misconfiguration; resolves with `{ ok: false, ... }` on send failure
 * so callers can decide retry/log behavior.
 */
export async function sendViaResend(args: ResendSendArgs): Promise<ResendSendResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    throw new Error("email_provider_unconfigured");
  }

  const from = args.from ?? COG_SENDERS.primary;
  const to = Array.isArray(args.to) ? args.to : [args.to];

  const payload: Record<string, unknown> = {
    from,
    to,
    subject: args.subject,
    html: args.html,
  };
  if (args.text) payload.text = args.text;
  if (args.replyTo) payload.reply_to = args.replyTo;
  if (args.headers) payload.headers = args.headers;
  if (args.tags && args.tags.length > 0) payload.tags = args.tags;
  else payload.tags = [{ name: "app", value: "cog" }];

  const resp = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    body = await resp.text().catch(() => null);
  }

  if (!resp.ok) {
    console.error("[resend] send_failed", resp.status, body);
    return { ok: false, status: resp.status, body };
  }

  const id = (body as { id?: string } | null)?.id;
  return { ok: true, status: resp.status, body, id };
}