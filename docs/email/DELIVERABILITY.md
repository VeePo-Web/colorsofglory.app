# COG Email Deliverability

Sender domain: **colorsofglory.app** (Resend). Reply-To routes to `people@colorsofglory.com` (Google Workspace).

## Required DNS (publish at the registrar)

1. **SPF** — Resend adds a TXT: `v=spf1 include:amazonses.com ~all` (exact record shown in the Resend dashboard).
2. **DKIM** — three CNAMEs from Resend (`resend._domainkey…`). Copy verbatim from the Resend dashboard.
3. **DMARC** — start in report-only, then tighten:
   ```
   _dmarc.colorsofglory.app  TXT  "v=DMARC1; p=none; rua=mailto:people@colorsofglory.com; ruf=mailto:people@colorsofglory.com; fo=1; aspf=r; adkim=r"
   ```
   After 2 weeks clean move `p=none` → `p=quarantine`; after a month at quarantine with no legitimate mail rejected, `p=reject`.

## Stream isolation (future work)

Everything currently ships from `colorsofglory.app`. When lifecycle volume grows, move it to a subdomain (`mail.colorsofglory.app`) so a bad week on lifecycle can never poison the auth stream (`security@`).

## Warmup + monitoring

- First week: keep sends under ~500/day per new sender.
- Watch complaints **< 0.1%** and hard bounces **< 2%** in the Resend dashboard.
- `resend-webhook` auto-writes any hard bounce or complaint into `email_suppressions(category='all')`, so `canSend()` will never mail that address again.
- DMARC aggregate reports land in `people@colorsofglory.com` — scan weekly.

## One-click unsubscribe

Every lifecycle email carries a token minted by `emailGovernance.unsubscribeUrl()`. Mail clients honor RFC 8058 by POSTing to `email-unsubscribe`; footer clicks GET the same endpoint. Both write `email_suppressions` immediately.

## Register the Resend webhook

Resend dashboard → Webhooks:

- URL: `https://vsiecltcxsuuulbczexl.functions.supabase.co/resend-webhook`
- Events: `email.bounced`, `email.complained` (delivered/opened optional)
- Signing secret: paste into project secret `RESEND_WEBHOOK_SECRET`.

## Cron schedule (managed via `cron.job`)

- `drain-notifications` → invokes `notify-referral-event` every 1 min
- `email-lifecycle-evaluator` → daily 15:00 UTC
- `weekly-rhythm-evaluator` → hourly (fires on recipient's Sunday 6pm local)
- `retention-evaluator` → daily 16:00 UTC
