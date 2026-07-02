# Email Audit & Routing Fix

## The rule
- **FROM (outbound):** everything ships from `@colorsofglory.app` via Resend (already correct).
- **TO / reply-to (inbound):** anything a human might reply to must land on `@colorsofglory.com` (Google Workspace).

## Audit results

### User-facing contact addresses (WRONG — currently `.app`)
| File | Current | Should be |
|---|---|---|
| `src/pages/legal/TermsPage.tsx:61` | `hello@colorsofglory.app` | `hello@colorsofglory.com` |
| `src/pages/legal/PrivacyPage.tsx:52` | `hello@colorsofglory.app` | `hello@colorsofglory.com` |
| `src/pages/pricing/CheckoutSuccessPage.tsx:89` | `help@colorsofglory.app` | `help@colorsofglory.com` |

### Outbound Resend senders (CORRECT — keep on `.app`)
- `supabase/functions/_shared/resend.ts` — `hello@`, `security@`, `referrals@` on `colorsofglory.app`. Keep.
- `phone-otp-start` WebOTP line `@colorsofglory.app #code` — **must** match app origin, do not change.
- `phone-otp-verify` synthetic internal email `phone+…@auth.colorsofglory.app` — internal-only, do not change.

### Missing: reply-to routing
Resend sends currently have no `reply_to`, so if a user hits Reply on an OTP or referral email it goes into `hello@colorsofglory.app` (Resend inbound, not monitored) instead of the Workspace inbox.

### Legacy / out of scope
- `supabase/functions/send-contact/index.ts` still sends as `Fly4MEdia <onboarding@resend.dev>` to `tobyrennick@gmail.com` / `parker@veepo.ca`. This is fly4me leftover per AGENTS.md — leave untouched unless you say otherwise.
- Docs under `docs/**` reference old `.com` / `.app` mixes — documentation only, no user impact, skip.

## Changes

1. **Legal + checkout copy → `.com`**
   - `TermsPage.tsx`, `PrivacyPage.tsx`: `hello@colorsofglory.app` → `hello@colorsofglory.com` (render as `mailto:` link for good measure).
   - `CheckoutSuccessPage.tsx`: `help@colorsofglory.app` → `help@colorsofglory.com` as a `mailto:` link.

2. **Resend helper: default `reply_to` to Workspace**
   - `supabase/functions/_shared/resend.ts`: if caller doesn't pass `replyTo`, inject a sensible `.com` default per sender:
     - `primary` (`hello@…app`)     → reply-to `hello@colorsofglory.com`
     - `security` (`security@…app`) → reply-to `support@colorsofglory.com`
     - `referrals` (`referrals@…app`) → reply-to `referrals@colorsofglory.com`
   - Existing callers (`email-otp-start`, `notify-referral-event`) inherit this automatically — no per-function changes needed.

3. **No DB / no edge redeploy of unrelated functions.** Only `_shared/resend.ts` changes, so `email-otp-start` and `notify-referral-event` get redeployed to pick it up.

## Not doing (call out if you want it)
- Rewriting `send-contact` (fly4me legacy).
- Changing WebOTP SMS body or synthetic auth email (both must stay `.app`).
- Touching docs / handoff markdown.

## Acceptance
- Grep `@colorsofglory.app` in `src/**` returns only the `auth.ts` comment.
- All Resend emails arrive with `From: …@colorsofglory.app` and `Reply-To: …@colorsofglory.com`.
- Legal pages + checkout success show `.com` contact addresses as clickable `mailto:` links.
