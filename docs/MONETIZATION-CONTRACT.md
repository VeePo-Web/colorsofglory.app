# MONETIZATION CONTRACT — G1 · Payments / Upgrade
*Published 2026-07-08 by the G1 agent. The reference for how money enters Colors of Glory: the plan gates, the checkout flow, the storage warning, and who owns what across G1/G2/F3/G3.*

---

## 1. Money truth (law)

The **server is the only authority** on plans, prices, and limits:

| Truth | Source | Client reader |
|---|---|---|
| Plan tiers, prices, song limits, storage included | `plan_tiers` table | `fetchPlanTiers()` (`lib/pricing/pricingApi`) / `getPricingCatalog()` (`cog/billing`) |
| The caller's plan + storage + song quota | `me-billing-status` edge fn | `getMyBillingStatus()` → `useBillingStatus()` / `useSubscription()` |
| Can this user create a song? | `can_create_song` RPC / `create-song` edge fn (enforced) | `canCreateSong()` (pre-check only) |
| Code validity + discount | `validate-code` edge fn | `validateCode(code, plan_key)` |
| Checkout session | `create-checkout` edge fn | `createCheckoutSession()` → Stripe Embedded Checkout `clientSecret` |

**Never hardcode a tier, price, or limit client-side.** The pricing page's feature
bullets derive every number (song counts, storage sizes) from the server tier row
(`planFeatures()` in `pages/pricing/UpgradePage.tsx`). The legacy hardcoded
`pages/UpgradePage.tsx` is **retired** — `/upgrade-old` now redirects to `/upgrade`.

## 2. Routes & surfaces

| Route | Surface | Guard |
|---|---|---|
| `/upgrade` (+ `/pricing` alias) | Server-driven pricing page (`pages/pricing/UpgradePage.tsx`) | **Public** (pricing is viewable; checkout itself requires auth) |
| `/checkout/success` | `CheckoutSuccessPage` — confirmation + propagation poll + return | Public (Stripe redirects here) |
| `/upgrade-old` | `<Navigate to="/upgrade" replace />` | — |
| `/r/:code` | Referral landing (F3) → `/upgrade?ref=CODE` | Public |
| App shell overlay | `StorageWarningController` + `StorageWarningSheet` | Signed-in only (no-ops otherwise) |

### `?source=` contexts on /upgrade
The pricing page greets the songwriter with a context line keyed by `source`:
`song_gate` (useCreateSong default) · `song_gate_free` (catalog + capture) ·
`song_gate_starter` · `storage` · `settings`. Add new sources to **both**
`UpgradeSource` (`components/pricing/PlanGate.tsx`) and `gateMessages`
(`pages/pricing/UpgradePage.tsx`).

## 3. The checkout flow

1. **Select plan** → `handleSelectTier` (pricing page). Anon users: the intent
   `{tierKey, code, ref, source}` is stashed in `sessionStorage["cog:pending-checkout"]`
   and the user goes to `/auth/login`; `postAuthRoute` returns them to `/upgrade`,
   which resumes the checkout automatically.
2. **Codes** — validated server-side *before* session creation. A manually typed
   founder/referral code wins over a stashed referral link (`ignored_referrer`
   is surfaced as a calm notice). Invalid states each get calm copy:
   `expired / not_found / wrong_plan / self / already_attributed / network_error`
   (`codeErrorMessage`).
3. **Session** — `createCheckoutSession({planKey, code, referrerCode, returnUrl})`
   → Stripe **Embedded Checkout** in `CheckoutModal`. The modal header restates
   plan + server-derived price and the applied code ("Founder code applied — $49/month").
   The modal is focus-trapped, closes on Escape, and locks body scroll.
4. **Outcomes**
   - **Success** → Stripe redirects to `/checkout/success?session_id=…`.
   - **Cancel/close** → back on the pricing page with every selection intact.
   - **Error** → `paymentErrorToMessage` renders a calm alert on the page; retry is one tap.
5. **Success page** — polls `current_plan` (1.5s × 8) so the upgrade is *visible*
   before returning; then invalidates the TanStack cache (gates unlock without a
   reload) and returns the user to `sessionStorage["cog:upgrade-return-to"]`
   (stashed by the pricing page from `source`: song gates → `/` catalog,
   settings → `/settings`). If propagation is slow it still finishes warmly —
   the realtime billing subscription (`useRealtimeBilling`) catches up.

## 4. Plan gates

- **The second-song gate (Key Decision 6):** enforced server-side
  (`QUOTA_EXCEEDED_SONGS` / `song_limit_reached`). Client moments:
  - Catalog "New song" → `canCreateSong()` pre-check → `/upgrade?source=song_gate_free`.
  - `useCreateSong` mutation → on `QUOTA_EXCEEDED_SONGS` navigates
    `/upgrade?source=song_gate` (a moment, never a toast).
  - Capture commit (`ReviewSheet`) → `/upgrade?source=song_gate_free`.
- **The shared gate pattern:** `components/pricing/PlanGate.tsx` — the ONE calm
  invitation card for any plan-gated capability (versions depth, exports, song
  count, storage). API:
  ```tsx
  <PlanGate
    title="Version history grows with Pro"
    body="Every draft of this song, kept forever."
    source="versions"          // → /upgrade?source=versions
    ctaLabel="See plans"       // optional
    onDismiss={() => …}        // optional "Not now"
  />
  ```
  Plus `upgradeHref(source)` for flows that navigate instead of rendering a card.
  **Policy comes from `getMyBillingStatus()`** — PlanGate only renders the moment.
  Key Decision 9: no nag banners, no badge counts, mount it in place of the
  locked *new action* only — never over existing content.

## 5. The storage warning (Onboarding 16)

`components/pricing/StorageWarningSheet.tsx` + `StorageWarningController.tsx`
(mounted once in `App.tsx`, alongside the capture FAB).

- **Approaching (≥80%)**: a once-per-session nudge (`sessionStorage["cog:storage-nudge-seen"]`).
  Nothing is blocked.
- **Over limit**: opens **only** when a new upload actually pauses — the Capture
  Outbox emits `{type:"failed", reason:"quota_storage"}` and *retains the take
  on-device* ("Saved · will sync"). Reading/playing existing work is never
  gated; the sheet leads with what is safe.
- **Offers**: Pro accounts → storage add-on checkout (`purchaseStorageAddon` with
  `PRICE_IDS.storage_25gb_monthly` / `storage_100gb_monthly`; Stripe shows the
  price — server truth). Free/Starter → `/upgrade?source=storage`.
- **On-demand**: any surface may request it:
  `window.dispatchEvent(new CustomEvent("cog:storage-warning", { detail: { mode: "approaching" | "over" } }))`.

## 6. Boundaries (who owns what)

| Concern | Owner | G1's relationship |
|---|---|---|
| `/upgrade`, checkout UI, success page, PlanGate, storage **warning** | **G1** | owns |
| Referral code **display/earnings** (`/settings/referral`, `/r/:code`, share surfaces) | **F3** | G1 *consumes* the stashed code (`sessionStorage["cog:referral-code"]`, `?ref=`) and applies it at checkout — never shows or reconciles earnings |
| Referral **payout processing** | **G3** (admin) | never touched by G1 |
| Manage existing subscription (`settings/BillingPage`), storage **meter** (`settings/StoragePage`) | **G2** | G1 links in (`/upgrade?source=settings` back-link); never edits |
| Billing data layer (`cog/billing.ts`, `lib/pricing/pricingApi.ts`) | **A3** | consumed, never bypassed with raw Stripe/Supabase calls |
| Route tree (`routes/*`) | **A5** | G1 registered the `/upgrade-old` redirect; `/upgrade` stays public by design (pricing viewable anon; auth is enforced at checkout) |
| Gate *policy* (limits) | **server** | G1 renders moments only |

## 7. Session-storage keys (the handoff surface)

| Key | Writer | Reader |
|---|---|---|
| `cog:referral-code` | F3 (`/r/:code`, `?ref=`) | G1 pricing page (pre-validates + applies at checkout) |
| `cog:pending-checkout` | G1 (anon user picked a plan) | G1 pricing page after login (resume); cleared on success |
| `cog:upgrade-return-to` | G1 pricing page (from `source`) | `/checkout/success` (return-to-context) |
| `cog:storage-nudge-seen` | G1 controller | G1 controller (once per session) |

## 8. Known seams / asks

- **Lovable**: `pricing_copy` (`getPricingPage()`) exists in `cog/billing.ts` but the
  page currently derives bullets from `plan_tiers` numbers. If marketing copy
  should be DB-driven per card, populate `pricing_copy` and the page can switch
  to `getPricingPage()` cards without contradiction (numbers already server-truth).
- **G2**: the storage meter (`settings/StoragePage`) and the warning sheet use the
  same thresholds (80%); keep them aligned.
- **Verification note**: checkout was exercised in code + unit/render tests; a
  full Stripe-test-mode round-trip (real card form → webhook → plan flip) needs
  live sandbox keys and should be walked once before launch.
