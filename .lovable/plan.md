
# Fix: "Edge function failure" when saving idea into a song

## What we know
- Reproduces from **Quick capture → Add to canvas** (Review sheet after recording).
- No specific error text was captured.
- Zero recent logs exist for `commit-take`, `intake-voice-memo`, `create-song`, `voice-memo-*` — either the call is never reaching the edge (client-side/CORS/auth failure) OR the failure happened outside our current log window. We need real evidence before patching.

## Suspected code path

There are two distinct "save idea into song" paths, and both surface the same toast copy on failure. We must confirm which one is failing before choosing a fix.

```
Path A — "Add to canvas" from ReviewSheet (song is already known)
  ReviewSheet.handleCommit
    → commitTakeToCanvas()                        (supabase.functions.invoke "commit-take")
        → verifies take, is_song_member, can_create_song (if __new__)
        → inserts canvas_cards rows, logs activity

Path B — "File into a song" from Seed Ideas shelf
  SeedIdeaCard → (optional) createSong()          (edge fn "create-song")
              → claimSeedIdea()
                 → uploadVoiceMemo()              (edge fns "voice-memo-upload-url" then
                                                     signed PUT to storage, then
                                                     "voice-memo-finalize")
```

Any failure in `commit-take`, `create-song`, `voice-memo-upload-url`, or `voice-memo-finalize` will bubble up as a generic "edge function failure" toast.

## Plan

### Step 1 — Reproduce with real telemetry (no code changes yet)
1. Sign the preview session in (session replay shows the user was stopped at the private-preview password gate; we need to be past it to hit these functions).
2. Drive the exact flow via Playwright headless in the sandbox using the injected Supabase session:
   - Case A: open a song → record a take → tap "Add to canvas".
   - Case B: from `/` capture a hum → open Seed Ideas shelf → "File into a song" → both pick-existing and create-new variants.
3. Capture: browser console error, network response body for the failing `POST /functions/v1/<name>`, and edge function logs immediately after (`supabase--edge_function_logs`).

This tells us the **exact function name + status code + server error string** and eliminates guessing.

### Step 2 — Categorize the failure

We expect the root cause to fall into one of these buckets. The plan branches accordingly:

| Bucket | Symptom | Fix |
|---|---|---|
| **B1. Auth / JWT** | 401 `unauthorized` from `commit-take` / `create-song` | Ensure `supabase.functions.invoke` is called while a session exists; confirm `resolveUser` in `_shared/auth.ts` accepts the token; verify `config.toml` doesn't require JWT verification we've disabled elsewhere. |
| **B2. Membership gate** | 403 `forbidden` from `commit-take` (`is_song_member` returns false) | The take was intake-created with a placeholder `song_id` the user is not a member of. Fix by (a) reparenting the take server-side to the target song, or (b) using `song_role` with owner-fallback like `promote-capture` does. |
| **B3. Free-plan gate** | 402 `song_limit_reached` from `create-song` when filing into a **new** song | Already surfaced by ReviewSheet as "Free plan limit reached → /upgrade". If seed-idea path throws the same code, add the same friendly handling in `SeedIdeaCard.handleFileIntoNew`. |
| **B4. Missing take row** | 404 `take_not_found` from `commit-take` | Race: `getPrimaryTakeIdForMemo` returned an id whose `takes` row hasn't been committed yet, or take was created but not inserted. Fix by making `intake-voice-memo` return the `take_id` directly (single source of truth) and passing it forward, instead of a follow-up lookup. |
| **B5. Storage upload** | Signed PUT to storage fails (413, 403, CORS) | Verify the returned signed URL headers, storage bucket RLS, and that `voice-memo-finalize` is only called after a successful PUT. |
| **B6. Edge boot / import error** | 500 with generic "Edge Function returned a non-2xx status code" and a Deno stack in logs | Fix the import (esm.sh drift, missing shared file, or a `deno.lock` mismatch) — the deploy-error playbook applies. |
| **B7. RLS on `canvas_cards` / `song_activity`** | 500 from `commit-take` with "new row violates row-level security" | Adjust the insert to run under `admin` (already the case) or add the missing INSERT policy. |

### Step 3 — Apply the targeted fix

Whichever bucket matches, ship the fix in the smallest possible patch:

- **Client** (`src/components/capture/ReviewSheet.tsx`, `SeedIdeaCard.tsx`): surface the *actual* server error code in the toast instead of the generic "edge function failure" string so future occurrences are self-diagnosing. Map known codes (`song_limit_reached`, `forbidden`, `take_not_found`) to specific user messages + recovery actions.
- **Edge** (`supabase/functions/commit-take/index.ts` or the failing one): fix the identified defect (reparent take, tolerate missing take, correct membership check, etc.). Keep responses in the existing `{ok, code, message}` envelope so `call()` in `src/integrations/cog/songs.ts` parses cleanly.
- Do NOT touch unrelated auth/payment/storage code — the earlier live-payments work stays intact.

### Step 4 — Verify

1. Re-run the Playwright repro from Step 1 — must succeed end-to-end and land in the target song's canvas.
2. Re-check `supabase--edge_function_logs` for the fixed function — no errors on the successful call.
3. Confirm the seed-idea variant works for both **existing song** and **new song** (free plan happy path + free-plan-limit path).
4. Sanity-check that ReviewSheet's happy path (`Add to canvas`) still commits blocks + navigates via the CommitRibbon.

### Step 5 — Guardrails to prevent recurrence

- Add a `console.error` in the `call()` helper (`src/integrations/cog/songs.ts`) and in `ReviewSheet.handleCommit` catch block that logs `{ fn, status, code, message }` so the next regression shows up as a searchable console line, not an opaque toast.
- Add a Deno test for the specific `commit-take` failure mode we hit (member gate / missing take) using `supabase--test_edge_functions`.

## Deliverables
1. Root-cause writeup (which bucket, which line).
2. Minimal patch to the responsible edge function and/or client call site.
3. Improved error surfacing so "edge function failure" is never shown as a bare string again.
4. Passing manual repro + one new Deno test covering the fix.

## Out of scope
- Live-payments key wiring (already done in prior turn — untouched).
- UI redesign of ReviewSheet / SeedIdeaCard beyond the toast copy.
- Any change to auth, RLS on unrelated tables, or storage bucket policies unless Step 2 identifies them as the cause.
