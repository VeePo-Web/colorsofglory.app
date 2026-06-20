# L8 — LOVABLE: Contribution Credits Ledger + Export
## Cluster 9 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. Credits are how a co-writing/worship community keeps trust:
> **every contribution remembered, fairly, and exportable as a split sheet.** Backend +
> the `cog/*` seam only. Songwriter truth: *the person who wrote the bridge line should
> always be able to prove it.*

## YOUR ROLE
Lovable: Supabase schema/RLS, edge functions, the typed `src/integrations/cog/ledger.ts`
seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Present: `credit_ledger` table + `ledger.ts` seam. Signal comes from L7 activity +
L6 membership. Specs: Product Vision 10 (Contribution Credits Remembered), Feature 13
(Contribution Ledger / Credits Review), `download (21).webp` (Parker — Owner · Lyrics ·
Arrangement; Sarah — Voice memo · Bridge idea; Caleb — Chord suggestion · Chorus review;
"Export credits").

## OBJECTIVE
An accurate, fair, member-scoped contribution ledger — derived from real activity but
owner-curatable — with optional songwriting splits and a clean export.

## TASKS
1. **Contribution model (`credit_ledger`):** per collaborator per song, the contribution
   **types** they made (e.g. lyrics, voice memo, chords, arrangement, bridge idea, chord
   suggestion, review, scripture). Seed from L7 activity (don't make the user hand-enter),
   de-duplicated into meaningful credit lines.
2. **Owner curation:** the Owner can add/edit/remove a credit line or re-attribute — the
   ledger is auto-built but human-correctable. Track who edited it (audit).
3. **Splits (optional, important):** an optional percentage/share per contributor for
   songwriting splits; if used, validate it sums to 100%. Owner-set. (Acknowledgment-only
   mode when splits aren't used.)
4. **Export (the "Export credits" action):** an edge function that produces a credits
   document — **split sheet** style — in PDF + CSV/JSON (names, roles, contributions,
   splits, song title, date). Member-readable; downloadable via a signed URL.
5. **RLS:** members read the ledger; only the Owner edits/curates/sets splits/exports.
6. **Seam (`ledger.ts`):** `listCredits(songId)`, `upsertContribution`,
   `setSplit`, `exportCredits(format)`. Document states + errors for C8.

## DELIVERABLES
1. Activity-seeded, de-duplicated credit lines per contributor. 2. Owner curation + audit.
3. Optional splits with 100% validation. 4. Export edge function (PDF + CSV/JSON, signed URL).
5. RLS (members read, owner edit/export). 6. Documented `ledger.ts` seam.

## ACCEPTANCE CRITERIA
- [ ] Credits auto-build from real activity, de-duplicated into meaningful lines per person.
- [ ] Owner can curate/re-attribute; edits are audited; members can read.
- [ ] Splits (when used) validate to 100%; acknowledgment-only mode works without splits.
- [ ] Export produces a correct split-sheet PDF + CSV/JSON via signed URL.
- [ ] One typed `ledger.ts` seam covers everything C8 needs.

## CONSTRAINTS
Backend + seam only. Credits must be fair + accurate — never invent contributions; derive
+ allow correction. Owner-gated edits via RLS, not UI. `lovable/credits-ledger` → merge → delete.

## REFERENCES
- table `credit_ledger`; `src/integrations/cog/ledger.ts`, `activity.ts`, `members.ts`
- Vision 10 + Feature 13 PDFs + `download (21).webp`
- `docs/prompts/L6-…collaboration-roles-rls.md`, `L7-…activity-versions.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §11.10
