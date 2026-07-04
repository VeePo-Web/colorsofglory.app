# Capture → Song: "Put a captured idea into a song" — Deep Audit + Plan

**Date:** 2026-07-06 · **Reporter:** Library lane · **Status:** the flow exists but is
reported "doesn't work" · **Spans lanes:** Capture (`src/components/capture/*`,
`src/lib/voice/seedIdeaApi.ts`) · Voice/backend (`src/lib/voice/voiceApi.ts` + edge fns) ·
Canvas (`src/lib/canvas/canvasLoader.ts`) · Library (surfaces the shelf).

The job: a songwriter hums an idea anywhere (global capture) → it waits on the **Your Ideas**
shelf → they **file it into a song** → it becomes part of that song and they can see/work with
it. This is the single most important connective tissue in the whole app ("a captured idea must
never be lost, and it becomes part of a song"). It must be flawless.

---

## 1. How it is wired today (verified in code, not assumed)

1. **Capture** writes a `SeedIdeaRecord` — blob → `audioCache`, index row → `localStorage["cog-seed-ideas"]`, `status:"local-only"` (`seedIdeaApi.ts:49 saveSeedIdea`).
2. **Library** renders `<SeedIdeasShelf songs={fileableSongs}/>` (`SongCatalogPage`), which lists unclaimed ideas (`seedIdeaApi.ts:81 listSeedIdeas`) as `SeedIdeaCard`s.
3. **File action** (`SeedIdeaCard.tsx:137 handlePick` / `:153 handleStartNewSong`) → `claimSeedIdea` (`seedIdeaApi.ts:92`).
4. **claimSeedIdea** loads the cached blob and calls `uploadVoiceMemo({ songId, blob, …, sectionLabel:"Raw idea" })` (`voiceApi.ts:149`), then marks the seed `claimed` and deletes the cache.
5. **uploadVoiceMemo** = `voice-memo-upload-url` edge fn → PUT to storage → confirm; creates a `voice_memos` row.
6. **Canvas** (the song's home since the library now opens `/songs/:id/canvas`) loads `voice_memos` and renders each as a **"Raw idea" voice card** (`canvasLoader.ts:38 loadVoiceMemosForCanvas`, card id `db-voice-<id>`).

**Conclusion:** the path is fully connected in code. "Doesn't work" is therefore a *runtime /
UX / backend* failure, not a missing wire. The plan below is built to find which, then make the
whole experience world-class.

---

## 2. Ranked failure hypotheses (what "doesn't work" most likely is) + how to verify

| # | Hypothesis | Why plausible | Verify (fast) |
|---|---|---|---|
| **H1** | **Backend upload fails** — `voice-memo-upload-url` edge fn, storage bucket RLS, or `env` mismatch. `claimSeedIdea` throws → card shows the error toast, seed stays. | Every other symptom (seed reappears, "still safe here" toast) matches a thrown upload. | File an idea, watch Network: does `voice-memo-upload-url` 200? Does the storage PUT 200? Does a `voice_memos` row appear? |
| **H2** | **Filed, but invisible in the song** — memo lands as a canvas card at a placed coordinate that's off the initial viewport / behind other cards, so the songwriter sees "nothing happened". | Canvas places cards by index (`placeCard(i)`); a new card can land off-screen; there's no "your idea landed here" confirmation on the canvas. | File an idea into a song, open it, pan the canvas — is the "Raw idea" card there but off-screen? |
| **H3** | **Seed shelf never appears** — global capture writes the seed elsewhere, or the shelf is hidden, so there's nothing to file. | Shelf renders `null` when `listSeedIdeas()` is empty (`SeedIdeasShelf.tsx:35`). | After a global capture, is `localStorage["cog-seed-ideas"]` populated? Does "Your Ideas" show in the library? |
| **H4** | **No post-file feedback / no way to follow the idea** — even on success the card just vanishes; the songwriter isn't taken to (or offered) the song, so it *feels* broken. | `handlePick` closes the sheet and refreshes; no toast, no "Open song" affordance (unlike `handleStartNewSong` which toasts). | File into an existing song — is there any confirmation or path to the song? |
| **H5** | **Duplicate / double-tap** or **offline** edge — `claimSeedIdea` has no idempotency key passed to `uploadVoiceMemo`; a double file could double-upload; offline file throws. | `uploadVoiceMemo` supports `idempotencyKey` but `claimSeedIdea` doesn't pass one. | Double-tap a song in the picker; toggle offline and file. |

**Run H1–H3 first** — they determine whether this is a backend fix (H1/H3) or a UX build
(H2/H4). Do not build UX polish on top of a broken upload.

---

## 3. World-class benchmark (how the best products do "capture → file into a project")

- **Apple Voice Memos → "Move to Folder"**: the memo animates out of the inbox and you can tap the destination to jump straight to it. **Confirmation + a path to the destination** are always present.
- **Apple Notes / Reminders inbox**: an item filed into a list gives an immediate, undoable move; the item is visibly *gone from here, present there*.
- **Otter.ai**: a captured snippet always shows where it went and lets you open it.
- **Notion / Obsidian "inbox → note"**: the captured item lands at a **known, predictable location** (top of the note), never scattered; the user's mental model is "it's at the top."
- **The through-line:** (1) capture never blocks, (2) filing is one calm tap, (3) there is **always confirmation + a one-tap path to where it landed**, (4) it lands **predictably** (not off-screen), (5) it's **reversible**.

Our current flow nails (1) and (2), is weak on (3), and — if H2 is true — fails (4).

---

## 4. Target experience (the best-possible feature)

1. **Capture** (unchanged): one tap, idea is safe on the shelf instantly.
2. **Shelf** (library): "Your Ideas" with play, rename, discard — already good. Add a subtle count and, at scale, a "See all" review sheet (`SeedReviewSheet` already exists — wire it).
3. **File**: the picker (good) files via a **hardened `claimSeedIdea`** (idempotency key, offline queue, retain-on-failure — already retains).
4. **On success — the missing piece:** a calm toast **"Filed into {song} ›"** whose tap **opens that song's canvas with the new idea focused** (pan/zoom the `db-voice-<id>` card to center + a one-time gold "here's your idea" ring). This is the Apple "Move to → jump there" moment and almost certainly what makes today feel broken.
5. **Predictable landing:** new filed memos should land in a **consistent, visible spot** on the canvas (e.g. top of the Ideas tree / nearest empty slot in view), never off-screen. Canvas lane owns `placeCard`; this plan asks for a "place newest in view" rule + optional `focusCardId` deep-link param.
6. **Reversible:** an **Undo** on the file toast (move the memo back to a seed) for a short window.

---

## 5. Staged implementation plan (lane-owned, verifiable)

**Stage 0 — Diagnose (blocking).** Run H1–H3. Output: is the upload succeeding? (Backend lane if not.) This decides everything.

**Stage 1 — Make success legible (Capture lane, frontend).**
- `claimSeedIdea` returns the new `memoId` (from `uploadVoiceMemo`, which already returns the id).
- `SeedIdeaCard.handlePick` → on success, `toast.success("Filed into {title}", { action: { label:"Open", onClick: () => navigate('/songs/'+songId+'/canvas?focus='+memoId) }})`, mirroring `handleStartNewSong`'s toast.
- Add the same for the batch/first-song path. Verify: file → toast → tap → land on the song.

**Stage 2 — Focus the idea on arrival (Canvas lane).**
- Canvas reads `?focus=<memoId>`; after `loadVoiceMemosForCanvas`, center + ring the `db-voice-<memoId>` card once.
- New filed cards use a "place in current view" rule so they're never off-screen. Verify: file → open → the idea is centered and highlighted.

**Stage 3 — Harden the pipe (Capture + Voice lanes).**
- Pass an `idempotencyKey` (seedId) through `claimSeedIdea → uploadVoiceMemo` to kill double-file dupes.
- Offline: if upload fails, keep `status:"local-only"` (already does) and surface "Saved — will file when you're back online"; optionally auto-retry via the existing pending-upload queue.

**Stage 4 — Scale + review (Library + Capture).**
- Wire `SeedReviewSheet` for a full-screen "review all ideas" when the shelf has many.
- Batch-file: select several ideas → file all into one song (mirrors the library's batch-add-to-album).

**Verification gate for each stage:** `tsc` clean, relevant tests green, and the real path walked
on a device: capture → file → confirmation → the idea is visibly in the song.

---

## 6. Ownership summary

- **Backend/Lovable:** confirm `voice-memo-upload-url` + storage RLS + env for seed uploads (Stage 0 / H1).
- **Capture lane:** Stages 1, 3, 4 (SeedIdeaCard toast+path, idempotency, offline, review/batch).
- **Canvas lane:** Stage 2 (`?focus=` deep-link, place-in-view, arrival ring).
- **Library lane (me):** the shelf placement (done), and wiring the "Open song" navigation target to the canvas (already routes there). Happy to own Stage 1's SeedIdeaCard toast if Capture lane wants a hand, since it's the seam the library surfaces.

**The one line that most likely fixes the felt "it doesn't work":** on a successful file, show
"Filed into {song} ›" and let the tap open the song with the idea focused — so the songwriter
*sees* their idea become part of the song, every time.
