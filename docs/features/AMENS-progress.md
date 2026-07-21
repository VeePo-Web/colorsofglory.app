# Amens — Canvas Encouragement Layer · Progress

## 2026-07-21 — Shipped (device-local live now; server sync arms itself when the table lands)

**What changed**
- NEW `src/integrations/cog/reactions.ts` — the `card_reactions` seam:
  probe-gated (missing table detected once, cached, everything no-ops
  cleanly), list/add/remove, realtime on a DEDICATED channel so a missing
  table can never error the shared song-room channel.
- NEW `src/lib/canvas/collab/amens.ts` — pure offline-first model: op-queue
  toggles (add+remove annihilate; no tombstones), server merge that
  completes multi-device ops, per-card summaries (count, mine-set, ≤3
  newest contributor dots), `idea_amened` activity synthesis, device
  persistence (`cog:amens-<songId>`), stable device actor for demo/local.
- NEW `src/lib/canvas/collab/useAmens.ts` — optimistic toggle, ordered
  flusher with retry (online event + 30 s), realtime re-list, demo-room
  local mode.
- NEW `src/components/canvas/AmenChip.tsx` — calm cluster (unselected) +
  the 44 px Amen/heart/keeper action row (selected), gold when yours,
  opacity-only fade, full aria labels, event-swallowing so a tap never
  drags/selects the card.
- Host wiring (`SongCanvasExperience`): `useAmens` fed by the existing
  `identityByUserId` roster; AmenChip composed into the existing
  `renderCardAdornment` (null for untouched unselected cards — card memo
  intact); `amenEvents` → `CanvasRecapGate`.
- Recap: `useCanvasRecap(songId, extraEvents?)` folds synthesized amen rows
  through the same anchor + own-changes gates; `idea_amened` phrase added
  to `recapDigest.ts` ("left an amen on an idea" / "left N amens").
- `docs/AMENS-CONTRACT.md` — the model, the calm-UX choices, and the
  **card_reactions schema + RLS + realtime-publication ask for A3/Lovable**.

**Deliberate calm-UX choices (documented in the contract)**
- Unselected cluster is display-only; actions reveal on selection — the
  established card grammar here, and a hot target on a pan/drag canvas is a
  mis-tap hazard. Cluster caps at 3 dots + "+N"; never a red count.
- Kind depth = the two extra buttons on the selected row (no sheet); the
  note + 5-sec voice amen are the filed next slice (need the table + a
  storage-path decision).

**What was verified**
- `amens.test.ts` 8/8 green: optimistic add visible instantly; tap-again
  annihilates; server-backed remove hides instantly + re-amen cancels the
  removal; someone else's identical amen never hidden; merge completes
  confirmed adds/applied removes; confirmOp reconciliation; summaries
  (count/mine/≤3 newest deduped dots/name resolution); `idea_amened`
  synthesis with empty payload (IDs-only product rule).
- `tsc --noEmit` clean · `vite build` green · canvas + collab suites green.

**Not verifiable here (needs the backend + two phones)**
- The two-session realtime pass (amen appears/removes live on the other
  device) requires the `card_reactions` table + publication — the ask is
  filed; the client path is written and probe-armed. Until then both
  sessions run device-local (each sees their own amens; nothing errors).

**Next candidates**
- The AmenSheet slice: short note + 5-sec voice amen (C4 recorder).
- Backend `idea_amened` activity logging so recaps reach members who were
  away long enough that client synthesis has aged out.
