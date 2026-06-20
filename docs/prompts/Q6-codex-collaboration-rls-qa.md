# Q6 — CODEX: Collaboration + RLS-from-Client QA
## Cluster 6 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. This is the **security-critical** gate: prove roles actually block
> the wrong action from a real client session, not just in the UI. Codex lane only:
> tests, security, a11y, QA docs. No feature/UI changes; file bugs.

## YOUR ROLE
Codex: `src/test/*`, security/RLS verification, perf, a11y, `docs/codex-*`. No
feature/UI/schema. Run after Q1 (CI) + L6 + C5. `docs/BUILD-PATHWAY.md`.

## CONTEXT
Roles (Owner/Contributor/Reviewer/Viewer) are enforced by RLS (L6). The UI (C5) merely
reflects them. The job: **verify the boundary holds from the client** — a Viewer who
crafts a write request still gets denied by the database, not just hidden by the UI.
Surfaces: `song_members`, `song_invites`, `song-invite-*` edge functions,
`src/integrations/cog/members.ts`, `src/pages/invite/*`.

## OBJECTIVE
Provable role enforcement, secure invites, and a working join flow — tested against the
real seam with **seeded users in each role**.

## TASKS
1. **Seeded role users (QA infra):** a test harness with users in each role on a test
   song (owner/contributor/reviewer/viewer) — document how it seeds (test Supabase /
   service-role in CI secret, never in app code).
2. **RLS-from-client matrix (Critical):** for each role, attempt select/insert/update/
   delete on the song + each child table via the seam/client and assert the **database**
   allows/denies correctly (Viewer write → denied; Contributor destroy-others → denied;
   only Owner manages roles; Reviewer cannot mutate content). This is the headline gate.
2. **Invite security:** token unguessable; expired/used token rejected; preview leaks no
   private content; accept can't escalate role; accept is idempotent; create/accept
   rate-limited.
3. **Member management:** owner-only change-role/remove enforced server-side; non-owner
   change-role attempt denied; leave works; ownership transfer is atomic + owner-gated.
4. **Join flow e2e (mocked network):** join → (verify) → name → land in room with the
   right role; broken/expired link handled gracefully.
5. **a11y:** invite sheet + role picker labeled, keyboard-operable, ≥44px, reduced-motion.
6. **CI:** wire collaboration security tests into the Q1 gate (with seeded-user secret).

## DELIVERABLES
1. Seeded-role test harness + docs. 2. RLS-from-client matrix tests (the headline).
3. Invite-security tests. 4. Member-management/ownership tests. 5. Join-flow e2e + a11y.
6. Collaboration tests in CI.

## ACCEPTANCE CRITERIA
- [ ] Every role's allowed/denied DB actions are asserted from a real client session — boundary proven, not assumed.
- [ ] Expired/used/forged invite tokens are rejected; no role escalation; preview leaks nothing private.
- [ ] Owner-only management enforced server-side; ownership transfer atomic.
- [ ] Join flow works + degrades gracefully; invite/role UI is accessible.
- [ ] Collaboration security tests run in CI.

## CONSTRAINTS
Codex lane only — no feature/UI edits; file product bugs for Claude/Lovable. Keep
secrets (seed/service-role) in CI env, never committed. `codex/collab-qa` → merge →
delete. Never weaken RLS to make a test pass — a failing role test is a real bug.

## REFERENCES
- tables: `song_members`, `song_invites`; `supabase/functions/song-invite-*`
- `src/integrations/cog/members.ts`, `src/pages/invite/*`
- `docs/prompts/L6-…collaboration-roles-rls.md`, `C5-…collaboration-ui.md`, `Q1-…ci-quality-gate.md`
- `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §3
