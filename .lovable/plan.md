# Unify Contact Email → people@colorsofglory.com

## Goal
Every human-facing "contact us" surface on the site — and every Reply-To on outbound Resend mail — routes to the single Google Workspace inbox **people@colorsofglory.com**. Outbound `From:` addresses stay on the verified `@colorsofglory.app` sending domain for deliverability; only the reply/contact destination changes.

## Audit Findings (current state)

User-facing contact links today are split across two addresses:
- `src/pages/legal/TermsPage.tsx` → `hello@colorsofglory.com`
- `src/pages/legal/PrivacyPage.tsx` → `hello@colorsofglory.com`
- `src/pages/pricing/CheckoutSuccessPage.tsx` → `help@colorsofglory.com`

Server-side Reply-To routing in `supabase/functions/_shared/resend.ts`:
- `hello@…app` → `hello@colorsofglory.com`
- `security@…app` → `support@colorsofglory.com`
- `referrals@…app` → `referrals@colorsofglory.com`

Legacy Fly4MEdia file `supabase/functions/_shared/email-templates.ts` still hard-codes `tobyrennick@gmail.com` in `BRAND.email`, used only by the legacy `send-contact` edge function (dead path per project memory, but the address is stale).

No other `mailto:` or `@colorsofglory.*` contact strings exist in `src/` or `index.html`.

## Changes

### 1. Frontend contact links → people@colorsofglory.com
- `src/pages/legal/TermsPage.tsx` — swap `hello@colorsofglory.com` → `people@colorsofglory.com` (link + label).
- `src/pages/legal/PrivacyPage.tsx` — same swap.
- `src/pages/pricing/CheckoutSuccessPage.tsx` — swap `help@colorsofglory.com` → `people@colorsofglory.com` (link + label).

### 2. Resend Reply-To routing → single inbox
Edit `supabase/functions/_shared/resend.ts` `REPLY_TO_DEFAULTS` map so **every** sender lane routes replies to `people@colorsofglory.com`:

```text
hello@colorsofglory.app      → people@colorsofglory.com
security@colorsofglory.app   → people@colorsofglory.com
referrals@colorsofglory.app  → people@colorsofglory.com
```

Explicit `replyTo` passed by a caller still wins (unchanged behavior).

### 3. Legacy BRAND.email cleanup
Update `supabase/functions/_shared/email-templates.ts` `BRAND.email` from `tobyrennick@gmail.com` → `people@colorsofglory.com` so any residual Fly4MEdia footer references show the correct inbox. No behavioral change to live COG flows.

### 4. Redeploy affected edge functions
Deploy the functions that import the shared Resend helper so the new Reply-To routing goes live:
- `email-otp-start`
- `notify-referral-event`
- (any other function importing `_shared/resend.ts` — verified via grep before deploy)

`send-contact` is legacy and untouched beyond the BRAND string.

## Out of Scope (intentionally not changed)
- Outbound `From:` addresses — remain on the verified `@colorsofglory.app` sending domain.
- Marketing/docs references to `colorsofglory.app` URLs (canonical, sitemap, share links, WebOTP origin string, synthetic phone auth email) — those are domain identifiers, not contact addresses.
- Referral link base URLs (`colorsofglory.app/r/…`) — product URLs, not email.

## Verification
- `rg -n "mailto:|@colorsofglory\.(com|app)" src/ index.html` — confirm only `people@colorsofglory.com` remains for user-facing contact.
- Trigger a password-reset OTP email in preview; inspect headers to confirm `Reply-To: people@colorsofglory.com`.
- Send a reply to that message and confirm it lands in the Google Workspace inbox.
