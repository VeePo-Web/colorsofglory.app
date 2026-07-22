
# L12 — World-Class Email System: Design, Observability, Deliverability

## Why this is next

L11 wired the data spine (queue, preferences, suppressions, evaluators, webhook, cron). What ships to inboxes today is still a patchwork:

- Lifecycle/referral emails render from **20+ raw HTML functions** in `supabase/functions/_shared/email.ts` (not React Email, no shared layout tokens, hard to preview or A/B).
- OTP + reset emails render from a **separate one-off HTML string** in `email-otp-start/index.ts` — different look, different sender path, different footer.
- Contact-form emails and Stripe receipts go through **yet another path**.
- `resend-webhook` verifies signatures and writes to `email_suppressions`, but there is **no send log** — no per-message record of what was sent, delivered, opened, clicked, bounced, or complained. We can't answer "did the invite email land?" or "what's our open rate on weekly recaps?".
- No **preview surface** — we can't see a template without triggering a real send.

L12 turns this into one worldclass system: one brand, one send path, one observable log, one preview surface.

## Scope (locked)

Backend + SDK only (Lovable lane). No page/component work in `src/pages` or `src/components` beyond a single dev-only preview route hand-off doc.

### Deliverables

1. **React Email design system** at `supabase/functions/_shared/transactional-email-templates/`
   - Shared `<CogLayout>` with cream body, gold accent header bar, serif "Colors of Glory" wordmark, warm-gray footer with unsubscribe + physical address.
   - Shared primitives: `<CogHeading>`, `<CogText>`, `<CogButton>` (gold pill), `<CogCode>` (OTP display), `<CogQuote>`, `<CogMetaRow>`, `<CogDivider>`.
   - Design tokens hard-coded to brand (cream `#F5F0E8`, gold `#B8953A`, charcoal `#1C1A17`, serif Georgia fallback for Outlook).
   - `registry.ts` exporting every template as `TemplateEntry` with `component`, `subject`, `displayName`, `previewData`.

2. **Template migration (22 templates)** — one file per template, all pointing to `<CogLayout>`:
   - Auth/account: `otp-signup`, `otp-signin`, `otp-reset`, `welcome`, `password-changed`
   - Lifecycle: `first-song-nudge`, `hum-capture`, `lyrics-chords`, `first-collaborator`, `referral-explainer`, `first-capture-win`, `room-ready`, `stalled-song`, `your-week`, `invite-nudge`, `gentle-return`, `what-changed`
   - Collaboration: `invite`, `invite-reminder`, `invite-accepted`
   - Rewards: `reward-signup`, `reward-first-song`, `reward-subscription`, `reward-payout`

3. **`send-transactional-email` edge function** — single send path:
   - Input: `{ templateName, recipientEmail, templateData, idempotencyKey, category, from? }`
   - Renders the registered React Email component, checks `email_suppressions`, writes to `email_send_log` (see below), calls Resend, records provider `message_id`.
   - Retrofits `notify-referral-event`, `email-lifecycle-evaluator`, `email-otp-start`, `contact-form` (if present), and any Stripe receipt path to invoke this function instead of hand-rolling HTML.

4. **`email_send_log` table** — full per-message observability:
   ```
   id uuid pk, message_id text (Resend id, unique nullable),
   template_name text, category text, recipient_email citext,
   user_id uuid null, subject text, idempotency_key text unique null,
   status text ('queued'|'sent'|'delivered'|'opened'|'clicked'|'bounced'|'complained'|'failed'|'suppressed'),
   suppression_reason text null, error text null,
   sent_at timestamptz, delivered_at, first_opened_at, first_clicked_at, bounced_at, complained_at,
   open_count int default 0, click_count int default 0,
   meta jsonb
   ```
   RLS: `service_role` all; `authenticated` can `SELECT` their own rows only (for future "email history" UI). GRANT + policies in same migration.

5. **`resend-webhook` upgrade** — expand beyond suppressions:
   - Handle `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed`.
   - Update `email_send_log` by `message_id`; increment counters; set timestamps.
   - Continue writing bounces/complaints to `email_suppressions`.
   - Idempotent on duplicate webhook deliveries.

6. **Preview surface** — `email-preview` edge function (dev-token gated):
   - `GET /?template=welcome&data=<json>` → returns rendered HTML.
   - `GET /` → returns an index page listing every registered template with links (uses `previewData`).
   - Gated by `EMAIL_PREVIEW_TOKEN` header/query; no auth JWT required, no PII.

7. **Admin analytics RPC** — `email_analytics_summary(from timestamptz, to timestamptz)`:
   - Returns per-template rows: `sent, delivered, opened, clicked, bounced, complained, delivery_rate, open_rate, click_rate`.
   - `SECURITY DEFINER`, restricted via `has_role(auth.uid(), 'admin')`.

8. **SDK** — `src/integrations/cog/emails.ts`:
   - `sendTransactionalEmail(templateName, recipientEmail, templateData, opts?)` typed against the registry.
   - `getEmailHistory()` for the signed-in user (reads own `email_send_log` rows).
   - Zero UI. Handoff doc for Claude describes optional `/settings/emails` history page and admin dashboard queries.

9. **Handoff doc** at `docs/claude-handoffs/2026-07-22-email-design-system.md` covering: preview route usage, admin dashboard queries, brand tokens for any in-app email-ish surfaces, and what NOT to touch.

## Build order

```text
1. Migration: email_send_log + GRANT + RLS + policies + indexes
2. Migration: email_analytics_summary RPC
3. Shared React Email primitives + CogLayout + registry skeleton
4. Migrate 22 templates (auth/lifecycle/collab/rewards) to registry
5. send-transactional-email edge function
6. Retrofit call sites: notify-referral-event, email-lifecycle-evaluator,
   email-otp-start, any contact/receipt paths
7. Upgrade resend-webhook to handle full event set + write send_log
8. email-preview edge function + EMAIL_PREVIEW_TOKEN secret
9. SDK: src/integrations/cog/emails.ts
10. Handoff doc + smoke test each template via preview + one live send per category
```

## Verification

- `bun run build` + typecheck clean.
- Preview URL renders every template with brand-correct cream/gold/serif.
- One live test send per category (auth, lifecycle, collab, reward) lands with unified branding.
- `email_send_log` receives `sent` row on send, updates to `delivered` / `opened` when webhook fires (verified with a real open).
- `email_analytics_summary` returns non-null aggregates for the test window.
- `email_suppressions` still populated by bounce/complaint (regression check).
- Idempotency: replaying a webhook payload doesn't double-count.

## Explicitly out of scope

- Frontend pages/components (Claude's lane): email history UI, admin analytics dashboard, preference center redesign.
- Marketing/campaign emails (policy: transactional only).
- A/B testing framework (future L13).
- Dark mode email variants (Outlook/Gmail render light regardless).
- Rewriting queue/cron infrastructure from L11.

Approve to build.
