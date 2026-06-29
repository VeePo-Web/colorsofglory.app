
## Goal

Route every transactional + auth email (OTP codes, password reset codes, future welcome/receipt emails) through **Resend** using the already-linked **VeePo's Resend** connector, from a verified **`colorsofglory.app`** sender — instead of the current Lovable default delivery path.

## Current state (verified)

- Resend connector is already linked to this project (`std_01kq3gcmgzf138g5qjq3nr0q96`) → `RESEND_API_KEY` + `LOVABLE_API_KEY` are already available to edge functions.
- No email domain is configured in the Lovable email system for this project (the managed `auth-email-hook` queue path is **not** active).
- `email-otp-start` currently sends via Resend's gateway (per prior turns), but uses a generic / non-verified `from` address.
- No DNS for email is set on `colorsofglory.app` yet at the registrar side.

## What this plan does

### 1. Verify `colorsofglory.app` inside Resend
Call Resend's `POST /domains` via the connector gateway with `{ name: "colorsofglory.app", region: "us-east-1" }`. Resend returns 4 DNS records (SPF TXT, DKIM CNAME ×2 or TXT, and an optional DMARC TXT). Capture them and surface them to you so you can paste them into your DNS provider (Lovable Domains manager since `colorsofglory.app` is bought through Lovable).

Recommended sender identity:
- `Colors of Glory <hello@colorsofglory.app>` — primary
- `Colors of Glory Security <security@colorsofglory.app>` — for OTP / password-reset emails (better inbox segmentation)

### 2. Add a shared Resend sender helper
New file `supabase/functions/_shared/resend.ts` exporting `sendViaResend({ to, subject, html, text, from?, replyTo?, tags? })`. It:
- Reads `LOVABLE_API_KEY` + `RESEND_API_KEY`.
- POSTs to `https://connector-gateway.lovable.dev/resend/emails`.
- Defaults `from` to `Colors of Glory <hello@colorsofglory.app>`.
- Tags every send with `app=cog` + `env=prod|preview` for Resend analytics.
- Throws on non-2xx with status + body for easy debugging.

### 3. Rewire existing email-sending edge functions

| Function | Change |
|---|---|
| `email-otp-start` | Replace inline fetch with `sendViaResend`. Use `security@colorsofglory.app` sender. Subject: `Your Colors of Glory code: 123456`. Branded HTML (cream bg, serif heading, gold code chip) + plain-text fallback. Purpose-aware copy (signup / login / reset). |
| `phone-otp-start` | No change — Twilio handles SMS. |
| `notify-referral-event` | Swap any direct Resend SDK calls to `sendViaResend` for consistency. |
| Any future `send-*` function | Use the shared helper from day one. |

### 4. Branded email templates
Add `supabase/functions/_shared/email-templates/` with:
- `otp.ts` → returns `{ html, text }` for OTP codes (signup / login / reset variants).
- `layout.ts` → shared cream-and-gold wrapper (logo, footer with company name + unsubscribe-not-applicable notice for transactional).

Styling matches the locked design system: `#F5F0E8` background, `#B8953A` accents, Playfair-style serif heading via web-safe `Georgia` fallback for email clients.

### 5. Smoke tests
After deploy:
- `curl` `email-otp-start` with `{ email: "parker@veepo.ca", purpose: "reset" }` → expect 200 + email in inbox from `security@colorsofglory.app`.
- Trigger forgot-password from the UI → confirm branded code arrives.
- Check Resend dashboard for the send + delivery + open events.

### 6. Decommission the Lovable email path
Skip `email_domain--setup_email_infra` / `scaffold_auth_email_templates` entirely — we're using Resend directly, not the managed queue. Document this in `docs/claude-handoffs/2026-06-29-resend-email.md` so Claude Code doesn't accidentally re-introduce the queue path.

## DNS records you'll add (preview — actual values come from Resend in step 1)

```text
TYPE   NAME                            VALUE
TXT    send.colorsofglory.app          "v=spf1 include:amazonses.com ~all"
CNAME  resend._domainkey               resend._domainkey.<...>.dkim.amazonses.com
TXT    _dmarc.colorsofglory.app        "v=DMARC1; p=none;"
```

Lovable Domains → `colorsofglory.app` → ⋯ → **Configure** → **Manage DNS records**.

## Out of scope (separate request)

- Marketing / broadcast emails.
- Inbound email parsing.
- Resend webhook → Supabase event ingestion (bounces/complaints) — can add later.

## Acceptance criteria

1. `colorsofglory.app` shows **Verified** in Resend after DNS propagates.
2. Forgot-password and signup OTPs arrive from `security@colorsofglory.app` with the cream/gold branded template.
3. No edge function still posts directly to Resend without going through `_shared/resend.ts`.
4. Zero references to the Lovable managed `auth-email-hook` / pgmq queue remain.
