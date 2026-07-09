# CANVAS COLLABORATION HANDOFF

**From:** Canvas Rescue (D-lane consolidation + world-class pass) · 2026-07-08
**For:** the next agent building canvas collaboration
**Companion contracts:** `docs/CANVAS-RENDER-CONTRACT.md` (D1), `docs/CANVAS-FEATURES-CONTRACT.md` (D2), `docs/CANVAS-COLLAB-CONTRACT.md` (D3), `docs/ROLE-CONTRACT.md` (E1)

---

## 1. What changed (this pass)

This pass merged the stranded `d1/canvas-step1` render work (Steps 2–9: typed
card system, geometry single-source, board-source seam, semantic nav, drag
visuals, clusters, reduced-motion gate) into main and then ran a deep UX
rescue on top. A six-slice audit scored the canvas 23/50; the fixes below
raise it to ~41/50 (scorecard in §5).

### Blockers fixed
1. **Action-row buttons now respond to real taps.** `setPointerCapture` on the
   card was retargeting `pointerup` — and therefore the `click` — away from
   every button inside a card (`→ Final`, `Edit`, `Layers`, `⋯`). Synthetic
   test events worked; real fingers didn't. A press that starts on a `button`
   no longer initiates drag/capture (`CanvasCard.onPointerDown`).
2. **"Hum a melody — tap to record" records.** The first-run chip opens the
   real `RecordingSheet` instead of creating a silent text card with a fake
   waveform.
3. **Pinch integrity.** A second finger during a card drag aborts the drag
   (spring-back, no commit) and both fingers become a viewport pinch; a zoom
   attempt can never rearrange the song (`useGesture` pointer adoption +
   `CanvasCard` second-pointer guard).
4. **Compare A vs B is reachable.** Partner matching is section-FAMILY based
   ("Chorus 1"/"Chorus 2" compare; exact section still preferred), and the ⋯
   sheet offers "Write another take to compare" when no partner exists.
5. **`moveToIdeas` never deletes.** Real provenance via `sourceCardId` (the
   legacy `-final` id suffix is still honored); a sourceless final card is
   PATCHED back to the Ideas tree with an Undo toast — the one hard-destroy in
   a never-delete system is gone.
6. **Scripture / meaning / note creation exists** (AddPartSheet), with a
   kind-aware editor (scripture placeholder; chord cards get Progression +
   Key & BPM fields that persist to `card.meta`).
7. **One z-scale** (`src/lib/canvas/zLayers.ts`): every modal sheet now sits at
   799/800 above the z-500 tab bar (five sheets used to render UNDER it, CTAs
   untappable). Persistent bars 520–540, coach marks 1000.
8. **Record button is never buried.** A restored listen path collapses to a
   pill; merge/arrange/listen swap one bottom slot instead of stacking.
9. **Spoofable `?role=viewer` gate replaced** by E1 `useCapabilities`
   (server-role). The URL param remains honored as a *restrict-only* hint;
   it can never grant edit. The `demo` room is a sandbox and stays fully
   usable for authenticated non-members.

### Feel + mobile
- Board shrank 2400→1600 (divider 800): "Fit" genuinely fits on a phone
  (MIN_ZOOM 0.25), the dead middle band is gone, and old saved boards are
  position-migrated on load (`canvasBoardSource.normalizeCard`).
- Edge auto-pan during card drag (drag-to-Final is physically possible at
  390px); drops clamp to board bounds (no stranded cards).
- Touch inertia on pan release; trackpad semantics fixed (plain scroll pans,
  ctrl/meta or pinch zooms, magnitude-proportional).
- Fly-tos (`animateTo`/`fitTo`) clamp through the same pan bounds as touch.
- 44px touch targets on the card action row and bar controls.
- Column geometry: `COLUMN_GAP` 208 (> real card height — no shingling),
  max 3 sub-columns per zone (ideas can never wrap across the divider),
  zone labels derive from the root card box.
- Mount framing composes the opening shot around root + Ideas zone.
- Header rescue at 390px: serif title breathes, chip strip removed (tab bar
  owns navigation), rows wrap so "Review N" is never pushed off-screen.

### Honesty + tokens
- Waveforms are ALWAYS system gold; chord chips are the locked gold-pale
  signature; creator identity lives in stripe/dot/name only.
- Aurora palette is warm-earth (clay/sage/plum/rose/moss) — no corporate
  blue, and no collaborator hashes to system gold (a gold ring always means
  the system: merge keeper, now-playing).
- No fake latency (compare's 420ms "Saving direction..." theater removed), no
  dead CTAs (recap's "Review changes" opens the real review queue or reads
  "Got it"), no untappable "Undo?" copy (undo lives in toasts), "saved" copy
  says *on this device* while persistence is local.
- Dimmed "kept" cards are tappable with a "Bring back" restore.
- Playing cards wear a gold now-sounding ring; the board follows listen-path
  playback; **Play final** plays the arrangement in one tap.
- Metronome hard-stops when recording starts (never-bleed invariant).
- Canvas audio resumes mid-take instead of restarting at 0:00.
- A fresh capture auto-expands its collapsed cluster before the fly-to.
- Gold pending-review dot on co-writers' unreviewed cards (adornment slot).

---

## 2. Canvas data model (what your rows must map to)

`CanvasBoardCard` (`src/lib/canvas/canvasTypes.ts`) is the one board type.
New collaboration-ready fields — all optional, already stamped by every
client-side create/edit path (UUID ids via `crypto.randomUUID()`):

| Field | Stamped today | Maps to |
|---|---|---|
| `createdBy` | auth user id when a session exists | `canvas_cards.created_by` |
| `createdByName` | (reserved) display name at creation | resolve via roster |
| `updatedBy` | on edit | audit column (Lovable ask) |
| `createdAt` / `updatedAt` / `lastActivityAt` | ISO strings | `created_at` / `updated_at` |
| `commentCount` | never (no comment surface yet) | future `card_comments` count |
| `reviewState` | `"none"` on create | owner review machine (`none/pending/kept/approved/dismissed`) |
| `contributionType` | by card type (`lyrics/melody/chords/arrangement/meaning/feedback`) | credits ledger |
| `sourceCardId` | on promote-to-Final | provenance link (replaces `-final` suffix) |
| `mergedFrom` | on merge (D2) | `canvas_link_cards` provenance |

`contributor` (display name) remains the render field; **never** hash colors
from names once ids flow — use `getCreatorColor(userId)` and the roster's
`avatar_color` first.

## 3. Where collaboration attaches

1. **Board persistence** — `src/lib/canvas/canvasBoardSource.ts` is the ONE
   seam (`initialBoard`/`writeBoard`/`hydrateBoard`/`clusterFlags`). The
   server spine already exists write-only: `canvas_cards` + six RPCs in
   `src/integrations/cog/canvas.ts` (`canvas_move_card`, `canvas_bulk_move`,
   `canvas_group_cards`, `canvas_link_cards`, `canvas_promote_to_final`,
   `canvas_set_section`). Extend `hydrateBoard` to map `listCanvasCards`
   rows (not just voice memos) and route `CanvasFeatureMutations` (the
   `featureMutations` useMemo in `SongCanvasExperience`) through the RPCs.
   Demote localStorage to an offline cache; exclude server-owned rows from
   `writeBoard` so deleted rows stop resurrecting.
2. **Mutation surface** — `CanvasFeatureMutations`
   (`src/lib/canvas/features/mutations.ts`). All five D2 hooks write ONLY
   through it; implement it over the store/RPCs and no hook changes.
3. **Per-card markers** — `CanvasStage`'s `cardAdornment` slot (already used
   for the gold pending-review dot). Comment badges belong here.
4. **Presence** — `useSongPresence` is live; presence-jump and join toasts
   are wired in the host.
5. **Review queue** — `OwnerReviewQueueSheet` + `pendingReview` memo in the
   host. It keys off `contributor !== currentUserName` today; switch to
   `createdBy !== profile.user_id` once hydration carries ids.
6. **Line suggestions** — `src/lib/canvas/lineSuggestions.ts` is a
   device-local outbox. It needs `song_suggestions` (Lovable ask, filed in
   `docs/CANVAS-COLLAB-CONTRACT.md`) or an interim shared row so a
   suggestion actually reaches the owner's device.
7. **Recap** — `useCanvasRecap` anchors on device-local last-seen; fall back
   to server `last_seen_at` (already written by `markSongSeen`, never read).

## 4. Remaining collaboration work (in order)

> **Update (same day, follow-up pass):** items 1, 2, and 5 are now DONE:
> - `hydrateBoard` (canvasBoardSource) reads BOTH `voice_memos` and
>   `canvas_cards` (Capture-mode ideas now appear on the board), returning
>   per-source `memosOk/cardsOk` flags; the host merge is upsert-and-prune
>   (server truth for content/processing, local truth for board state; prunes
>   only when a source responded; skips the server mirror of a memo uploaded
>   this session).
> - Server-owned card ids are `db-card-<uuid>` / `db-voice-<uuid>` (EXACT
>   match via `isServerCardId`/`serverCardId`). They persist to localStorage
>   like everything else (offline reads — e.g. the credits ledger — depend on
>   it); the hydrate merge prunes rows the server stopped returning, so
>   deleted rows can't resurrect. Server rows use MOVE semantics on
>   promote/return (`movesInPlace`), so no derived ghost ids are ever minted.
>   Board-state truth: server wins tree/section/x/y for `db-card-*` rows
>   unless the card is DIRTY (a 15s grace window after this device's own
>   write, tracked in `dirtyServerCards`; writes serialize per card id).
> - Write-through RPCs: drag → `canvas_move_card`, arrangement slot swaps →
>   `canvas_bulk_move`, edits → `updateCanvasCard` + `canvas_set_section`,
>   promote/return → `canvas_promote_to_final` / `canvas_set_section` with
>   MOVE semantics for server rows (`movesInPlace` in useFinalArrangement) —
>   all fire-and-forget non-fatal (`syncServer`).
> - Identity: `createdBy` + roster resolver ends the literal-"You";
>   `isMine()` compares user ids first; unresolved contributors render as
>   nothing (never fabricated).
> - Recap: `getSongLastSeen` reads the server anchor BEFORE `markSongSeen`
>   advances it — the new-device recap works.

1. ~~Render `canvas_cards` rows + write through the RPCs~~ **DONE** (above).
   **Also DONE (engine-audit build pass):** the CREATE spine —
   `createCanvasCard` insert + local→server id swap (`persistNewCard` in the
   host) makes canvas-born cards and merged sections room-truth, local-first
   with graceful fallback.
2. ~~Identity resolver~~ **DONE** (above); `canvasLoader.ts` is now unused
   legacy — delete when convenient. Colors now hash the USER ID on every
   canvas surface (presence/self/roster/cards) — one person, one color.
3. `song_suggestions` table → **interim SHIPPED**: suggestions travel as
   `canvas_cards` CARRIER ROWS (`section_kind: "line_suggestion"`, JSON
   payload, `parent_card_id` = target; hydrate routes them into the review
   lane; deciding deletes the row). The proper table remains the Lovable ask —
   migrate the carrier when it lands (and add `review_state`/`status` columns
   so owner decisions cross devices; today "Not this one" holds via local
   tombstones only).
4. Comments on cards (populate `commentCount`, adornment badge — visual
   grammar reserved in CANVAS_VISUAL_HANDOFF.md §4).
5. ~~Server recap anchor~~ **DONE**; entity deep-links from recap rows remain.
6. Conflict-safe editing (RPCs are last-write-wins today; version stamps
   exist on the type). Note the interim merge rule: local x/y/tree win over
   the server on hydrate for cards this device holds — a failed RPC write
   self-heals only after a reload; acceptable until a store lands.
7. Perf follow-up (documented, not blocking): split the viewport context
   value/functions so gesture-end doesn't re-render every card; drive the
   divider glow via ref/class instead of stage state.

**Known pre-existing failures (NOT this lane, present on main baseline):**
`activity-feed` route test, `codex-mobile-render` (catalog: PracticePlayerProvider;
phone verify: code-digit labels), `cog-phone-otp-send`, `credits-route`,
`seo` onboarding routes, `song-workspace-hub` ×2. Baseline was 13; this pass
fixed 5 of them (canvas-path ones); 8 remain for their owning lanes.

## 5. Before / after scorecard

| Dimension | Before | After | What moved it |
|---|---|---|---|
| First impression | 3 | 4.5 | framed opening shot, no clipped root, one coach mark, calm header |
| Mobile usability | 1 | 4 | z-scale unified, 44px targets, wrap header, one bottom surface, **buttons actually tappable** |
| Pan / zoom / drag | 2 | 4 | pinch integrity, inertia, edge auto-pan, trackpad semantics, clamped fly-tos, drop clamp |
| Visual hierarchy | 3 | 4.5 | gold reserved for system, warm identity palette, no shingling, review dots, playing ring |
| Songwriting usefulness | 1 | 4.5 | hum records, scripture path, compare reachable + variant path, chord key/BPM, restore |
| Audio capture | 2 | 4 | real recorder from first-run, resume-not-restart, metronome never-bleed, queue reconciliation |
| Arrangement clarity | 2 | 4.5 | no silent delete + provenance, Play Final, board follows playback, undo everywhere |
| Calmness / warmth | 3 | 4.5 | no fake latency, honest copy, collapsed path pill, quiet review dot |
| Performance | 3 | 3.5 | rAF engine intact; context-churn follow-up documented |
| Collab readiness | 1 | 3 | full metadata + UUIDs + capability gate; server spine still unread (your charter) |
| **Total** | **23/50** | **~41/50** | |

*Verified: `tsc` clean (app + tests), `eslint` clean on canvas paths, 650/658
tests passing (8 pre-existing failures, all in other lanes' surfaces),
`npm run build` passes, and a headless-Chromium songwriter journey at 390×844
(empty room → write lyric → dismiss-keeps-words → promote to Final with
provenance → scripture card → metadata stamps) passes 6/6.*
