# LANE A — THE IDEA'S JOURNEY: capture → song canvas, so simple an 8-year-old can do it

You are a worldclass UI/UX engineer (Fantasy.co × Apple craft) working the Colors of Glory
songwriting app (React 18 + Vite + TS strict, Tailwind, COG design tokens `var(--cog-*)`,
mobile-first at 390px iPhone / iOS Safari). You own THIS lane; a second session is working
the INVITE lane simultaneously in this same tree — respect the fences below.

## THE MISSION (the user's words)
"The app doesn't really work. The UI is buggy, lots of visual bugs, the UX flow is not
smooth at all. This is NOT a full re-haul — streamline it so it is extremely simple. The
capture feature is good. After that it needs to be so simple that an 8-year-old kid can
figure out how to put the captured song idea into a song canvas." Voice-memo stacking
NEEDS to work — it is the heart of "what's on the card."

## THE LAWS
1. **The 8-year-old test** — every step of capture→canvas must be guessable by a child:
   one obvious thing to tap, the tap does what it looks like, and you always see the result.
2. **TEMU momentum** — after every completed act, the next most-likely act is standing
   there, one tap away. Never a dead stop.
3. **ONE bold thing** (Fantasy.co) — at any moment there is one dominant piece of
   information. Gold = the single primary act on screen.
4. **Don't touch capture's core** — the recorder + guided shape rail are good. Streamline
   around them.
5. **Streamline, don't rebuild** — fix, trim, clarify. No new frameworks, no new deps,
   no re-architecture. The whiteboard/map code stays in the repo but has no UI entry.
6. **Evidence before claims** — `npx tsc --noEmit` clean + `npx vite build` green +
   focused `npx vitest run` green before ANY "done". Fix root causes, never symptoms.

## THE PRE-DIAGNOSED BUG LEDGER (from a 5-agent deep trace — verify each line, then fix)
**The root disease: the ID-SPACE SEAM.** Server-hydrated voice cards have id
`db-voice-<uuid>`; the stacking pipeline expects raw memo uuids; and the board hydrator
never reads `parent_memo_id` at all. Stacking works same-device-same-session, then
evaporates on reload / other devices. Fix in this order:

- **P0-1** `src/lib/canvas/canvasBoardSource.ts:234` — hydrateBoard's voice_memos select
  omits `parent_memo_id` (and the card built at :262-290 never sets `parentMemoId`).
  EVERY hydrated layer renders as a loose top-level sibling card — this IS the "cluttered
  and confusing" feed — and stacks are invisible cross-device. FIX: select
  `parent_memo_id` (+ `layer_gain, layer_muted, layer_offset_ms` if present) and set
  `parentMemoId` on the built card in the BASE's card-id space (`db-voice-${parent}`),
  so `layerCountByBase` and the stack-sheet filter match.
- **P0-2** `src/components/canvas/SongCanvasExperience.tsx:1152` (+ entries :1390, :1657,
  :1665) — the base card id is NEVER normalized to a memo id. Layering over any hydrated
  card sends `parent_memo_id: "db-voice-<uuid>"`; the edge fn's parent lookup fails
  SILENTLY and persists the layer as a BASE. Same raw id kills the record-over guide
  (`playReferenceGuide` at :1210 can't resolve audio). FIX: normalize once at the choke
  point — `recordingParentIdRef.current = parentId ? (memoIdForCard(parentId) ?? parentId) : null`
  (helper: `src/lib/canvas/features/canvasAudio.ts:29-35`) and resolve before the guide.
- **P0-3** `src/hooks/useStackPlayer.ts:195` — `prepare()` uses raw card ids for
  audioCache/getSignedUrl; hydrated stacks are completely SILENT (per-id catch swallows
  it). FIX: resolve each id through `memoIdForCard` before lookup; keep the original id
  as the mixer key.
- **P0-4** `src/components/voice/MemoSheet.tsx:89` + `:108` — `listTakes(base.id)` and
  `r.parentMemoId === base.id` compare memo uuids against card ids; the server-truth heal
  never matches a hydrated base. FIX: `const baseMemoId = memoIdForCard(base.id) ?? base.id`.
- **P1-5** `MemoSheet.tsx:105-127` — the server overlay REPLACES the layer list, dropping
  a still-uploading optimistic layer (it vanishes mid-flow). FIX: union server children
  with passed layers whose ids aren't on the server yet.
- **P1-6** `src/integrations/cog/memos.ts:106-116` + `src/lib/voice/pendingUploads.ts:145-157`
  — the measured guide-alignment offset is never transmitted; `layer_offset_ms` is always
  0 server-side (the edge fn already reads+clamps it). FIX: thread the offset through
  PendingUpload → flush → uploadVoiceMemo → createUploadUrl body.
- **P1-7** `SongCanvasExperience.tsx:578` — an interruption-salvaged take is pure React
  state until Save; iOS killing the backgrounded tab loses the take AND its parent. FIX:
  persist durably in handleAutoFinalize (enqueuePendingUpload or failedCaptureStore with
  the current `recordingParentIdRef`), then let review rename the already-safe take.
- **P1-8** `SongCanvasExperience.tsx:1371` — the promised reconnect retry doesn't exist
  (mount-only sweep; copy at :1292 lies). FIX: `window 'online'` listener re-running the
  pending sweep.
- **P1-9** `SongCanvasExperience.tsx:1399` — a layer whose base leaves the board becomes
  permanently invisible (renders nowhere). FIX: when a card's `parentMemoId` matches no
  present card, promote it to a base (mirror the DB trigger's flatten rule).
- **P2-10** `useStackPlayer.ts:410` — the fallback-rung seek omits `serverOffsets` (the
  fresh-start path at :336 includes it) → drift after seek. And `:255` — the fallback
  transport wires only to `playIds[0]`; if the base failed, progress is dead and
  isPlaying sticks. FIX: reuse the headOffset sum; wire transport to the first LOADED element.
- **P2-11** `src/components/canvas/feed/FeedCard.tsx:181` — nothing at REST says a memo
  has layers ("Layers · N" is selected-only). FIX: quiet resting chip (e.g. "≡ 2 layers"
  near the duration) when `interactions.layerCount > 0`.
- **P2-12** `SongCanvasExperience.tsx:1288-1293` — the held-back-layer throw
  (`parent-take-still-uploading`) shows the misleading "when you're back online" copy.
  FIX: distinguish the error; say the truth ("finishing the base take first").
- **FILE to the admin/backend lane (do NOT implement backend yourself):** the edge fn
  ignores `idempotency_key` (`supabase/functions/voice-memo-upload-url/index.ts:45` —
  retries can duplicate rows); demo-room pending rows retry forever (cap attempts).
- **SUSPICIOUS (check while there):** flush landing mid-listen hard-stops stack playback
  (idsKey change → releaseAll); `getSignedPlaybackUrl` can return `""` → `fetch("")`
  caches an HTML blob under the memo id; `webAudioOk` never resets after one bad decode;
  the stack player isn't wired to the audio session (never-bleed rests on modal ordering).

## THE WORK, PHASED (re-firable loop — each pass: fix → verify → commit+push → report)
- **Phase 1 — make stacking TRUE** (P0-1..4 in one pass; they are one seam). Add a
  regression test pinning the seam: a hydrated base (`db-voice-x`) + its hydrated layer
  group correctly; recording over a hydrated base produces a raw-uuid parent.
- **Phase 2 — make stacking SURVIVE** (P1-5..9). Stress in tests where cheap.
- **Phase 3 — the 8-year-old journey.** Walk capture→canvas as a child: record at the
  open mic → shape → pick a song → the feed shows YOUR idea → tap = hear it → "Layer
  over this" → sing → the stack shows both → "→ Final" → "Hear it". At every step ask:
  is the next tap obvious? does something confirm what happened? Fix every snag; kill
  every visual bug found on the way (alignment, overflow, z-index, contrast, animation
  jank at 390px).
- **Phase 4 — card clarity.** Each feed card must answer in <1s: WHO is it from (author
  name+dot legible, not 10.5px gray at the bottom — consider the crown row), WHAT is it
  (type + content + duration + layers at rest). One bold per card. Dimmed "already in
  the song" cards may collapse to one-line rows.

## LANE FENCES (a second session runs simultaneously)
YOURS: `src/components/canvas/**`, `src/components/voice/**`, `src/components/capture/**`,
`src/lib/canvas/**`, `src/lib/voice/**`, `src/lib/audio/**`, `src/hooks/useStackPlayer.ts`,
`src/integrations/cog/memos.ts` (client seam only).
NOT YOURS: `src/components/invite/**`, `src/lib/invite/**`, invite/share/onboarding pages,
`supabase/**` (file backend issues, don't edit). In the shared host file
`SongCanvasExperience.tsx`, touch ONLY canvas/stack/capture regions — never the
ShareSheet/presence/invite region (the other lane owns it this cycle).

## SHIP PROTOCOL (Concurrent-Tree — mandatory every pass)
`git branch --show-current` must be `main` before commit AND push · stage ONLY your files
by path (never `git add -A`; never touch `.agents/`, `tmp/`, others' `docs/prompts/*`) ·
commit with a real message ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` ·
`git -c core.autocrlf=false pull --rebase origin main` · push · if the tree holds changes
you didn't make, stash-protect them, never absorb. End every pass by naming the next
highest-leverage slice. Do not stop until the 8-year-old walkthrough passes end to end.
