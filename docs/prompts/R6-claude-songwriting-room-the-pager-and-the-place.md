# R6 — Songwriting Room: The Pager, The Place, and Everything Rendered Twice
## Feed structure, losing your place, and the hidden half of the room

**Owner:** Claude (frontend). Backend half shipped this pass (§5).
**Goal of the room (unchanged):** capture an idea and hear it back inside the song — instantly.
**Rule:** if a thing can be one thing, it is one thing.

R1 architecture → R2 feature-by-feature → R3 last mile → R4 audio → R5 realtime/retrieval.
**R6 is the feed's own structure** — the two-page pager that every other feature sits inside.

---

## 1. Both pages are always mounted, so the song renders twice — P0

`CanvasFeed.tsx:229-347`. The pager is one 200%-wide flex row translated by 50%:

```tsx
<div style={{ width: "200%", transform: page === "ideas" ? "translateX(0)" : "translateX(-50%)" }}>
  <section aria-label="Ideas"> …every idea card… </section>
  <section aria-label="The final song"> <FinalListenPage cards={finalCards} …/> </section>
</div>
```

The transform-based pager is the right choice — it's GPU-composited and gives the continuous
drag-follow feel a tab swap can't. The defect is that **nothing is ever unmounted or skipped**:

- Every Final card renders, animates, and re-renders on every parent commit while the user is on
  Ideas — and vice versa. Combined with R2's uncapped card list, a 60-card song mounts and diffs
  ~60 cards to show ~30.
- Both `<section>`s are live scroll containers with `overflow-y: auto`, so the browser maintains two
  scroll areas and two paint layers permanently.
- Every parent state change — and after R5's delta wiring there will be *more* of them, just cheaper
  — pays for the hidden page too.

**Fix (keep the pager, pay for one page):**
1. `content-visibility: auto` + `contain-intrinsic-size` on the **inactive** section. One CSS line,
   browser skips layout/paint for the off-screen half, transform animation still smooth.
2. Cap the entrance-animation cascade at the first ~12 cards (R2) — a card that mounts off-screen
   should never animate at all.
3. Only then consider virtualization. Most songs won't need it; don't add a windowing library to
   solve a problem two CSS properties solve.

## 2. The hidden page is reachable by keyboard and screen reader — P0 (a11y)

Same block. The inactive section is visually translated off-screen but is **fully in the accessibility
tree and the tab order**. `rg "inert|tabpanel" CanvasFeed.tsx` → **0 hits**.

So on the Ideas page, a keyboard user tabs past the last idea and lands *inside the Final song*,
invisibly. A screen-reader user swipes into content that isn't on screen. The tabs are also
`role="tab"` with `aria-selected`, but there are **no `role="tabpanel"` elements and no
`aria-controls`** — the tablist points at nothing.

**Fix (four attributes, no restructure):**
- `role="tabpanel"`, `id`, and `aria-labelledby` on each section; `aria-controls` + `id` on each tab.
- `inert` on the inactive section (React 19 supports it as a prop; otherwise set via ref). `inert`
  removes it from tab order *and* the a11y tree in one attribute — it is exactly this problem's tool.
- Move focus to the newly-shown panel on tab change so keyboard flow follows the eye.

## 3. You lose your place, constantly — P1

`rg "scrollTo|scrollRestoration" src/components/canvas` → two `scrollIntoView` calls, **no scroll
position persistence anywhere**.

Both feed sections are their own scroll containers, and every module (`/song/:id/lyrics`, `/voice`,
`/notes`, versions, activity) is a **route**, not a sheet. So:

> Scroll 40 cards down → tap a card's "Open in lyrics" → back → **top of the feed**. Find your place
> again. Every time.

For a writer working the bridge of a long song, this is the most frequently-felt friction in the
room, and it's invisible in any short test.

**Fix:** one `useRef<Record<"ideas"|"final", number>>` per room, written on scroll (passive listener,
rAF-throttled, no state), restored on mount and on page switch. Persist to `sessionStorage` keyed by
`songId:page` so a route round-trip restores too. ~25 lines, no library.

Related: when the user returns from a module, the card they acted on should be the anchor. If a
`?card=<id>` param is present, restore to that card instead of the raw offset and give it one gold
settle pulse. That single touch makes the room feel like a *place* rather than a list that resets.

## 4. Two swipe systems share one surface — P2

`CanvasFeed` owns a direction-locked pointer pager (`:84-135`) and `SwipePromoteRow` owns a
per-card horizontal swipe-to-promote (`:36-85`). Both are well built — the pager locks axis, the row
uses `touch-action: pan-y` and DOM-ref drag with zero re-renders — and they're deconflicted by
convention: *"swipe-right is FREE on the Ideas page: the pager only uses leftward swipes."*

That convention is undocumented in the UI and load-bearing. A user who swipes a card right-then-left
mid-gesture, or starts a promote and drifts, gets an ambiguous result. And on the Final page the
convention inverts with nothing enforcing it.

**Simplify:** the pager should ignore any pointer sequence that began on a `[data-feed-card]` with an
active row drag — make the deconfliction explicit (a shared `gestureOwner` ref, claim/release, the
same pattern as R4's audio bus) rather than geometric luck. One owner per gesture, by construction.

## 5. Shipped this pass by Lovable

**`song_room_search(song_id, q, limit)`** — membership-gated find across card title, body and section
label, ranked (title-prefix > title-contains > body-prefix > body-contains > section), capped at 100.
Terms under 2 chars return empty; filter locally for those.

**`song_section_summary(song_id)`** — the section vocabulary this song actually uses, with per-section
card counts and last activity, split by tree. This is the data source for the section filter chips,
and it also *quantifies* R2's free-text fragmentation: if the summary returns both `verse1` and
`Verse 1`, the chips will show it plainly and the normalization fix pays for itself immediately.

```ts
import { searchSongRoom, getSongSectionSummary } from "@/integrations/cog/room";
```

Together with R5's find-field spec: type → local filter over loaded cards for instant feedback, and in
parallel `searchSongRoom` for anything not loaded, merged by id. The user never learns there are two
sources.

Note: `pg_trgm` is not installed on this project, so search is `ILIKE` + rank arithmetic rather than
trigram similarity. At song scale (hundreds of cards, partitioned by `song_id`) this is the correct
trade — no fuzzy matching, but no extension dependency and no index bloat either.

## 6. Build order

1. §2 `inert` + tabpanel roles — four attributes, fixes a real a11y bug.
2. §1 `content-visibility` on the inactive page + cascade cap.
3. §3 scroll memory + `?card=` anchor — the biggest felt win.
4. §4 explicit gesture ownership.
5. §5 wire find + section chips.

## 7. Definition of done

- Tab from the last Ideas card: focus leaves the feed, never enters Final.
- React profiler while typing on Ideas: zero Final card commits.
- Scroll 40 cards, open lyrics, come back: same position, acted-on card pulsing.
- Swipe a card right and drift left mid-gesture: the card completes or cancels; the pager never moves.
- Section chips render the song's real vocabulary, and any duplicate casing is visible at a glance.
