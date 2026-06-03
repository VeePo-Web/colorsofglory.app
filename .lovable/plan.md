
# Colors of Glory — Backend Systems Audit

Mode: **Systems Audit / Scale-Readiness**. Scope: Lovable-owned backend only (DB schema, RLS, edge functions, storage, payments, referrals). UI is out of scope (Claude Code).

---

## 1. Executive Diagnosis

The backend is **structurally strong but operationally underspecified**. The object model, RLS helpers (`is_song_member`, `song_role`, `has_role`), quota gates (`can_create_song`, `can_upload_bytes`, `can_invite`) and the payments→subscriptions→storage_addons chain are clean and well-separated. CAD price mapping is verified end-to-end.

However, the system is currently **deceptively complete**: several lifecycles are declared but not enforced, several edge functions exist without the scheduled workers or recovery paths they imply, and several admin/operator views the spec promises are not yet queryable. At today's volume (≈0 users) nothing breaks. At 500 concurrent songwriters with active collaborators, the following will fail first: (1) voice-memo transcripts stuck in `pending` with no operator visibility, (2) invite acceptance racing with quota gates, (3) storage_usage drift vs. real bytes in `voice-memos` bucket, (4) reward maturation if `pg_cron` is not actually scheduled, (5) chargeback/refund flows that touch subscriptions without updating `current_plan()` semantics.

Biggest risks, in order: **silent transcript failure**, **storage accounting drift**, **invite/quota race**, **reward worker scheduling**, **missing GDPR delete path**, **no admin visibility plane**.

## 2. What Is Working (Preserve)

- Single source of truth per concern: `songs`, `song_members`, `subscriptions`, `storage_addons`, `credit_ledger`, `reward_events`, `referral_attributions`, `billing_events`.
- Membership gating via `is_song_member()` / `song_role()` SECURITY DEFINER — every song-content table uses the same predicate.
- `profiles` decoupled from `auth.users` with `user_id uuid` (no FK to `auth.users`), correct per Lovable rules.
- Quota gates server-side (`can_create_song`, `can_upload_bytes`, `can_invite`) — clients cannot bypass.
- Stripe webhook is idempotent on `billing_events.stripe_event_id`; lookup_key → DB row mapping is verified for all 6 CAD products.
- Roles in dedicated `user_roles` table with `has_role()` — no privilege escalation surface.

## 3. Top Structural Risks

### R1 — Voice memo lifecycle has no terminal failure state (CRITICAL, state bug)
`voice_memos` flows `uploading → finalized → ready → transcribed`, but there is no `failed_upload`, `failed_transcription`, or `quarantined` state. `voice_memo_transcripts` tracks attempts via `claim_transcript_attempt` / `reset_transcript_attempts`, but a memo that exhausts retries has no surfaced state on the parent row. Owners will see "processing…" forever. Fix: add `status = 'failed'` + `failure_reason text` on `voice_memos`, and a `mark_memo_failed()` SECURITY DEFINER called from the worker after max attempts.

### R2 — Storage accounting can drift from bucket reality (CRITICAL, data integrity)
`storage_usage.bytes_used` is updated via `apply_storage_delta`. If `voice-memo-delete` succeeds in DB but the storage object delete fails (or vice versa), counter drifts. There is no reconciler. Fix: (a) make delete a two-phase: mark `voice_memos.deleted_at` then enqueue actual blob delete; (b) add a nightly `storage-reconcile` worker that diffs bucket bytes vs. `storage_usage` per owner and emits `audit_logs` rows; (c) make `apply_storage_delta` clamp at 0 (never negative).

### R3 — Invite acceptance races free-plan quota (HIGH, logic bug)
`song-invite-accept` adds the invitee as a `song_member` regardless of the invitee's plan. Spec says invited memberships do NOT consume the invitee's free-song slot — confirm `owned_active_song_count()` only counts `owner` role. Currently the function exists, but `can_create_song` is called from `create-song`, not on invite accept, so this is consistent. Risk is the reverse: a Free user who accepts an invite and is later promoted to `owner` via `song-transfer-owner` will bypass `can_create_song`. Fix: enforce `can_create_song(new_owner_id)` inside `song-transfer-owner` before commit; block transfer with a clear error.

### R4 — Reward maturation depends on an unscheduled worker (HIGH, automation bug)
`rewards-mature-worker` and `mature_holds()` exist, but there is no confirmed `pg_cron` schedule in any migration. If nothing calls it, `reward_events` sit in `pending` forever and `payouts` never populate. Fix: add a migration that registers `cron.schedule('mature-holds-daily', '17 7 * * *', $$select public.mature_holds()$$)` (or invokes the edge function via `net.http_post`), plus an `audit_logs` entry on each run so operators can confirm it executed.

### R5 — Webhook handles `invoice.payment_succeeded` but not refunds / disputes consistently (HIGH, state bug)
`record_invoice_refunded` and `record_chargeback` exist as SQL helpers, but the webhook router needs explicit cases for `charge.refunded`, `charge.dispute.created`, `customer.subscription.deleted`, `customer.subscription.updated` (plan change), and `invoice.payment_failed` (dunning). On refund of an add-on, `storage_addons` must be deactivated and `effective_storage_limit()` must recompute. Currently only the happy path is wired. Fix: extend `payments-webhook` switch with these events and ensure each path writes a `billing_events` row + downstream domain change.

### R6 — No `delete-account` / GDPR path (HIGH, compliance)
There is no edge function to delete a user's auth row + cascade their owned songs, memberships, memos, blobs, subscriptions. Owners who delete will orphan songs with collaborators. Fix: add `delete-account` edge function with these rules: (a) for songs with other members, force `song-transfer-owner` to next-most-senior member or archive song; (b) for solo songs, soft-delete then enqueue blob purge; (c) cancel active Stripe subscriptions via API; (d) write `audit_logs`.

### R7 — No admin visibility plane (HIGH, operator burden)
`admin-founders`, `admin-payouts`, `admin-attribution-override` exist, but there is no read-side: no `v_admin_songs_at_risk` (memos stuck pending > 1h, storage > 90% of limit, transcripts failed N times), no `v_admin_billing_anomalies` (refunds, chargebacks, failed invoices last 30d), no `v_admin_referral_health`. Operators will rely on ad-hoc SQL. Fix: add SECURITY DEFINER views (or RPCs) gated by `is_admin()` for the three planes above.

### R8 — `song_invites` lifecycle missing `expired` / `revoked` enforcement (MEDIUM, state bug)
`is_invite_valid()` and `current_invite_expiry()` exist, but nothing demotes expired invites to `expired` status in the row itself — they remain `pending` and just fail validation. Operators auditing pending invites will see noise. Fix: add a cheap `pg_cron` job (`expire-invites-hourly`) that updates rows where `expires_at < now() AND status = 'pending'` to `status = 'expired'`. Also enforce one-shot use: on accept, set `status = 'accepted'`, `accepted_at`, `accepted_by` atomically with `FOR UPDATE`.

### R9 — Signed URL TTLs and abuse not bounded (MEDIUM, permission bug)
`voice-memo-signed-url` issues URLs for `voice-memos` bucket. Confirm TTL is ≤ 5 min and per-request rate-limited per `user_id` (e.g., 60/min). Without bounding, a leaked URL gives extended access. Same audit for `exports`.

### R10 — `app_settings` is a single global row with no schema discipline (MEDIUM, data model)
If `app_settings` holds tunables (reward hold days, free-plan caps, max memo MB), encode each as a typed column with a CHECK, not a JSON blob. Otherwise tunable drift will silently change behavior. Confirm and add `updated_by`, `updated_at`, and an `audit_logs` trigger on UPDATE.

### R11 — `audit_logs` has no required-write contract (MEDIUM, traceability)
Critical actions (transfer-owner, delete-account, payout approve, attribution override, admin role grant, refund) must write `audit_logs` rows. Today this is convention, not enforcement. Fix: add SECURITY DEFINER wrappers `audit('action', actor, target, payload)` and require every admin edge function to call it; lint by checking edge function source in CI later.

### R12 — `song-leave` for the sole `owner` is undefined (MEDIUM, logic bug)
If the only owner calls `song-leave`, the song is orphaned. Fix: reject when caller is the only `owner`; require `song-transfer-owner` or `song-delete` first. Return a structured error code (`OWNER_CANNOT_LEAVE`) the UI can interpret.

### R13 — Free-plan "1 owned active song" not enforced on reactivation (MEDIUM)
If a Free user archives song A, creates song B, then unarchives A, they have two active. `owned_active_song_count()` must be re-checked on un-archive. Fix: add `can_unarchive_song()` gate and use it in any un-archive RPC; explicitly forbid un-archive when over quota with a structured error.

### R14 — No backpressure on transcript queue (LOW→MEDIUM, scale)
`voice_memo_transcripts` with `claim_transcript_attempt` is a poll-based queue. At 500 users uploading concurrently, a single worker will lag. Fix: cap concurrent in-flight per worker via `FOR UPDATE SKIP LOCKED LIMIT N`, expose queue depth in `v_admin_songs_at_risk`, and pre-decide whether to scale to a second worker invocation.

### R15 — Founder/Pro distinction has no downgrade story (LOW)
`founder_pro` is grandfathered pricing. If a founder cancels then resubscribes, do they get founder price again? Today: webhook will use whatever lookup_key Stripe sends, so cancel+resubscribe at standard price strips founder status silently. Decide policy and encode it in `current_plan()` + `record_invoice_paid`.

## 4. Friction Points (Operator + Client)

- Operators cannot answer "which user's transcripts are stuck?" without raw SQL.
- Operators cannot answer "what changed for this song in the last 24h?" — `audit_logs` is partial.
- Clients (UI) get HTTP 400 from edge functions without structured error codes, so the UI cannot localize messages or distinguish "over quota" from "validation failed".
- `song-invite-create` returns a token but does not return a copy-paste-ready URL or expiry timestamp in a stable shape.

## 5. Scale Breakpoints (10x → 100x)

| Volume | First failure |
|---|---|
| 50 active songs / user | Catalog queries on `songs` need `(owner_id, archived_at, updated_at desc)` composite index |
| 1,000 memos / song | `voice_memos` list needs cursor pagination + `(song_id, created_at desc)` index |
| 100 concurrent uploads | Transcript queue starves without `SKIP LOCKED` + worker concurrency |
| 10 GB / user | Storage reconciler becomes mandatory, not optional |
| 1,000 invites pending | Without `expire-invites-hourly`, dashboards become unusable |
| 100 refunds / mo | Without webhook dunning + refund cases, billing state diverges |

## 6. Missing States / Objects / Rules

Missing states:
- `voice_memos.status`: add `failed`, `quarantined`.
- `song_invites.status`: enforce `expired`, `revoked`, `accepted` as terminal.
- `subscriptions.status`: ensure `past_due`, `canceled`, `incomplete_expired` are handled and reflected in `current_plan()`.
- `songs.archived_at` (if not present): formal archive state distinct from delete.

Missing objects:
- `audit_logs` is present but underused — needs canonical wrapper.
- `v_admin_songs_at_risk`, `v_admin_billing_anomalies`, `v_admin_referral_health` (views or RPCs).
- `delete_account_requests` queue table (GDPR audit trail).

Missing rules:
- `song-transfer-owner` must check `can_create_song(new_owner)`.
- `song-leave` must reject last owner.
- `can_unarchive_song()` for Free plan.
- Refund/chargeback must deactivate matching `storage_addons` and re-evaluate plan.

## 7. UX/UI Improvements (Backend-Owned Contracts)

Backend can only shape what UI consumes. Standardize:
- All edge functions return `{ ok: boolean, code: string, message: string, data?: any }` with a fixed enum of `code` values (e.g., `QUOTA_EXCEEDED_SONGS`, `QUOTA_EXCEEDED_STORAGE`, `OWNER_CANNOT_LEAVE`, `INVITE_EXPIRED`, `INVITE_ALREADY_USED`, `TRANSFER_BLOCKED_QUOTA`).
- `song-invite-create` returns `{ token, accept_url, expires_at, role }`.
- All quota responses include `current`, `limit`, `unit` so UI can render "3 of 5 songs used" without recomputing.

## 8. Recommended Architecture Adjustments (Priority Order)

**Phase D1 — Lifecycle integrity (this batch)**
1. Add `failed`/`quarantined` to `voice_memos` + `mark_memo_failed()`; wire into transcribe worker.
2. Add `expired`/`revoked` enforcement on `song_invites` + atomic accept.
3. Guard `song-transfer-owner` with `can_create_song(new_owner)`; guard `song-leave` against last owner.
4. Add `can_unarchive_song()` and apply in any un-archive path.

**Phase D2 — Scheduled workers**
5. `pg_cron`: `mature-holds-daily`, `expire-invites-hourly`, `storage-reconcile-nightly`. Each writes `audit_logs`.
6. Storage reconciler edge function: diff bucket vs. `storage_usage`, clamp at 0, emit anomalies.

**Phase D3 — Billing completeness**
7. Extend `payments-webhook` for `charge.refunded`, `charge.dispute.created`, `customer.subscription.deleted/updated`, `invoice.payment_failed`. Wire `storage_addons` deactivation on refund. Decide founder reactivation policy.

**Phase D4 — Compliance + admin plane**
8. `delete-account` edge function with transfer/archive/cancel/blob-purge sequence.
9. Admin views/RPCs: `v_admin_songs_at_risk`, `v_admin_billing_anomalies`, `v_admin_referral_health`, all gated by `is_admin()`.
10. Canonical `audit()` SECURITY DEFINER wrapper; refactor admin edge functions to call it.

**Phase D5 — Contracts + scale hygiene**
11. Standardize edge-function response envelope + error code enum.
12. Add composite indexes: `songs(owner_id, archived_at, updated_at desc)`, `voice_memos(song_id, created_at desc)`, `song_invites(status, expires_at)`, `voice_memo_transcripts(status, claimed_at)`.
13. Switch transcript claim to `FOR UPDATE SKIP LOCKED`; expose queue depth.

## 9. Next Actions (Ordered)

1. Approve this audit + Phase D1–D2 scope.
2. Ship migration A: voice_memo failure states, invite expiry/revoke enforcement, transfer/leave/unarchive guards, audit() wrapper, composite indexes.
3. Ship migration B: `pg_cron` schedules for mature-holds, expire-invites, storage-reconcile.
4. Deploy edge functions: `storage-reconcile`, `delete-account`, extended `payments-webhook` cases.
5. Ship migration C: admin views + standardized error code enum (as a Postgres ENUM or doc'd contract).
6. Backfill: one-time reconcile pass + one-time expire-invites sweep.
7. Hand off SDK changes (`src/integrations/cog/*`) so Claude Code can consume new error codes and admin RPCs.

After approval I will execute D1+D2 in one batch (migrations + edge functions + SDK), then D3, then D4+D5.

---
## Execution log — D1+D2 shipped (2026-06-03)

Migration `20260603202127`:
- `voice_memos.failure_reason` + `mark_memo_failed(memo, reason)` SECURITY DEFINER
- Atomic `accept_song_invite(token, user)` returning structured code (`OK | INVITE_NOT_FOUND | INVITE_EXPIRED | INVITE_ALREADY_USED | INVITE_EXHAUSTED`)
- `is_last_owner`, `can_unarchive_song`, `safe_transfer_song_owner`, `safe_leave_song`, `safe_unarchive_song` (all SECURITY DEFINER, structured-code returns)
- `expire_pending_invites()` sweeper
- `pg_cron`: `cog-mature-holds-daily` (07:17 UTC), `cog-expire-invites-hourly` (07 * * * *)

Edge functions refactored to atomic helpers + standard `{ ok, code, message, data }` envelope:
- `song-invite-accept`, `song-leave`, `song-transfer-owner`
- New: `song-unarchive`
- `voice-memo-transcribe`: calls `mark_memo_failed` when retries exhausted

SDK (`src/integrations/cog/songs.ts`):
- `CogError` class + `CogErrorCode` enum exported
- Envelope-aware `call()` with backward compat
- New `unarchiveSong()`

Remaining for D3+: storage-reconcile worker (needs net.http_post + anon key via insert tool), payments-webhook refund/dispute cases, delete-account, admin views.
