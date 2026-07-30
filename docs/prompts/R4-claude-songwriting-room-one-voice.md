# R4 — Songwriting Room: One Voice, One Path, Zero Wait
## Cross-surface audio arbitration, playback latency, and route intent

**Owner:** Claude (frontend). Backend half shipped this pass (§4).
**Goal of the room (unchanged):** capture an idea and hear it back inside the song — instantly.
**Rule:** if a thing can be one thing, it is one thing.

R1 = architecture. R2 = feature-by-feature. R3 = last mile (resilience/a11y/ergonomics).
R4 is about the sense the room is actually judged on: **sound**, and the wait before it.

---

## 1. Audio ownership is fragmented across seven independent engines — P0

`rg "new Audio\(" src` returns **13 construction sites across 7 owners**:

| Owner | File |
|---|---|
| Canvas feature audio (Listen Path, Compare) | `src/lib/canvas/features/canvasAudio.ts:81` |
| Take mini-player | `src/components/voice/TakeMiniPlayer.tsx:174` |
| Practice player | `src/hooks/usePracticePlayer.ts:281,861` |
| Layered stack player | `src/hooks/useStackPlayer.ts:222,243` |
| Voice memo list item | `src/components/voice/VoiceMemoListItem.tsx:109` |
| Voice memos page | `src/pages/VoiceMemosPage.tsx:144` |
| Brainstorm panel | `src/components/brainstorm/BrainstormMemosPanel.tsx:44` |
| Voice review sheet / reference guide / onboarding | 3 more |

`rg "audioBus|stopAllAudio|activeAudio" src` → **0 hits**. There is no arbiter.

Each engine is individually well-behaved — `canvasAudio` is an excellent documented singleton with a
two-element gapless pool. The defect is *between* them. `MiniPracticePlayer` mounts outside `<Routes>`
in `App.tsx` and deliberately survives navigation, so:

> Start a practice take → navigate into the room → tap a card. **Two takes play at once.**

That is the worst possible failure for a songwriting app. It is also invisible in every test because
each engine passes its own tests.

**Fix — one audio bus, ~40 lines, deletes code net:**

```ts
// src/lib/audio/audioBus.ts
type Owner = "canvas" | "mini" | "practice" | "stack" | "list" | "review";
let current: { owner: Owner; stop: () => void } | null = null;

export function claimAudio(owner: Owner, stop: () => void) {
  if (current && current.owner !== owner) current.stop();
  current = { owner, stop };
}
export function releaseAudio(owner: Owner) {
  if (current?.owner === owner) current = null;
}
export function stopAllAudio() { current?.stop(); current = null; }
```

Every engine calls `claimAudio` before its first `play()` and `releaseAudio` on stop/unmount.
No engine is rewritten; each gains two lines. `stopAllAudio()` also fires on route change and on
`visibilitychange → hidden`. **Invariant: at most one sound in the app, ever.**

Follow-ups in the same pass:
- **Media Session API** is unused. Set `navigator.mediaSession.metadata` (song title + section) and
  wire `play`/`pause`/`nexttrack` handlers to the bus, so lock-screen controls drive the room.
- **Audio interruptions** (a phone call, another app) are unhandled. Listen for `pause` fired without
  a user gesture and reflect it in UI state instead of showing a stuck playing indicator.

## 2. First play of every card pays a cold edge invocation — P0

`canvasAudio.resolveUrl` (`:40-62`) is local-first (nice — device blobs play instantly), but for
anything the device hasn't seen it calls `getPlaybackUrl` → `voice-memo-signed-url`, **one edge
function invocation per memo, paid at the exact instant a thumb hits play**, with a 300s TTL that
guarantees re-paying it inside a normal writing session.

For a collaborator opening a shared room — the acquisition moment — *every* card is cold.

**Fixed on the backend this pass** (see §4): batch-sign the whole song on room entry, seed
`urlCache`, and the tap becomes local. Also raise TTL handling: refresh at 12 min, not on expiry.

## 3. Nothing is prefetched on intent — P1

Routes are properly lazy (`src/routes/songRoutes.tsx`), but there is no prefetch anywhere.
Tapping a song card on the catalog starts the room chunk download *after* the tap.

**Fix (three cheap wins, in order of payoff):**
1. `onPointerDown`/`onTouchStart` on a song card → `import("@/pages/SongWorkspacePage")` and
   `queryClient.prefetchQuery(qk.songDetail(id))`. Touch-down to tap-up is 80-150ms of free time.
2. Same handler → `getSongRoomBootstrap(id)` (§4) so the room's data is already in cache on mount.
3. Idle-time prefetch of the room chunk via `requestIdleCallback` once the catalog is settled.

## 4. Shipped this pass by Lovable

**`song-playback-urls` edge function** — signs every non-archived memo *and* take in a song in one
membership-gated call, de-duplicating shared storage paths. 15-minute TTL (was 5).

```ts
import { getSongPlaybackUrls } from "@/integrations/cog/room";
const { urls } = await getSongPlaybackUrls(songId); // { [memoId|takeId]: signedUrl }
```

Wiring:
1. On room mount (same tick as the bootstrap call), fetch once.
2. Seed `canvasAudio`'s `urlCache` — add an exported `primePlaybackUrls(map)` to
   `src/lib/canvas/features/canvasAudio.ts` that writes entries with the returned TTL. Device blobs
   still win; this only removes the cold path.
3. Refresh on a 12-minute timer while the room is open, and on window refocus after >12 min away.
4. Keep `voice-memo-signed-url` for one-off/late-arriving memos — it becomes the exception, not the rule.

**`song_room_bootstrap` RPC** (from R3 §6) — still unwired. One read replaces six.
`getSongRoomBootstrap` in `@/integrations/cog/room`.

Together these take a cold room entry from **6 data round trips + N audio round trips** to **2 round
trips, total**, with the audio pre-signed before the user's thumb ever moves.

## 5. Simplify

- Seven audio engines is six too many *conceptually*, even if the bus makes them safe.
  Once the bus lands, `VoiceMemoListItem`, `VoiceMemosPage`, and `BrainstormMemosPanel` are three
  copies of "play one memo from a list" — collapse them onto `canvasAudio`'s pool and delete the
  other three `new Audio()` sites outright.
- `TakeMiniPlayer` (663 lines) and `MiniPracticePlayer` are two mini-players. The room should have
  one persistent sound surface. Pick `TakeMiniPlayer`, retire the other.

## 6. Build order

1. §1 audio bus (+ route/visibility stop) — this is a correctness bug, ship it first.
2. §4 wiring: bootstrap + `primePlaybackUrls`.
3. §3 prefetch-on-intent.
4. §1 Media Session + interruption handling.
5. §5 engine collapse and mini-player retirement.

## 7. Definition of done

- Practice take playing → enter room → tap a card: the practice take stops. Never two sounds.
- Lock screen shows the song title and the pause button works.
- Collaborator opens a shared room on 3G: first card plays in under 200ms (no signing round trip).
- Network panel on room entry: two requests before first meaningful paint.
- Tapping a song card on the catalog: room chunk already in memory by the time the tap lands.
