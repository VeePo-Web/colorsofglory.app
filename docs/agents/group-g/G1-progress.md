# G1 · Payments / Upgrade — progress log

## 2026-07-08 — all 10 steps, one pass

**Baseline found (differs from the charter in G1's favor):** the real pricing page
(`pages/pricing/UpgradePage.tsx`) was already server-driven for *prices/limits*
via `lib/pricing/pricingApi.fetchPlanTiers()`, and already had: code validation
with per-reason copy, the referral banner, the anon→login→resume checkout intent
(`cog:pending-checkout` + `postAuthRoute`), loading skeletons, and a lazy,
preloaded CheckoutModal. The charter's `getPricingPage()`-renders claim was
optimistic; the true page reads `plan_tiers` + supplements with client copy.

**Step 1 — legacy retired.** Deleted `pages/UpgradePage.tsx` (hardcoded
"1 song/500MB · 50 songs/100GB" contradicting the catalog; its "Go Pro" button
had *no onClick*). `/upgrade-old` → `<Navigate to="/upgrade" replace>` in
`settingsRoutes.tsx`. Repointed `codex-mobile-render.test.tsx` at the real
pricing page (with a pricingApi mock) — passes. `git grep pages/UpgradePage` clean.

**Step 2 — server truth.** The card bullets hardcoded plan numbers ("3 more
songs (4 total)", "50 songs", "100GB"). Replaced with `planFeatures(tier, tiers)` /
`planMissing(tier)` deriving every number from the server tier row
(`ownedSongLimit`, `storageBytesIncluded`, `allowsMemberReferral`). Data-load
failure now has a one-tap "Try again" (retryable effect), not a dead refresh hint.

**Steps 3+4 — checkout hardened + codes visible at the money moment.**
`CheckoutModal` now: restates plan + server-derived price + applied code
("Founder code applied — $49/month") in the header; focus-trapped; Escape
closes; body scroll locked; focus restored on close. The pricing page passes a
`checkoutSummary` built from the server-validated numbers at session-creation
time. Cancel path = close → back on plans with selections intact. All invalid
code states already had calm copy; `not_found` falls to the generic calm line.

**Step 5 — second-song gate warmed.** `gateMessages` was missing the `song_gate`
key that `useCreateSong`'s default (`/upgrade?source=song_gate`) actually sends —
the most common gate entry showed no context line. Added it (+ `storage`).
Capture's `ReviewSheet` navigated to a bare `/upgrade` with a cold "Free plan
limit reached" toast — now `/upgrade?source=song_gate_free` with "Your first
song is safe" copy. (One-line edit in C2's file; flagged here.)

**Step 6 — storage warning built (was 0%).** `StorageWarningSheet`
(approaching ≥80% nudge / over-limit paywall; real `getMyBillingStatus().storage`
numbers; Pro → add-on checkout via `purchaseStorageAddon` + `PRICE_IDS`, others →
`/upgrade?source=storage`; "Your existing songs are never deleted or locked"
always visible) + `StorageWarningController` (mounted in `App.tsx`): over-limit
opens **only** off the outbox's `quota_storage` event — i.e. when a new upload
actually paused and was retained on-device — so it gates exactly the new action;
approaching nudges once per session; `cog:storage-warning` CustomEvent for
on-demand opens. The outbox retain-and-retry machinery already existed (C2) —
this is its missing UI consumer.

**Step 7 — PlanGate.** `components/pricing/PlanGate.tsx`: the one calm
invitation-card pattern + `upgradeHref(source)` + the `UpgradeSource` union.
Documented in the contract for other lanes to adopt (versions/exports gates
live in E3/etc. lanes — adoption is theirs, the pattern is here).

**Step 8 — success + return.** `CheckoutSuccessPage` rewritten: polls
`current_plan` (1.5s × 8) before the auto-return so there's no "still locked"
flash; invalidates the TanStack cache once visible (gates unlock without
reload); returns to `cog:upgrade-return-to` (stashed by the pricing page from
`source`); clears `cog:pending-checkout`; manual CTA always available; warm
copy in both phases.

**Step 9 — guards + a11y.** Auth-resume path verified (existing, tested in
`post-auth-route.test.ts`). `/upgrade` stays public (decided + documented —
pricing viewable anon, auth enforced at checkout; A5's route comment already
says the same). Modal focus trap/Escape (Step 3), `aria-label` on the code
input, SR-readable prices ("$49 per month, discounted from $100"), progressbar
semantics on the storage bar, `prefers-reduced-motion` on the success animation.

**Step 10 — verification.**
- `npm run build` ✅ · `tsc --noEmit` ✅
- Full vitest: **13 failures — byte-identical to the origin/main baseline**
  (verified by running the same 7 files in a clean worktree at 9d549f9).
  Zero regressions; the repointed upgrade smoke test passes.
- Published `docs/MONETIZATION-CONTRACT.md`.
- **Honest limit:** a real Stripe-sandbox round-trip (card form → webhook →
  plan flip) wasn't run here (no sandbox keys in this environment). The
  client-side money path is verified by build + unit/render tests + code walk;
  walk the live sandbox once before launch.

**Depends on:** A3 (`cog/billing.ts`, `pricingApi`) — consumed only.
F3 (`cog:referral-code` stash, `/r/:code`) — consumed at checkout only.
A5 — `/upgrade-old` redirect registered; `/upgrade` public.
G2 — storage meter unchanged; warning thresholds aligned at 80%.
