# L11 — Finish the Email Data Spine

Cron is scheduled, evaluators + webhook are deployed, `canSend()` gates on preferences/dismissals. Three tasks remain to close L11.

## 1. Feature-usage writes (so evaluators know what NOT to nudge)

Evaluators like `education_candidates` check `feature_usage` to skip users who already used a feature. Wire calls in the two capture entry points and the client memory seam:

- `supabase/functions/intake-voice-memo/index.ts` — on successful memo insert, call `mark_feature_used(user_id, 'voice_memo')`.
- `supabase/functions/promote-capture/index.ts` — on successful promotion, call `mark_feature_used(user_id, 'canvas_promote')`.
- `src/integrations/cog/notifications.ts` — expose `markFeatureUsed(feature)` so client memory-graph views can call it on first successful save.

Writes are fire-and-forget (log-and-continue) — a failure here must never break the primary action.

## 2. Resend webhook secret

`resend-webhook` verifies SVIX headers using `RESEND_WEBHOOK_SECRET`. Since Resend is already connected but the Svix signing secret is a separate per-endpoint value:

- User creates the webhook endpoint in Resend pointing at `https://vsiecltcxsuuulbczexl.supabase.co/functions/v1/resend-webhook` (events: `email.bounced`, `email.complained`, `email.delivery_delayed`).
- Resend shows a `whsec_…` signing secret; user pastes it via `add_secret` for `RESEND_WEBHOOK_SECRET`.
- No code changes required — function already reads the env var.

## 3. Verification pass

Run three probes to confirm the spine is live:

- `SELECT jobname, schedule, active FROM cron.job WHERE jobname IN ('drain-notifications','email-lifecycle-evaluator','weekly-rhythm-evaluator','retention-evaluator');`
- Manually invoke each evaluator once via `curl_edge_functions` with an empty body and confirm it returns 200 + a candidate count in logs.
- Insert a synthetic row via `debug_seed_reward_chain` (or a simple test enqueue), let `drain-notifications` fire, and confirm the row moves from `pending` → `sent` in `notification_queue` and produces one row in `email_send_log`.

## Out of scope for this turn

DNS/deliverability copy in `docs/email/DELIVERABILITY.md` is already written — actual DNS record verification lives with the user in Resend's dashboard.

## Order of execution

1. Patch the two edge functions + client seam for feature-usage writes; redeploy `intake-voice-memo` and `promote-capture`.
2. Ask user to create the Resend webhook endpoint and paste the `whsec_…` secret.
3. Run verification probes and report results.
