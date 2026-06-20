# C8 — CLAUDE: Credits UI (Contribution Ledger + Export)
## Cluster 9 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. This screen honors people. It should feel dignified and warm —
> like the liner notes of a record. Mobile-first; tokens only; seam only; meet
> `MOBILE-UX-BENCHMARK.md`. Songwriter truth: *seeing my name next to the bridge I wrote
> feels like being seen.*

## YOUR ROLE
Claude: all `src/` UI. Seam only (`cog/ledger.ts`); no schema/auth/tests.
`docs/BUILD-PATHWAY.md`.

## CONTEXT
L8 provides `listCredits`, `upsertContribution`, `setSplit`, `exportCredits`. Spec +
image: Product Vision 10 (Contribution Credits Remembered), Feature 13 (Credits Review),
`download (21).webp` (each contributor with avatar, role, contribution chips, and an
"Export credits" button). Contributor colors are shared with C5/C6 (same person = same color).

## OBJECTIVE
A dignified, glanceable credits screen: every contributor with their color, role, and the
specific things they shaped — with one-tap export, and (if used) clear splits.

## PHASE 0 — SPEC
Read Vision 10 + Feature 13 + `download (21).webp`. The one moment: *I see everyone who
touched this song and exactly what they brought — and I can export it as a split sheet.*

## PHASE 4 — BUILD
1. **Credits list:** each contributor row — avatar + **color dot**, name, role, and
   **contribution chips** (Lyrics · Voice memo · Bridge idea · Chord suggestion · Review…).
   Warm, liner-notes feel; serif touches; calm.
2. **Owner curation:** Owner can add/edit/re-attribute a contribution (calls seam; backend
   owner-gates). Non-owners see read-only.
3. **Splits (optional):** if splits are set, show each contributor's % cleanly and the
   total; an Owner editor that enforces 100% (reflecting L8 validation). Acknowledgment-only
   mode when no splits.
4. **Export credits:** prominent gold "Export credits" → `exportCredits` → download/share
   the split-sheet PDF (and offer CSV). Clear success state.
5. **Empty/solo state:** a brand-new solo song shows the writer with grace ("Just you so
   far — every idea here is yours").
6. Mobile-first: 44×44, reduced-motion, tokens, calm motion, no layout shift.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: view credits, owner edit, set split (100%),
export, solo empty. Evidence + a mobile re-drive of the credits screen.

## ACCEPTANCE CRITERIA
- [ ] Each contributor shows color + role + specific contribution chips (matches mockup).
- [ ] Owner curation via seam (read-only for others); contributor color consistent with C5/C6.
- [ ] Splits (when used) display cleanly + total 100%; export downloads a split-sheet PDF.
- [ ] Solo/empty state designed; meets the mobile benchmark; ≤250 lines/component.
- [ ] `tsc`+`build`+tests green; 7-lens pass.

## DEPENDENCIES
- **L8** (`ledger.ts`: list/upsert/setSplit/export) · contributor colors shared with **C5/C6**.
  Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/credits-ui` → merge → delete.
This screen is about dignity — never make a contribution feel like a database row.

## REFERENCES
- `src/integrations/cog/ledger.ts`; Vision 10 + Feature 13 PDFs + `download (21).webp`
- `docs/prompts/L8-…credits-ledger.md`, `C5-…collaboration-ui.md`, `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`
