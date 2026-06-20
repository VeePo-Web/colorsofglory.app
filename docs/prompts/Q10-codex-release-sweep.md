# Q10 — CODEX: Full Release Sweep (Lighthouse · a11y · regression · launch gate)
## Cluster 10 (final) · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. The last gate before launch — prove the whole app meets the bar on
> mobile and that nothing temporary is shipping. Codex lane only. No feature/UI changes;
> file bugs.

## YOUR ROLE
Codex: CI, Lighthouse, a11y, regression, release checklist, `docs/codex-*`. No
feature/UI/schema. Run last, after every other cluster. `docs/BUILD-PATHWAY.md`.

## OBJECTIVE
A green, fast, accessible, secure release — the entire golden path proven on mobile, all
gates passing, and every temporary/preview hack removed.

## TASKS
1. **🔒 LAUNCH BLOCKERS (must verify):**
   - **Re-enable the auth wall:** `src/components/auth/RequireAuth.tsx` `BYPASS_AUTH`
     **must be `false`** (it was set true for preview testing). Fail the release if true.
   - **PasswordGate:** confirm intended state for launch (keep for preview / remove for GA — per product).
   - No `console.log`/`console.error` in committed app code; no secrets in client; no
     `.env`/keys committed; fly4me remnants gone (e.g. `contact_submissions` per L1).
2. **Lighthouse (mobile, throttled 4G)** on key routes (capture, room, canvas, catalog,
   auth): **Performance ≥ 90 · Accessibility ≥ 95 · Best Practices 100 · SEO 100**;
   CWV: LCP < 2.5s · INP < 200ms · CLS < 0.1. Record results.
3. **Golden-path e2e on mobile (390px):** capture → review → room → lyrics/chords → voice
   → invite → activity → versions → credits → catalog → upgrade — with a seeded test user.
   (This is the repeatable version of the live mobile audit — build it as the standing
   harness.)
4. **Full regression:** run every cluster's test suite; all green + deterministic (no flake).
5. **a11y audit:** keyboard, screen-reader landmarks, contrast AA+, reduced-motion across
   the app.
6. **Bundle budget + perf:** `perf:budget` passes; no oversized chunks regressed.
7. **Release checklist doc:** `docs/codex-qa-gate/RELEASE-CHECKLIST.md` — the go/no-go list,
   with the auth-wall re-enable at the top.

## DELIVERABLES
1. Auth-wall + hygiene launch-blocker checks (CI-enforced where possible). 2. Lighthouse
   report (mobile) on key routes. 3. Mobile golden-path e2e harness (seeded user) + run.
4. Full green regression. 5. a11y audit report. 6. Bundle/perf pass. 7. RELEASE-CHECKLIST.

## ACCEPTANCE CRITERIA
- [ ] `BYPASS_AUTH === false`; no console/secret/fly4me leftovers; PasswordGate state intentional.
- [ ] Lighthouse mobile targets met on key routes; CWV within budget.
- [ ] Golden-path e2e passes on the 390px viewport with a seeded user (repeatable harness).
- [ ] Full regression green + deterministic; a11y audit clean; bundle budget holds.
- [ ] RELEASE-CHECKLIST.md exists with a clear go/no-go.

## CONSTRAINTS
Codex lane only — file bugs for Claude/Lovable; don't fix features. Test/Stripe = test
mode. `codex/release-sweep` → merge → delete. **Do not sign off launch while BYPASS_AUTH
is true.**

## REFERENCES
- `src/components/auth/RequireAuth.tsx` (the bypass to re-enable), `App.tsx` (PasswordGate)
- `scripts/codex-qa-gate.mjs`, `check-bundle-budget.mjs`, `docs/codex-qa-gate/`
- `docs/MOBILE-AUDIT-FINDINGS.md`, `docs/MOBILE-UX-BENCHMARK.md`
- all prior prompts; `docs/prompts/Q1-…ci-quality-gate.md`; `docs/BUILD-PATHWAY.md`; `CLAUDE.md` §3 perf
