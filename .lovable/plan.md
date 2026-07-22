## L11 — Email System Data Spine + Deliverability

Extend the existing email foundation (queue + suppressions + governance + evaluator + drain already exist) with the missing pieces L11 calls for: preferences table, feature-usage signals, fenced RPCs, dismissal-based suppression, cron scheduling, Resend delivery webhook, and the `cog/notifications.ts` client seam. No UI.

### What's already live (do not rebuild)
- `notification_queue` with `scheduled_for`, `category`, `dedupe_key` + indexes
- `email_suppressions` (user_id, category, reason, expires_at)
- `_shared/emailGovernance.ts` with `canSend()` (caps, quiet hours, suppression) + HMAC unsub tokens
- `_shared/resend.ts` sender w/ Reply-To to `people@colorsofglory.com`
- `notify-referral-event` = the governed multi-category drain
- `email-lifecycle-evaluator` (D1 digest, B1 hum, B2 lyrics)
- `email-unsubscribe` endpoint (writes `email_suppressions`)

### Gaps this plan closes

**1. Migration `20260722_email_spine_extensions.sql`**
- `email_preferences` table: `user_id pk → auth.users`, one bool per §7 category (`song_activity, weekly_recaps, tips_guides, invite_suggestions, encouragement, product_news`), `unsubscribed_all`, `updated_at`. Auto-provision via trigger on `profiles` insert + backfill existing rows. RLS: owner select/update only; service_role full; no client insert/delete.
- `nudge_dismissals(user_id, kind, count, suppressed_until, updated_at)` — service-role only. Extend `canSend()` to read it for nudge kinds.
- `feature_usage(user_id, feature, first_used_at)` unique on `(user_id, feature)`; service-role only + `mark_feature_used(_feature text)` SECURITY DEFINER RPC callable by `authenticated`.
- Category-level suppression enforcement — patch `canSend()` to also gate on `email_preferences` (unsubscribed_all + per-category boolean maps to category namespace root).

**2. Fenced evaluator RPCs (SECURITY DEFINER, titles/IDs/counts only)**
Add to same migration:
- `email_rolling_counts(_user_id) → (last_24h int, last_7d int)`
- `first_invite_ever(_user_id) → bool`
- `owner_first_accepted_invite(_song_id, _owner_id) → bool`
- `education_candidates(_user_id) → jsonb` per active song: `song_id, title, has_memo, has_lyrics_chords, section_count, duplicate_take_sections, take_count, contributor_count, element_count, editor_count` + feature-used flags joined from `feature_usage`
- `dormancy(_user_id) → (last_active_at, days_inactive, has_unfinished_song, collaborator_waiting)`
- `storage_usage_summary(_user_id) → (used_bytes, quota_bytes, pct)` (wrap existing `storage_usage` table)
- `song_milestones(_user_id)` + `catalog_size(_user_id)`

All return IDs/titles/counts only — no lyric/transcript/memo/scripture/note text.

**3. Feature-usage writes**
- Call `mark_feature_used` from within `intake-voice-memo` (canvas_open), `promote-capture` (canvas_open), plus expose SDK helper in `cog/memory.ts` for client-side one-shots (listen_path, metronome, compare_mode, version_history_open, credits_open). Client wiring is Fable/Claude's job; backend just publishes the RPC + SDK.

**4. Resend delivery webhook**
New edge fn `resend-webhook` (verify_jwt=false, signature-verified via `RESEND_WEBHOOK_SECRET`):
- `email.bounced` (hard) / `email.complained` → upsert `email_suppressions(user_id, 'all', reason=bounce|complaint, expires_at=null)` looked up by recipient email → `profiles.email`
- `email.delivered/opened/clicked` → optionally log to `notification_queue` metadata (cheap, no PII beyond user_id)
- Register URL in Resend dashboard (documented, not tool-invokable)

**5. Cron scheduling (pg_cron via `insert` tool, not migration — user-specific fn URL)**
- `drain-notifications` every 1 min → invokes existing `notify-referral-event`
- `email-lifecycle-evaluator` daily at 15:00 UTC
- `weekly-rhythm-evaluator` (new light edge fn) hourly — for each user whose local time is Sunday 18:00, enqueue one of {digest | your-week | invite-nudge}
- `retention-evaluator` (new light edge fn) daily — F1–F4 dormancy via `dormancy()` RPC

**6. Client seam — `src/integrations/cog/notifications.ts` (data only, no UI)**
```
getEmailPreferences() → row
setEmailPreferences(patch) → row
pauseAllEmail(bool) → row
markFeatureUsed(feature) → void
```
All via typed Supabase client over `email_preferences` (RLS-owner) and `mark_feature_used` RPC.

**7. DNS / deliverability (documented — Lovable can't set DNS)**
Add `docs/email/DELIVERABILITY.md` documenting:
- SPF/DKIM/DMARC records to publish for `colorsofglory.app` (start `p=none; rua=mailto:people@colorsofglory.com`)
- Stream isolation: keep `security@` sender on current domain; recommend moving lifecycle to `mail.colorsofglory.app` subdomain later (call out as future work, don't block)
- Warmup ramp + <0.1% complaint monitoring via Resend dashboard
- List-Unsubscribe passthrough (already set in headers from drain — verify)

### Deliverables
1. `supabase/migrations/20260722010000_email_spine_extensions.sql`
2. New edge fns: `resend-webhook`, `weekly-rhythm-evaluator`, `retention-evaluator` + `config.toml` entries (verify_jwt=false on webhook)
3. Patch `_shared/emailGovernance.ts` `canSend()` to consult `email_preferences` + `nudge_dismissals`
4. Patch `intake-voice-memo` + `promote-capture` to write `feature_usage`
5. New `src/integrations/cog/notifications.ts`
6. Cron schedule inserts via `supabase--insert` (separate step, contains project ref + anon key)
7. `docs/email/DELIVERABILITY.md`
8. Update `_shared/resend.ts` to pass `RESEND_WEBHOOK_SECRET` header check helper (or new `_shared/resendWebhook.ts`)

### Acceptance
- Preference-center reads/writes flow through owner-RLS `email_preferences`
- `canSend()` blocks on unsubscribed_all, per-category pref off, suppression row, or nudge_dismissals.suppressed_until > now
- Evaluator RPCs return zero content strings (verified by inspecting return types — only IDs/titles/counts/bools)
- `resend-webhook` hard-bounce test → suppression row visible; subsequent `canSend` returns false
- Cron confirmed in `cron.job`
- Fable/Claude handoff doc lists exactly the SDK surface + preference categories
