
# Colors of Glory — Backend Requirements (Deep Audit)

Lens: **Maximum organization, minimum friction, minimum admin overhead.** Every requirement below is scoped to backend-only (DB, RLS, edge functions, payments, storage, AI, observability) — Claude owns UI.

## 1. Actors

| Actor | Surface | Key needs |
|---|---|---|
| Songwriter (owner) | App | Create song, invite, edit lyrics/memos/chords, upgrade plan, see usage |
| Collaborator (member: editor/contributor/viewer) | App via invite | Join song, contribute within role, see only their songs |
| Founder (referrer) | App + admin-lite | Resolve own code, see referrals + earnings, request payout |
| Admin | Admin endpoints | Founders CRUD, attribution override, payout batches, fraud review |
| Anon visitor | Landing / invite preview | Resolve code/invite preview only — no song data |
| Service-role (edge fns / workers) | Server | Trigger automations, mature holds, write rewards, transcribe |
| Stripe | Webhook | Subscriptions, invoices, refunds, chargebacks |
| Lovable AI Gateway | Outbound | Transcription + digest summarization only |

## 2. Core objects (source of truth)

Songs, song_members, song_lyrics, song_versions, song_sections, song_notes, chord_progressions, voice_memos, voice_memo_transcripts, song_invites, profiles, user_roles, codes, founders, referral_attributions, reward_events, credit_ledger, payouts, subscriptions, storage_addons, storage_usage, billing_events, audit_logs, fraud_flags, app_settings.

**Health check:** schema is mostly complete. Gaps flagged in §10.

## 3. State machines (the missing explicit layer)

These exist implicitly in code but are NOT documented or enforced via CHECK/trigger gates. Backend requirement: codify them in a single `docs/state-machines.md` AND enforce transitions in DB triggers where money/quota/access is involved.

```text
voice_memo:        uploading → finalized → ready → transcribed
                        ↘ failed (recoverable) ↘ deleted
transcript:        pending → processing → ready | failed (attempt_count, next_attempt_at)
song_invite:       pending → accepted | revoked | expired | exhausted
subscription:      incomplete → trialing → active → past_due → canceled (+ grace via current_period_end)
storage_addon:     same lifecycle as subscription, independent
reward_event:      pending → payable → paid | reversed
credit_ledger:     pending → available → applied | reversed
payout:            draft → approved → processing → paid | failed
code:              active → exhausted | expired | revoked
referral_attribution: created (immutable except admin_override)
```

Required gate functions (some exist, some missing — see §10):
`is_song_member`, `is_song_owner`, `song_role`, `has_role`, `is_invite_valid`, `current_plan`, `is_pro_user`, `effective_storage_limit`, **new:** `can_create_song(user)`, `can_upload_bytes(user, bytes)`, `can_invite(song, user)`.

## 4. Critical workflows (backend contracts)

Each workflow needs: trigger, inputs, gates, side effects, failure path, audit event.

1. **Create song** — `create-song` edge fn (NOT YET BUILT). Gate: free plan = max 1 owned active song. Side effects: insert song, `add_owner_song_member` trigger seeds `song_members`. Failure: 402 `song_limit_reached`.
2. **Invite collaborator** — `song-invite-create` (missing). Gate: caller is owner/editor; not exhausted; expiry from `current_invite_expiry()`. Emits invite link, audit row.
3. **Accept invite** — `song-invite-accept` (missing). Gate: `is_invite_valid`. Side effects: insert `song_members`, increment `use_count`, mark accepted; invited memberships do NOT consume invitee's free-song slot.
4. **Voice memo lifecycle** — `voice-memo-upload-url` → client PUT → `voice-memo-finalize` → enqueue → `voice-memo-transcribe-worker` (claim via `claim_transcript_attempt`) → `mark_memo_transcribed`. Quota check at upload-url issuance via `can_upload_bytes`. Storage delta trigger updates `storage_usage`. Failure: backoff + cap at `max_attempts`, surface `last_error` on memo.
5. **Signed playback URL** — `voice-memo-signed-url` gated by `is_song_member`. URLs short-TTL (≤5 min).
6. **Checkout** — `create-checkout` builds Stripe session; founder-pro gated by `canPurchaseFounderRate`. Embedded checkout; `managed_payments: true` ineligible for our seller region (CAD/Canada IS supported — verify and enable).
7. **Webhook ingest** — `payments-webhook` (built, verified ✅). Idempotent via `billing_events.external_event_id`. Routes to `upsertSubscription` / `upsertStorageAddon` / `record_invoice_paid` / `record_invoice_refunded` / `record_chargeback`.
8. **Reward maturation** — `rewards-mature-worker` runs `mature_holds()` on cron. Need scheduled trigger (pg_cron or external).
9. **Credit application** — at next invoice paid for the credit owner, call `apply_credit_to_invoice` BEFORE charging Stripe. Currently NOT wired — gap §10.
10. **Payouts** — admin `create_payout_batch` → `approve_payout` → external Stripe Connect transfer → `mark_payout_paid` / `mark_payout_failed`.
11. **Digest / recap** — `song-digest-summarize` (missing). Reads activity IDs + event kinds only — never raw lyric/memo bytes — feeds Gemini Flash via Lovable AI Gateway.
12. **Activity log** — every mutating SDK call writes one `audit_logs` row via `write_audit`.

## 5. Permissions matrix (target)

| Object | anon | invitee w/ valid invite | viewer | contributor | editor | owner | admin |
|---|---|---|---|---|---|---|---|
| song row | — | preview title only | R | R | R | RW + delete | RW |
| lyrics / memos / notes / chords / sections / versions | — | — | R | RW own | RW | RW | R |
| song_members | — | — | self only | self only | RW | RW | RW |
| invites | — | resolve self | — | — | RW | RW | RW |
| subscriptions / storage_addons / storage_usage | — | — | self | self | self | self | R all |
| reward_events / credit_ledger / payouts | — | — | self | self | self | self | RW |
| founders / codes | — | — | — | — | — | self (own) | RW |
| audit_logs | — | — | — | — | — | — | R |

Every public table must be re-audited for: explicit `GRANT`s, `service_role` ALL, `anon` only where invite-preview/landing needs it.

## 6. Edge functions — required set

Built: `create-checkout`, `payments-webhook`, `referral-resolve`, `referral-attach`, `admin-*`, `rewards-mature-worker`, voice-memo chain.
**Missing / required:**
- `create-song` (free-plan gate)
- `song-invite-create`, `song-invite-accept`
- `song-leave`, `song-transfer-owner`, `song-delete` (soft)
- `song-export` (PDF/zip → `exports` bucket, signed URL)
- `song-digest-summarize` (Lovable AI Gateway, Gemini Flash)
- `voice-memo-delete` (with storage delta + transcript cleanup)
- `billing-customer-portal` (Stripe billing portal session)
- `billing-cancel-subscription` (server-side, idempotent)
- `apply-credit-on-invoice-upcoming` (Stripe `invoice.upcoming` → `apply_credit_to_invoice`)
- `cron-mature-holds` (scheduled wrapper)
- `delete-account` (GDPR: soft-delete songs, anonymize profile, revoke memberships, cancel sub)

## 7. Storage buckets

| Bucket | Public | Access pattern | Quota |
|---|---|---|---|
| `voice-memos` | private | signed URLs scoped by `is_song_member`, short TTL | counted against owner via trigger |
| `exports` | private (MISSING — needs creation) | signed URLs to owner only, 24h TTL, auto-purge after 7d | not counted |
| `avatars` | public (MISSING — currently only `partnership-uploads` fly4me leftover) | direct read | small cap per user |

Leftover `partnership-uploads` bucket must be deleted once fly4me is gone.

## 8. Payments & quota enforcement

- Free: 1 owned active song, 200 MB storage, full collab as invitee.
- Pro / Founder Pro: unlimited owned songs, 100 GB base + add-ons.
- Server-side enforcement points: `create-song`, `voice-memo-upload-url`, `song-export`. Never trust client.
- Referral rewards: direct-only, holds matured via `mature_holds`, refunds/chargebacks reverse via `record_invoice_refunded` / `record_chargeback`.
- Currency: CAD canonical. Verify `managed_payments: { enabled: true }` eligibility for Canadian seller account.

## 9. Observability, audit, fraud

- `billing_events`: every Stripe event, with `processing_error` for triage.
- `audit_logs`: every privileged mutation (admin actions, attribution overrides, payouts).
- `fraud_flags`: chargebacks auto-flag; manual flags for self-referral attempts, abnormal invite velocity.
- Required: `edge_function_logs` review SOP + a `/admin/health` read-only query set (counts of stuck transcripts, failed webhooks, past-due subs, draft payouts).

## 10. Gaps & risks (prioritized)

**Critical (blocks GA):**
1. No `create-song` quota gate → free users can create unlimited songs.
2. No `apply_credit_to_invoice` wiring on Stripe `invoice.upcoming` → credits never burn down.
3. No invite create/accept edge fns → collaboration impossible end-to-end.
4. No `exports` / `avatars` buckets created.
5. No scheduled job actually invokes `rewards-mature-worker` or transcript retry sweeper.
6. `delete-account` missing — GDPR/App Store risk.

**Important:**
7. No DB-level state-transition guards on `subscriptions.plan`, `reward_events.status`, `payouts.status` (only app-layer).
8. `song-export`, `song-digest-summarize` missing — Phase 4 features.
9. Storage delta trigger only counts memos, not future exports/attachments.
10. Founder-pro gate uses single `referral_attributions` row — race condition if attribution arrives after checkout starts.

**Hygiene:**
11. Delete fly4me leftovers: `contact_submissions`, `send-contact`, `partnership-uploads` bucket (await user signal).
12. Tighten `anon` grants — audit per table.
13. Add `idx` on `billing_events(processed_at)` and `voice_memo_transcripts(status, next_attempt_at)` for worker scans.

## 11. Build sequence (backend-only, ordered)

Phase A — **Quota & lifecycle gates**: `create-song`, `can_upload_bytes`, `voice-memo-delete`, `exports`+`avatars` buckets, `song-delete`/`song-transfer-owner`/`song-leave`.
Phase B — **Collaboration**: `song-invite-create`, `song-invite-accept`, invite-preview anon RLS.
Phase C — **Billing completeness**: `billing-customer-portal`, `billing-cancel-subscription`, `apply-credit-on-invoice-upcoming`, verify `managed_payments` eligibility, end-to-end live `4242` (after Claude ships checkout host route).
Phase D — **Scheduling & workers**: pg_cron for `mature_holds`, transcript retry sweeper, expired-invite cleanup, stuck-export GC.
Phase E — **AI + exports**: `song-digest-summarize`, `song-export`.
Phase F — **Compliance & ops**: `delete-account`, admin `/health` read pack, fly4me purge migration.

## 12. Mermaid (state — subscription + reward)

```text
stateDiagram-v2
  [*] --> incomplete
  incomplete --> trialing
  incomplete --> active
  trialing --> active
  active --> past_due
  past_due --> active
  past_due --> canceled
  active --> canceled
  canceled --> [*]
```

```text
stateDiagram-v2
  [*] --> pending: invoice.paid + attribution
  pending --> payable: hold_until reached
  pending --> reversed: refund/chargeback
  payable --> paid: payout marked_paid
  payable --> reversed: refund/chargeback
  paid --> [*]
  reversed --> [*]
```

## 13. End-state guarantees

When this plan is fully implemented backend will guarantee:
- Every song has exactly one owner row in `song_members` (trigger-enforced).
- Free plan limits are server-enforced — client cannot bypass.
- Every Stripe event is idempotent and replayable.
- Every reward, credit, and payout is auditable end-to-end via `audit_logs` + `billing_events`.
- No raw lyric/memo content ever leaves the backend except to the song's own members via short-TTL signed URLs.
- Admin actions are gated, logged, and reversible where possible.

## Next action

Approve this plan, then I'll convert Phase A items into a single migration + edge-function batch for the first build pass.
