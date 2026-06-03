## Colors of Glory — Backend Foundation v1

Scope: backend + typed client SDK (`src/integrations/cog/*`). Frontend pages/components stay in Claude's lane. Derived from Phase 1 docs (15 Product Vision PDFs + 2 Free funnel PDFs). Phases 2–6 (onboarding, canvas, system ops, business model PDFs) will extend this in follow-up plans — nothing here will block them.

### 1. Domain model (Supabase tables)

All tables in `public`, with GRANTs + RLS + policies in the same migration. No FK to `auth.users` (use `user_id uuid` + `profiles` table per Supabase guidance). `auth.uid()`-scoped policies; `anon` GRANT only where invite preview must work pre-login.

**Identity & plans**
- `profiles` — `user_id` (unique), `display_name`, `avatar_url`, `phone`, `email`, `referral_code` (unique), `referred_by_user_id`, timestamps.
- `user_roles` — separate roles table (admin/moderator/user) with `has_role(uuid, app_role)` SECURITY DEFINER function. Never store roles on profiles.
- `plans` enum: `free | pro`. `subscriptions` table tracks Stripe state, plan, current_period_end, status.
- `referrals` — `referrer_user_id`, `referred_user_id`, `referral_code`, `pro_started_at`, `status` (pending/active/churned). Direct-only attribution (no MLM).
- `referral_payouts` — monthly accruals while a directly-referred user stays Pro.

**Songs (the core "private room")**
- `songs` — `id`, `owner_user_id`, `title`, `status` (`draft|active|archived`), `is_invited_only` (false for owned), `cover_color`, `created_at`, `updated_at`, `last_activity_at`, `archived_at`.
- `song_members` — `song_id`, `user_id`, `role` (`owner|contributor|reviewer|viewer`), `invited_by_user_id`, `joined_at`, unique `(song_id, user_id)`.
- `song_invites` — `id`, `song_id`, `inviter_user_id`, `invitee_contact` (phone or email), `contact_type`, `role`, `token_hash`, `expires_at`, `status` (`pending|accepted|expired|revoked`), `referral_code`, `created_at`. Token plaintext is never stored — only hash. Accept flow validates server-side.

**Creative content (lives inside a song)**
- `song_sections` — `id`, `song_id`, `order_index`, `kind` (`verse|chorus|bridge|pre_chorus|tag|intro|outro|free`), `label`, `created_at`.
- `song_lyrics` — `id`, `section_id` (nullable for free notes), `song_id`, `body`, `chord_data` (jsonb), `author_user_id`, `created_at`, `updated_at`.
- `voice_memos` — `id`, `song_id`, `section_id` (nullable), `storage_path`, `duration_ms`, `waveform_peaks` (jsonb), `transcript` (nullable), `recorded_by_user_id`, `bytes`, `created_at`.
- `song_notes` — freeform `notes` (story/scripture/meaning zone), `song_id`, `author_user_id`, `body`, `kind`.
- `chord_progressions` — `song_id`, `section_id`, `progression` (jsonb), `bpm`, `key`, `time_signature`, `author_user_id`.

**Memory, history, credits, activity**
- `song_versions` — immutable snapshots: `song_id`, `version_index`, `snapshot` (jsonb of lyrics+chords+arrangement), `created_by_user_id`, `reason` (`auto|manual|restore|merge`), `created_at`. Restore writes a NEW snapshot (never overwrites history).
- `song_activity` — append-only event log: `song_id`, `actor_user_id`, `kind` (`section_added|lyric_edited|memo_added|invite_sent|invite_accepted|role_changed|restore|export|comment_added|suggestion_accepted|…`), `payload` (jsonb, no raw lyric content beyond IDs), `created_at`. Drives the "What changed since you left" digest.
- `contribution_events` — fine-grained ledger: `song_id`, `contributor_user_id`, `kind` (`lyric_lines|memo|chord_idea|note|approved_suggestion|review_pass`), `weight`, `source_ref` (jsonb), `created_at`. Feeds the credits screen.
- `credit_cards` — owner-curated credits derived from `contribution_events` + manual edits. `song_id`, `contributor_user_id`, `role_label` (writer/co-writer/producer/etc.), `confirmed_by_owner`.
- `suggestions` — line-level "replace just this line" / pending ideas. `song_id`, `section_id`, `proposer_user_id`, `original_text`, `proposed_text`, `status` (`pending|accepted|declined|withdrawn`).

**Storage & billing surfaces**
- `storage_usage` — per-workspace counters refreshed by triggers on voice_memos / exports / archive inserts/deletes. `user_id` (owner), `voice_memos_bytes`, `exports_bytes`, `archived_bytes`, `uploads_bytes`, `total_bytes`, `updated_at`.
- `storage_addons` — purchased extra GB blocks.
- `exports` — generated lyric sheets / credit exports. `song_id`, `format`, `storage_path`, `requested_by_user_id`, `bytes`.

**Auth helpers**
- `is_song_member(uuid, uuid)` SECURITY DEFINER.
- `song_role(uuid, uuid)` SECURITY DEFINER → role enum.
- `has_role(uuid, app_role)` per standard pattern.

### 2. RLS policies (summary)

- `songs`: SELECT to members (via `is_song_member`); INSERT to authenticated (owner = `auth.uid()`); UPDATE/DELETE only to owner.
- `song_members`: SELECT to members; INSERT/UPDATE/DELETE only to owner.
- `song_invites`: SELECT to inviter or to anyone with valid token via edge function (no direct anon SELECT). Accept flow runs server-side.
- All song-content tables (`song_sections`, `song_lyrics`, `voice_memos`, `song_notes`, `chord_progressions`, `suggestions`): SELECT to members; INSERT/UPDATE gated by `song_role` ≥ contributor (viewer/reviewer can't write); owner can hard-delete.
- `song_versions`, `song_activity`, `contribution_events`: SELECT to members; INSERT only via SECURITY DEFINER functions / edge fns; no UPDATE/DELETE.
- `credit_cards`: SELECT to members; UPDATE only to owner.
- `subscriptions`, `storage_usage`: SELECT to owning user; writes only via service role.
- `referrals`, `referral_payouts`: SELECT to referrer; writes only via service role / Stripe webhook.
- `profiles`: SELECT to authenticated (display data); UPDATE only to self.
- `user_roles`: SELECT to self + admins; writes only via service role.

### 3. Storage buckets

- `voice-memos` (private) — `{owner_user_id}/{song_id}/{memo_id}.{ext}`. RLS: members of `song_id` can read via signed URLs; only contributors+ can upload; owner can delete. Counts against owner's `storage_usage`.
- `exports` (private) — `{owner_user_id}/{song_id}/{export_id}.{ext}`. Same access rules.
- `avatars` (public-read) — `{user_id}/avatar.{ext}`.
- Existing `partnership-uploads` bucket from fly4me will be deleted in the cleanup pass when you give the signal.

### 4. Edge functions

- `accept-invite` — validates token hash, expiry, identity match; creates `song_members` row, fires `invite_accepted` activity event, attaches referral attribution, returns `{ songId, role }`. Never relies on client.
- `create-song` — server-authoritative free-plan check (1 owned active song for Free), assigns owner membership, seeds initial section, emits activity.
- `send-invite` — Resend → SMS gateway (decide later) or email; writes `song_invites` with hashed token; rate-limited per inviter.
- `save-version` — manual or auto snapshot; idempotent on `(song_id, version_index)`.
- `restore-version` — writes a NEW snapshot copy as current; never destroys history.
- `compute-digest` — generates "What changed since you left" payload for a given user+song since their last `seen_at`; calm summarization (server-side, doesn't expose lyrics to analytics).
- `stripe-webhook` — subscription state, plan transitions, storage add-on purchases, referral payout accrual.
- `request-storage-checkout` — Stripe checkout session for storage add-on or Pro upgrade.
- `generate-export` — async lyric/credit sheet; writes to `exports` bucket; updates `storage_usage`.
- `ingest-voice-memo` — signs upload URL, validates ownership, records `voice_memos`, recomputes storage usage. Layered/over-record uses same function with `parent_memo_id`.
- `referral-resolve` — when an invitee signs up via a referral code, attaches `referred_by_user_id` (direct only — no chain).

### 5. Auth

- Email + password (verification ON) + Google OAuth via Lovable Cloud managed social login (single `configure_social_auth` call enables Google so first OAuth login doesn't 500).
- Phone auth optional; the docs show a "phone or email" invite flow, so phone code login is on the roadmap but not blocking v1 — invitees can verify via email OTP first, phone added in Phase 3 once we read the Onboarding 04–05 PDFs.
- Profile is auto-created via `handle_new_user` trigger on `auth.users` insert (the one allowed write path) populating `profiles` + a unique `referral_code`.

### 6. Payments (Stripe via Lovable connector)

- Products: `Colors of Glory Pro` (monthly), `Storage Add-on` (one-time or monthly tiers — finalize after reading the business-model PDFs in Phase 6).
- Free plan limits enforced server-side in `create-song` and storage triggers: 1 owned active song, capped total storage, advanced features (smart recap, layered record, listen path, version compare, advanced exports) flag-gated.
- Invited collaborators never consume the invitee's free-song slot — invited memberships don't increment `owned_active_songs_count`.

### 7. Lovable AI Gateway

Reserved hooks for later (Phase 4 canvas docs will drive the model picks):
- `compute-digest` may call a small Gemini Flash model to summarize activity payloads — never raw lyrics, only structured event metadata.
- Voice memo transcription via Lovable AI (model TBD after canvas PDFs).

### 8. Realtime

`song_lyrics`, `song_activity`, `suggestions`, `song_members` added to `supabase_realtime` publication. Channel naming: `song:{songId}` filtered server-side via RLS so non-members can't subscribe to events.

### 9. Typed client SDK (the "minimal frontend glue")

Under `src/integrations/cog/` (Claude consumes, never edits Supabase types directly):
- `client.ts` — re-exports `supabase` from the generated client.
- `auth.ts` — `useSession`, `useCurrentUser`, `signInWithGoogle`, `signOut`.
- `songs.ts` — `useSong(id)`, `useMySongs(tab)`, `createSong`, `archiveSong`.
- `lyrics.ts` — `useLyrics(songId)`, `saveLyric`, optimistic + realtime patch.
- `memos.ts` — `recordMemo`, `useMemos`, signed-URL playback hook.
- `invites.ts` — `sendInvite`, `acceptInvite`, `useInvitePreview(token)`.
- `versions.ts`, `activity.ts`, `credits.ts`, `referrals.ts`, `storage.ts`, `plan.ts` — one file per domain, all returning typed React Query hooks + zod-validated payloads.
- `analytics.ts` — thin wrapper that never sends raw lyric/memo content (Product Vision docs repeat this rule).

### 10. Build sequence (backend)

1. **Memory + cleanup gate** — rewrite `mem://index.md` from Fly4MEdia to Colors of Glory core rules. Fly4me table/bucket/edge function deletion stays paused until you say go.
2. **Migration #1 — identity**: `profiles`, `user_roles`, `has_role`, `handle_new_user` trigger, GRANTs + RLS.
3. **Migration #2 — songs core**: `songs`, `song_members`, `song_sections`, `song_lyrics`, `song_notes`, `chord_progressions`, helper functions (`is_song_member`, `song_role`), GRANTs + RLS, realtime publication.
4. **Migration #3 — invites + activity**: `song_invites`, `song_activity`, `suggestions`, GRANTs + RLS.
5. **Migration #4 — versions + credits**: `song_versions`, `contribution_events`, `credit_cards`, GRANTs + RLS.
6. **Migration #5 — voice + storage**: `voice_memos`, `storage_usage`, `storage_addons`, `exports` + triggers; create `voice-memos` and `exports` buckets via storage tool.
7. **Migration #6 — plans + referrals**: `subscriptions`, `referrals`, `referral_payouts`, plan enums.
8. **Auth config**: `configure_auth` (email verification ON, HIBP ON), `configure_social_auth(["google"])`.
9. **Edge functions**: `accept-invite`, `create-song`, `send-invite`, `save-version`, `restore-version`, `compute-digest`, `generate-export`, `ingest-voice-memo`, `referral-resolve`, `stripe-webhook`, `request-storage-checkout`. All ship with `verify_jwt = true` except `accept-invite` and `stripe-webhook` (token/signature-validated).
10. **Stripe**: `enable_stripe_payments` (recommend first); create Pro + storage products inside connector.
11. **Email**: Resend connector (already linked to your account in prior projects — I'll reconfirm) for transactional invite + digest emails. Custom domain wait until Phase 6.
12. **SDK scaffold**: `src/integrations/cog/*` files above, exported via a single `cog` namespace.

### 11. Open questions (will resolve in later phases — non-blocking)

- Exact Free-tier storage cap (GB) and Pro-tier cap — finalize from the Business Model PDFs (Phase 6).
- Pricing for Pro and storage add-ons — Phase 6.
- Phone (SMS) verification provider — Phase 3 onboarding PDFs (Twilio vs Supabase phone auth).
- Layered voice memo data model (`parent_memo_id` vs separate `memo_layers` table) — Phase 4 canvas PDFs (`COG_Product_04_Layered_Voice_Memo`).
- Listen Path / Compare Mode storage shape (probably a transient `listen_paths` table) — Phase 4.
- Smart Recap algorithm + AI model choice — Phase 4.
- Founder code redemption flow (mentioned in onboarding 06) — Phase 3.

### 12. What I will NOT do without explicit go-ahead

- Touch any fly4me file (`contact_submissions`, `send-contact`, `partnership-uploads`, existing pages/components, current `mem://index.md`).
- Write any `src/pages/**` or `src/components/**` file. Claude owns those.
- Enable Stripe live mode or a custom email domain.
- Run migrations — every migration goes through your approval one at a time.

Phases 2–6 will refine specific sections (onboarding will pin auth + invite copy, canvas will pin the realtime + AI shape, system-ops will pin suggestions/review-queue logic, business-model will pin limits + pricing). Each future phase produces a follow-up plan that *amends* — never rewrites — this foundation.