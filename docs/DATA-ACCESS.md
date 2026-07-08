# DATA-ACCESS — the frontend↔backend seam

> **Owner:** A3 (Data Access). **Scope:** everything between a React component and
> Supabase. **Prime directive:** no component ever calls `supabase.*` directly,
> and no raw error string ever reaches the UI. Every backend interaction goes
> through **one** typed, error-normalized, cache-aware layer.

This is the how-to. Read it before you add a data module, a query, a mutation, a
realtime subscription, or a voice-save surface. The lock suite that enforces
these rules is `src/test/data-access-critical-paths.test.tsx`.

---

## The layer at a glance

```
component / page
     │  imports a HOOK, never the client
     ▼
src/hooks/**                     ← React Query hooks (reads + writes + realtime)
  useAppQueries.ts   useMutations.ts   useMemoSave.ts   useRealtime.ts
     │  calls a SEAM FN, keyed by qk, errors = CogError
     ▼
src/integrations/cog/*.ts        ← the ONLY module that imports the client
     │  supabase.rpc / .from / .functions.invoke / .channel
     ▼
src/integrations/supabase/client.ts  ← the ONE client (env-guarded)
```

Supporting singletons:

- `src/integrations/cog/errors.ts` — the error contract (`CogError`, `toCogError`,
  `codeFromServer`, `call`, `withTimeout`, `isOffline`).
- `src/hooks/queryKeys.ts` — the `qk` key factory (the shared cache vocabulary).
- `src/lib/cache/invalidation.ts` (A4) — the mutation → keys policy table.
- `src/lib/voice/captureOutbox.ts` — the durable write path for every recorded take.

---

## 1. Add a seam fn (`src/integrations/cog/*.ts`)

The seam is the **only** place `supabase.*` may appear. A fn either returns typed
data or throws a `CogError`.

**RPC / `.from()` (direct PostgREST):** wrap the error in `toCogError`.

```ts
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export async function listWidgets(songId: string): Promise<Widget[]> {
  const { data, error } = await supabase.rpc("list_widgets", { _song_id: songId });
  if (error) throw toCogError(error);        // ← never `throw error`
  return (data ?? []) as Widget[];
}
```

**Edge function:** use `call<T>` — it unwraps the `{ ok, data }` envelope AND
reads the code off a non-2xx body, so `QUOTA_*` / `INVITE_*` / `FORBIDDEN`
survive end-to-end.

```ts
import { call } from "./errors";
export const createWidget = (input: NewWidget) =>
  call<{ widget: Widget }>("widget-create", input);
```

Rules:

- **Never** `throw error;` or `throw new Error(str)` from a seam fn — a raw
  PostgREST/RPC/edge string must never escape. Always `toCogError` (direct) or
  `call` (edge).
- **Reads fail soft.** A read that logically has "no result" returns `null` / `[]`,
  it does not throw (see `getSong` → `null` for a non-member).
- **Domain types** are declared by A2 and imported from their home (eventually
  the `@/types` barrel) — the seam never forks a type.
- Auth (`cog/auth.ts`) keeps its own `AuthError`/`AuthErrorCode` taxonomy on
  purpose — it runs before a session exists. Do not fold it into `CogError`.

### The error codes the UI switches on

`CogError.code` is a stable string. **UI switches on `.code`, never on
`.message`.** The product gates two *moments* (not toasts) on quota codes:

| code | meaning / UI reaction |
|---|---|
| `QUOTA_EXCEEDED_SONGS` | → `/upgrade?source=song_gate` (upgrade screen) |
| `QUOTA_EXCEEDED_STORAGE` | → storage screen / "Add storage"; the take is **retained** |
| `FORBIDDEN` | write blocked by RLS/role |
| `UNAUTHENTICATED` | sign-in required |
| `OFFLINE` | client-only; keep cached data, show a calm offline signal |
| `INVITE_EXPIRED` / `INVITE_NOT_FOUND` / `INVITE_ALREADY_USED` / `INVITE_EXHAUSTED` | which invite screen renders |
| `SONG_NOT_FOUND` / `SONG_DELETED` / `NOT_A_MEMBER` | song-room guards |

---

## 2. Add a query hook (a read)

Reads live in `src/hooks/useAppQueries.ts`. Key off `qk`, fetch through a seam
fn, wrap in `withTimeout` so a dead network can't hang the screen.

```ts
export function useWidgets(songId: string) {
  return useQuery({
    queryKey: qk.widgets(songId),                 // ← from the factory, never inline
    queryFn: () => withTimeout(listWidgets(songId)),
    enabled: !!songId,
    staleTime: 30_000,                            // size to volatility
  });
}
```

- `error` is a `CogError` — the component switches on `.code`, never renders
  `.message`.
- The client default (`@/lib/queryClient`: `retry: 1`) is the single gentle
  re-attempt. Don't add aggressive retry on an `OFFLINE` error — the cached
  `.data` is still valid; fail soft.
- `withTimeout` wraps **reads only**. Never wrap a write (a timed-out write may
  still land server-side).

---

## 3. The `qk` factory + invalidation convention

**All keys come from `src/hooks/queryKeys.ts`.** Never hand-roll an inline
`queryKey: ["song-detail", id]` — a divergent shape silently misses invalidation.

Shape law: `[domain, id?, sub?]`. Invalidating a **less-specific** key
invalidates every more-specific key under it (TanStack prefix match):

- `qk.song(id)` invalidates the whole song room.
- `qk.activity(id)` also clears `qk.activityDigest(id)`.
- `qk.admin.root()` clears the admin console.

To add a new domain, add a builder to `queryKeys.ts` and use it everywhere (read
key + every invalidate).

**Writes never invalidate ad hoc.** The mutation → keys mapping lives once in
`src/lib/cache/invalidation.ts` (A4's `invalidationMap` / `invalidateFor`). A
mutation hook calls the matching entry in `onSettled`/`onSuccess`:

```ts
onSettled: () => invalidateFor(qc, "commitTake", songId),
```

---

## 4. Add a mutation hook (a write)

Writes live in `src/hooks/useMutations.ts`. Each runs a seam fn, invalidates the
right keys via the policy table, and — for UX-critical writes — updates the cache
optimistically.

```ts
export function useCreateWidget(songId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewWidget) => createWidget(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.widgets(songId) });
      const prev = qc.getQueryData(qk.widgets(songId));
      qc.setQueryData(qk.widgets(songId), (old) => [optimistic(input), ...(old ?? [])]);
      return { prev };                                  // rollback snapshot
    },
    onError: (_e, _input, ctx) => qc.setQueryData(qk.widgets(songId), ctx?.prev),
    onSettled: () => invalidateFor(qc, "createWidget", songId),
  });
}
```

- A **quota** error is a MOMENT, not a toast: `onError` inspects
  `err.code === "QUOTA_EXCEEDED_SONGS"` and navigates to `/upgrade` (see
  `useCreateSong`).
- An **optimistic drag/move** deliberately does NOT invalidate on success (the
  optimistic position IS the truth — invalidating would reload the board). Only a
  FAILED move rolls back + resyncs (see `useMoveCard`).

---

## 5. The outbox rule — every recorded take

**A recorded take is NEVER uploaded directly.** It routes through the Capture
Outbox (`src/lib/voice/captureOutbox.ts`) via the one hook `useMemoSave` (which
wraps `saveMemoDurable` → `enqueueCaptureUpload`). Do **not** call
`uploadVoiceMemo` / `saveMemoDurable` / `enqueueCaptureUpload` directly from a
component.

Why it's non-negotiable:

1. The blob is written to the IndexedDB audio cache **before** any network call —
   durable across reload/crash/offline.
2. A content-free job is persisted to `localStorage` (`cog-capture-outbox`) so the
   queue survives a full reload.
3. Upload carries a **stable idempotency key** — a retry never double-creates.
4. On failure the take + blob are **retained**, not discarded, and auto-retried on
   `online`, on a 20s heartbeat, and at next app load.

Two failure modes RETAIN the take (never data-loss copy):

- **Offline / dropped upload** → `status:"queued"`/`"failed"`, retried; the sync
  pill shows it pending.
- **`QUOTA_EXCEEDED_STORAGE`** → stays `queued`, **does not burn an attempt**, and
  the outbox emits `failed { willRetry: true, reason: "quota_storage" }` so the
  surface can show "Saved · will sync" + an "Add storage" prompt. It syncs itself
  once storage is added.

There is exactly **one** upload core (`cog/memos.uploadVoiceMemo`); every pipeline
(voiceApi shim, brainstorm, in-song intake) routes through the outbox to it.

---

## 6. The IDs-only realtime rule

Realtime **invalidates a cached query; it never streams content.** A channel
carries a table + event kind (IDs only). The fresh content is re-read by whatever
`useAppQueries` hook owns the invalidated key.

Use the hooks in `src/hooks/useRealtime.ts`:

```ts
useRealtimeSong(songId);   // activity/card/take/capture change → invalidate qk.* + songDetail
useRealtimeMemos(songId);  // memo/transcript change → invalidate qk.memos
useRealtimeBilling(userId);// subscription/storage change → invalidate qk.billing/storage
```

When you wrap a new channel: the handler takes **no payload** (or destructures
only the event kind to route). Reading `payload.new`/`payload.old` is banned — it
smuggles content down the realtime path and splits the source of truth. The
primitive returns a `removeChannel` unsubscribe; return it straight from the
`useEffect` and key the effect on the id so a switch cycles the channel (no leak,
no duplicate).

---

## 7. The lock suite

`src/test/data-access-critical-paths.test.tsx` (24 tests) is the regression fence
over the whole layer. It mocks the Supabase client (and the outbox's IO) and
exercises the REAL seam fns / hooks across 11 critical paths: auth session load,
`listMySongs`, `getSong` counts, optimistic quick-capture, outbox idempotency +
over-quota retain, idempotent commit-take, every `acceptInvite` error code,
`getMyBillingStatus`, realtime → invalidation, and the normalized FORBIDDEN/QUOTA
error contract through both the edge (`call`) and direct (`toCogError`) paths.

Add a critical path? Add a case here. Companion suites: `cog-errors.test.ts`
(error taxonomy), `use-mutations.test.tsx` (write hooks), `use-realtime.test.tsx`
(channel lifecycle), `src/lib/voice/captureOutbox.test.ts` (full outbox contract).

---

## Checklist for a new data module

- [ ] Seam fn in `cog/*` — the only place `supabase.*` appears; `toCogError`/`call`.
- [ ] Domain type imported (A2), never forked.
- [ ] Key builder in `qk` (`src/hooks/queryKeys.ts`).
- [ ] Read hook in `useAppQueries.ts` (keyed by `qk`, `withTimeout`, fail soft).
- [ ] Write hook in `useMutations.ts` (invalidate via `invalidationMap`; quota → moment).
- [ ] Voice save? Route through `useMemoSave` / the outbox — never a direct upload.
- [ ] Realtime? `useRealtime.ts` — invalidate keys, IDs only, no payload read.
- [ ] Critical path? Add a case to `data-access-critical-paths.test.tsx`.
