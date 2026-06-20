# C6 — CLAUDE: Activity Feed ("What changed since you left")
## Cluster 7 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. This is **calm intelligence**, the opposite of a notification feed.
> Mobile-first; tokens only; seam only; meet `MOBILE-UX-BENCHMARK.md`. Songwriter truth:
> *come back after three days and feel, in one calm glance, exactly what your co-writers
> touched — no anxiety, no red badges.*

## YOUR ROLE
Claude: all `src/` UI. Seam only (`cog/activity.ts`); no schema/auth/tests.
`docs/BUILD-PATHWAY.md`.

## CONTEXT
L7 provides `getSinceYouLeft(songId)` (deduped, summarized), `listActivity(songId)`,
`markSeen(songId)`. Spec + image: Product Vision 08 (Calm Activity Intelligence),
Feature 12 (What Changed — Smart Recap), `download (20).webp` ("What changed since you
left": Sarah added voice memo · Parker edited Verse 2 · Caleb suggested a chord change ·
2 comments need review). No component exists yet — build it.

## OBJECTIVE
A glanceable "since you left" recap (the hero) + a calm full timeline — summarized,
per-contributor color, gentle "needs review" prompts, never noisy.

## PHASE 0 — SPEC
Read Vision 08 + Feature 12 + `download (20).webp`. The one moment: *one calm card tells
me what changed, in plain language, colored by who did it — and I feel caught up.*

## PHASE 2 — AUDIT (7 lenses)
There's no component — design from the seam + mockup. Plan the summarized recap vs the
full timeline; contributor color reuse (same colors as C5/canvas); calm states; a11y.

## PHASE 4 — BUILD
1. **"Since you left" recap (hero):** the deduped digest from `getSinceYouLeft` as a calm
   card — plain-language lines ("Sarah added 2 harmony memos"), each tinted by that
   contributor's color. One glance = caught up. Appears in the Room (links from C2's peek).
2. **Full timeline:** `listActivity` grouped by day/person; summarized (not raw firehose);
   tap an item to jump to the thing that changed.
3. **"Needs review" prompts:** pending suggestions/comments surfaced gently — a quiet
   count, gold not red, that routes to the review.
4. **Mark-seen:** call `markSeen` when the recap is viewed so it resets calmly next time.
5. **Calm + faith-tone:** no red badges, no spam, reverent pacing; designed empty state
   ("All quiet — nothing's changed since your last visit").
6. Mobile-first: 44×44, reduced-motion, tokens, motion system, no layout shift.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: fresh changes recap, all-caught-up empty,
needs-review, offline. Evidence + a mobile re-drive of the recap card.

## ACCEPTANCE CRITERIA
- [ ] "Since you left" shows the **summarized** digest (not raw events), color-coded by contributor.
- [ ] Full timeline grouped + tappable to the changed item; mark-seen resets the recap.
- [ ] "Needs review" is calm (gold, counted, no red badge); empty state designed.
- [ ] Meets the mobile benchmark; ≤250 lines/component; `tsc`+`build`+tests green.

## DEPENDENCIES
- **L7** (`getSinceYouLeft`/`listActivity`/`markSeen`) · contributor colors shared with
  **C5**. Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/activity-feed` → merge → delete.
Calm is the spec — if it ever feels like a notification feed, it's wrong.

## REFERENCES
- `src/integrations/cog/activity.ts`; Vision 08 + Feature 12 PDFs + `download (20).webp`
- `docs/prompts/L7-…activity-versions.md`, `C2-…song-workspace-room.md`, `C5-…collaboration-ui.md`
- `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §1/§11
