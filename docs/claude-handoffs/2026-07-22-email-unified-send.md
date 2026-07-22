# Email — unified send path + observability (L12 continuation)

All transactional email now flows through one path. Frontend + edge functions
call the same registry, the same render, and the same log.

## New surface

- **Edge fn `send-transactional-email`** — single POST endpoint.
  Auth: user JWT (recipient must be the caller's own email) OR service role.
  Body: `{ templateName, recipientEmail, templateData?, idempotencyKey?, from?, replyTo?, userId? }`.
  Returns `{ ok, status, logId, messageId? }`.

- **Edge fn `email-preview`** — dev preview surface, gated by
  `EMAIL_PREVIEW_TOKEN`. `GET /?token=…` lists all registered templates;
  `GET /?token=…&template=welcome[&data={...}]` renders one.

- **SDK `src/integrations/cog/emails.ts`**
  - `sendTransactionalEmail({ templateName, recipientEmail, templateData, idempotencyKey })`
  - `listMyRecentEmails(limit)` — for a "notifications history" surface in
    settings. Deduped per `message_id` implicitly by ordering + limit.

## Observability

- `email_send_log` is the single source of truth. Every send (queue, direct,
  OTP) writes a row via `_shared/sendAndLog.ts`. Rows carry `message_id`,
  `template_name`, `category`, `status`, and per-event timestamps (sent,
  delivered, opened, clicked, bounced, complained) plus `open_count` /
  `click_count`.
- `resend-webhook` now handles the full Resend event set and updates the
  matching `email_send_log` row keyed by `message_id`. Bounce / complaint /
  delivery-delayed events still write to `email_suppressions`.
- Idempotency: pass `idempotencyKey` — a second call with the same key
  returns `{ status: "duplicate" }` and does not send again.

## Retrofits shipped

- `email-otp-start` now renders via `otpCodeEmail()` and sends through
  `sendAndLog`, so signup / login / reset codes appear in
  `email_send_log` with `category='auth'` and `template_name='otp_<purpose>'`.

## What Claude Code should do next

1. **Notification history UI** — Settings → "Emails from us". Call
   `listMyRecentEmails()` and render status pill (delivered / opened /
   failed) with template display name from `emailRegistry`.
2. **Preview link in dev** — add an internal `/dev/emails` route that
   iframes `${SUPABASE_URL}/functions/v1/email-preview?token=…` when
   `import.meta.env.DEV`.
3. **Move remaining hand-rolled sends** (`song-invite-create`,
   `send-contact`, `notify-referral-event`) onto the registry + `sendAndLog`
   path so every email appears in the log. Existing renderers can stay —
   just wrap the outbound call.

## Ops notes

- Set `EMAIL_PREVIEW_TOKEN` (any 32+ random string) to enable the preview
  endpoint. Leave unset in prod to disable.
- Webhook events are idempotent per message_id — safe to replay.