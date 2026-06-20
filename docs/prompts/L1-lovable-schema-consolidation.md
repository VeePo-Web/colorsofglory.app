# L1 — LOVABLE: Schema Consolidation + RLS Baseline
## Cluster 0 (Foundation) · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste this whole file into Lovable. It is an **audit + consolidation** task,
> not a greenfield build — the schema already exists (59 migrations, ~35 tables).
> Do not write any frontend. Stay entirely in `supabase/` and the data layer.

---

## YOUR ROLE (do not overstep)

You are **Lovable**, owner of the **data spine**: Supabase schema, RLS, migrations,
auth, storage, edge functions. You publish typed access only through the seam at
`src/integrations/cog/*`. You do **not** touch `src/` UI components, screens, copy,
or visual design (that's Claude), and you do not write app tests (that's Codex).
Full contract: `docs/BUILD-PATHWAY.md`.

---

## CONTEXT

**Colors of Glory** is a mobile-first Christian songwriting app. Every song is a
private room holding lyrics, voice memos, chords, notes, collaborators, versions,
activity, and credits. Product + data model spec: `CLAUDE.md` (esp. §3 architecture
and §5 data model). Feature roadmap:
`zip_extracted/20. SONGWRITING SPECIFIC PART/MASTER - ALL 1000 colors_of_glory_songwriting_features_roadmap.xlsx`.

The schema is already large. Tables currently present include:
`profiles, user_roles, songs, song_sections, song_lyrics, song_notes,
song_versions, song_activity, song_members, song_invites, song_notification_prefs,
voice_memos, takes, voice_memo_transcripts, idea_captures, canvas_cards,
chord_progressions, credit_ledger, plan_tiers, subscriptions, billing_events,
storage_usage, storage_addons, pricing_copy, founders, founder_codes,
founder_redemptions, codes, referral_attributions, reward_events, invite_requests,
payouts, fraud_flags, app_settings, audit_logs, contact_submissions`.

This means the job is to **make this trustworthy, coherent, and locked down** — not
to add more.

---

## OBJECTIVE

Deliver a **verified, documented, fully RLS-protected canonical schema** that (a)
covers the product model with no gaps, (b) has no dead/duplicate/fly4me tables, (c)
enforces correct per-song collaborator access everywhere, and (d) exactly matches
the names the seam (`src/integrations/cog/*`) and Claude's UI rely on.

---

## TASKS

### 1. Inventory & map to the product model
- Produce a table of every table: **purpose · key columns · foreign keys · owning entity**.
- Map each against `CLAUDE.md §5`. Mark **Covered / Missing / Extra**.
- Flag obvious **fly4me leftovers** for removal (e.g. `contact_submissions`, and any
  marketing-era tables) — propose a deprecation migration, do not silently drop.

### 2. Resolve the capture-data overlap (critical)
There are several capture-related tables: `voice_memos`, `takes`,
`voice_memo_transcripts`, `idea_captures`, `canvas_cards`, `chord_progressions`,
`song_sections`, `song_lyrics`. Define the **one canonical capture→song data flow**
in prose + a diagram: when a recording is made, exactly which rows are written, in
which table, with which FKs. Identify and collapse any redundant/competing tables.
This directly unblocks the "Canvas cleanup" (C1) and capture (done) work.

### 3. RLS audit (the core deliverable)
For **every** table:
- Confirm `ROW LEVEL SECURITY` is **enabled**.
- Produce an **RLS Policy Matrix**: table × {select, insert, update, delete} × who.
- Enforce song access through `song_members` roles
  (**Owner / Contributor / Reviewer / Viewer** per `CLAUDE.md §3`):
  - Owner: full control of the song and its children.
  - Contributor: add lyrics/memos/notes/ideas; no destructive ops on others' work.
  - Reviewer: comment/approve; read all.
  - Viewer: read/listen only.
- Verify **no table** is world-readable or world-writable by mistake.
- Verify children (lyrics, sections, memos, takes, transcripts, notes, activity,
  versions, credits) inherit access from their parent song via `song_members`.
- Confirm billing/founder/payout/fraud tables are **service-role or self only** —
  never client-writable.

### 4. Integrity, performance, storage
- Foreign keys + sensible `ON DELETE` (cascade children with the song; protect ledgers).
- Indexes on hot lookups (`song_id`, `author_user_id`, `created_at`, status fields).
- Storage buckets for audio: confirm bucket(s), naming, and **storage RLS** (only
  song members can read a song's audio; only authed users can write their own).

### 5. The seam (no drift)
- Cross-check `src/integrations/cog/*` against the live schema. List every place an
  SDK function references a table/column that changed or no longer matches.
- Do **not** edit UI — only report drift and, if needed, update the typed SDK +
  regenerate Supabase types. Hand the drift list to Claude/Codex.

### 6. Migration hygiene
- 59 migrations is a lot. Do **not** squash history (risky), but produce a single
  **canonical schema snapshot** (`supabase/SCHEMA.md` or generated `schema.sql`) so
  the current truth is readable in one place.

---

## DELIVERABLES
1. `supabase/SCHEMA.md` — canonical schema: every table, columns, FKs, purpose.
2. `supabase/RLS-MATRIX.md` — the policy matrix + the role→permission rules.
3. **Gap list** — Missing vs the product model, Extra/dead tables (incl. fly4me), with proposed migrations.
4. **Capture data-flow doc** — the one canonical recording→song write path.
5. **Seam-drift list** — SDK/type mismatches for Claude/Codex to act on.
6. Any consolidation/RLS migrations needed to reach the acceptance criteria.

---

## ACCEPTANCE CRITERIA
- [ ] Every table has RLS enabled with explicit, tested policies (no implicit deny-all gaps that break the app, no accidental public access).
- [ ] Collaborator roles (Owner/Contributor/Reviewer/Viewer) enforced on songs + all child tables.
- [ ] Billing/founder/payout/fraud tables are not client-writable.
- [ ] Product-model coverage is 100%; every Extra/dead table is flagged with a plan.
- [ ] Canonical capture data-flow is documented and free of redundant tables.
- [ ] Seam (`src/integrations/cog/*`) matches the schema; drift list handed off.
- [ ] `supabase db` migrations apply cleanly from scratch; Supabase types regenerated.

---

## CONSTRAINTS
- Backend/Supabase only. **No `src/` UI edits.** Coordinate via the seam + handoff lists.
- Work on a `lovable/schema-consolidation` branch → merge to `main` → delete. `main` stays green.
- Never expose service-role keys client-side. Never weaken RLS to "make it work" — fix the policy.
- Reference, don't assume: read the actual migrations in `supabase/migrations/` and `CLAUDE.md §5`.

---

## REFERENCES
- `supabase/migrations/*` (current schema truth)
- `CLAUDE.md` §3 (architecture/roles), §5 (data model)
- `docs/BUILD-PATHWAY.md` (role contract + the seam)
- `src/integrations/cog/*` (the access seam Claude consumes)
- Roadmap: `zip_extracted/20. SONGWRITING SPECIFIC PART/MASTER - …roadmap.xlsx`
