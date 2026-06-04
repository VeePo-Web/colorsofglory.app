
# Admin Dashboard — Founder Codes & Payout Tracking

Internal-only dashboard at `/admin/*`, gated by the existing `user_roles.role = 'admin'` check via `has_role()`. Never linked from public navigation, never indexed (noindex), and every page guards with a server-verified role check (not a client flag).

## 1. Access control

- New `RequireAdmin` route wrapper:
  1. `supabase.auth.getUser()` (re-validates with auth server)
  2. RPC call to `public.is_admin(auth.uid())` (already exists)
  3. On false → redirect to `/` with no flash of admin UI
- Add `<meta name="robots" content="noindex,nofollow">` on all `/admin/*` pages
- Not linked from any nav, footer, or sitemap. Direct-URL only.

## 2. Backend additions (single migration)

All SECURITY DEFINER, `has_role(auth.uid(),'admin')` guard inside each function. No new tables — reuses existing `founders`, `codes` (kind='founder'), `founder_codes`, `founder_redemptions`, `referral_attributions`, `reward_events`, `payouts`, `credit_ledger`.

**New RPCs:**

- `admin_create_founder(_display_name text, _email text, _reward_profile jsonb, _payout_method text, _payout_details jsonb)` → inserts into `founders`, returns row.
- `admin_create_founder_code(_founder_id uuid, _code text, _max_redemptions int, _expires_at timestamptz, _notes text)` → inserts into both `codes` (kind='founder', owner_founder_id, value=upper code) and `founder_codes` (mirror for legacy reads). Validates `code ~ '^[A-Z0-9-]{4,32}$'` and uniqueness across `codes.value`.
- `admin_deactivate_code(_code_id uuid)` → sets `codes.status='disabled'` + audit row.
- `admin_founder_summary()` returns table: founder_id, display_name, email, code_count, active_codes, total_redemptions, attributed_users, paying_users, pending_cents, payable_cents, paid_cents, last_payout_at.
- `admin_founder_detail(_founder_id uuid)` returns: founder row, all codes with redemption counts, attributed user list (id, signed_up_at, plan, lifetime_paid_cents), reward_events grouped by status, payouts list.
- `admin_referrals_recent(_limit int)` for activity feed.

**New view (admin-only, service_role-only GRANT):**
- `admin_monthly_payout_v1` — per founder, per calendar month: payable cash sum, pending cash sum, count of contributing invoices. Powers the "this month I owe" screen.

**Audit:** every admin write calls `write_audit(auth.uid(), 'admin_*', ...)`.

**Indexes (only if missing):** `codes(owner_founder_id) WHERE kind='founder'`, `reward_events(referrer_founder_id, status, created_at DESC)`, `referral_attributions(referrer_founder_id)`.

## 3. SDK (`src/integrations/cog/admin.ts`)

Thin typed wrappers around the RPCs above + a `useIsAdmin()` hook. This is the only `src/**` file Lovable owns for this task (per the 3-agent rule — pages/components are Claude's, but a typed SDK is allowed).

## 4. Admin pages (Claude builds the UI; Lovable scaffolds routes only)

Per the project rule, Lovable does NOT build `src/pages/**` or `src/components/**`. This plan scaffolds **route registration only** in `src/App.tsx` (admin routes lazy-loaded), and leaves page implementation to Claude with a short brief:

- `/admin` — overview: totals, MTD payable, recent redemptions
- `/admin/founders` — list + "New founder" button
- `/admin/founders/:id` — detail: codes, redemptions, attributed users, reward events, payouts; "New code" + "Deactivate code" actions
- `/admin/codes` — flat searchable list of all founder codes with redemption/payable totals
- `/admin/payouts` — current month per-founder amounts owed, button to call `create_payout_batch` + `approve_payout` + `mark_payout_paid` (already exist)

Each page is mobile-first cream/gold per design system but **utilitarian** — dense tables OK, this is internal.

## 5. Out of scope (explicit)

- Public founder landing pages
- Stripe Connect / actual money movement (still manual via `mark_payout_paid` with provider txn id)
- Editing reward_profile after creation (do in DB for now)
- Rate limiting on admin RPCs (admin-only, low volume)

## 6. Verification

- `is_admin` returns false → `/admin` redirects
- Create founder + code → row in `founders`, matching row in `codes` (kind=founder, owner_founder_id set) and `founder_codes`
- New user redeems code → `referral_attributions` row links to founder
- Simulated invoice via `record_invoice_paid` → reward_event appears in founder detail with correct cents per `reward_profile`
- Monthly view sums match `reward_events` where `status='payable'` and `payout_id IS NULL`

## Open question

Should I scaffold the route registrations and SDK only (and hand UI to Claude per the 3-agent rule), or should I also build the admin page UIs myself this round? Default: SDK + migration + route stubs only.
