# COLORS OF GLORY — EXECUTION PLAN (Hand-off)
## The cleanest, most effective path to build it — to a CapCut / Apple mobile UX bar

> Companion to `BUILD-PATHWAY.md` (the what/who) and `MOBILE-UX-BENCHMARK.md` (the bar).
> This file is the **how-to-run-it**: order, cadence, ownership, and "done" for all 32
> prompts. Print it. Work top to bottom. Don't skip the cadence.

---

## 0. THE FIVE RULES THAT KEEP IT CLEAN

1. **One cluster at a time.** Finish a cluster (its L → C → Q) and merge to `main` before
   the next. No half-built clusters scattered across branches.
2. **One agent, one branch, one task.** `lovable/*` · `claude/*` · `codex/*`. Branch →
   PR/merge to `main` → delete. **Never three agents writing the same working tree at once.**
3. **The seam is the only contact point.** Lovable publishes typed functions in
   `src/integrations/cog/*`; Claude only calls them; Codex tests them. If a seam fn isn't
   ready, Claude builds against a thin adapter and hands Lovable the signature.
4. **`main` is always green.** It must `tsc` + `build` + pass CI at all times (Q1 enforces).
5. **Every screen clears the bar before it ships** (§4). If it doesn't feel like CapCut /
   Voice Memos / Things on a phone, it isn't done.

---

## 1. THE CADENCE (run this loop per cluster)

```
  LOVABLE          →     CLAUDE             →     CODEX            →   MERGE
  build data+seam        build UI on seam         gate it              to main
  (lovable/<x>)          (claude/<x>, /feature)   (codex/<x>)          delete branches
  • migrations/RLS       • screens, tokens,        • tests, RLS-from-   • main green
  • typed cog/*            motion, a11y              client, perf,      • next cluster
  • hand off seam        • re-drive 390px           Lighthouse
```

- **Claude isn't blocked by Lovable**: if the seam fn is missing, code against the agreed
  signature + adapter; Lovable fills it; reconcile on merge.
- **Codex never fixes features**: it files bugs back to Claude/Lovable.

---

## 2. THE BUILD ORDER (top to bottom)

| # | Cluster | Lovable | Claude | Codex | Why this order |
|---|---|---|---|---|---|
| 0 | **Foundation** | L1 schema+RLS, L2 auth | — | Q1 CI gate | Stabilize first: trustworthy data + a green-keeping gate |
| 1 | **Capture** ✅ | L3 intake+transcribe, **LX** AI enhance | (CF1✓ fixes done) | Q2 capture QA | Capture works; harden + add the AI magic |
| 2 | **Canvas** | L4 persistence | C1 cleanup (the "weird") | Q3 canvas QA | Kill sessionStorage; one model; split god-component |
| 3 | **Room** | (uses L1) | C2 room hub | (in Q-sweep) | The private-room home |
| 4 | **Lyrics+Chords** | (uses L1) | C3 editor | Q4 lyrics QA | Chord-on-syllable + no-loss autosave |
| 5 | **Voice** | L5 storage+layering | C4 list+playback | Q5 audio QA | First-class audio with real waveforms |
| 6 | **Collaboration** | L6 roles+RLS+invites | C5 invite+roles UI | Q6 RLS-from-client | The growth loop + the trust boundary |
| 7 | **Activity** | L7 (activity+versions) | C6 "what changed" | Q7 activity/versions | Calm intelligence |
| 8 | **Versions** | L7 | C7 timeline | Q7 | Never lose a draft |
| 9 | **Credits** | L8 ledger+export | C8 credits UI | Q8 credits QA | Remember who shaped what |
| 10 | **Business** | L9 plans+Stripe, L10 referrals | C9 catalog+nav, C10 upgrade/storage/referral | Q9 payments, **Q10 release sweep** | Monetize calmly; final gate |

**Recommended first three to hand out now:** **L1 → C1 → Q1** (foundation + the canvas
that's most broken). Then go cluster by cluster.

---

## 3. THE FULL MAP — prompt → branch → depends on → done when

| Prompt | Agent | Branch | Depends on | Done when |
|---|---|---|---|---|
| L1 schema+RLS | Lovable | `lovable/schema-consolidation` | — | RLS matrix locked; capture-table overlap resolved; seam matches |
| L2 auth | Lovable | `lovable/auth-finalize` | L1 | email e2e; profiles auto-provision; RLS keys off auth.uid() |
| Q1 CI gate | Codex | `codex/ci-quality-gate` | — | CI fails red on push/PR; flaky test fixed; one umbrella gate |
| L3 intake+transcribe | Lovable | `lovable/capture-pipeline` | L1 | idempotent intake; transcripts + section detect |
| LX capture AI | Lovable | `lovable/capture-ai` | L3 | enhance + sung-transcribe + key/BPM/chords; on-device option |
| Q2 capture QA | Codex | `codex/capture-qa` | Q1, L3 | device matrix + flow tests green |
| L4 canvas persist | Lovable | `lovable/canvas-persistence` | L1 | positions/sections persist; idempotent commit |
| C1 canvas cleanup | Claude | `claude/canvas-cleanup` | L4 (adapter ok) | one model; seam-only; god-component split; F4/F5 MVP |
| Q3 canvas QA | Codex | `codex/canvas-qa` | Q1, C1 | drag 60fps; positions persist; structural guards |
| C2 room hub | Claude | `claude/song-workspace-room` | L1 | 5 live panels; activity peek; nav cohesion |
| C3 lyrics+chords | Claude | `claude/lyrics-chords-editor` | C1, L1 | chord-on-syllable; autosave; ChordPicker reused |
| Q4 lyrics QA | Codex | `codex/lyrics-chords-qa` | Q1, C3 | alignment + no-loss proven |
| L5 voice storage | Lovable | `lovable/voice-storage` | L1 | member-only audio; layered takes; waveform; quota |
| C4 voice list | Claude | `claude/voice-memo-list` | L5, LX | real waveforms; instant play; transcript peek |
| Q5 audio QA | Codex | `codex/audio-qa` | Q1, C4 | playback + AI-state + perf green |
| L6 collaboration | Lovable | `lovable/collaboration` | L1 | roles in RLS; secure invites; ownership transfer |
| C5 collab UI | Claude | `claude/collaboration-ui` | L6 | 2-tap invite; role picker; color identity |
| Q6 collab QA | Codex | `codex/collab-qa` | Q1, L6, C5 | RLS-from-client matrix proven |
| L7 activity+versions | Lovable | `lovable/activity-versions` | L1, L6 | deduped digest; non-destructive restore |
| C6 activity feed | Claude | `claude/activity-feed` | L7 | summarized recap; calm; mark-seen |
| C7 version history | Claude | `claude/version-history` | L7 | preview + safe restore; original protected |
| Q7 activity/versions QA | Codex | `codex/activity-versions-qa` | Q1, L7 | restore non-destructive proven |
| L8 credits | Lovable | `lovable/credits-ledger` | L6, L7 | auto-ledger; splits=100%; export |
| C8 credits UI | Claude | `claude/credits-ui` | L8 | contributor chips; export; dignity |
| Q8 credits QA | Codex | `codex/credits-qa` | Q1, L8 | derivation + owner-gate + export integrity |
| L9 plans+Stripe | Lovable | `lovable/billing-storage` | L1 | free=1 song server-side; Stripe webhooks |
| L10 referrals+email | Lovable | `lovable/referrals-email` | L6, L9 | invite-tied attribution; fraud caps |
| C9 catalog+nav | Claude | `claude/catalog-nav` | L9, C1, C2 | catalog glance; ONE nav model |
| C10 business screens | Claude | `claude/business-screens` | L9, L10, C5 | calm upgrade/storage/referral; no dark patterns |
| Q9 payments QA | Codex | `codex/payments-qa` | Q1, L9, L10 | gate RLS; idempotent webhooks; no live charge |
| Q10 release sweep | Codex | `codex/release-sweep` | everything | Lighthouse mobile; e2e; **BYPASS_AUTH=false** |

(CF1 mobile detail fixes — already executed + verified.)

---

## 4. THE UX/UI BAR — every Claude screen passes before merge

From `MOBILE-UX-BENCHMARK.md`. A screen is **not done** until all are yes:

- [ ] **3-second test** — a first-timer knows what it is + the one thing to do, one-handed.
- [ ] **Thumb test** — the primary action is reachable without shifting grip.
- [ ] **CapCut test** — the core action is ≤2 taps from landing, with instant feedback.
- [ ] **Apple test** — type/spacing/motion/haptics feel intentional; nothing default.
- [ ] **Sanctuary test** — calm + warm; no red badges, no nagging, no dark patterns.
- [ ] **Home-screen test** — sits comfortably beside Voice Memos / CapCut / Things.
- [ ] All five interactive states · `prefers-reduced-motion` · 44×44 · tokens only · 60fps.
- [ ] **Re-driven on the 390px viewport** (the live audit habit) — measured, not assumed.

---

## 5. DEFINITION OF DONE

**Per prompt:** acceptance criteria met · `tsc` 0 · `vite build` ok · its tests green ·
(Claude) §4 bar passed + mobile re-drive · merged to `main` · branch deleted.

**Per cluster:** L + C + Q all merged; `main` green; the cluster's golden-path step works
end to end on mobile.

**Launch (Q10):** Lighthouse mobile targets met · full regression green · golden-path e2e
passes on 390px · **`RequireAuth.BYPASS_AUTH = false`** · no console/secrets/fly4me
leftovers · `RELEASE-CHECKLIST.md` go.

---

## 6. THE ONE THING NOT TO FORGET
`RequireAuth.BYPASS_AUTH` is **`true`** right now for preview testing. It is the top line
of Q10's launch blockers. **Flip it back to `false` before any real launch.**

*Last updated: 2026-06-20. Build top-to-bottom. Keep `main` green. Meet the bar every time.*
