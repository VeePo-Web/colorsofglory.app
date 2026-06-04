## Internal Audit Log Search — Plan

Per the 3-agent split, Lovable builds the **backend + SDK** only. The page itself (`/admin/audit`) is handed to Claude with a typed SDK ready to call.

### Scope
Admin-only search/filter over `public.audit_logs` for referral debugging. Filters: `invoice_id`, `referrer_user_id`, `referred_user_id`, `reversed_reason`, plus action kind and date range. Results paginated, newest first.

### Where the data lives
Referral audit rows we write today (`reward_skipped`, `reward_reversed`) store:
- `actor_user_id` — usually the referred user
- `target_type` = `'invoice'` or `'reward_event'`
- `meta` jsonb — `{ reason, invoice, amount_cents, subscription_id, plan, status, count }`

So the filters map to:
- `invoice_id` → `meta->>'invoice' = $`
- `reversed_reason` → `meta->>'reason' = $` (only `action='reward_reversed'`)
- `referred_user_id` → `actor_user_id = $`
- `referrer_user_id` → join `referral_attributions` on `actor_user_id` (the referred user) → match `referrer_user_id` OR `referrer_founder_id`

### Build steps

**1. Migration — search helper + GIN index**
- `CREATE INDEX idx_audit_meta_gin ON public.audit_logs USING GIN (meta jsonb_path_ops)`
- `CREATE INDEX idx_audit_action_created ON public.audit_logs (action, created_at DESC)`
- `admin_search_audit_logs(...)` SECURITY DEFINER function (`has_role(auth.uid(),'admin')` gate inside) that accepts all filters as nullable params and returns paginated rows with an enriched `referrer_user_id` resolved via `referral_attributions`.

**2. Edge function — `admin-audit-search`**
- POST, JWT-verified, admin role required (else 403)
- Zod-validated body: `{ invoice_id?, referrer_user_id?, referred_user_id?, reversed_reason?, action?, since?, until?, limit?, offset? }`
- Calls the RPC, returns `{ rows, total, has_more }`

**3. SDK — `src/integrations/cog/admin.ts`** (Lovable-owned path)
- `searchAuditLogs(filters) → Promise<AuditSearchResult>` with full TS types

**4. Hand-off doc — append to `.lovable/plan.md`**
- Page spec for Claude: route `/admin/audit`, filter bar (4 inputs + action select + date range), results table (timestamp, action, actor, invoice, reason, expand-for-meta-JSON), CSV export button.

### Out of scope (this turn)
- The actual `/admin/audit` React page and components — Claude builds those against the SDK
- Editing/redacting audit rows (audit log is append-only)
- Cross-environment (sandbox vs live) filter — add later if needed

### Technical Details
- Function is SECURITY DEFINER but re-checks `has_role(auth.uid(),'admin')` at top; revokes EXECUTE from `public`/`anon`, grants to `authenticated`
- Default limit 50, max 500
- Returns `meta` jsonb verbatim so the UI can render the full skip/reversal context

### Hand-off to Claude — `/admin/audit` page

SDK is ready: `searchAuditLogs(filters)` from `src/integrations/cog/admin.ts`. Gate the route with `isCurrentUserAdmin()`.

Filter bar inputs (all optional, debounced submit):
- `invoice_id` (text, e.g. `in_1QabcXYZ`)
- `referrer_user_id` (uuid)
- `referred_user_id` (uuid)
- `reversed_reason` (select: `churned_before_maturity`, `invoice_refunded`, `no_subscription`, `storage_addon`, `zero_amount`, `wrong_plan`, `bad_status`, `user_mismatch`, `no_attribution`, `self_referral`, `fraud_hold` — plus free text)
- `action` (select: `reward_skipped`, `reward_reversed`, `attribute_referral`, `redeem_code`, `approve_payout`, `mark_payout_paid`, `mark_payout_failed`, `override_attribution`, `admin_create_founder`, `admin_create_founder_code`, `admin_deactivate_code` — plus free text)
- `since` / `until` (datetime-local)

Results table columns: timestamp · action · entity (type+id) · actor (referred) · referrer (uuid or founder id) · invoice_id · reason / reversed_reason · "View JSON" expand row showing `before` + `after`.

Pagination: limit 50, page via `offset`; show `total` and `has_more`. CSV export button calls SDK with limit 500 and downloads client-side.

Notes:
- `invoice_id` is extracted from `after.invoice` / `before.invoice` jsonb
- `referrer_user_id` is resolved by joining `referral_attributions` on the row's `actor_user_id` (the referred user)
- All access enforced server-side by `has_role(auth.uid(),'admin')` inside `admin_search_audit_logs` — front-end gate is UX only