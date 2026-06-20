# L2 — LOVABLE: Auth Finalize (the gate to everything)
## Cluster 0/3 · Lane: `lovable/*` · Owner: Lovable (data spine + auth)

> Paste into Lovable. Auth is the foundation RLS keys off — finish it so every other
> feature can trust `auth.uid()`. Backend + the `cog/auth` seam only. Claude owns how
> the auth *screens look*; you own the auth *logic, endpoints, and SDK*.

---

## YOUR ROLE (do not overstep)
You are **Lovable**: Supabase auth, sessions, RLS, edge functions, and the typed
auth seam at `src/integrations/cog/auth.ts`. You do **not** restyle the auth screens
(Claude) or write app tests (Codex). Contract: `docs/BUILD-PATHWAY.md`.

---

## CONTEXT
Current auth surface:
- Screens: `src/pages/auth/EmailAuthPage.tsx` (primary), `PhoneLoginPage.tsx` +
  `CodeVerifyPage.tsx` (phone OTP — **disabled until an SMS provider is configured**),
  `ResetPasswordPage.tsx`.
- Seam: `src/integrations/cog/auth.ts` (the only auth surface the frontend imports).
- Many edge functions exist (`supabase/functions/*`), incl. billing/admin/founder.
- RLS across ~35 tables depends on a correct, consistent `auth.uid()` and a
  provisioned `profiles` row per user. (See L1.)

---

## OBJECTIVE
A complete, secure, reliable auth that the whole app + RLS depend on — email
end-to-end, a clear decision on phone OTP, guaranteed `profiles` provisioning, and a
clean seam.

## TASKS
1. **Email auth end-to-end:** signup, login, logout, email verification, and
   password reset (incl. the reset deep-link/redirect) all work and persist sessions
   across reloads + token refresh.
2. **`profiles` provisioning:** a DB trigger (or equivalent) creates a `profiles`
   row on every new auth user, with `plan_tier` default — so RLS + the app never hit
   a missing-profile state.
3. **Phone OTP decision:** either wire the SMS provider (Twilio) and enable the
   phone flow end-to-end, **or** keep it cleanly gated with a single source of truth
   (a flag/route guard) so there are no dead/confusing entry points. State which.
4. **RLS consistency:** confirm every policy keys off `auth.uid()` and the
   `profiles`/`song_members` relationship (ties to L1's RLS matrix). No anon access
   to private data.
5. **The seam:** `cog/auth.ts` exposes exactly what the frontend needs (current
   user, session, signIn/up/out, reset) and nothing leaks the raw client into
   pages/components. Document the surface for Claude.
6. **Abuse/hardening:** rate-limit OTP/login endpoints; verify edge functions check
   auth + role; no service-role key client-side.

## DELIVERABLES
1. Auth flow doc (`supabase/AUTH.md`): every path + redirect + session lifecycle.
2. `profiles` provisioning migration/trigger.
3. Phone-OTP decision (enabled w/ provider, or cleanly gated) + the flag location.
4. RLS confirmation tied to L1's matrix.
5. Documented `cog/auth.ts` surface for Claude.

## ACCEPTANCE CRITERIA
- [ ] Email signup/login/logout/verify/reset all work; sessions persist + refresh.
- [ ] Every new user gets a `profiles` row automatically.
- [ ] Phone OTP is either fully live or cleanly disabled (no dead ends).
- [ ] All RLS keys off `auth.uid()`; no anon access to private song data.
- [ ] Frontend touches auth only via `cog/auth.ts`.

## CONSTRAINTS
- Backend + seam only; no auth-screen restyling. `lovable/auth-finalize` → merge → delete.
- Never weaken RLS or expose service-role keys.

## REFERENCES
- `src/pages/auth/*`, `src/integrations/cog/auth.ts`, `supabase/functions/*`, `supabase/migrations/*`
- `CLAUDE.md` §3/§5, `docs/prompts/L1-lovable-schema-consolidation.md`, `docs/BUILD-PATHWAY.md`
