# COLORS OF GLORY — THE BUILD PATHWAY
## The single source of truth for how Lovable, Codex, and Claude build this together

> This is the one live process doc. `CLAUDE.md` = product/design spec. This file
> = *who does what, in what order, without colliding.* If anything here conflicts
> with an older doc in `docs/`, this wins; archive the older one.

---

## 0. THE DIAGNOSIS (why it felt broken)

The code on `main` builds green and typechecks clean — **the app is not broken.**
What broke was *coordination*:

- Three agents editing the **same working tree at the same time**.
- Four divergent branches (`main` + 3 `codex/*`), the tree drifting off `main`.
- Orphaned `git stash` entries and convergent duplicate edits (e.g. two mic fixes).
- 38 docs with no single source of truth.

**The fix is the operating system below, not a code rewrite.**

---

## 1. THE ROLE CONTRACT (nothing oversteps)

| | **LOVABLE** 🛠 | **CLAUDE** 🎨 | **CODEX** 🔬 |
|---|---|---|---|
| **Mandate** | The data spine | The experience | The quality gate |
| **Owns** | `supabase/` (schema, RLS, migrations), auth (OTP/email), Stripe, storage, edge functions, email automations | `src/` UI — screens, components, copy, animation, UX flows, design tokens | `src/test/`, `docs/codex-*`, `scripts/`, CI, Lighthouse, a11y, regression, perf |
| **Publishes** | Typed SDK functions in `src/integrations/cog/*` | Screens that *call* that SDK | Test/audit reports + pass/fail gates |
| **Never touches** | Frontend components, visual design, copy | Schema, RLS, auth backend, edge-function source, payments | Feature implementation, visual design |
| **Branch lane** | `lovable/*` | `claude/*` | `codex/*` |

### The seam
`src/integrations/cog/*` is the **only contact point**. Lovable publishes typed
functions there; Claude only imports and calls them; Codex tests them. **No agent
reaches across the seam.** In pages/components, auth comes from
`@/integrations/cog/auth` — never the raw Supabase client (that lives in `lib/`/SDK).

### Hard frontend rules (Claude)
Design tokens only (`var(--cog-*)`), no raw Tailwind colors · components < ~250 lines
· no `console.log` · mobile-first, iOS-Safari-first · evidence before "done"
(`tsc` + `build` + tests). **Every screen meets `docs/MOBILE-UX-BENCHMARK.md`**
(Apple + CapCut standard).

---

## 2. GIT OPERATING RULES (so it never tangles again)

1. **`main` is the single source of truth.** It must always build green.
2. **One short-lived branch per agent per task**, prefixed by lane
   (`claude/canvas-cleanup`), merged to `main`, then **deleted**. No long-lived
   parallel branches.
3. **Never three agents on one working tree at once.** Agents take turns, or each
   uses its own `git worktree`/clone. Concurrent writes to one tree is the root
   cause of the tangle — do not repeat it.
4. **Stage by path** (`git add <files>`), never `git add -A` blindly. Commit only
   your lane's files.
5. **Rebase, don't merge**, onto `main`. Never force-push or rewrite another
   agent's shared branch. Duplicate patches are fine; destroyed work is not.
6. **No permanent stashes.** Inspect → apply → drop, same session.
7. Commit messages end with the agent tag, e.g.
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## 3. THE BUILD ORDER (clusters, songwriting-first)

Each cluster flows **Lovable (data) → Claude (UI) → Codex (QA)**, merged to `main`
before the next. Capture is the done template.

```
0  Foundation        schema baseline · CI · design-token audit
1  Capture           ✅ built — harden only
2  Canvas cleanup    the "weird" one — restructure
3  Song Workspace    the private-room hub
4  Lyrics + Chords   editor
5  Voice Memos       list · playback · layering
6  Collaboration     invite · roles
7  Activity          "what changed since you left"
8  Versions          snapshot history
9  Credits           contribution ledger
10 Business model    storage · upgrade · referral
```

Every prompt may cite any folder/PDF: the 226-feature master
`zip_extracted/20. SONGWRITING SPECIFIC PART/MASTER - …roadmap.xlsx`, the spec
PDFs + reference images under `zip_extracted/…` (see `CLAUDE.md` §7).

---

## 4. THE 30 PROMPTS (10 per agent)

Written **one at a time, in depth**, in build order. Status legend: ☐ todo.

### 🛠 LOVABLE — the data spine
- ☑ **L1** Schema consolidation + RLS baseline → [`docs/prompts/L1-lovable-schema-consolidation.md`](prompts/L1-lovable-schema-consolidation.md)
- ☑ **L2** Auth finalize (email + phone OTP) → [`docs/prompts/L2-lovable-auth-finalize.md`](prompts/L2-lovable-auth-finalize.md)
- ☐ **L3** Capture intake + transcription pipeline (voice_memos, takes, transcripts)
- ☐ **L4** Canvas / song-sections persistence + commit API
- ☐ **L5** Voice-memo storage + BPM/key analysis endpoints
- ☐ **L6** Collaboration (collaborators, invite_tokens, roles, RLS)
- ☐ **L7** Activity log + version snapshots
- ☐ **L8** Credits ledger
- ☐ **L9** Storage quotas + plan gating + Stripe
- ☐ **L10** Referrals + email automations

### 🎨 CLAUDE — the experience
- ☑ **C1** Canvas cleanup (audit + restructure the weird one) → [`docs/prompts/C1-claude-canvas-cleanup.md`](prompts/C1-claude-canvas-cleanup.md)
- ☑ **C2** Song Workspace / room hub → [`docs/prompts/C2-claude-song-workspace-room.md`](prompts/C2-claude-song-workspace-room.md)
- ☐ **C3** Lyrics + Chords editor
- ☐ **C4** Voice-memo list + playback
- ☐ **C5** Collaboration UI (invite + roles)
- ☐ **C6** Activity feed ("what changed")
- ☐ **C7** Version-history timeline
- ☐ **C8** Credits ledger UI
- ☐ **C9** Catalog + navigation cohesion
- ☐ **C10** Business-model screens (upgrade / storage / referral)

### 🔬 CODEX — the quality gate
- ☑ **Q1** CI baseline + bundle / lint / typecheck gates → [`docs/prompts/Q1-codex-ci-quality-gate.md`](prompts/Q1-codex-ci-quality-gate.md)
- ☑ **Q2** Capture QA (mic, cross-device) → [`docs/prompts/Q2-codex-capture-qa.md`](prompts/Q2-codex-capture-qa.md)
- ☐ **Q3** Canvas QA + perf
- ☐ **Q4** Lyrics / chords QA + a11y
- ☐ **Q5** Audio playback QA + perf
- ☐ **Q6** Collaboration + RLS-from-client QA
- ☐ **Q7** Activity / versions QA
- ☐ **Q8** Credits QA
- ☐ **Q9** Payments QA (no live charges)
- ☐ **Q10** Full Lighthouse / a11y / regression release sweep

---

## 5. EXECUTION RHYTHM

1. Write the next prompt in depth (start: **L1 → C1 → Q1**).
2. The owning agent runs it on its own branch → merges to `main` → deletes branch.
3. `main` stays green; next prompt begins.
4. Claude's per-feature loop is the `/feature` skill (the 7-Phase loop) — see
   `persona-songwriter-engineer.md`.

*Last updated: 2026-06-19. Supersedes scattered process docs in `docs/`.*
