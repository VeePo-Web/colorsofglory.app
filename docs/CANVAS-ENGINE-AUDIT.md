# COG Song Whiteboard Canvas — Engine Audit (Tier-3 Mechanics)

**Date:** 2026-07-08 · **Auditor:** Claude Fable 5 (9-agent read-only audit fleet)
**Audited tree:** `main` @ `15819c2` (post "Canvas rescue" `0d9ae3e` + "Canvas collab wiring + glory spectrum" `15819c2`)
**Rule honored:** READ-ONLY — no code was changed. This document is the only artifact.

> The audit brief's "where it actually is" claims described the pre-rescue codebase and were
> treated as STALE; every mechanic below was re-verified against the current code.

## ADDENDUM — 2026-07-09: the build pass that answered this audit

A follow-up commit implemented the audit's top findings. Now FIXED:

- **The create spine** — `createCanvasCard` (integrations/cog/canvas.ts) + a
  local-first insert/swap in the host (`persistNewCard`): canvas-born lyric/
  chord/scripture/note/section cards AND merged sections become `canvas_cards`
  rows and reach every device (graceful local fallback when RLS/network says no).
- **Line suggestions TRAVEL** — carrier rows over `canvas_cards`
  (`section_kind: "line_suggestion"`, JSON payload, routed off the board by
  `hydrateBoard` into the review lane; resolved rows are deleted). UUID ids;
  the fake 200ms latency + the offline refusal are gone (local-first outbox).
- **The two silent reverts** — `handleAcceptLine` now writes through
  (`updateCanvasCard` + dirty window), and dismissed server cards get local
  TOMBSTONES consulted by the hydrate, so decisions stay decided (cross-device
  decision truth still needs the `review_state` column — the Lovable ask stands).
- **Listen Path** — the step follows the playing card when earlier stops are
  removed; the NEXT stop's signed URL preloads while the current one sounds;
  Clear has Undo; steps announce via aria-live.
- **One person, one color** — presence/self/roster/cards all hash the user id
  through the warm canvas palette; the legacy avatar palette (incl. corporate
  blue) no longer leaks onto canvas surfaces. ONE sage (glorySpectrum)
  everywhere Final speaks; merge credits the real merger (no more "Alice & Bob").
- **Arrangement save is atomic** — re-slots through `finalColumnSlot(i)` in one
  patch → one `canvas_bulk_move`, killing y-ties and pair-swap races.
- **ScripturePicker is wired** — "Find the verse" inside the scripture card
  editor: structured book/chapter/verse, real passage fetch, 3 translations;
  the reference rides in the card title + meta.
- **A11y/perf** — focus traps in the review + suggestion sheets, Compare's
  nested-button fixed + its reduced-motion classes applied, honest roster
  aria-label, merge non-destruction caption, realtime re-hydrates debounced.

**Second addendum (same day, audio-truth pass):** also now DONE —
- **Gapless advance** — canvasAudio is a two-element pool: the next take is
  fully primed (src + buffering) on a spare element while the current one
  sounds; advancing swaps elements instead of re-fetching.
- **Compare's A|B rhythm** — `switchPlay` flips takes at the SAME playhead
  (`startAt`), both sides preload on open, and the sheet gains one big
  thumb-reachable A|B toggle (rose/violet, instant switch).
- **Merge preview** — the bar shows the combined section LIVE before commit,
  with a "Swap order" flip; merges are no longer blind.
- **Tactile drag** — a quiet haptic bump on lift and a firmer one on a
  cross-tree drop (the drop that changes the song's shape).

Still open (backend-shaped or next passes): `song_suggestions` proper table +
`review_state`/`status` columns (cross-device decision truth), entry-based
listen queue (repeats/reorder), section-occupancy presence,
loudness-match/blind-mode compare, the god-component carve.

## Scoreboard

| # | Mechanic | Verdict | Gap-to-worldclass |
|---|---|---|---|
| 1 | Owner Review Queue (F11) | PARTIAL | 5/10 |
| 2 | Line-Level Suggestions (F19) | PARTIAL | 3.5/10 |
| 3 | Compare Mode A vs B (F21) | PARTIAL | 4.5/10 |
| 4 | Listen Path (F20) | REAL | 6.5/10 |
| 5 | Merge / Splice (F22) | PARTIAL | 4.5/10 |
| 6 | Final Arrangement Drag (F23) | REAL | 6/10 |
| 7 | Multi-cursor Presence | PARTIAL | 4.5/10 |
| 8 | Story / Scripture / Meaning Zone | PARTIAL | 4.5/10 |

---

# SONG WHITEBOARD CANVAS — ENGINE-WIDE SYNTHESIS
*Eight mechanics audited against the current code (post-0d9ae3e "Canvas rescue" + 15819c2 "Canvas collab wiring"). Every load-bearing claim below was re-verified against the working tree at `C:/Users/Business/cog-canvas-rescue-wt`. Read-only; no code was changed.*

---

## 1. THE HEADLINE TRUTH

The old baseline — "60% demo, 40% real" — is dead, and it flipped in the right direction: **on a single device, roughly 70% of the engine is now real**, and the fakes that remain are honest ones. Audio genuinely plays (one shared element, resume-not-restart, sequenced Listen Path with board-follow); the Owner Review Queue is a built, owner-gated, one-at-a-time ritual; roster presence is live Supabase Realtime; drags, edits, and promotions on server-backed cards write through real RPCs and survive reload for co-writers; the render layer (CanvasStage/CanvasCard/typed faces) and the feature hooks (`src/lib/canvas/features/`) are clean, uuid-clean, reduced-motion-aware craft. But cut the numbers the other way and the engine is **only ~40% real as a *collaboration* tool**: line suggestions never leave the proposer's phone (`lineSuggestions.ts` is a localStorage outbox with no destination), merged sections, canvas-born cards, scripture anchors, compare decisions, review decisions, listen paths, and the arrangement of any non-server card all live in `localStorage` — private truths that evaporate on a second device and never existed for the co-writer. Average gap-to-worldclass across the eight mechanics: **4.9/10** (Listen Path 6.5 and Final Arrangement 6 at the top; Line Suggestions 3.5 at the bottom). The felt summary: *everything you do on this canvas is real for you, and about half of it is a beautiful secret the app keeps from the people you're writing with.*

---

## 2. THE THREE SYSTEMIC ROOT CAUSES

### (a) The god component — `SongCanvasExperience.tsx`, now 2,351 lines and still growing

Verified: 2,351 lines today (the brief said 2,226 — it accreted ~125 lines *during* this audit cycle's parallel work). The D1 carve genuinely removed the render layer, but the host still owns: identity resolution, the hydrate/merge/prune cycle, `syncServer` + dirty-grace, all eight mechanics' action handlers, sheet orchestration, review-queue derivation, saved-moments, presence wiring, and focus/fly-to. How this taxes each mechanic — the seams, not a refactor:

- **Correct patterns exist but aren't reachable as units, so siblings drift.** `handleSaveCardEdit` (~1394) does the full write-through (`markDirty` + `syncServer(updateCanvasCard)`); `handleAcceptLine` (~1622), two hundred lines away in the same file, patches state only — producing the accept-then-revert Blocker. Same file, same need, two behaviors. A carved "board write" module would have made the wrong version impossible to write.
- **Per-render closure churn.** `getCardInteractions` (host:1064) is deliberately unmemoized, handing fresh closures to every memoized `CanvasCard` on *every* host render — and the host re-renders on every listen-path step, presence sync, and realtime tick. Fine at 15 cards; a re-render storm at 50+ or once a playhead ticks.
- **Everything re-renders through one component.** A presence `sync` event, a metronome toggle, and a suggestion send all pass through the same 2,351-line render. The mechanics can't be tested, profiled, or reasoned about in isolation; every parallel agent editing the canvas edits this one file (the git-churn hazard in project memory is partly this file's shape).
- **The seam is already named in the code.** `canvasBoardSource.ts:17–27` explicitly describes the `useCanvasStore` extraction that would take `initialBoard`/`writeBoard`/`hydrateBoard` out of the host. The next carves, in value order: the board store + hydrate merge; the write layer (`syncServer` + patch semantics); review-queue derivation; identity/color resolution. Each is currently a region of the host with clean boundaries — describe-and-carve work, not surgery.

### (b) The persistence split — server-truth for some cards, localStorage for everything they *mean*

Verified: the complete server write surface is four `syncServer` call sites — `bulkMoveCards` (host:497), tree-change/promote (host:543), `moveServerCard` (host:690), and `updateCanvasCard` on edit (host:1394). There is **no create path**: `integrations/cog/canvas.ts` contains no insert of any kind (verified by grep — only list/update/delete/RPCs), and `linkCards`/`groupCards` (canvas.ts:107, 118) exist with **zero call sites**. Everything not covered by those four writes persists via `writeBoard` → `localStorage cog:canvas-cards-<songId>` (canvasBoardSource.ts:131–137) or `cog:canvas-features-<songId>`.

The exact map of what remains device-local, and which mechanic it strands:

| Device-local artifact | Where | Mechanic stranded |
|---|---|---|
| Canvas-born cards (addCard/addPart, all types incl. scripture) | host:706–794, no insert fn | Scripture/Meaning (Blocker), Merge (parents), Review queue (add-part items) |
| Merged sections + `mergedFrom` provenance | `useMergeSplice` → `applyMerge` (host:425) | Merge/Splice (Blocker) |
| Compare decisions (`status`, `isDimmedReference`, `dimReason`) | `patchCards` syncs positions only (host:477–498) | Compare Mode (Blocker) |
| Review decisions (`reviewed`, dismissals) | host:1549–1567, no `review_state` write; hydration hardcodes `reviewState:"none"` | Owner Review Queue (2 Blockers: resurrection + revert) |
| Line suggestions (`ls-${Date.now()}` ids) | `lineSuggestions.ts`; id minted host:2282 | Line Suggestions (Blocker) |
| Listen paths | featureMeta localStorage | Listen Path (its one failed law) |
| Final membership/order of voice memos + local cards | `movesInPlace` true but `onTreeChange` no-ops for non-`db-card-*` ids | Final Arrangement (Blocker) |

The single missing primitive is small: **a client-side `createCanvasCard` insert plus two writable columns (`status`/`dim_reason`, `review_state`)**. The `commit-take` edge function already proves the row shape; `CanvasReviewState` already exists in `canvasTypes.ts:99` waiting for hydration to stop hardcoding it. One insert function and two columns convert five mechanics from private theater to room-truth, because the client seams (`canvasBoardSource`, `syncServer`, `patchCards`) were explicitly built as swap points.

### (c) The missing collaboration spine — proposals can't travel, presence has no "where"

Verified: zero hits for `song_suggestions` or `canvas_listen_paths` in `supabase/migrations/`; `get_song_detail` literally selects `0 AS pending_suggestion_count` (migration 20260608053232); no `broadcast`/cursor code anywhere in the canvas tree — `CanvasStage.onCursorMove` is piped through `CanvasViewport` into `useGesture`'s real 100ms-throttled, correctly canvas-space-normalized stream (useGesture.ts:246–258)… and the host passes nothing into it. A documented, throttled, mathematically-ready seam connected to nothing.

What this gates, mechanic by mechanic: **Line Suggestions** (fully — a suggestion has no destination table, so the sheet's "The owner will review your idea" is currently a sealed envelope); **Owner Review Queue** (half — the queue receives voice memos and capture cards, but never suggestions or add-part cards, and its decisions have no server home); **Merge and Final Arrangement as Law-4 citizens** (a contributor's merge/reorder can't *propose* because there's nothing to propose *into* — today it's masked by the persistence gap, and the moment merge syncs, this becomes a live proposal-not-change violation); **Compare** (a chosen direction can't be announced); **Presence's second half** (roster "who" is real and well-built on its own ephemeral channel; the "where" — cursors on desktop, section-occupancy on mobile — is absent, so two co-writers in the room at once still work blind to each other until a card lands).

---

## 3. CROSS-CUTTING FEEL + QUALITY

**Calm + faith-first: the engine's genuine crown, with three cracks.** No red badges anywhere; pending review is `REVIEW_TONE` amber ("attention, never alarm," glorySpectrum.ts:75); "Not now" is a first-class choice; empty states celebrate; toasts are quiet and mostly honest. The cracks: (1) **the color-identity fracture** — one person can wear three hues: presence hashes the *name* (host:1128), cards hash the *user id* (host:317/713) — except voice cards, which hash the name again (host:889) — and the roster falls back to a legacy palette (`inviteContext.ts:86`) containing corporate blue `#4D8FD2` and `#D4AE5C`, essentially `--cog-gold-light`, quietly breaking "gold = the system speaking." (2) **Two greens both named sage**: `glorySpectrum` sage is `#6E9B63` (verified, line 44) while `creatorColors` sage is `#53AB8B` (line 21), and the raw `#53AB8B` is hardcoded into the arrangement badge (CanvasCard.tsx:370), the Final zone label (ZoneLabel.tsx:63), and the live-ping dot (host:1780) — a second color language for "final/success" living outside the spectrum file that exists to prevent exactly this. (3) **Raw `#E05440` red** in LineSuggestionSheet's char counter and offline copy (lines 243, 249) where the calm system's own amber was available; plus the fabricated credit string `"Alice & Bob"` (useMergeSplice.ts:51–54) earning a real ledger entry — a small injustice in the one app whose theology is credits.

**Accessibility: strong bones, recurring last-mile gaps.** Targets are 44–56px, sheets have Escape, reduced-motion is honored in most surfaces, aria-live counters exist in the review flow. The repeated misses: no focus trap/initial focus in OwnerReviewQueueSheet and LineSuggestionSheet; CompareModeSheet's reduced-motion CSS targets classNames that are never applied (dead rules) and nests a `<button>` inside a `<button>` (VoiceOver hazard); Listen Path steps and arrangement moves are silent to screen readers; the presence stack's aria-label can claim "In this room: 3 people" for people who are not present. None is deep work; together they decide whether a blind worship leader can arrange her own song.

**Performance: three compounding churn sources, all verified.** (1) `CanvasViewport`'s `ctxValue` is a fresh object literal every render (lines 164–181) whose `zoom/panX/panY` fields update at gesture end — new context identity → every consumer re-renders after each pan/pinch. (2) `getCardInteractions` per-render closures defeat `CanvasCard`'s memo (host:1064). (3) `hydrateVoiceMemos` — a full board fetch + merge — runs on *every* realtime event of four types (host:673–681): one co-writer action triggers a whole-board rebuild in everyone else's host. Survivable at today's card counts; these three together are the re-render storm waiting for the 50-card song and the future playhead tick.

**Orphaned/legacy debt.** `canvasLoader.ts` has zero importers (verified) and speaks a dead dialect (`IdeaCard`/`CanvasNode`/sessionStorage positions) — delete-candidate. `LineSuggestionSheet`'s `"review"` mode is unreachable and half-wired. CompareModeSheet has an unreachable `isSaving && !isDone` branch. The 200ms fake "Sending…" latency plus a `navigator.onLine` block that refuses a purely local save (LineSuggestionSheet:69–79) is theater that actively harms offline users. `MergeActionBar` hardcodes z 540 against a contract doc saying 695. The `isDemoRoom` seam (host:223) is load-bearing and fine, but it silently widens `canReview` — worth a comment before someone "fixes" it.

---

## 4. THE PRIORITIZED ROADMAP

### QUICK WINS (hours each; no backend; users feel every one)
1. **Stop the two silent reverts** — `handleAcceptLine` writes through like `handleSaveCardEdit`; dismissed/kept server cards get a local tombstone consulted during hydrate `additions`. *Decisions stay decided — the review queue becomes trustworthy.* Unblocks: Review Queue.
2. **One person, one color** — a single userId-keyed identity function across presence/cards/roster; retire the legacy palette on canvas surfaces; fold `#53AB8B` uses into a glorySpectrum tone. *"Sarah is always plum"; gold returns to meaning the system.* Unblocks: Presence, Merge, faith-first law everywhere.
3. **Track Listen Path step by id, not index** (~3h) — kills the skip-a-card corruption when the queue is edited mid-play.
4. **Wire `mediaSessionBridge` into Listen Path** (~2h; already proven by Practice Mode) — lock-screen transport, background survival.
5. **The a11y sweep** — focus traps + initial focus (two sheets), un-nest Compare's buttons + apply its dead reduced-motion classNames, aria-live for path steps and arrangement moves, honest presence labels ("3 people write here" vs "2 here now").
6. **Honesty pass** — kill the fake 200ms latency + offline block; `crypto.randomUUID()` for suggestion ids; real names in merge credits (no "Alice & Bob"); fly-to the merged card (`setFocusCardId`, one line); Undo on Clear path.
7. **Scripture feels like scripture** — Playfair reference line, sage wash, `parseReference`-derived titles, `aria-hidden` the ✦.

### HIGH-IMPACT (a day or two each; frontend-only; the feel layer)
1. **Gapless audio — double-buffer the next take in `canvasAudio`** (~1 day). Preload the next signed URL on track start, swap elements on end. Every user *hears* this on every play; it upgrades Listen Path, Compare, and the "Play final" demo moment in one stroke.
2. **Atomic arrangement save** — on `save()`, re-slot through `finalColumnSlot(i)` (kills y-tie no-ops past 10 cards), one serialized keyed `bulkMoveCards`, toast only on ack. Fixes the scramble race and the offline lie together.
3. **Merge preview sheet** — combined result live in Playfair, A↔B order swap, pre-commit safety caption ("Both originals stay on the board"). Blind commits become confident ones.
4. **Compare shared playhead + preload + one big A|B toggle** — the comparison finally compares the same bar; the tap-tap-tap rhythm of real take-picking.
5. **Wire ScripturePicker into AddPartSheet's scripture path** — the mechanic's most finished asset is one import away; type "psa 46," watch the passage breathe in.
6. **Entry-based listen queue** — repeats (Verse–Chorus–Verse–*Chorus*) and reorder; the most common song shape becomes pathable.

### FOUNDATIONAL (Lovable contract + ~a frontend week; the truth layer)
1. **`createCanvasCard` insert + `status`/`review_state` writable columns** — converts canvas-born cards, merges, scripture, compare decisions, and review decisions into room-truth. The client seams already exist; `commit-take` proves the row shape. Unblocks five of eight mechanics at once.
2. **`song_suggestions` table + outbox flush** (C2 pattern already in-repo) — the proposal spine. Keep rows on decide (status flip, never delete) and Law 1's "declining preserves" comes free. Unblocks Line Suggestions fully, Review Queue's other half, and the already-stubbed catalog count.
3. **Section-occupancy presence** (2–3 days, *no new infrastructure* — re-`track()` `{zone, sectionLabel}` on the existing ephemeral channel; name-chips on zone tabs, never floating pointers on touch) — "Sarah is in the Chorus right now."
4. **A listen-path/arrangement record server-side** (`canvas_listen_paths` per docs/COG-WHITEBOARD-PLAN.md:357) — the set list the band rehearses from is the set list everyone sees.
5. **Proposal routing for contributor merges/reorders** through the Review Queue — required *before* merge sync ships to contributors, or Law 4 breaks the moment persistence is fixed.

---

## 5. THE SINGLE MOST VALUABLE NEXT MOVE

**Land the persistence spine: a `createCanvasCard` write path plus `status`/`review_state` columns, routed through the existing `syncServer` seams — with the `song_suggestions` table filed to Lovable in the same contract.**

Eight audits, run independently, converged on the same sentence: *the interaction is real; the truth is local.* Five of the eight top-ranked recommendations are this one move wearing different clothes. It is also the cheapest deep fix in the codebase's history of deep fixes, because the rescue passes already built every seam it needs — `canvasBoardSource` names its own replacement, `patchCards` already splits patch types, `CanvasReviewState` already exists, `linkCards`/`groupCards` are already shipped and waiting for their first call site, and the review sheet that will receive travelling proposals is already beautiful.

And it is the move that serves the people most directly. Gapless audio (the runner-up, and the best pure-frontend day this team could spend) makes the room *sound* wonderful for one person. The persistence spine is different in kind: it makes the room *true* for two. Sarah's suggested line actually knocks on Parker's door; Parker's "yes" reaches every phone; the merged chorus two friends found at midnight is still there — for both of them — in the morning. That is the covenant this canvas was named for, and every quick win above lands twice as hard once the thing being polished is real.

**SINGLE HIGHEST-LEVERAGE MOVE: make the room's truth shared — `createCanvasCard` + decision columns + `song_suggestions`, through the seams already waiting for them.**

---

# PER-MECHANIC AUDITS

---

# 1 · Owner Review Queue (F11) — PARTIAL (5/10)

> The Owner Review Queue is a genuinely lovely one-at-a-time review ritual whose decisions don't stick: dismissed server cards quietly resurrect, accepted lines revert on the next hydrate, and half the queue (line suggestions, add-part cards) never leaves the proposer's phone.

# F11 — OWNER REVIEW QUEUE AUDIT

## 1. VERDICT

**PARTIAL — 5/10.** The stale brief said NOT-BUILT; that is now false. `OwnerReviewQueueSheet.tsx` exists, is wired, owner-gated on the server role, and its one-at-a-time flow (grouped summary → review → "All caught up" celebration) is one of the most spec-faithful surfaces on the canvas. But the mechanic's spine — *a collaborator's proposal reaches the owner, and the owner's decision persists* — is only half real. Co-writer **voice memos** and **capture-committed cards** genuinely cross devices into the queue, and Approve genuinely writes `canvas_promote_to_final`. Everything else is device-local theater: line suggestions live in the proposer's localStorage, "Not this one" on a server card resurrects on the next realtime tick, "Keep in Ideas" evaporates on the owner's other device, and accepting a line suggestion is silently undone by the next hydrate. The score is a 5 because the *felt* review experience is near-worldclass while the *truth* underneath it breaks Laws 1, 4, and 5 in ways an owner will actually notice.

## 2. HOW IT ACTUALLY BEHAVES

**Real and working:**
- **The sheet** — `src/components/canvas/OwnerReviewQueueSheet.tsx` (343 lines). Three phases: `summary` (Playfair "Needs your review", counts grouped by plain-language kind, gold "Start review" / quiet "Not now"), `review` (one card at a time, contributor chip with initials + accent, "1 of N" `aria-live` counter, auto-advance after every action, `acted` ref guards double-taps, queue frozen on open via `useState(() => items)` so acting never re-indexes what's ahead), `done` (sage-green check, "All caught up… The room is clear."). Escape closes; safe-area padded; reduced-motion honored.
- **Owner gating** — `SongCanvasExperience.tsx:225` `canReview = isDemoRoom || caps.isOwner`, where `caps` comes from E1's `useCapabilities` (`src/lib/permissions/useCapabilities.ts`, server `myRole` RPC — a URL can't grant it). The "Review N" pill (line ~1728), the amber card dots (`renderCardAdornment`, ~1598, `REVIEW_TONE` amber from `glorySpectrum.ts:75` — "attention, never alarm"), and the sheet itself all require it. Contributors and viewers never see any of it. Correct.
- **Queue derivation** — `pendingReview` memo (~1523): ideas-tree cards, not stack layers, not dimmed, not `reviewed`, not `approved`, attributed and `!isMine(c)` (with a calm default-to-mine while identity resolves, so an unresolved card never pings the queue). Unified with `suggestionReviewItems` (~1571) into `reviewQueueItems`.
- **Cross-device reality (the real half)** — co-writer **voice memos** hydrate from `voice_memos` and **capture-mode cards** from `canvas_cards` (`canvasBoardSource.ts:hydrateBoard`), carry `createdBy`, resolve names through the roster, and genuinely appear in the owner's queue on another device. Approve on a `db-card-*` row calls `arrangement.moveToFinal` → `movesInPlace` → `onTreeChange` → `syncServer(promoteCardToFinal(sid))` (`SongCanvasExperience.tsx:538–547`) — a real RPC other collaborators will see, with a 7s Undo.
- **The recap handoff** — `WhatChangedRecapSheet`'s gold CTA reads "Review changes" only when a queue exists, else an honest "Got it" (`onReview` optional, line 78). Lovely honesty.

**Local-only / theater:**
- **Line suggestions** — `src/lib/canvas/lineSuggestions.ts` is an explicit localStorage outbox (`cog:line-suggestions-<songId>`), with `id: \`ls-${Date.now()}\`` minted at `SongCanvasExperience.tsx:2282`. A contributor's suggestion on THEIR phone never reaches the owner's phone. Confirmed backend gap: `supabase/migrations/20260608053232_….sql:79` literally selects `0 AS pending_suggestion_count` in `get_song_detail`; no `song_suggestions` table exists anywhere in `supabase/migrations`.
- **Add-part idea cards** — `addCard`/`addPart` (~726/~761) mint `card-${crypto.randomUUID()}` locally and there is **no create path** in `src/integrations/cog/canvas.ts` (only list/update/delete/RPCs; creation happens solely via the capture `commit-take` edge fn). So a contributor's canvas-born lyric card also never reaches the owner.
- **Review decisions** — `reviewed: true` (`handleKeepInIdeas`, ~1549) and dismissal (`handleDismissReview`, ~1554) are `setCards` + `writeBoard` localStorage only. No server column, no RPC. `CanvasReviewState` exists in `canvasTypes.ts:99` but hydration hardcodes `reviewState: "none"` on every row.

## 3. STRESS-TEST FINDINGS

- **[Blocker] "Not this one" resurrects server cards.** `handleDismissReview` filters the card out of local state; the next hydrate (which runs on EVERY realtime room event, `hydrateVoiceMemos` ~595) finds the server row unconsumed and re-appends it via `additions` (~656–666). Felt: the owner declines a memo, the toast fades, and seconds-to-minutes later the amber dot and "Review 3" pill quietly come back. A calm sanctuary that un-decides your decisions teaches you not to trust it.
- **[Blocker] Accepting a line suggestion silently reverts.** `handleAcceptLine` (~1622) patches `body` locally but never calls `markDirty`/`syncServer(updateCanvasCard)` the way `handleSaveCardEdit` (~1391) does. For a `db-card-*` lyric the very next hydrate restores `server.body` (merge line 620). Felt: the owner accepts a co-writer's better line, sees "Line updated," and the old line creeps back — the one outcome worse than no review queue.
- **[Blocker, backend-shaped] The proposal pipe doesn't exist for suggestions or canvas-born cards.** Suggestions are device-local (`lineSuggestions.ts`); add-part cards have no server insert. In real two-phone use, the owner's queue only ever contains voice memos and capture-committed cards. Law 4's core promise — "a collaborator's action reaches the owner" — holds for exactly one and a half content types.
- **[Major] Decisions don't survive the owner's second device.** `reviewed` lives in `cog:canvas-cards-<songId>` localStorage. Phone-reviewed at night, laptop next morning: the whole queue is back. (Same-device reload IS safe — `initialBoard` reads the saved board and the hydrate merge spreads `...c`, preserving `reviewed`.)
- **[Major] "Keep original" destroys the proposal.** `handleKeepLine` → `removeLineSuggestion` — permanent, no undo, no archive, no provenance. The spec's own words: *declining preserves*. Law 1 violation on the one artifact that represents a co-writer's care.
- **[Major] Date.now() suggestion ids.** `ls-${Date.now()}` (line 2282) — direct Law 5 violation; two suggestions in the same millisecond (or two devices) collide, and the id scheme can't survive a server migration.
- **[Minor] Self-suggestions land in your own queue with dishonest copy.** `suggestionReviewItems` has no `isMine` filter, so an owner suggesting a line on their own lyric is later told "1 idea your co-writers added." Small false claim in a copy system that's otherwise scrupulously honest.
- **[Minor] No proposer-side status.** After "Suggestion sent," the contributor has zero trace their proposal exists — no "waiting on Parker" chip, nothing to reassure them it wasn't lost (it was, unless the owner shares their device).
- **[Minor] No focus management.** The sheet sets `aria-modal` but never moves focus in, doesn't trap Tab, doesn't restore focus on close. A keyboard/SR user Tab-walks the canvas behind the dialog. Buttons themselves are good (56/48/44px min-heights, real labels).
- **[Minor] "See it on the canvas" loses your place.** `onSee` closes the sheet and flies to the card; reopening restarts at the summary, index 0. Context-in-frame is the worldclass ask; today context costs your progress.
- **[Minor] Suggestion accents hash the display NAME.** `getCreatorColor(s.contributor)` (~1579) while the rest of the canvas deliberately hashes the stable user id (host comment at ~322) — the same person can wear two colors between their cards and their suggestions.
- **[Minor] Global animation-kill selector.** The sheet's inline `<style>` disables animation on ALL `[role="dialog"]`/`[role="presentation"]` elements under reduced-motion — page-wide side effect from a component style block. Harmless today, a trap tomorrow.
- **[Minor] Acting on a deleted dependency claims success.** If the target card of a suggestion vanished, `handleAcceptLine` maps over nothing yet still fires "Line updated." A quiet false claim.
- **[Edge, verified fine]** Empty queue → pill hidden (no dead entry point); mid-review parent shrinkage → frozen snapshot handles it; double-tap → `acted` guard; 0-item done-phase unreachable except by completing; demo room intentionally reviewable by all.

## 4. GAP vs VISION (the Six Laws)

1. **Non-destructive — BROKEN at the edges.** Dismiss has a 7s undo (good), but declined line suggestions are hard-deleted, and dismissal of server cards doesn't stick anyway.
2. **Calm — EXCELLENT.** No red anywhere: gold "Review N" pill, amber dots, "Pending" in muted gray, "Not now" as a first-class choice, celebration close. This law is the surface's crown.
3. **Faith-first sanctuary — STRONG.** Playfair headline, cream sheet, contributor accents always paired with names + initials, gold reserved for the owner's system actions. One wobble: name-hashed suggestion colors.
4. **Proposal-not-change — HALF.** The owner-decides ceremony is beautifully built, but proposals mostly can't travel, so the ceremony often reviews an empty or local-only set.
5. **Persist + survive reload — THE BIG BREAK.** `reviewed`/dismissed are localStorage-as-truth; `ls-${Date.now()}` ids; accepted lines revert. Same-device reload passes; second-device and second-collaborator fail.
6. **Structure beats freedom — STRONG.** Bottom sheet idiom, single-tap actions, no drag required anywhere in review, reduced-motion safe. Missing: focus trap.

## 5. GAP vs WORLDCLASS BAR

- **Context-in-frame** — PARTIAL. Contributor, section eyebrow, and body/diff are in-frame; "See it on the canvas" exists but exits the flow. No thumbnail/mini-map peek, no audio audition for voice-memo items (the queue asks you to judge a memo you cannot play from the frame — the single biggest in-frame gap).
- **Single-gesture + auto-advance** — YES. Genuinely done, with a double-tap guard. This is the sheet's best worldclass credential.
- **One-by-one default AND explicit batch** — HALF. One-by-one is the default and only mode; no "Approve all" / "Keep all" exists anywhere (grep confirms).
- **Every decision reversible** — PARTIAL. Approve and Dismiss have undo toasts; Keep-in-Ideas has none (benign); Accept/Keep line have none (harmful).
- **No red badge** — YES, fully honored.
- **Empty state a celebration** — YES for completing ("All caught up," green check, "Back to the song"); N/A for arriving-empty since the pill hides.
- **Approved items visibly LAND** — NO. Approval happens behind the sheet; the owner gets a toast but never *sees* the card arrive in the Final tree. The reward moment of the whole ritual is invisible.
- **Prioritized/grouped, not flat FIFO** — PARTIAL. Summary groups counts by kind; the walk itself is flat (suggestions first, then board order), not grouped by section or person.

## 6. UPGRADE RECOMMENDATIONS (ranked)

1. **[Deep] Make proposals and decisions server-truth.** A `song_suggestions` table (id uuid, song_id, card_id, original/proposed, author, status: pending/accepted/kept, decided_by/at) + a review-decision write (reuse `canvas_cards.review_state` — the `CanvasReviewState` type at `canvasTypes.ts:99` is already waiting). The frontend seam is clean: `lineSuggestions.ts` is a deliberate swap point, and `get_song_detail`'s `0 AS pending_suggestion_count` becomes a real count feeding the catalog. This is a Lovable ask + a day of frontend rewiring. *Felt benefit: the entire reason this surface exists starts being true — Sarah's line reaches Parker.* Until it lands, a device-local dismissal-tombstone set consulted during hydrate `additions` would stop resurrection (hours, not days).
2. **[High impact] Stop the two silent reverts.** (a) `handleAcceptLine` must `markDirty(cardId)` + `syncServer(updateCanvasCard(sid, { body }))` exactly like `handleSaveCardEdit`; (b) dismissed/kept server cards must be excluded from hydrate re-append until a server decision exists. *Felt: decisions stay decided — trust.* Half a day.
3. **[High impact] Let voice memos play inside the frame.** A queue item for a memo should carry the mini waveform + a play button routed through the existing shared audio element (`canvasAudio.ts`), one-at-a-time. *Felt: the owner can actually judge the idea they're approving without leaving the ritual.* ~1 day.
4. **[Quick win] Approved items visibly land.** On "Back to the song" (done phase), if anything was approved, pan the viewport to the Final tree and give each landed card one 400ms gold settle pulse (`--cog-ease-reveal`, skipped under reduced motion). *Felt: the harvest moment — you watch the song grow because you said yes.* Hours.
5. **[Quick win] Explicit batch on the summary.** Under "Start review," a quiet secondary "Approve all N" (and per-kind "Keep all in Ideas"), with a single aggregate undo toast. Keep one-by-one the default. *Felt: a worship leader returning to 14 pendings isn't sentenced to 14 taps.* Hours.
6. **[Quick win] "Keep original" preserves the suggestion.** Mark it `kept` instead of deleting; show it dimmed on the lyric card's history ("Sarah suggested a line — you kept the original"), with undo. *Felt: a co-writer's offering is never thrown away, which is the whole theology of this app.* Hours once status exists; a local `status` field works today.
7. **[Quick win] Focus discipline.** Move focus to the sheet heading on open, trap Tab, restore focus to the "Review N" pill on close. *Felt: keyboard and screen-reader owners get the same calm room.* Hours.
8. **[Quick win] Copy + identity honesty.** Filter self-authored suggestions out of "your co-writers added" (or reword to "waiting on you"); hash suggestion accents from user id, not name; replace `ls-${Date.now()}` with `crypto.randomUUID()` today regardless of backend timing. Minutes each.
9. **[Quick win] "See it" keeps your place.** Remember the frozen queue + index in host state so reopening resumes at "3 of 5" (a "Resume review" pill variant). *Felt: curiosity is free; you never pay for looking.* Hours.
10. **[Feel] Card-to-card transition.** A 200ms fade/6px-rise on the review card as the queue advances (`--cog-ease-reveal`, reduced-motion: instant). Currently the swap is a hard cut — the one un-gentle beat in an otherwise gentle ritual. Minutes.
11. **[Feel] Group the walk.** Order queue items by section (chorus proposals together), with a tiny section eyebrow transition between groups. *Felt: the owner thinks in song parts, not upload order.* Hours.
12. **[Feel] Proposer-side whisper.** On the suggesting device, a muted "Waiting on {owner-first-name}" chip on the lyric card until decided. *Felt: your offering was received, not swallowed.* Hours (real once #1 lands).

SINGLE HIGHEST-LEVERAGE MOVE: **Give proposals and review decisions a server home (song_suggestions + canvas_cards.review_state) and route Accept-line/Keep/Dismiss through syncServer like promote already is** — every beautiful thing this sheet does is currently performed on top of localStorage, and this one move converts a superb rehearsal into the real collaboration covenant: Sarah's line reaches Parker's phone, Parker's "yes" reaches everyone's, and no decision ever quietly un-decides itself.

---

# 2 · Line-Level Suggestions (F19) — PARTIAL (3.5/10)

> Line suggestions are a beautifully crafted single-device loop — the sheet, queue, and before/after review are real and calm — but a suggestion can never reach an owner on another device, an accepted line silently reverts on server-backed cards, and both accept and reject destroy history.

# F19 — Line-Level Suggestions Audit

## 1. VERDICT

**PARTIAL — 3.5/10 to worldclass.** The stale brief's "200ms-setTimeout void" claim is now half-false: suggestions genuinely persist (localStorage), enter a real owner review queue with a lovely strikethrough before/after, and Accept genuinely replaces the card body. But the mechanic's soul — *a collaborator's proposal reaches the owner* — does not exist: suggestions live only on the suggester's device, the review button is owner-gated so the suggester can't even see their own pending item, Accept on a server-backed lyric card is reverted by the next hydrate, and both Accept and Keep-original permanently delete the losing text. The UI is worldclass-adjacent; the system beneath it is a one-device demo. Score reflects real craft on a hollow persistence core.

## 2. HOW IT ACTUALLY BEHAVES

**Entry (real, contributor+owner, viewers excluded).** Two paths open the sheet, both gated `!isViewer`: the card interaction selector `SongCanvasExperience.tsx:1080-1083` (`onSuggestLine` — which only lights the card's ⋯ affordance via `CanvasCard.tsx:151-157`) and the overflow action "Suggest a line" at `SongCanvasExperience.tsx:2211-2216`. Both snapshot `{ cardId, originalLine: card.body, sectionLabel }`.

**Create sheet (real UI, theatrical send).** `LineSuggestionSheet.tsx` is genuinely good: original line always shown (188-195), Playfair lyric input with autocorrect/spellcheck off and a load-bearing comment about deliberate non-words (216-220), 280-char counter, 52px gold CTA, Escape + reduced-motion honored. `handleSend` (69-79) blocks when `navigator.onLine` is false, then plays a **fake 200ms "Sending…"** before calling `onSend` and a "Suggestion sent / The owner will review your idea" pop. The actual save is a synchronous localStorage write — the latency is simulated and the offline guard blocks a save that would have succeeded offline.

**Persistence (real, device-local only).** Host `onSend` (2275-2292) calls `addLineSuggestion` (`src/lib/canvas/lineSuggestions.ts`) with **`id: \`ls-${Date.now()}\``** into key `cog:line-suggestions-{songId}`. It survives reload on the same device (state initializer at 368-370 reads it back). **No server table exists**: the only backend trace is a SQL view column hardcoded `0 AS pending_suggestion_count` (migration `20260608053232_…​.sql`; surfaced as `counts.pending_suggestions` in `src/integrations/cog/songs.ts:52,239`). A different device — including the actual owner — sees nothing, ever. Confirmed: no realtime channel, no RPC, no outbox flush.

**Review queue (real UI, wrong audience).** Suggestions map to queue items (1571-1590) and render inside `OwnerReviewQueueSheet.tsx:206-216` with a muted strikethrough Original, a gold "Suggested" label, contributor name + initials + creator color (195-198), and 56px [Keep original]/[Accept line] buttons (237-262) with a double-tap guard. But the "Review N" button renders only when `canReview` (`= isDemoRoom || caps.isOwner`, line 225). So in a real song the queue containing the suggestion exists **only on the suggester's device where the owner-gate hides it**. The only reachable end-to-end paths are: the demo room, or an owner suggesting to themselves.

**Accept (real locally, self-reverting on server cards, destructive).** `handleAcceptLine` (1622-1628) does `setCards(map body → proposedLine)`, deletes the suggestion, shows the calm "Line updated" saved-moment. It does **not** call `syncServer`/`updateCanvasCard`, does not `markDirty`, and does not touch `updatedAt/updatedBy` — contrast `handleSaveCardEdit` (1371-1402) which does all four. Consequence: `writeBoard` (586) persists the new body to localStorage, but the hydrate merge (`body: dirty ? c.body : server.body`, line 620) overwrites it with the server's original on the **next realtime nudge or reload** for any `db-card-*` lyric. The original line and the suggestion record are both gone (`removeLineSuggestion`); no version snapshot, no undo (contrast `handleDismissReview`'s 7-second Undo toast at 1553-1567).

**Keep original (destructive).** `handleKeepLine` (1631-1633) deletes the proposal outright. No "rejected" history, no notice to the suggester.

**Credits/activity: absent.** No emit on send/accept/reject; `src/integrations/cog/activity.ts` is read-only client-side. The suggester's name lives only in the transient queue card. The capability model already defines `"suggest"` and `"review"` (`src/lib/permissions/capabilities.ts:40-41`, Reviewer included) — the canvas ignores both, using `isOwner`/`isViewer` directly.

**Dead code.** `LineSuggestionSheet`'s `"review"` mode (owner accept inside the sheet, `contributorName`, `onAccept`) is unreachable: the host mounts it with `mode={isViewer ? "review" : "create"}` (2272) but both entry points are `!isViewer`-gated, and it never passes `proposedLine`/`onAccept` — if it ever rendered, it would show an empty review with an Accept button wired to nothing.

## 3. STRESS-TEST FINDINGS

- **[Blocker] The cross-device void.** Contributor taps Send on their phone; the sheet says "The owner will review your idea." The owner's device never receives anything — no table, no broadcast. *Felt: a co-writer offers their best line into what turns out to be a sealed envelope addressed to no one; trust in the whole proposal system dies the first time they ask "did you see my line?" and the owner says "what line?"*
- **[Blocker] Accepted lines quietly un-accept.** For any Capture-written (`db-card-*`) lyric card, Accept shows "Line updated," then the next realtime event or reload restores the old body (hydrate line 620, since accept never marks dirty or writes through). *Felt: the owner blesses Sarah's line, closes the app, reopens — the song took it back. Gaslighting by hydration.*
- **[Blocker] The suggester's world shows nothing after send.** No pending chip on the card, no queue access (owner-gated), no list of "your suggestions." *Felt: send → sheet closes → total silence, forever.*
- **[Major] Accept destroys the original; Keep destroys the proposal.** No version snapshot, no history, no undo — direct Law-1 violation and the spec's "reject keeps history / nothing lost" is unmet. *Felt: the one lyric app that promised nothing is ever lost loses a line every time a decision is made.*
- **[Major] No credit, no activity.** Accepting Sarah's line leaves `contributor`, `updatedBy`, credits ledger, and recap untouched. *Felt: her words enter the song and her name doesn't — the exact wound COG's credits creed exists to prevent.*
- **[Major] Reviewer role can't review.** `canReview = isOwner` (225) contradicts `capabilities.ts:41` where Reviewer holds `"review"`. *Felt: the person invited specifically to approve changes stares at a canvas with no review button.*
- **[Major] Offline users are blocked from a local-only save** (`LineSuggestionSheet.tsx:71`), while online users get fake latency theater. *Felt: on the subway, the app refuses the one write it could actually complete.*
- **[Major] Deleted/archived target card.** Accept maps over cards, matches nothing, still deletes the suggestion and shows "Line updated." *Felt: a confident success message about a change that happened nowhere.*
- **[Minor] Two suggestions on one line:** both queue independently; accepting both is silent last-write-wins, and the second item's "Original" shows a now-stale line. No conflict framing.
- **[Minor] `ls-${Date.now()}` id** — Law 5 bans Date.now() ids by name; merge already uses `crypto.randomUUID()`. Also used as a React key.
- **[Minor] No "See it on the canvas" for suggestions** — `OwnerReviewQueueSheet.tsx:222` gates it with `!current.suggestion` (correctly, since `current.id` is the suggestion id, not the card id — but the owner loses context-jumping exactly where context matters most).
- **[Minor] No on-canvas marker:** the amber review dot (1594-1619) covers only pending idea-cards, not lyric cards holding suggestions.
- **[Minor] A11y:** dialogs have no focus trap; review-phase queue has no initial focus target; the char counter and offline text use raw red `#E05440` (borderline vs. the calm law; amber `REVIEW_TONE` exists).

## 4. GAP vs VISION (Six Laws)

1. **Non-destructive — FAIL.** Accept overwrites with no snapshot/undo; Keep deletes the proposal; nothing is recoverable.
2. **Calm — PASS.** Amber dot not red, quiet saved-moment, step-through queue, "Not now" escape hatch. Genuinely lovely.
3. **Faith-first sanctuary — PASS.** Playfair lyric text, cream/gold, contributor color always paired with name + initials in the queue.
4. **Proposal-not-change — PASS in shape, FAIL in substance.** On one device the line truly doesn't change until accept. Across devices the proposal never arrives, so the law is satisfied vacuously.
5. **Persist + survive reload — FAIL.** localStorage-as-truth, Date.now() id, invisible to collaborators, and the accepted result reverts on server-backed cards.
6. **Structure beats freedom — PASS.** Bottom sheets, no drag required, big targets, reduced-motion honored, Escape everywhere.

## 5. GAP vs WORLDCLASS BAR

- Original preserved + visible after accept: **No** — destroyed both places.
- Inline before/after at the exact line: **Half** — beautiful in the queue sheet; nothing at the card itself, and granularity is the whole card body, not one line of it (a multi-line lyric card can only be replaced wholesale).
- Low-ceremony ✔/✗: **Half** — two clean buttons, but only inside a modal queue behind a summary screen; no at-card accept.
- Suggester attributed: **Yes** in the queue; **credited: No** (no ledger/activity/updatedBy).
- Optional rationale ("because…"): **No field.**
- Clutter control when many stack: **N/A by omission** — suggestions render nowhere on the canvas, the opposite failure.
- Mobile bottom-sheet, big Accept/Reject + Undo: **Buttons yes (52-56px), Undo no.**
- Non-adversarial copy: **Yes** — "Keep original" instead of "Reject," "Sarah's suggestion," no red. Best-in-class detail.

## 6. UPGRADE RECOMMENDATIONS

1. **[High impact] Give suggestions a shared home.** Lovable ask: `song_suggestions` table (id uuid, song_id, card_id, original_line, proposed_line, rationale, suggested_by, status `pending|accepted|kept`, decided_by, decided_at) + RLS + realtime. Client: turn `lineSuggestions.ts` into a durable-first **outbox** (the C2 pattern already in this codebase) that flushes to the table; subscribe in the existing `subscribeSongRoom` wiring. Keep rows on decide (status flip, never delete) — that alone satisfies "reject keeps history." *Felt: Sarah's line actually knocks on Parker's door; the sheet's promise becomes true.* Effort: 1-2 days + backend.
2. **[High impact] Make Accept real and reversible.** In `handleAcceptLine`: write through `syncServer(() => updateCanvasCard(sid, { body: s.proposedLine }), s.cardId)` exactly like `handleSaveCardEdit`, set `updatedAt/updatedBy`, and show a 7s **Undo** toast (pattern already at 1553-1567) that restores `originalLine`. Saved-moment copy: "Line updated — Sarah's words are in · Undo." *Felt: a blessing that sticks, with a graceful take-back.* Effort: half a day; kills the revert Blocker even before the table lands.
3. **[High impact] Credit the suggester.** On accept: stamp the suggester into the card's contribution trail (e.g. `meta`/credits seam) and emit activity so the recap says "Parker accepted Sarah's line in Chorus." Needs Lovable's activity write path. *Felt: her name lives where her words live.*
4. **[Quick win] Honest offline + no fake latency.** Delete the `navigator.onLine` block and the 200ms setTimeout (`LineSuggestionSheet.tsx:71-78`); save instantly; when offline, confirmation reads "Saved — will reach the owner when you're back online." *Felt: the app keeps its word in a dead zone.* ~1 hour.
5. **[Quick win] Show the suggestion where the line lives.** Extend `renderCardAdornment` (1598) to dot lyric cards with pending suggestions; on the selected card face, a small chip "1 line suggested · Sarah" that opens the queue at that item; wire `onSee` for suggestion items by passing `s.cardId` (fixing the `!current.suggestion` gate at `OwnerReviewQueueSheet.tsx:222`). *Felt: the owner meets the proposal in the song's context, not in an abstract inbox.* ~half a day.
6. **[Quick win] Suggester-side "Waiting for review" state.** Their device already holds the record — show a quiet chip on the card and a line in the recap sheet. *Felt: the envelope has a tracking number.* ~2 hours.
7. **[Quick win] `crypto.randomUUID()` instead of `ls-${Date.now()}`** (host 2282), matching merge's ids; makes the id idempotency-safe for the future outbox flush. ~15 minutes.
8. **[Quick win] Let Reviewers review.** `canReview = isDemoRoom || caps.can("review")` (or `isOwner || isReviewer`) at line 225 — the capability model already promises it. ~30 minutes.
9. **[Deep] True line granularity.** Card bodies are multi-line; in the create sheet, render the body split by lines, tap-to-target one (others dim), store `lineIndex`, and show a word-level diff in review. *Felt: "replace just this line" finally means one line, and the diff makes the owner's choice effortless.* 2-3 days.
10. **[Quick win — feel] Optional rationale field** ("Why this line? — optional, one sentence") below the textarea; render it in the queue as a warm-gray italic. Songwriting is persuasion between friends. ~2 hours.
11. **[Minor feel] Focus trap + initial focus** in both sheets; swap the raw `#E05440` counter/offline red for the existing amber `REVIEW_TONE`. Remove the dead `"review"` mode from `LineSuggestionSheet` or wire it as the at-card quick-review surface (option 5 gives it a purpose).
12. **[Minor] Guard the missing target:** if `s.cardId` isn't on the board, say "That line has left the board — suggestion kept" and retain the record instead of claiming "Line updated."

**SINGLE HIGHEST-LEVERAGE MOVE:** Land the `song_suggestions` table + outbox write-through (rec 1) — every broken promise here (the owner ever seeing it, history on reject, credits, the catalog's already-stubbed `pending_suggestion_count`, idempotent ids) is downstream of suggestions having no shared home; the UI to receive them is already built and waiting.

---

# 3 · Compare Mode A vs B (F21) — PARTIAL (4.5/10)

> Compare Mode's audition is real and lovingly built — one-at-a-time audio, calm undo, focus-trapped sheet — but the decision it produces lives only in this device's localStorage, the songwriter can't choose which take is "B", and none of the pro-listening bar (loudness match, preload, same-playhead, blind mode) exists yet.

# F21 — Compare Mode A vs B: Audit

## 1. VERDICT

**PARTIAL — 4.5/10.** The stale brief is wrong in the good direction: Compare Mode is wired and the audition is real. `useCompareMode` (src/lib/canvas/features/useCompareMode.ts) drives a focus-trapped bottom sheet (`CompareModeSheet.tsx`) that plays actual takes one-at-a-time through the shared canvas audio element, and choosing a direction dims-never-deletes the loser with a full-snapshot Undo. What keeps it at 4.5: the *decision* — the entire point of comparing — persists only to this device's localStorage (no server write, no activity emit, no collaborator visibility), the partner is auto-picked with no way to choose among 3+ variants (and can pair a voice take against a text note), and zero items of the pro-audition bar are present. A songwriter feels a real moment of choosing; the song itself never learns about it.

## 2. HOW IT ACTUALLY BEHAVES

**Real, verified:**
- **Entry:** `SongCanvasExperience.tsx:2218-2233` — the card overflow sheet offers "Compare A vs B" when `compare.canCompare(c)` (non-viewer, non-dimmed, non-layer, has a same-tree same-section-family partner), else the paved path "Write another take to compare" → `handleNewVariant` (`:1024-1044`) clones the slot with the same section and opens the editor. Family matching via `sectionFamily()` (`useCompareMode.ts:40-42`) strips trailing numbers so "Chorus 1"/"Chorus 2" pair; exact section match wins first (`findPartner:44-54`).
- **Audition is genuinely real:** `togglePlay` (`useCompareMode.ts:90-106`) → `playMemoOnCanvas` (`features/canvasAudio.ts`) — the ONE shared `HTMLAudioElement` with a play-token, so A silences B, compare silences Listen Path, nothing double-plays. Pause→play *resumes* (canvasAudio.ts:77-87) instead of yanking to 0:00. Signed URLs cached 4 min.
- **The sheet:** z 799/800 above the tab bar (zLayers.ts), manual focus trap + Escape + focus restore (`CompareModeSheet.tsx:251-280`), `aria-pressed` selection, `aria-live` "Saved.", 44px+ play pills, 54px gold CTA, stacked cards for 390px, calm copy ("Tap a card to select a direction. Neither idea will be deleted."). A/B two-tone is `COMPARE_A_TONE = GLORY.crimson`, `COMPARE_B_TONE = GLORY.violet` (glorySpectrum.ts:78-79) — the brief's "rose" is actually crimson #C94F4F.
- **Choose:** `choose()` (`useCompareMode.ts:108-134`) snapshots both cards, patches winner `status:"shortlisted"` (ideas tree) and loser `{isDimmedReference:true, dimReason:"compare_kept"}`, fires a 7s toast with a working Undo that restores the exact snapshot. Loser renders dimmed at 0.55 opacity with "↳ Kept for reference" (`CanvasCard.tsx:77-81`) and stays tappable with a Restore action (`handleRestoreCard`, host `:1047-1057`). "Keep both" is honestly a no-op + calm toast. The board card behind the sheet gets the now-sounding ring (`getCardInteractions` host `:1097-1099`).

**Local/half-true:**
- **Persistence:** `patchCards` (host `:477-498`) applies the patch to React state and syncs **only x/y position** patches to the server (`bulkMoveCards`). `status`/`isDimmedReference`/`dimReason` never leave the device — they persist solely via `writeBoard()` → `localStorage cog:canvas-cards-{songId}` (canvasBoardSource.ts:131-137, host effect `:585-587`). There is no server column or RPC for them: `updateCanvasCard`'s patch surface is `label|body|kind|section_kind|position|x|y` (integrations/cog/canvas.ts:71-77) and the RPC roster (move/link/group/set_section/promote) has nothing for status/dim. `hydrateBoard` re-derives status from tree ("raw"/"approved", canvasBoardSource.ts:238), so **a second device or co-writer sees no decision at all**; on the deciding device the dim survives reload only because hydration's merge never touches `isDimmedReference` (host `:611-635`).
- **No activity emit:** `choose()` calls only `onMoment` (a local "saved moment" pill) — nothing reaches the activity feed or the "What changed" recap. Grep confirms no activity write anywhere in the compare path.

## 3. STRESS-TEST FINDINGS

- **[Blocker] Decision is device-local — Law 5.** Reload on another device, or as the co-writer whose take lost: both takes look identical, undecided. The felt experience: "we chose a direction last night and the app forgot." Winner's "shortlisted" and loser's "Kept for reference" evaporate outside one browser profile. (host `patchCards :487-497` syncs only positions; schema gap is Lovable-side.)
- **[Major] No partner choice with 3+ variants.** `open()` takes ONE card and `findPartner` returns `candidates.find(exact-section) ?? candidates[0]` — array order. A chorus with four takes always compares against the same silent pick; the songwriter cannot say "take 2 vs take 4." Feels like the app choosing for you.
- **[Major] Type-agnostic pairing.** `findPartner` matches any card type in the family. All server voice memos hydrate with `section:"Raw idea"` (canvasBoardSource.ts:203), as do server note cards (`:236`), so "Compare A vs B" on a voice take can open **voice vs. text note** — a confusing non-comparison with one Play button.
- **[Major] Compare leaves the Listen Path lying.** If the path is playing and the user auditions in compare, `playMemoOnCanvas` silently steals the shared element but `useListenPath.playing` stays `true` (useListenPath.ts:56 — no preemption callback). After the sheet closes: the transport shows the pause icon over dead silence and the stale card keeps its "now sounding" ring; first tap on play/pause does nothing audible (it "pauses" nothing).
- **[Major] Nested `<button>` inside `<button>`.** `IdeaCardView` is a `<button>` (CompareModeSheet.tsx:49) with the Play pill `<button>` inside it (`:171`). Invalid HTML; screen readers and some browsers flatten or mis-focus it — a VoiceOver user may be unable to reach Play separately from Select.
- **[Major] Uploading takes fail silently.** No `isProcessing` handling in the sheet: Play renders for a memo still uploading, `getPlaybackUrl` throws, `onError` quietly flips the button back (useCompareMode.ts:102). Felt as "the play button is broken." (Listen Path handles this — `useListenPath.ts:103-104` skips processing memos; compare doesn't.)
- **[Minor] Reduced-motion CSS is dead.** The `@media (prefers-reduced-motion)` block targets `.cog-compare-backdrop`/`.cog-compare-sheet` (CompareModeSheet.tsx:497-502) but those classNames are never applied — the 320ms rise and fade always animate. Law 6 miss, trivially fixable.
- **[Minor] Pair vanishing mid-compare orphans audio.** If a hydrate prunes one card, `pair` memo returns null and the sheet unmounts without `close()` — the take keeps playing with no visible transport until it ends.
- **[Minor] Winner of a voice A/B shows no mark.** Only `LyricCard` renders the status chip (LyricCard.tsx:66-78); `VoiceMemoCard` doesn't, so after choosing between two takes the winner looks unchanged — only the loser's dim tells the story.
- **[Minor] Viewers can't listen.** The overflow entry is gated `!isViewer`, so a Viewer (whose role is precisely "can listen") can't even open the A/B audition. Choosing is rightly owner/contributor work; listening shouldn't be.
- **[Minor] Dead branch:** `isSaving && !isDone` can never be true (`isSaving = isDone`, CompareModeSheet.tsx:247), so "Saving direction..." copy is unreachable; also the sheet lacks CardActionsSheet's `maxWidth:480`, going full-bleed on desktop.

## 4. GAP vs VISION (six laws)

1. **Non-destructive: PASS, genuinely.** Loser dimmed with reason, restorable, snapshot Undo; "Keep both" honest.
2. **Calm: PASS.** Quiet "Saved.", 7s undo toast, no confetti. Watch item: crimson as take-A's identity edge sits near "error red"; it's the lyric material tone so it's in-language, but a selected A card glowing crimson can read as a warning to a first-timer.
3. **Faith-first sanctuary: PASS.** Cream sheet, Playfair titles, gold reserved for the system CTA, contributor dot always paired with the name (`:89-118`).
4. **Proposal-not-change: MISS by absence.** A contributor's "choose direction" doesn't propose anything to the owner — it silently edits their own local board and never reaches anyone. Neither a proposal nor a change; a private opinion the app forgets.
5. **Persist + survive reload: FAIL.** localStorage-as-truth for the decision on every card, server rows included. Ids are clean (no Date.now()), but the result does not return for other collaborators. This is the law the mechanic breaks hardest.
6. **Structure beats freedom: MOSTLY PASS.** Bottom sheet, tap-not-drag decision, keyboard trap, semantic labels — but reduced-motion is dead CSS and the nested-button breaks the single-pointer/SR guarantee.

## 5. GAP vs WORLDCLASS BAR

- **Loudness-matched default: ABSENT.** Raw `HTMLAudioElement`, no gain analysis — a quiet porch hum vs a loud room take will always "lose" for the wrong reason. This is the single biggest *judgment-distorting* gap.
- **Instant same-playhead gapless switch: ABSENT.** Switching A→B starts B at 0:00 (or its own resume point). No shared playhead, and each first play pays a signed-URL fetch + network gap.
- **Preload both: ABSENT.** Nothing warms either take on sheet open; `el.preload="auto"` only helps after Play.
- **Blind mode: ABSENT.** Contributor names/avatars always visible — you always know whose take you're rejecting, which is exactly the social pressure blind mode exists to relieve in a co-writing ministry context.
- **Currently-audible unmistakable: PARTIAL.** Pill inverts to tone.dark + board ring behind the scrim; but no motion (no waveform pulse, no progress) inside the sheet — with the phone at arm's length you can't see *where* in the take you are.
- **Commit preserves loser and says so: PASS.** "Direction saved — the other idea is kept" + "↳ Kept for reference" is exactly right.
- **Single large toggle for rapid A/B rhythm: ABSENT.** Two separate small pills; A/B/A/B comparison takes four precise taps instead of one thumb resting on one control.
- **Lyric variants side-by-side read-only: PASS and fine per spec** — 3-line clamp is a sensible preview, though clamped text can hide the exact line that differs.

## 6. UPGRADE RECOMMENDATIONS (ranked)

1. **[High impact] Persist the decision through the store + emit activity.** Needs a Lovable seam (either a `status`/`dim_reason` column pair on `canvas_cards` + RPC, or a `canvas_decisions` row), then route `choose()`'s patch through `syncServer` the way tree changes already do (host `onTreeChange :539-547` is the template). Emit one activity item: "Parker chose a direction for Chorus — the other take is kept." Felt benefit: the decision becomes part of the song's memory; a co-writer opens the room and *sees* the chosen path instead of re-litigating it. Effort: medium (blocked on schema; the client seam is a day).
2. **[High impact] One shared playhead + preload both on sheet open.** Prefetch both signed URLs when `pair` sets (warm `urlCache`), hold two `Audio` elements just for the sheet (still exclusive via the play token), and make switching A↔B seek the other take to the same `currentTime`. Felt benefit: the comparison finally compares *the same bar*, not two different intros; switching feels like tilting your head, not restarting a tape. Effort: medium (contained in canvasAudio + the hook).
3. **[High impact] Loudness match.** On preload, decode each take once through `AudioContext`/`decodeAudioData`, compute RMS, and set per-take gain (or `el.volume`) to equalize. Copy stays silent about it — it should just feel fair. Felt benefit: the softer singer stops losing every A/B. Effort: medium-deep (WebAudio path per take; cache the measurement).
4. **[Quick win] Partner picker.** When the family has 2+ candidates, `open()` shows a one-screen list ("Compare with…") before the A/B sheet; filter candidates to compatible types (audio-vs-audio, text-vs-text) to kill the note-vs-voice pairing. Felt benefit: "I choose what I'm choosing between." Effort: small (one list sheet + a type-parity filter in `findPartner`).
5. **[Quick win] Preempt the Listen Path honestly.** Export a `subscribeCanvasAudioPreempt` from canvasAudio (or have compare call `listenPath.playPause()` when it starts); flip `playing:false` when someone else takes the element. Felt benefit: no lying pause button after a compare session. Effort: tiny.
6. **[Quick win] Processing + failure states in the sheet.** If `card.isProcessing`, render the pill disabled with "Still uploading…" ; on play error, swap pill text to "Couldn't play — tap to retry" instead of silently reverting. Effort: tiny.
7. **[Quick win] Fix the a11y pair.** Un-nest the buttons (outer becomes a `div[role=button]` or move Play outside the selectable region) and apply the `.cog-compare-*` classNames so the existing reduced-motion CSS actually fires. Effort: tiny.
8. **[High impact] The rapid A/B toggle.** Replace two pills with one large segmented A|B control (56px tall, thumb-center) that always plays the *other* take at the shared playhead on tap, plus a thin progress hairline in the active tone. Felt benefit: the back-and-forth *rhythm* that real take-picking has — tap, tap, tap, decide. Effort: small once #2 exists.
9. **[Deep] Blind mode.** A "Listen without names" toggle that hides contributor dots/names and shuffles A/B assignment until a direction is chosen, then reveals with grace: "You chose Sarah's take." Felt benefit: in a worship team, freedom to choose the song's best idea without choosing between friends. Effort: medium.
10. **[Quick win] Mark the winner on voice cards + gentler Saved beat.** Give `VoiceMemoCard` the same status chip lyric cards have ("chosen" in gold tint), and let the sheet's "Saved." linger ~900ms with the winner's ring easing to gold before close (500ms currently swallows the moment). Effort: tiny.

**SINGLE HIGHEST-LEVERAGE MOVE:** Persist the compare decision server-side and announce it in the activity feed — until the chosen direction survives reload and reaches the co-writer who recorded the other take, Compare Mode is a beautifully-built private opinion, not a decision the song remembers.

---

# 4 · Listen Path (F20) — REAL (6.5/10)

> Listen Path really plays — sequenced audio, board-follow, honest device-local save — but it is not gapless, cannot repeat a chorus or reorder, dies at the lock screen, and has an index-drift bug that skips cards when the queue is edited mid-play.

# LISTEN PATH (F20) — AUDIT

## 1. VERDICT

**REAL — 6.5/10.** The stale brief is dead: play is not a boolean and save is not just a toast. `useListenPath` (src/lib/canvas/features/useListenPath.ts) is a genuine sequenced-playback state machine driving real audio through one shared element, the board flies to the sounding card, and the save copy is honest about being device-local. What keeps it at 6.5 instead of 9: the seam between takes (signed-URL round-trip per advance, no preload), no repeats/reorder (musically wrong for songs with a repeating chorus), localStorage-as-truth persistence (Law 5 violation), no lock-screen survival, and one real correctness bug (index-based step tracking drifts when the queue is edited during playback).

## 2. HOW IT ACTUALLY BEHAVES

**Real, verified in current code:**
- **Sequenced playback is real.** `useListenPath.playStep` (useListenPath.ts:80–119) walks the queue: voice/hum cards audition via `playMemoOnCanvas` with `onEnded → advance`; non-audio cards dwell 3.5s (`DWELL_MS`); failed loads skip after 1.2s (`ERROR_SKIP_MS`); a queue entry whose card left the board advances instantly (line 96–100) — no phantom silence.
- **One-at-a-time audio is guaranteed by architecture.** `canvasAudio.ts` is a singleton `HTMLAudioElement` with a `playToken` guard; Compare Mode shares it, so starting either silences the other. Pause→resume genuinely resumes mid-take (canvasAudio.ts:77–87) instead of restarting at 0:00.
- **Board follows playback.** `onStepChange → followPlaybackRef` (SongCanvasExperience.tsx:509–515, 1352–1357) → `jumpToCard` → `panTo(450ms)`; `panTo` jumps instantly under reduced motion (useGesture.ts:409–414). The sounding card wears a cobalt ring (`PLAYBACK_TONE` = GLORY.cobalt, CardShell.tsx:74–75) and its waveform breathes via `cog-wave-play`, correctly killed by `prefers-reduced-motion` in CanvasStage.tsx:192–196.
- **Visible position + count.** Every queued card wears a persistent numbered cobalt badge (CanvasCard.tsx:457–471, AA-checked dark register) and its aria-label includes "listen path stop N" (line 342). The bar shows "Listen Path · N cards" + "step/total"; collapsed it's a "Path · N" pill that never buries Record (ListenPathBar.tsx:69–127); hand-adding auto-expands, a restored path stays a quiet pill (host 556–563).
- **Play final** (FinalArrangementBar.tsx:76–85 → host 2056–2059) seeds `playAll` from the Final tree's running order — real, and available to viewers.
- **Id reconciliation is real.** A pending upload's temp id is swapped for the real memo uuid in the queue (`replaceCardId`, wired at host line 838).
- **Save is honest but local.** `save()` → `mutations.saveListenPath` → `featureMeta.listenPath` → `localStorage cog:canvas-features-<songId>` (host 167–176, 419–421, 499–501), toast says "saved on this device". Verified: **no `canvas_listen_paths` table exists anywhere except the plan doc** (docs/COG-WHITEBOARD-PLAN.md:357) and no listen-path RPC in src/integrations.

**Mocked/local/absent:**
- Persistence is device-local only; a co-writer never sees your path, and a saved path won't follow you to another device.
- No preload of the next item — `playMemoOnCanvas` fetches a signed URL through an edge function (`voice-memo-signed-url`, memos.ts:79–82) **on advance** (4-min TTL cache softens replays only).
- The unsaved queue itself does not survive reload — only an explicitly saved path restores.
- No Media Session wiring — even though `src/lib/audio/mediaSessionBridge.ts` exists and Practice Mode uses it.

## 3. STRESS-TEST FINDINGS

- **[Major — playback corruption] Removing an earlier card while playing skips a card and mislabels the ring.** Step is tracked by *index*, not id. Queue [A,B,C,D], B sounding (step=1): remove A → queue [B,C,D], `queue[step]`=C, so the cobalt "now sounding" ring and chip highlight jump to C while B is audibly playing; when B ends, the captured `advance = playStep(2)` plays D — **C is never heard**. `toggleCard`/`removeCard` only handle the removed-card-IS-current case (useListenPath.ts:121–142). A songwriter pruning their path mid-listen silently loses a stop and can't trust the ring.
- **[Major — Law 5] Path is localStorage-as-truth.** Save writes only `cog:canvas-features-<songId>`. The worship leader who builds the "listen through the whole song" order for tomorrow's co-write opens the song on her iPad — the path is gone. Copy is honest, behavior still under-serves.
- **[Major — flagship feel] Not gapless.** Each advance = edge-function round trip + audio fetch + decode before sound. On mobile networks that's a 300ms–2s dead-air seam between every take — exactly where "the canvas is alive" should feel like a song, it feels like a slideshow. No next-item preload exists anywhere in useListenPath/canvasAudio.
- **[Major — musical truth] No duplicates.** `toggleCard` removes on second tap, so Verse → Chorus → Verse 2 → *Chorus again* is impossible — the single most common song shape can't be pathed. The overflow action even flips to "Remove from Listen Path (#n)" (host 2234–2240), closing the door politely.
- **[Major — mobile reality] Backgrounding/lock screen kills the journey.** No Media Session metadata/handlers on `canvasAudio` and no visibilitychange strategy: current take may finish under a locked screen, but the advance (async signed-URL fetch + `play()` with no user gesture) stalls at the next boundary, and there are no lock-screen controls. She pockets her phone to listen while walking — the path dies after one card. The fix's plumbing (`mediaSessionBridge.ts`) already exists in-repo.
- **[Major — no reorder] Chips support tap-to-jump and remove only** (ListenPathBar.tsx:266–284). Building order wrong means Clear-and-rebuild. There is no drag, no up/down, nothing.
- **[Minor→Major — Law 1] Clear has no undo and no grace.** One tap on "Clear" (44px from Save) destroys a hand-built 10-stop path instantly. Nothing is reversible here despite the non-destructive law.
- **[Minor] Transport vanishes while audio continues.** The bar renders only when `merge.selection.length === 0` and not arranging (host 2029). Start a merge selection mid-playback: audio keeps sounding with no visible pause anywhere.
- **[Minor] No continuous playhead.** No `timeupdate` surface exists; playing a 90-second take shows a frozen "2/5" with no sense of position within the take or across the path.
- **[Minor] Active chip isn't scrolled into view.** With 10+ chips, playback advances offscreen in the horizontal strip — the expanded bar loses the plot it exists to show.
- **[Minor] Phantom entries inflate the count.** A saved queue keeps ids for cards that left the board; chips render null but the header still counts them ("5 cards", 4 chips) and step math includes them.
- **[Minor] `playAll` silently clobbers a hand-built queue** (useListenPath.ts:181–189) — "Play final" replaces your curated path with no undo.
- **[Minor — perf] Each step advance re-renders every card:** `getCardInteractions` is deliberately unmemoized (host 1060–1100), so `listenPath.step/playing` changes hand fresh closures to all 50+ memoized cards. Once per track is survivable; it will bite when a playhead ticks.
- **[Minor — a11y] `aria-pressed` on chips misdescribes state** (active step ≠ pressed toggle), and there is no `aria-live` announcement of step changes — a screen-reader user gets no "now playing" narration. Transport buttons are real, labeled, 44px+ `<button>`s (good); Enter/Space work on chips (good).

## 4. GAP vs VISION (Six Laws)

1. **Non-destructive: PARTIAL.** Queue edits are cheap but Clear/playAll/remove have no undo; the path itself is the only canvas artifact that can be destroyed in one tap.
2. **Calm: PASS.** Quiet pill, honest toast, cobalt-not-red, no confetti. The collapse-don't-clear chevron (ListenPathBar header) is genuinely considerate.
3. **Faith-first sanctuary: PASS.** Gold stays the actor (Play button, Save), cobalt marks playback indication only — the CardShell comment at 70–74 shows this was reasoned, not accidental. Cream, Inter, no rainbow.
4. **Proposal-not-change: N/A-PASS.** Listening changes nothing; viewers can path and play (correctly ungated at host 1084).
5. **Persist + survive reload: FAIL.** localStorage-as-truth, unsaved queue lost on reload, invisible to collaborators, no server table. The one law this mechanic clearly breaks.
6. **Structure beats freedom: MOSTLY PASS.** Bottom bar + pill, single-pointer everything, reduced-motion honored in bar slide, fly-to, and waveform. Gap: no keyboard shortcut for play/pause and no reorder affordance at all.

## 5. GAP vs WORLDCLASS BAR

- Persistent add-confirmation + visible position: **YES** — numbered cobalt badge on the card face + overflow label with #.
- Always-visible count: **YES** — pill "Path · N" and expanded header.
- GAPLESS (preload next): **NO** — signed-URL fetch on advance, zero prefetch.
- Same item twice: **NO** — toggle semantics forbid it.
- Reorder + remove + undo: **remove only** — no reorder, no undo.
- Survives backgrounding/reload: **PARTIAL** — saved path restores on same device; unsaved queue dies; backgrounding stalls at track boundaries; nothing crosses devices.
- Continuous playhead: **NO**.
- Clear Play/Clear: **YES** — labeled, distinct, though Clear is un-undoable.

## 6. UPGRADE RECOMMENDATIONS (ranked)

1. **[High impact] Make it gapless — double-buffer canvasAudio.** In `playStep`, the moment a track starts, resolve the *next* audio step's signed URL and warm a second `Audio` element (`preload="auto"`); on `onEnded`, swap elements instead of fetching. Keep the playToken guard across both. Felt benefit: the path stops being cards-with-pauses and becomes *hearing the song* — the flagship's whole promise. ~0.5–1 day, purely frontend, no Lovable dependency.
2. **[High impact] Track the current step by id, not index.** Store `currentEntryId`; derive `step` for display; on queue edits, re-derive and let the pending `advance` look up "the entry after currentEntryId" at fire time. Kills the skip-a-card bug and makes the ring always truthful. ~2–3 hours in useListenPath only.
3. **[High impact] Entry-based queue → repeats + reorder.** Change `queue: string[]` to `{ entryId: uuid, cardId }[]` (use `newFeatureCardId` — already in mutations.ts:37). Second tap on a card *adds another stop* (badge shows "2·5"); chips gain drag-reorder plus an up/down on long-press for the single-pointer law. Felt benefit: Verse–Chorus–Verse–Chorus finally singable. ~1–1.5 days; coordinate the `listenIndex` badge to show first occurrence + count.
4. **[High impact] Server persistence.** File the Lovable ask for `canvas_listen_paths (song_id, ordered_card_ids jsonb, updated_by, updated_at)` exactly as docs/COG-WHITEBOARD-PLAN.md:357 already sketches; `saveListenPath` writes through `syncServer` like moves do, localStorage stays as offline cache. Change toast to "Listen path saved" when the write lands, keep "saved on this device" as the offline fallback — the copy machinery is already honest. Felt benefit: her path is waiting on every device, and a co-writer can press play on the same journey.
5. **[Quick win] Wire `mediaSessionBridge` into the path.** It exists (src/lib/audio/mediaSessionBridge.ts) and Practice Mode proves the pattern (usePracticePlayer.ts). Set metadata (card title, song name), play/pause/next/prev handlers → lock-screen transport + far better background advance. ~2 hours.
6. **[Quick win] Undo on Clear.** Keep the toast pattern already used by merge/arrangement: "Path cleared · Undo" restores the previous queue+step. ~1 hour, closes the Law-1 gap.
7. **[Quick win] Auto-scroll the active chip.** `chipRef.scrollIntoView({ inline: "center", behavior: reducedMotion ? "auto" : "smooth" })` on step change. The expanded bar finally *shows* the journey it plays. ~30 min.
8. **[Quick win] Continuous playhead + dwell sweep.** Expose `onTimeUpdate` from canvasAudio; render a 2px cobalt progress line along the active chip's bottom edge; for non-audio dwell, run the same line over 3.5s so silence reads as intentional pacing, not a hang. Reduced motion: step-fill at 25% increments. ~half day.
9. **[Quick win] Announce steps to screen readers.** One visually-hidden `aria-live="polite"` region in ListenPathBar: "Now playing: Bridge hum, stop 3 of 5." ~30 min.
10. **[Quick win] Keep a mini-pause visible during merge/arrange.** When the bar is suppressed but `playing`, render just the collapsed pill (it's only 44px) so sound is never uncontrollable. ~30 min.
11. **[Deep] Draft autosave.** Persist the working queue (not just explicit saves) to featureMeta on change, debounced — reload resumes exactly where she was, matching the outbox-first ethos the rest of the canvas already has.
12. **[Quick win — copy] The empty teach-moment.** First time a card's overflow shows "Add to Listen Path", a one-line hint under the action: "Tap cards in the order you want to hear them." Discoverability today depends entirely on opening ⋯.

**SINGLE HIGHEST-LEVERAGE MOVE:** Double-buffer the next take in `canvasAudio` (rec #1). It is the one change every user *hears* on every single play — the difference between "a queue of files" and "my song, moving" — it needs no backend, no schema, and it upgrades Play Final, the flagship demo moment, in the same stroke.

---

# 5 · Merge / Splice (F22) — PARTIAL (4.5/10)

> Merge/Splice is a real, calm, non-destructive local interaction with uuid ids and a working Undo — but the merged section never leaves the device (the canvas_group_cards/link RPCs exist with zero call sites), merges commit blind with no preview, and credits attribute the new section to a fabricated person named "Alice & Bob".

# F22 — MERGE / SPLICE AUDIT

## 1. VERDICT

**PARTIAL — 4.5/10 to worldclass.** The interaction is genuinely built and genuinely kind: two-slot selection, collision-safe `merged-<uuid>` ids, `mergedFrom` provenance recorded, parents dimmed (never deleted) with a "Bring back" path, a real Undo, calm gold-ring visuals, 44px targets, reduced-motion honored. The stale brief's claim of `Date.now()` ids and React-state-only is **now false** — ids come from `newFeatureCardId` (crypto.randomUUID, `features/mutations.ts:37-43`) and the board persists through `writeBoard` → localStorage, surviving reload on the same device. What keeps it at 4.5: **the merge never reaches the server** — in a collaboration app, a merged chorus is a private hallucination on one phone; the commit is **blind** (no combined preview, no granular pick); reversibility is time-boxed to a 7-second toast; and provenance/credits mis-fire in a way that would quietly hurt the very worship-team fairness the product promises.

## 2. HOW IT ACTUALLY BEHAVES (runtime truth)

**Real, verified:**
- `useMergeSplice` (`src/lib/canvas/features/useMergeSplice.ts`) is a clean state machine: max-2 selection, viewer-gated `executeMerge` (line 45), builds a `section`-type ideas card at the parents' midpoint +60y, `mergedFrom: [idA, idB]`, toast with Undo (`revertMerge`, lines 74-80).
- Host `applyMerge`/`revertMerge` (`SongCanvasExperience.tsx:425-447`) dim both parents (`dimReason: "merged"`), append the merged card, and undo restores exactly. Dimmed parents show "↳ Merged into section" (`CanvasCard.tsx:77-81, 393-397`), can't drag or re-enter selection (`host:1087, 2241` — duplicate merges are structurally impossible), and carry a permanent "Bring back" restore (`host:1046-1057`).
- **Reload on the same device works.** `writeBoard` persists every card change (`host:585-587`); the hydrate/prune cycle does NOT destroy the merge — `isServerCardId` is an exact-match regex (`canvasBoardSource.ts:109-118`), so `merged-<uuid>` cards survive pruning, and the hydrate merge spreads `...c` first (`host:617-636`), preserving `isDimmedReference` on server-hydrated (`db-card-*`) parents through realtime ticks. Merging two server cards behaves sanely: parents stay dimmed, merged card survives.
- Entry: tap card → ⋯ More sheet → "Select to merge" (`host:2241-2248`); `MergeActionBar` slides up (z 540, above the z-500 tab bar), chips with per-chip remove, "Select 1 more idea…" placeholder, Cancel, gold "Merge into section" CTA. One-bottom-surface discipline is real (`host:552-573`).

**Confirmed NOT real (mocked/local/absent):**
- **No server write on merge.** `applyMerge` is pure `setCards`. `linkCards`/`groupCards` RPCs exist in `integrations/cog/canvas.ts:107-120` — the contract doc (`docs/CANVAS-FEATURES-CONTRACT.md` §2) even names them as the merge seam — but they have **zero call sites** in the entire src tree. No `canvas_cards` insert, no activity emission, no recap entry.
- **No preview, no granular pick.** The CTA fires the join sight-unseen; body join order = selection order, stated nowhere.
- `mergedFrom` provenance is stored but **rendered nowhere**; the merged card's face is `LyricCard`, which doesn't display `meta` — so "Merged from A and B" is invisible on the board.

## 3. STRESS-TEST FINDINGS

**[Blocker] The merge exists for exactly one device.** `applyMerge` (`host:425`) never calls `syncServer`. Second-collaborator test: co-writer merges two chorus ideas, texts "found it," owner opens the room — nothing there, parents undimmed. New-phone / cleared-storage test: the merged section vanishes and server parents resurrect as raw rows; any edits made to the merged card are silently lost. The felt cost: the one moment the app exists for — "our two halves became a song" — doesn't survive to the other person.

**[Major] Merging is blind.** No combined preview, no A/B order control, no line-level pick. A writer discovers the verse order is wrong only after commit, then can't un-commit past 7 seconds. Fear of a blind commit is exactly the hesitation F22 was designed to remove.

**[Major] Nobody is told the originals are kept — until after.** The dim label and toast are post-hoc. `MergeActionBar` has no line of copy promising safety before the gold button. A first-time worship leader will hover, afraid of losing Sarah's original.

**[Major] Credits mis-attribution.** Merged contributor is the literal string `"Alice & Bob"` (`useMergeSplice.ts:51-54`); `deriveCredits` (`lib/canvas/credits.ts:50-58`) keys by that name, so a fabricated person "Alice & Bob" earns the Arrangement credit and neither real person does. The merged card also skips `createdBy`/`createdAt`/`contributionType` (compare the host's `stampNewCard`). For a product whose Law is "credits matter," this is a quiet injustice.

**[Major] Merging two voice memos orphans the sound.** The merged section card carries no audio reference (voice bodies are `""`), and dimmed parents lose every playback affordance — the dim-selected row renders only "Bring back" (`CanvasCard.tsx:401-414`); no ⋯ sheet, no listen-path add. The hum you merged "into" the section becomes unplayable until you un-dim, which unravels the tidy dim story.

**[Major] The merged card can land off-screen with no fly-to.** `applyMerge` never sets `focusCardId` (the host's own fly-to mechanism, used by `handleNewVariant`). On a zoomed 390px viewport, the midpoint of two distant parents is frequently out of view: toast says "Ideas merged," the user sees nothing move, and hunts.

**[Major] Reversibility expires in 7 seconds.** After the toast, the merged section is permanent — there is no delete/dismiss/un-merge for your own cards; "Bring back" on parents leaves a stray duplicate section forever. No E3 version snapshot is taken. Law 1 says reversible; here it's reversible-for-7-seconds.

**[Minor] Ragged identity strings.** Unresolved server contributors ("" until roster loads) produce `"Alice & "` or `" & "`, rendered verbatim under the card (`CanvasCard.tsx:386-390`). The "&"-name also hashes a brand-new creator color belonging to no one (`CanvasCard.tsx:145`).

**[Minor] Deleted-dependency dangle.** If a co-writer deletes a parent's server row, the hydrate prune removes it even while dimmed and referenced by `mergedFrom` (`host:647-653`); Undo then restores only the survivor.

**[Minor] Self-review noise.** A merged card built from two others' ideas fails `isMine` (contributor "Alice & Bob" doesn't contain me) and appears in **my own** review queue (`host:1523-1546`) as if a co-writer added it.

**[Minor] Zone lie at the divider.** Midpoint placement isn't clamped to the ideas half at creation; `normalizeCard` fixes it only on reload (`canvasBoardSource.ts:39-47`).

**[Minor] Doc/code drift.** Contract says MergeActionBar z 695; code hardcodes 540 (matching `Z.bottomBar` but not importing it, `zLayers.ts:23`).

## 4. GAP vs VISION (six laws)

1. **Non-destructive** — Mostly met (dim + Bring back + labeled reasons), but merge reversal is toast-boxed: *partial*.
2. **Calm** — Met. Quiet toast, no red, gold keeper ring, one bottom surface at a time.
3. **Faith-first sanctuary** — Mostly met (cream bar, gold = keeper/CTA, Inter labels), dented by the fabricated "&" identity color and empty-name fragments.
4. **Proposal-not-change** — Unaddressed. A contributor can merge *other people's* cards into a new section with no owner yes. It's currently masked by the persistence gap; the moment merge syncs, this becomes live and must route through the review queue.
5. **Persist + survive reload** — **Fails for anyone but this device.** localStorage-as-truth for merge results, despite the RPC seam already shipped and documented.
6. **Structure beats freedom** — Met. Bottom sheet, tap-only flow (no drag required), per-chip remove, Escape/Cancel, reduced-motion, 44px targets, safe-area inset.

## 5. GAP vs WORLDCLASS BAR

- **Live combined preview** — MISSING (blind commit).
- **Granular line pick A vs B** — MISSING.
- **Non-destructive AND stated** — half: true, but stated only after commit.
- **Explicit commit + easy cancel** — PRESENT and good (disabled-until-2, Cancel, chip remove).
- **Undo now + version snapshot** — half: real 7s Undo; no snapshot, no durable un-merge.
- **Provenance visible, credits-aware** — FAIL: `mergedFrom` stored but never rendered; credits mis-keyed to a joined name.
- **Mobile stacked sources + sticky preview** — half: the chip strip is a decent 390px source stack; there is no preview to stick.

## 6. UPGRADE RECOMMENDATIONS (ranked)

1. **[High impact] Make the merge real for the room.** In `applyMerge`, when parents are `db-card-*`: insert the merged section as a `canvas_cards` row (kind "section", body = join), then `groupCards([parentA, parentB, merged])` + `linkCards(merged, parent)` for provenance — through the existing `syncServer` keyed chain so offline stays non-fatal; undo deletes the created row + ungroups. Local-only parents keep today's local path. *Felt:* the "we found the chorus" moment survives to every phone in the room. Effort: 1–2 days (needs Lovable only if insert isn't RLS-permitted for contributors).
2. **[High impact] Merge preview sheet.** Replace the blind CTA with a bottom sheet: both sources stacked (390px), the combined result rendered live in Playfair on cream, an A↔B swap control, caption under the gold button: *"Both originals stay on the board — nothing is deleted."* Commit stays explicit; Cancel stays one tap. *Felt:* confidence replaces hope. Effort: ~1 day.
3. **[High impact] Granular pick.** In that preview, split each body on newlines into tappable line chips (default all-on, source-colored, name-paired); the preview recomposes live. This is the actual "splice" in Merge/Splice. Effort: 1–2 days atop #2.
4. **[High impact] Durable un-merge + snapshot.** Give the merged card a permanent ⋯ action "Un-merge — restore both originals" powered by `mergedFrom`, and take an E3 version snapshot at commit. *Felt:* the 7-second panic window disappears. Effort: ~1 day.
5. **[Quick win] Fly to the newborn.** `setFocusCardId(merged.id)` inside `applyMerge` — one line; the room answers the action instead of toasting into the void. Effort: minutes.
6. **[Quick win] Credit the real people.** Set `createdBy` (merging user), `createdAt`, `contributionType: "arrangement"`; store parent contributors structurally (or teach `deriveCredits` to read `mergedFrom`) so Alice AND Bob each keep their credit. Effort: hours.
7. **[Quick win] Show the lineage.** A small "⧉ Merged from 2 ideas" chip on the merged face (LyricCard doesn't render `meta` — add a provenance slot); tapping it softly glows both dimmed parents. *Felt:* the song remembers where it came from. Effort: hours.
8. **[Quick win] Keep the sound reachable.** Let dimmed voice cards open the ⋯ sheet (listen-path add), or attach parent memo ids to the merged section so its melody plays from the new card. Effort: hours.
9. **[Quick win] Copy + hygiene.** Pre-commit safety caption in `MergeActionBar` (see #2 if deferred); filter empty names from the contributor join; clamp merged x into the ideas half at creation. Effort: minutes each.
10. **[Deep] Proposal-not-change.** When a non-owner merges cards they didn't author, create the section as `reviewState: "pending"` and surface it in `OwnerReviewQueueSheet` — the merge *proposes*; the owner says yes. Required before #1 ships to contributors. Effort: 2–3 days.

**SINGLE HIGHEST-LEVERAGE MOVE:** Wire `executeMerge` through the already-shipped, already-documented server seam (`canvas_cards` insert + `canvas_group_cards`/`canvas_link_cards` in `integrations/cog/canvas.ts`, called via the host's `syncServer`) — until the merged section exists for every collaborator, every other refinement is polishing a private illusion, and every downstream promise (credits, recap, review, provenance) has nothing real to hang on.

---

# 6 · Final Arrangement Drag (F23) — REAL (6/10)

> Final Arrangement Drag is genuinely built — a real y-order model, an arrange bar with single-pointer controls, snapshot cancel, undo toasts, and canvas_bulk_move writes — but the running order is only true for server cards, can scramble under fast taps or offline, goes silent for screen readers, and the tactile drag-reorder feel layer is missing.

# F23 — FINAL ARRANGEMENT DRAG · AUDIT

## 1. VERDICT

**REAL — 6/10.** The stale brief is now false in every load-bearing claim: an arrange mode exists, the RPCs are called, and reordering survives reload for server-backed cards. What keeps it from worldclass is truth, not pixels: the order is device-local for voice memos and locally-created cards (a Law 5 failure for first-class content), position writes can land out of order server-side, and the reorder moment has no motion, no haptic, and no voice for assistive tech. The bones are excellent; the promise "this is the song's running order, for everyone, forever" is only ~70% kept.

## 2. HOW IT ACTUALLY BEHAVES (runtime truth)

**The order model is real.** `useFinalArrangement` (src/lib/canvas/features/useFinalArrangement.ts:66–98) defines the running order as Final-tree cards sorted by `y` (excluding layer children via `!parentMemoId`). `moveBy(id, ±1)` swaps the two neighbours' `{x,y}` through `mutations.patchCards`. The host's `finalOrder` memo (SongCanvasExperience.tsx:1004–1009) numbers cards by the same y-sort, and CanvasCard.tsx:364–378 renders the set-list badge (green `#53AB8B`, top-left).

**Arrange mode is real.** `FinalArrangementBar.tsx` — collapsed: gold "Play final" + white/gold "Arrange final" pills (fixed right, thumb-reachable, 44px min-height); active: a bottom toolbar (`role="toolbar"`, safe-area padded, reduced-motion-gated rise animation) listing sections in order with per-row Move-earlier/later chevron buttons (36×36 — slightly under the 44px floor), Save + Cancel. `begin()` snapshots every final card's position (useFinalArrangement.ts:76–82); `cancel()` restores it exactly; `save()` closes and offers a 7s Undo toast restoring the begin-snapshot. Viewer role correctly sees Play but never Arrange (`canArrange = !isViewer && length >= 2`).

**Server persistence is real — for `db-card-*` rows.** The host's `patchCards` (SongCanvasExperience.tsx:477–498) extracts position patches on server rows and fires ONE `bulkMoveCards` → `canvas_bulk_move` RPC (integrations/cog/canvas.ts:103–105), with `markDirty` grace so a racing hydrate can't yank cards back. Free drags commit through `handleCardMove` → `canvas_move_card`, keyed and serialized per card (SongCanvasExperience.tsx:686–691). Reload restores positions via `hydrateBoard` (`serverPositioned`, canvasBoardSource.ts:229–252); co-writers receive them through `subscribeSongRoom → hydrateVoiceMemos` merge (SongCanvasExperience.tsx:628–635). Verified end to end in code — this is not mocked.

**Free drag is genuinely worldclass mechanically.** CanvasCard.tsx: pointer-capture, direct-to-DOM per-frame positioning (no React re-render mid-drag = real 60fps design), lift transform `scale(1.06) rotate(1.5deg)` + creator-color glow on crossing the 7px threshold, rAF edge auto-pan (52px zone), `clampToBoard` so nothing strands, second-finger pinch aborts with a spring-back, cross-divider drops promote via `onCardDrop`. Dropping a Final card at a new height IS drag-to-reorder — badges renumber on release.

**Alternate paths exist.** The ⋯ sheet offers "Move up/down in the arrangement" (SongCanvasExperience.tsx:2201–2210); cards are keyboard-focusable buttons (CardShell.tsx:135–145) so a full keyboard route exists (focus card → Enter → ⋯ → move). "Play final" pipes `orderedFinalCards` into `listenPath.playAll` — real sequenced audio, for viewers too.

**What is local/half-true:** voice-memo cards and locally-created cards have no server position or tree — their Final membership and order live only in `writeBoard` localStorage (canvasBoardSource.ts:131–137). `movesInPlace` returns true for `db-voice-*` ids but `onTreeChange` no-ops for them (`serverCardId` matches only `db-card-*`), so a memo promoted to Final and slotted third is third **on this device only**. There is no export or downstream consumer of the order — practice mode reads `song_sections` (practiceApi.ts:182), not the Final tree. A unit test exists but covers only `moveToIdeas` never-deletes (canvas-rescue-mechanics.test.ts:44–81) — `moveBy` itself is untested.

## 3. STRESS-TEST FINDINGS

- **[Blocker] The running order is a private truth for voice memos and local cards.** A songwriter arranges Verse (lyric card) → Hum (voice memo) → Chorus; their co-writer opens the song and sees the hum back in Ideas at an auto-slot (`hydrateBoard` rebuilds memos as `tree:"ideas"` at `ideaColumnSlot(i)`). Same user, new phone: same loss. The set list they rehearsed from is not the set list their team sees. (useFinalArrangement `movesInPlace`/`onTreeChange` seam + canvasBoardSource.ts:196–219.)
- **[Major] Rapid reorder can persist a scrambled order.** `patchCards`' `syncServer(() => bulkMoveCards(moves))` at SongCanvasExperience.tsx:497 passes **no key** — successive taps fire concurrent RPCs that may arrive out of order; payloads for the same card carry stale positions. The arranger's device looks right (dirty grace); the next reload or a co-writer sees Chorus where Bridge should be, with no error anywhere.
- **[Major] Silent no-op + ambiguous numbering past 10 final cards.** `finalColumnSlot` wraps into sub-columns (canvasGeometry.ts:66–71), so card #1 and card #11 share the same `y`. The y-sort ties break by array order (meaningless), and `moveBy` swapping two equal-y cards changes nothing — the user taps "Move earlier" and the list doesn't move. A worship team's 12-section medley hits this.
- **[Major] Arrange mode is not transactional across people.** Every `moveBy` writes through immediately; a co-writer watches the order churn live mid-session, and your **Cancel** restores your `begin()` snapshot — silently overwriting anything they moved meanwhile. No presence signal ("Parker is arranging"), no soft lock, last-write-wins.
- **[Major] Offline reorder silently reverts, while the toast says "Running order saved."** `syncServer` swallows failures with no retry outbox (unlike voice capture); after the 15s dirty grace, the next hydrate snaps positions back to the server's old order. Subway arranger loses their work and was told otherwise.
- **[Major] Law 4 tension: contributors change the final running order with no owner "yes."** Promotion has a review path; reordering — arguably the most song-shaped decision on the canvas — applies instantly for any non-viewer.
- **[Minor] Reorder is silent to screen readers and drops keyboard focus.** No `aria-live` region in FinalArrangementBar; badges are `aria-hidden`; when a row reaches an edge its chevron disables and focus falls to `<body>`; no Escape-to-cancel on the toolbar (CardActionsSheet has it; the arrange bar doesn't).
- **[Minor] The swap teleports.** CardShell's transition covers transform/shadow/opacity but not `left/top` (CardShell.tsx:114–115), so on-canvas cards jump instantly on `moveBy`; list rows re-render with no FLIP glide. No haptics anywhere in canvas despite `useVibration` existing and being used in practice/swipe-nav.
- **[Minor] ⋯-sheet reordering is one step per open** — `CardActionsSheet` closes after every action (CardActionsSheet.tsx:100); moving a section three slots means reopening the sheet three times.
- **[Minor] "Play final" clobbers a hand-built listen path** — `playAll` replaces the in-memory queue (useListenPath.ts:181–189); the saved path survives but the pill the user just curated vanishes.
- **[Minor] Undo is one level, 7 seconds.** After the toast dies there is no path back except re-arranging by hand.
- **[Minor] Perf note:** drag itself is exemplary (direct-to-DOM + rAF), but `getCardInteractions` deliberately builds fresh closures per render (SongCanvasExperience.tsx:1059–1064), defeating `CanvasCard`'s memo — every reorder tap re-renders every card. Fine at 15 cards; watch at 50+.

## 4. GAP vs VISION (the six laws)

1. **Non-destructive — PASS.** Snapshot cancel, undo toasts, `moveToIdeas` patches instead of deleting (tested), nothing removed.
2. **Calm — PASS.** Quiet pills, muted chevrons, "Running order saved," no badges shouting. The one blemish: a save toast that claims more than the network confirmed.
3. **Faith-first sanctuary — MOSTLY.** Cream/gold/Playfair-Inter held; but the arrangement badge is a hardcoded `#53AB8B` that lives outside glorySpectrum (sage is `#6E9B63`), and the list rows number in creator color while the canvas numbers in green — two color languages for the same fact, and creator color appears without its paired name in the rows.
4. **Proposal-not-change — GAP.** Contributor reorders apply instantly; no proposal reaches the owner.
5. **Persist through the store — SPLIT.** Server cards: yes, reload + co-writers verified in code. Voice memos + local cards: localStorage-as-truth, the exact anti-pattern the law names. Ids are clean (uuid via `newFeatureCardId` pattern / `crypto.randomUUID`).
6. **Structure beats freedom — STRONG.** Bottom toolbar, chevrons as the single-pointer alternative to drag, reduced-motion honored on the bar rise and card animations, edge auto-pan bridges the 390px two-tree reality.

## 5. GAP vs WORLDCLASS BAR

- Deliberate grab (handle/long-press): **partial** — 7px threshold prevents accidents, but any card-body press drags; no handle, no long-press ritual on the list.
- Lift + haptic: **half** — beautiful lift on canvas (scale+rotate+glow); zero haptics.
- Placeholder gap reshuffling: **missing** — no drag inside the list at all; on canvas there is no gap/ghost, order only reveals on drop.
- Auto-scroll: **present on canvas** (edge auto-pan); the list itself scrolls only natively.
- Spring drop ~100ms: **partial** — abort springs back nicely; a committed drop just stops.
- Move-Up/Down + keyboard fallback: **present**; SR announcements: **absent**; focus retention at edges: **broken**.
- Handle not a menu icon: **n/a-pass** (chevrons are unambiguous).
- Undo after reorder: **present** (single-level, 7s).
- Order persists + survives reload: **true for `db-card-*` rows only.**

## 6. UPGRADE RECOMMENDATIONS (ranked)

1. **[High impact] Make Save write the order as one deliberate, verified act.** On `save()`: re-slot `orderedFinalCards` through `finalColumnSlot(i)` (kills y-ties and the 11+ no-op, makes numbering deterministic), send ONE serialized `bulkMoveCards` keyed per song (fixes out-of-order scrambling), and only then toast — "Order saved" on ack, "Order saved on this device — will sync" on failure (the listen path already models this honest copy). Queue failed writes in a small outbox like voice capture. *Feels like: the moment you press Save, the set list becomes solid — and never lies.* Effort: ~1 day.
2. **[High impact] Persist memo/local cards' Final membership + order (Lovable ask).** Either mirror promoted memos into `canvas_cards` rows or add a song-level `arrangement` record (ordered id list). Until server support lands, show a quiet truth chip in the arrange bar when the order contains device-local cards: "2 of these live only on this device." *Feels like: the whole band holds the same set list.* Effort: contract + 2–3 days across teams.
3. **[Quick win] Give the reorder a voice and keep the thread of focus.** An `aria-live="polite"` line in FinalArrangementBar ("Chorus — position 2 of 5"); when a chevron disables, move focus to its sibling; Escape cancels the toolbar. ~20 lines. *Feels like: a blind worship leader can arrange their own song.*
4. **[Quick win] Let the swap glide.** Add `left/top` to CardShell's transition (180ms, `--cog-ease-reveal`, gated by reduced-motion) so canvas cards trade places visibly; FLIP the list rows (or `translateY` swap) so the row you moved slides into its slot. *Feels like: the song physically rearranging, not teleporting.* ~half day.
5. **[Quick win] Haptics via the existing `useVibration`:** `vibrate(8)` on drag lift, `vibrate(5)` per slot change (list or canvas), a soft double-pulse on Save. iOS no-ops safely. *Feels like: the order clicking into place under your thumb.* ~1 hour.
6. **[High impact/Deep] Drag-to-reorder inside the arrange list** — long-press lift (shadow + 1.02 scale), placeholder gap, auto-scroll near list edges, ~100ms spring drop; chevrons remain the fallback. This is the missing worldclass feel of F23. 2–3 days.
7. **[Quick win] Keep the ⋯ sheet open for Move up/down** (a `keepOpen` flag on those two actions) with the live position shown ("now #2 of 5"), so a three-slot move is three taps, not three sheet rituals.
8. **[Quick win] One color language for the set-list number:** replace `#53AB8B` with a glorySpectrum arrangement tone (e.g. `GLORY.sage.dark`) in both the canvas badge and the bar rows; pair creator color with the name in rows per Law 3.
9. **[Deep] Proposal path for non-owners:** a contributor's Save becomes "Suggest this order" → OwnerReviewQueueSheet shows a before/after strip (1→3, 2→1…) with one gold "Use this order." Honors Law 4 without slowing the owner down.
10. **[Deep] Give the order somewhere to go:** "Send to practice" (map Final order onto `song_sections` positions) and a plain-text setlist share ("1. Verse 1 · 2. Chorus…"), plus an activity entry "Parker set the running order." *Feels like: the arrangement matters beyond the canvas — it reaches Sunday.*

**SINGLE HIGHEST-LEVERAGE MOVE:** Turn Save into one atomic, normalized, serialized, honestly-confirmed write of the whole running order (recommendation 1) — that single change fixes the tie no-op, the scrambled-order race, the offline lie, and lays the rail the memo/local-card persistence and the proposal flow both run on.

---

# 7 · Multi-cursor Presence — PARTIAL (4.5/10)

> Roster-level presence is genuinely live over Supabase Realtime — who's here, join toasts, jump-to-person all real — but the "where they are" half (cursors, viewport, section-occupancy) does not exist, and one person can wear three different colors across presence, cards, and roster.

# AUDIT — Multi-cursor Presence (Song Whiteboard Canvas)

## 1. VERDICT

**PARTIAL — 4.5/10.** The stale brief's "not built / past-authors-only" claim is now false: the *who's-here* layer is real Supabase Realtime Presence, correctly built (separate ephemeral channel, track-after-subscribe, multi-tab collapse, fail-soft, cap+N, reduced-motion honored). Two sessions genuinely see each other. But the mechanic is named *multi-cursor* presence, and the *where* layer — cursors, viewport share, or the mobile-right section-occupancy — is entirely absent; the `onCursorMove` seam is wired to nothing. Add a real color-identity fracture (three different hues for the same human) and an "In this room" label that can claim people are present when they are not, and this sits at half of world-class: honest about *who*, silent about *where*, inconsistent about *which color is you*.

## 2. HOW IT ACTUALLY BEHAVES

**Real (verified in code, would work across two live sessions):**

- `src/lib/canvas/useSongPresence.ts:15-38` — thin, fail-soft hook. Subscribes when identity resolves; `selfKey` (userId|name|color) prevents re-track churn; returns roster with `isSelf` flagged; empties on unmount. If realtime is down the list stays empty and the room still works — presence is an enhancement, never a dependency. Correct posture.
- `src/integrations/cog/realtime.ts:40-75` `subscribeSongPresence` — real Presence channel `presence:song:${song_id}`, presence key = userId, `channel.track(self)` only after `SUBSCRIBED` (correct semantics), emit on sync/join/leave, `byUser` map collapses a person open in two tabs to one avatar (`metas[0]`), `untrack()` + `removeChannel` on cleanup. Crucially this is a **separate channel** from the postgres-changes edit channel `song:${songId}` (`subscribeSongRoom`, line 108) — the worldclass "presence on its own ephemeral channel" box is genuinely ticked. No table writes; ephemeral only.
- Host `SongCanvasExperience.tsx:1123-1141` — `presenceSelf` built from the real signed-in profile (null until it resolves, so no ghost joins), `livePresence`, `othersHereNow`, `presentNames`.
- **Arrival moment** `:1146-1161` — "X joined the room / They're here with you now." toast, seeded on first non-empty sync so nobody already present triggers it on load. Calm sonner toast, no red, no confetti. This is the invite-link payoff moment and it lands.
- **Header stack** `:1769-1788` — `CollaboratorAvatarStack` (maxVisible 3, real "+N" remainder — `CollaboratorAvatarStack.tsx:52-105`), green live-ping dot only when `othersHereNow > 0`, ping animation disabled under `prefers-reduced-motion` (`:2342-2345`). The stack lives inside the Invite button — presence and invitation share one surface, which is the right growth instinct.
- **Presence as navigation** `:1412-1434` `jumpToCollaborator` + `ShareSongSheet.tsx:34-38, 316-317` — sheet rows show a green "Here now" dot/text for live people; tapping a person flies the canvas to their **latest card**. Honest fallback copy when they haven't added anything yet.
- **Fallback chain** `:1163-1188` — livePresence → songMembers → card authors. The stack is never empty in a populated room; nothing fabricated.

**Not built / dead seams (name them plainly):**

- **No cursor or viewport broadcast anywhere.** `src/lib/canvas/collab/` contains only recap files; grep for broadcast/cursor/viewport = zero hits. `CanvasStage.tsx:88-89` exposes `onCursorMove` and `CanvasViewport.tsx:65-66,140` pipes it into `useGesture`, which has a real 100ms throttle and correct container-relative canvas-space math (`useGesture.ts:22, 246-258`) — but the host's `<CanvasStage>` call (`SongCanvasExperience.tsx:1803-1815`) passes no `onCursorMove`. The seam is documented, throttled, and connected to nothing. Also note: `useGesture.ts:171-184` early-returns untracked pointers, so even wired, the stream fires only **during a mouse/pen drag** — never on hover, never on touch. As designed it could not power live cursors without extension.
- **No section-occupancy model** — nothing broadcasts which zone/section a person is viewing; presence-jump flies to their latest *artifact*, not their live *location*. On a phone, "where is Sarah working right now" is unanswerable.
- **No interpolation/ghost-expiry/own-cursor story** — N/A until a position exists.

## 3. STRESS-TEST FINDINGS

- **[Major] One person, three colors.** Presence avatar color is hashed from the **name** (`presenceSelf`, host `:1128` — `getCreatorColor(currentUserName)`), card accents from the **user id** (`identityByUserId` `:317,324`; add-card `:713`), and the roster fallback from a **legacy palette** (`useSongCollaborators.ts:48` → `inviteContext.ts:86-91`, which includes corporate blue `#4D8FD2`, violet-blue `#8070C4`, and `#D4AE5C` — essentially `--cog-gold-light`, the system's own hue). Worse, voice-memo cards hash the name (`:889`) while other cards hash the id (`:713`) *in the same file*. Felt consequence: Sarah's presence avatar is sage, her lyric cards plum, her roster row corporate blue — the songwriter can never learn "Sarah is plum," and a near-gold person-avatar quietly breaks "gold = the system speaking."
- **[Major] "In this room" can be a false claim.** When realtime is empty, `presenceStack` shows members/card-authors, and the aria-label (`:1764-1765`) says "In this room: 3 people" for people who are *not here*. Visually the fallback stack is pixel-identical to a live stack minus the 10px dot. A screen-reader user is told collaborators are present when the writer is alone at midnight; a sighted user gets a softer version of the same ambiguity. Ambient presence must never over-claim.
- **[Major] The "where" half of the mechanic is absent.** No cursors, no viewport share, no occupancy. Two co-writers in the same room at the same time work blind to each other's location until a card arrives — collision (both editing near the same cluster) is discovered only after the fact. This is the gap between "someone is here" and "we are writing *together*."
- **[Minor→Major] Viewers are watched but cannot see.** `:1746-1749` replaces the invite button — the only surface hosting the presence stack — with static text for viewers. A viewer broadcasts their presence (others see them arrive) but sees no roster themselves. Asymmetric visibility is the one shape of presence that starts to feel like surveillance.
- **[Minor] No reconnect forgiveness on join toasts.** `knownPresenceRef` is fully replaced each emit (`:1160`), so a collaborator on flaky Wi-Fi re-toasts "joined the room" on every reconnect. On a worship-team van ride that's a toast drumbeat — calm law erosion by repetition.
- **[Minor] Name-keyed matching where userId exists.** `presentNames` matches lowercase names and even bare first names (`ShareSongSheet.tsx:37`); `jumpToCollaborator` matches `contributor === fullName || firstName` (`:1419-1423`). Two Sarahs → both glow "Here now," and jump can land on the wrong Sarah's card. The presence payload already carries `userId`; the precision is being thrown away.
- **[Minor] "You joined the room."** If a profile has a user_id but no name fields, `currentUserName` is literally "You" (`:240-245`) and *other people's* toast reads "You joined the room" — a small but disorienting copy hazard.
- **[Minor] Departures are instant deletions.** When someone leaves, their avatar pops out of the stack with no exit motion; combined with no "left" affordance this is fine calm-wise, but the abrupt reflow reads as a glitch rather than a goodbye.
- **[Perf, negligible] Every presence sync re-renders the 2,226-line host** (fresh array per emit in `useSongPresence`). Presence events are rare; acceptable today, worth memoizing by roster identity if occupancy heartbeats land.

## 4. GAP vs VISION (six laws)

1. **Non-destructive** — Pass. Ephemeral channel, nothing written, nothing deletable.
2. **Calm** — Mostly pass. Green (not red) dot, quiet toasts, no counts screaming; fails only at the reconnect-toast repeat and the instant avatar pop.
3. **Faith-first sanctuary** — Partial fail. Contributor color is always paired with a name/initials (good), but the legacy roster palette leaks corporate blue and near-system gold into the room, and the three-way color fracture breaks the identity language the glorySpectrum file itself preaches (`creatorColors.ts:15-18`).
4. **Proposal-not-change** — N/A for presence; nothing here mutates the song. Pass.
5. **Persist + survive reload** — Pass *by design*: presence is correctly ephemeral (the one thing that *should* be), and it degrades to the persistent roster. The fallback chain just needs to stop borrowing presence language.
6. **Structure beats freedom** — Partial. Presence-jump is a good single-tap navigation primitive and reduced-motion is honored; but the room offers no structured answer to "where is everyone," which is this law's whole point for presence on a 390px phone.

**Intended behavior ("who's here, where they are, ambient never surveillance"):** *who* = built and real; *where* = not built; *ambient-not-surveillance* = mostly right, undermined only by the viewer asymmetry and the over-claiming fallback label.

## 5. GAP vs WORLDCLASS BAR

- Who/where/what without surveillance — **who only** (½)
- ≤20Hz send + interpolate on receive — throttle exists (10Hz, `useGesture.ts:22`) but streams nowhere; no receive path, no interpolation — **seam only**
- Cap + "+N" — **yes** (`CollaboratorAvatarStack` maxVisible 3 + remainder)
- Presence on separate ephemeral channel from edits — **yes** (`presence:song:` vs `song:` channels)
- Ghost expiry + reconnect forgiveness — expiry delegated to Supabase leave events (**acceptable**); reconnect forgiveness **missing** (toast spam)
- Never show own cursor — N/A (no cursors); self is correctly flagged/filtered in counts — **ok**
- Stable warm color consistent across surfaces — **fail** (three hash inputs, two palettes)
- Mobile prefers section-occupancy over floating pointers — **not built** (the largest conceptual gap, and the codebase's touch-excluding cursor seam accidentally agrees with this priority)
- Normalized positions — the canvas-space conversion in `useGesture.ts:254-255` is correct and ready — **ready, unused**

## 6. UPGRADE RECOMMENDATIONS (ranked)

1. **[High impact] One person, one color — everywhere.** Single identity function keyed by `userId` (fall back to name only when no id exists), used by presence (`SongCanvasExperience.tsx:1128`), voice-card accents (`:889`), the roster hook (`useSongCollaborators.ts:48` — drop `inviteContext.getAvatarColor` for canvas surfaces), and the people layer (`:1199`). Felt benefit: "Sarah is always plum" — the songwriter learns collaborators as colors, and gold returns to meaning *the system* exclusively. Effort: small (half-day) — it is one function call standardized across ~5 sites, plus a check that credits/recap already agree.
2. **[High impact] Honest presence states in the header stack.** When the stack is fallback roster, change the aria/visual language to "3 people write here" (contribution, past tense) vs live "2 here now"; give *live* members full opacity + the dot, roster members ~70% opacity. Felt benefit: the room never claims company that isn't there — trust in the green dot becomes absolute, which is the entire currency of ambient presence. Effort: small (hours).
3. **[Deep — the mechanic's missing half] Section-occupancy presence, mobile-first.** Re-`track()` on the existing presence channel with `{ zone: "ideas"|"final", sectionLabel?: "Chorus" }`, derived from the viewport center / selected cluster, throttled to one update per ~3s and only on change (Presence merges tracked payloads — no new channel, no schema). Render: a tiny name-chip on the Ideas/Final zone tabs ("· Sarah") and, zoomed in, a 16px initialed dot pinned to the cluster header — never a floating pointer on touch. Upgrade `jumpToCollaborator` to prefer live occupancy over latest-card. Felt benefit: "Sarah is in the Chorus right now" — co-writers converge instead of colliding, and the room feels inhabited rather than merely counted. Effort: 2–3 days including expiry (treat payloads older than 30s as stale) and reduced-motion-safe chip transitions.
4. **[Deep] Desktop cursor layer (after #3).** Wire host → `CanvasStage.onCursorMove` → `channel.send` broadcast on the presence channel's topic (separate event name, not tracked state); extend `useGesture` to also emit on non-drag mouse moves (`useGesture.ts:171-184` currently drops hover); receive path lerps 100ms-apart samples toward targets (spring, ~120ms settle), renders name-tagged warm-color dots, expires ghosts at 5s, caps at 5 + "+N", never renders self. The canvas-space normalization is already correct. Felt benefit: writing sessions on laptop feel like sitting at one table. Effort: 3–4 days.
5. **[Quick win] Let viewers see the room.** Render the avatar stack (read-only, no gold Invite pill) in the viewer branch (`:1746`). Felt benefit: the person listening in sees who's with them — presence stops being one-way glass. Effort: <1 hour.
6. **[Quick win] Reconnect forgiveness.** Keep a `recentlyLeft` map (userId → leftAt); suppress the join toast for rejoins within 60s. Felt benefit: flaky Wi-Fi stops narrating itself; toasts return to meaning *arrival*. Effort: <1 hour.
7. **[Quick win] Match by userId, not name.** `presentNames` → `presentUserIds`; `jumpToCollaborator` matches `createdBy` first, name as fallback. Fixes the two-Sarahs glow and wrong-jump. Effort: 1–2 hours.
8. **[Quick win, copy] Guard the unnamed-profile case** so nobody ever sees "You joined the room" — fall back to "A collaborator joined the room." Effort: minutes.
9. **[Small feel] Give departures a breath.** Fade+scale the leaving avatar out over 250ms (`--cog-ease`) before the stack reflows; skip under reduced motion. Felt benefit: a goodbye instead of a glitch. Effort: 1–2 hours.
10. **[Small feel] Sort the share sheet by presence** — "Here now" people first under a tiny sage eyebrow, then the rest by role. Felt benefit: the sheet answers "who can I sing this to *right now*" at a glance. Effort: 1 hour.

**SINGLE HIGHEST-LEVERAGE MOVE:** Ship section-occupancy presence over the *existing* ephemeral channel (rec #3) — re-tracking a tiny `{zone, section}` payload and rendering named chips on the zone tabs turns the already-real "who's here" into the mechanic's promised "where they're working," the mobile-correct way, with no new infrastructure and no floating-cursor surveillance feel.

---

# 8 · Story / Scripture / Meaning Zone — PARTIAL (4.5/10)

> Scripture/meaning now has a real canvas creation path with a warm sage identity and a real structured picker one surface away — but canvas-born verses live only in this device's localStorage, carry no structured reference, and read like sticky notes rather than anchors.

# AUDIT — Story / Scripture / Meaning Zone

## 1. VERDICT

**PARTIAL — 4.5/10.** The stale brief's claim ("picker real, zero canvas path") is now half false: the canvas has a genuine "Scripture / meaning" creation path, a distinct sage visual identity, and scripture rows from Capture DO hydrate onto the board from `canvas_cards`. But the mechanic's heart is missing: a verse added on the canvas is free text saved to localStorage on one device, with no `scripture_ref`, no tap-through to the passage, no path into the memory graph, and no contemplative treatment beyond an icon swap. The "why" does not yet travel with the song — it travels with the phone. 4.5 because the bones (typed card, review queue, picker, edge fn, export exclusion) are real; the connective tissue is not.

## 2. HOW IT ACTUALLY BEHAVES

**Real, on the canvas:**
- `AddPartSheet.tsx:27-32,124-141` — a "Scripture / meaning" quick entry (BookOpen icon) in the second row of the Add-a-part sheet. Picking it calls `addPart` (`SongCanvasExperience.tsx:761-794`) which stamps a `type: "scripture"` card with `section: "Meaning"`, uuid id (`stampNewCard`, line 706-724, `crypto.randomUUID()` — Law 5's no-Date.now() ids honored), then opens `CardEditSheet`.
- `CardEditSheet.tsx:39-41,152-171` — scripture-aware editor: label "Verse & why it anchors the song", placeholder "Psalm 46:10 — Be still before the second verse turns upward." Escape/backdrop **saves** rather than discards (lines 63-75) — genuinely non-destructive. But it is one free-text textarea; nothing parses the reference.
- `NoteCard.tsx:12-16,43,60-64` — the scripture face: BookOpen icon, "✦ " prefix on the section eyebrow, sage tone (`glorySpectrum.ts:66` — `scripture: GLORY.sage`), ruled-paper texture, 4-line clamp that expands when selected (a partial reveal-on-tap).
- `SongCanvasExperience.tsx:699-705` — scripture cards stamp `contributionType: "meaning"`, so a verse-bringer is credited in the ledger.
- `SongCanvasExperience.tsx:1516-1546` — a collaborator's scripture card enters the owner review queue as a **"Theology note"** — Law 4 (proposal-not-change) genuinely honored for this mechanic.

**Real, but only via Capture (not the canvas):**
- `ScripturePicker.tsx` is a near-worldclass structured picker: `parseReference` with a book table, 3 translations persisted to a preference key, verse-range preselect, debounced `fetchPassage` (`integrations/cog/scripture.ts`, module-level cache) against the real `supabase/functions/fetch-scripture` edge fn (verified present). It is wired ONLY into Capture (`CaptureSheet.tsx:103,168-169`) and `ReviewSheet.tsx:398-415` (spoken references get canonical label + fetched verse text before commit).
- `commit-take` writes `canvas_cards` rows with `kind: "scripture"`; `canvasBoardSource.ts:139-145,222-253` hydrates them as `type: "scripture"` board cards, and edits to those hydrated `db-card-*` rows write through `updateCanvasCard` + `setCardSection` (`SongCanvasExperience.tsx:1391-1398`). So a verse spoken into Capture genuinely appears in every collaborator's room.

**Local/mocked:**
- A scripture card created **on the canvas** (`addPart`/`addCard`) is never written to the server — there is no `createCanvasCard` anywhere in `integrations/cog/canvas.ts`; the board persists via `writeBoard` → `localStorage` (`canvasBoardSource.ts:131-137`). The status pill then says **"Saved to this song."** (`SongCanvasExperience.tsx:791`) — a false promise across devices.
- No `scripture_ref` on canvas cards: `CanvasBoardCard` (`canvasTypes.ts:110-155`) and the `canvas_cards` schema (`canvas.ts:12-33`) have no reference field. `idea_captures.scripture_ref` exists and feeds the memory graph (`memory.ts:95,125`, `obsidianVault.ts`), but canvas scripture cards are invisible to that loop.
- No scripture actions: the overflow sheet (`SongCanvasExperience.tsx:2197-2260`) offers Listen Path / merge / compare — no "Read the passage", no translation, no ref edit.

**Exports:** the song's only outward exports — `SongSheetPage.tsx` print/PDF (line 479-545), ChordPro copy (line 225), and share text — read sheet sections from `song_lyrics`, never canvas cards. Scripture is excluded **by architecture**, which holds today but is an accident, not a rule; the Obsidian memory export deliberately includes scripture (private vault — correct by design).

## 3. STRESS-TEST FINDINGS

- **[Blocker] Canvas-born verses don't survive a second device or collaborator.** Anchor "Isaiah 43" to the chorus on your phone; your co-writer's room never shows it, and neither does your iPad. Reload on the same device works (localStorage), which makes the loss feel random and betraying when it finally surfaces. (`addPart` → `writeBoard`, no server write.)
- **[Major] The reference is dead text.** Typing "Psalm 46:10" into `CardEditSheet` fetches nothing, canonicalizes nothing, links nothing — while the same user saw Capture magically attach the full verse. Inconsistent magic across surfaces teaches distrust of both.
- **[Major] No memory loop.** The Zettelkasten graph clusters by `idea_captures.scripture_ref`; a verse anchored on the canvas never joins "Scripture you lean on" (`obsidianVault.ts:544`). The long-term promise — your verses connecting across songs — silently excludes the canvas.
- **[Minor] Identical titles pile up.** Every canvas scripture card defaults to title "Scripture note" (`addPart` title map, line 774-775); three verses in a room become three indistinguishable review-queue entries and recap lines.
- **[Minor] ✦ is read by screen readers.** The star lives inside the eyebrow text (`NoteCard.tsx:43`), so SR users hear a Unicode name before "Meaning". Wrap it `aria-hidden`.
- **[Minor] Listen Path accepts scripture cards** (non-audio dwell in `useListenPath`, lines 14-19) — actually a quiet accidental grace (the verse surfaces mid-listen), but nothing renders it specially; worth embracing deliberately rather than by fallthrough.
- **[Good] Reduced motion, touch targets, viewer role all pass:** global kill-switch in `index.css:390-397` covers the sheets; card action buttons are 44px (`CanvasCard.tsx:83-88`); `addPart` gates on `isViewer`.

## 4. GAP vs VISION (the Six Laws)

1. **Non-destructive — PASS.** Edit sheet saves on dismiss; dismissed review items get Undo (`handleDismissReview`).
2. **Calm — PASS.** Sage tone, no badges, quiet "Saved to this song." (though that copy currently overclaims).
3. **Faith-first sanctuary — HALF.** Sage + ✦ + BookOpen is a real identity, but the verse body is 12.5px Inter on the same ruled paper as a to-do note. A verse should be set like a verse — this is the mechanic where Playfair should appear on a card body and doesn't.
4. **Proposal-not-change — PASS.** Collaborator scripture enters the owner queue as "Theology note".
5. **Persist + survive reload — FAIL for canvas-created cards.** localStorage-as-truth, exactly what the law forbids. (Capture-path scripture passes.)
6. **Structure beats freedom — HALF.** Bottom sheets and tap-alternatives exist, but the structured picker — the mechanic's own structure — is one import away and unused here.

**Meaning Zone question:** there is no dedicated spatial zone; scripture cards sit in the Ideas column, clustering only at ≥5 per section (`clusterFlags`, `CLUSTER_THRESHOLD = 5`). Verdict: cards-among-ideas is the **right call** — the why belongs beside the what, and a separate region would exile it off the 390px screen. What's missing isn't a zone; it's *gravity* — the verse card should feel weightier than its neighbors, and the song root should surface the anchor.

## 5. GAP vs WORLDCLASS BAR

- **Context out of the eye's path** — PARTIAL. 4-line clamp → expand on select is the right instinct; but a long reflection still balloons the card inline instead of opening a reading surface.
- **Quiet inline marker on the linked span** — MISSING. No link between a verse and the lyric section it anchors (no `sectionId`/edge; `section: "Meaning"` is a label, not a bond).
- **Structured verse picker** — EXISTS, UNWIRED here. The single most finished asset in the mechanic is not invited to it.
- **Spacious full-screen editor for reflection** — MISSING. `CardEditSheet` is a utility sheet shared with chords.
- **Tap-through to passage** — MISSING (no ref, no action).
- **Calm/contemplative** — PARTIAL (palette yes, typography and rhythm no).
- **Excluded from exports** — PASS today, by architecture rather than intent.

## 6. UPGRADE RECOMMENDATIONS

1. **[High impact] Persist canvas-created cards to `canvas_cards`.** Add a `createCanvasCard` insert (table + RLS already exist; `commit-take` proves the shape) and call it from `stampNewCard` consumers via the existing `syncServer` chain, mapping the returned uuid to a `db-card-*` id. User-felt: the verse you anchored at church is on your co-writer's board by the time they open it — "Saved to this song." becomes true. This fixes the Blocker for every card type, not just scripture. *Effort: medium (host + one integration fn; Lovable owns any RLS gap).*
2. **[High impact] Wire ScripturePicker into the canvas path.** When `AddPartSheet` picks "Scripture / meaning", open the picker first (it already returns `(label, text)`); prefill `CardEditSheet` title with the canonical reference and body with the chosen verses, leaving a "why this verse" line for the writer. Feel: type "psa 46" → the passage breathes in below → tap verses → they're on the card, exactly the grace Capture users already get. *Effort: small-medium (composition only; both components exist).*
3. **[High impact] Store `scripture_ref` on the card and feed the memory graph.** Add `scriptureRef?: string` to `CanvasBoardCard` + a `scripture_ref` column ask to Lovable for `canvas_cards`; include canvas refs in `buildGraph`'s scripture clusters. User-felt: "Scripture you lean on" finally sees the verses you anchored where you actually write. *Effort: medium; schema is Lovable's lane — file it in the canvas contract doc.*
4. **[Quick win] Let the verse look like a verse.** In `NoteCard` when `isScripture`: render the reference line in Playfair (`var(--font-display)`, ~13.5px italic), give the card `GLORY.sage.bg` as a whisper wash and a 2px left sage rail, and drop the ruled-paper texture (a verse is not a rough note). Wrap ✦ in `aria-hidden`. User-felt: your eye finds the anchor across the whole board without reading a word. *Effort: tiny.*
5. **[Quick win] Default titles that carry the reference.** On save, if the body starts with something `parseReference` accepts, set the title to the canonical ref ("Psalm 46:10") instead of "Scripture note". Three verses stop being triplets in the review queue. *Effort: tiny (parseReference is pure, already in `src/lib/scripture/`).*
6. **[Deep] A reading surface: "Read the passage."** Overflow action on scripture cards → full-screen sheet: reference in Playfair, verse text at reading size with generous leading, translation toggle (picker's persisted preference), the writer's "why" beneath a hairline. This is the tap-through and the contemplative moment in one. *Effort: medium-large.*
7. **[Quick win] Embrace scripture in the Listen Path.** During the non-audio dwell, show the verse text in the ListenPathBar caption ("✦ Psalm 46:10 — Be still…"). The why literally interleaves with the listens — already half-happening by fallthrough; make it felt. *Effort: tiny.*
8. **[Deep] Anchor bond: link a verse to a section.** A "This anchors…" action that draws a quiet sage thread (`CanvasBranchConnectors` already draws edges) from the scripture card to a section's cards, with a small ✦ marker on the anchored section. This is the "inline marker on the linked span" the bar asks for, translated to spatial canvas language. *Effort: large; needs the edge model.*

**SINGLE HIGHEST-LEVERAGE MOVE:** Wire the already-built ScripturePicker into `AddPartSheet`'s scripture path **and** persist the resulting card to `canvas_cards` (recs 1+2 as one motion) — in one stroke the verse becomes structured, canonical, fetched, and shared with every co-writer, converting this mechanic from a private sticky note into the faith-first spine the canvas was named for.

