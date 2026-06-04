# Backend gaps — features still needing server work

Scope: Lovable backend only (DB, RLS, edge functions, storage, integrations, secrets). No frontend. Framed around the Church Center-grade UX bar (phone OTP, instant feedback, calm collaboration, trustworthy failure, realtime presence). Claude owns all UI.

---

## 1. Phone OTP login (Twilio) — Church Center parity

**Today:** Email/password + Google only. `PhoneLoginPage` and `CodeVerifyPage` exist with no backend.

**Backend work:**
- Enable Supabase Auth phone provider, provider = Twilio.
- Add secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGE_SERVICE_SID` (or `TWILIO_PHONE_NUMBER`).
- Configure Twilio Verify or SMS template ("Your Colors of Glory code is {{ .Code }}"). Keep copy reverent, no marketing.
- Edge function `auth-phone-start` wrapping `signInWithOtp({ phone })` with rate limit (3/min/IP, 10/hr/phone) in a `phone_otp_throttle` table.
- Edge function `auth-phone-verify` wrapping `verifyOtp` and writing `profiles.phone_verified_at`.
- Trigger: on first phone-auth user insert, `handle_new_user` already creates profile + referral_code — verify it covers phone-only signups.

## 2. Founder / referral code redemption

**Today:** `FounderCodePage` simulates with `setTimeout`. No backend call.

**Backend work:**
- Edge function `redeem-founder-code` (auth required): normalize code, look up `codes` table, validate status/expiry/usage caps, insert `referral_attributions` row, mark profile flag `founder_code_redeemed_at`, return discount/reward profile for UI display.
- Add `codes.usage_count` increment in same tx with row lock.
- Surface clear error codes: `CODE_NOT_FOUND`, `CODE_EXPIRED`, `CODE_EXHAUSTED`, `CODE_ALREADY_REDEEMED`.

## 3. Onboarding state persistence

**Today:** Steps live in localStorage only; resuming on another device loses progress.

**Backend work:**
- Add `profiles.onboarding_state jsonb` (step, started_at, first_song_id, first_memo_id, intent).
- Edge function `onboarding-set-step` (auth required, validates step enum).
- `me-summary` (see §11) returns it so any client resumes mid-flow.

## 4. Lyrics + chords persistence

**Today:** Tables exist (`song_sections`, `song_lyrics`, `chord_progressions`). No SDK, no functions. Editor is local.

**Backend work:**
- `cog/lyrics.ts` SDK over PostgREST (RLS via `is_song_member`): list/upsert/reorder/delete sections, lines, chords.
- Edge function `lyrics-batch-mutate` for atomic multi-op autosave (returns server timestamps for last-write-wins).
- New table `line_suggestions` (line_id, suggested_text, status enum, created_by) + RLS (collaborator insert pending; owner/reviewer accept/reject) — Feature 19.
- Enable Supabase Realtime on `song_lyrics`, `song_sections`, `chord_progressions` filtered by `song_id`.
- Triggers writing minimal IDs-only activity rows (see §6).

## 5. Notes

**Today:** `song_notes` exists. No SDK.

**Backend work:**
- `cog/notes.ts` PostgREST helpers.
- Enable Realtime on `song_notes`.
- Activity rows on create/delete (not per keystroke).

## 6. Activity feed + "what changed since you left"

**Today:** `audit_logs` only. No per-song feed, no last-seen tracking.

**Backend work:**
- New table `song_activity` (song_id, actor_user_id, kind enum, entity_type, entity_id, payload jsonb minimal — IDs + enums only, never raw lyric/memo text). RLS via `is_song_member`.
- Triggers on `song_lyrics`, `song_sections`, `chord_progressions`, `voice_memos`, `song_members`, `song_invites`, `line_suggestions` → insert activity.
- New table `song_member_last_seen` (song_id, user_id, last_seen_at).
- Edge function `song-mark-seen` (auth, member-gated).
- Edge function `song-activity-recap` using Lovable AI Gateway (Gemini Flash) → calm one-paragraph "what changed since {last_seen_at}" recap. Cache keyed by (song_id, user_id, last_seen_at). Input is event kinds + counts only, never lyric content.
- Realtime on `song_activity`.

## 7. People + roles + presence

**Today:** Invite create/preview/accept done. Members table exists.

**Backend work:**
- `song-member-update-role` (owner-only).
- `song-member-remove` (owner-only) — cascade pending suggestions + revoke pending invites by/for that user.
- `song-invite-revoke` (owner/inviter) — set status, broadcast.
- `song-members-list` SECURITY DEFINER RPC: joined with `profiles` (display_name, avatar_url, last_active_at) so member rows render without exposing profiles broadly.
- `song-invites-list` (pending for People page).
- Presence channel `song:{id}` (Supabase Realtime presence) for "who's in the room" indicator.

## 8. Voice memos — completeness

**Today:** Upload-url, finalize, transcribe (Lovable AI Gateway), signed-url, delete, retranscribe. Quota counted server-side. Strong baseline.

**Gaps:**
- **Lyric-link columns:** add `section_id uuid`, optional `line_id uuid` to `voice_memos`; populate from finalize payload; index.
- **Layered takes (F16):** add `parent_memo_id uuid`, `take_number int` + index for "record over this" stacks.
- **Loop regions (F15):** new table `voice_memo_loop_regions` (memo_id, start_ms, end_ms, label) + member RLS.
- **Waveform peaks:** new column `peaks jsonb` (or sibling table) populated by `voice-memo-finalize` so lists render instantly without client decode.
- **Word-level transcript:** persist `words jsonb` (start/end/text) from Gemini response into `voice_memo_transcripts` for karaoke highlight.
- Enable Realtime on `voice_memos` and `voice_memo_transcripts` so collaborators see uploading → transcribing → ready states live.

## 9. Version history (Feature 24 — "Original preservation")

**Today:** `song_versions` table only.

**Backend work:**
- `song-version-snapshot` edge function: serialize sections + lyrics + chords + memo refs into `snapshot jsonb`, optional label, owner/contributor-gated.
- `song-version-restore` edge function: owner-only, applies snapshot in a single tx, writes activity entry, never destroys prior state (insert new revision instead of overwrite).
- Scheduled `version-autosnapshot` (Supabase cron) every N min per song with pending changes.
- RPC `version_diff(_from_id, _to_id)` returning per-section/line diff for timeline UI.

## 10. Credits ledger

**Today:** None.

**Backend work:**
- View or RPC `song_credits_v(song_id)` aggregating contribution kinds per member from `song_activity` (lyrics edits → "Lyrics", memo inserts → "Voice memo", chord edits → "Chords", accepted suggestions → "Arrangement").
- Table `credit_overrides` so owner can pin manual credit ("Bridge idea") without rewriting history.
- Edge function `song-credits-export`: render PDF (Deno PDF lib) into `exports` bucket; return signed URL.

## 11. Home / catalog — single instant-render call

**Today:** No list endpoint; `cog/songs.ts` missing `listSongs`.

**Backend work:**
- `cog/songs.ts` `listSongs()` PostgREST select on `songs` joined with `song_members` + `last_activity_at` (denormalized column updated by activity trigger). Sort desc.
- Edge function `me-summary` (auth): returns plan tier, owned-song count, free-song remaining, storage %, per-song unread activity counts, pending invites count, onboarding_state. One call → instant catalog without N+1.
- Realtime on `songs` + `song_members` so a new shared song appears without refresh.

## 12. Storage summary + addon purchase

**Today:** `storage_usage` and `storage_addons` tables exist; `effective_storage_limit` RPC exists.

**Backend work:**
- Edge function `storage-summary` returning `{ used_bytes, quota_bytes, percent, addons[], warning_level }`.
- Table `storage_warning_ack` so 80/95/100% banners don't re-nag.
- Extend `create-checkout` with addon SKU paths (storage top-ups).
- Confirm `voice-memo-upload-url` returns structured `QUOTA_EXCEEDED_STORAGE` envelope for deep-link to `/upgrade`.

## 13. Referral dashboard

**Today:** `referral-attach` / `referral-resolve` exist. No read endpoint.

**Backend work:**
- Edge function `referral-summary` returning code, redacted referred users, credits earned, pending matured rewards, next payout window.
- Enable Realtime on `credit_ledger` for self.

## 14. Profile + avatar

**Backend work:**
- `profile-update` edge function (display_name, timezone, notification prefs).
- `avatar-upload-url` signed upload to `avatars` bucket; on finalize, write `profiles.avatar_url`.
- `presence-ping` lightweight function updating `profiles.last_active_at` (rate-limited 1/min).

## 15. Notifications + digest (calm by default)

**Backend work:**
- Table `notification_preferences` (digest_frequency enum: off | daily | weekly, channels: email | inapp, quiet_hours jsonb).
- Table `notifications` (user_id, song_id, kind, payload, read_at).
- Trigger from `song_activity` → fan out to non-actor members respecting prefs.
- Email infra via `email_domain--setup_email_infra` once a sending domain is verified; transactional templates: invite, digest, storage warning, payment receipt.
- Scheduled `digest-send` (cron) — composes digest using AI Gateway summarizer (IDs/counts only, no lyric content). Honors user timezone + quiet hours.
- `notifications-mark-read` edge function.

## 16. Song Canvas / Whiteboard (Phase 4 — large; scaffold only now)

**Backend work (scaffold):**
- Tables: `canvas_nodes` (song_id, kind enum, parent_id, tree enum: ideas | final, position jsonb, payload jsonb, created_by), `canvas_edges` (from_node, to_node, kind: listen_path | merge | compare_pair). RLS via `is_song_member`.
- Functions later: `canvas-node-upsert`, `canvas-node-move-tree`, `canvas-merge-nodes`, `canvas-listen-path-set`, `canvas-compare-pair`, owner review queue read.

## 17. Cross-cutting hardening

- Audit every public-schema CREATE TABLE in current migrations for missing GRANTs (per memory rule).
- Add Supabase scheduled job to expire stale `song_invites` (status → 'expired' past `expires_at`).
- Add Supabase scheduled job to retry `voice_memo_transcripts` rows in `failed` state where `next_attempt_at < now()` and not exhausted (already partially in `voice-memo-transcribe-worker`; confirm cron is enabled).
- Add `app_settings` flag for maintenance mode so edge functions can short-circuit with calm 503.

---

## Integrations / secrets summary

| Need | Provider | Secrets |
|---|---|---|
| Phone OTP | Twilio (Supabase Auth provider) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGE_SERVICE_SID` |
| Transcription / digest / recap | Lovable AI Gateway (Gemini Flash) | `LOVABLE_API_KEY` (already managed) |
| Payments | Stripe (Lovable connector) | already wired |
| Email (invites, digest, receipts, storage warnings) | Resend via Lovable email infra | requires verified sending domain |
| Avatars / exports | Supabase Storage | n/a |

No external storage, no third-party analytics, no third-party AI receiving raw lyric/memo content (Product Vision constraint).

---

## Suggested backend build order

```text
Phase A  Twilio phone OTP + founder-code redemption + onboarding_state
Phase B  Lyrics/notes SDK + realtime, member mgmt endpoints, song-members-list
Phase C  song_activity table + triggers + last-seen + recap (AI Gateway)
Phase D  me-summary + catalog list + storage-summary + addon checkout
Phase E  Versions snapshot/restore + autosnapshot cron, credits view + PDF export
Phase F  Email domain + notifications + digest cron
Phase G  Voice memo extensions (lyric link, layered takes, peaks, word timing)
Phase H  Canvas tables scaffold
```

Phase A unblocks the Church Center-style phone-first onboarding. B–C unblock Claude's first-slice acceptance criteria. D–F close trust + monetization + calm-notification loops.
