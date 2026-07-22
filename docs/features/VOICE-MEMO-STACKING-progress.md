# Voice Memo Stacking · Progress

## 2026-07-22 — The spine shipped (Step 1 + engine + mix core)

**The audit that started it (multi-collaborator vision check):** the seam
was ALREADY sending `parent_memo_id` on every "record over this" upload —
and the upload edge function silently dropped it; no migration ever created
the column. Every collaborator layer un-stacked into an orphan memo on
reload while demoing perfectly. That hole is closed at the root.

**What changed**
- MIGRATION `20260722210000_voice_memo_stacking_spine.sql` (additive,
  non-destructive): `voice_memos.parent_memo_id` (self-FK, ON DELETE SET
  NULL → orphans promote to base), `layer_gain` (0–1.5, default 1),
  `layer_muted`, `layer_offset_ms` (0–2000, the best-effort latency
  compensation), partial index, and a BEFORE trigger that FLATTENS a
  layer-of-a-layer to the top base and clears self/cross-song parents —
  data corrected, never rejected.
- `voice-memo-upload-url` now accepts + validates `parent_memo_id`
  (must exist, same song) + `layer_offset_ms`, and persists them —
  with a deploy-order-safe fallback (if the migration hasn't run, the
  insert retries without the new columns; an upload can NEVER fail over
  stacking).
- `stackModel.ts`: client-side one-level flatten mirroring the trigger +
  `resolveMix` (volume + mute + solo → effective gain per id, pure) +
  `clampLayerGain`. 14/14 tests (incl. the layer-of-a-layer family test).
- Seam: `readStacking(row)` (cast-until-types-regen, the established
  pattern) + `setLayerMix(memoId, {gain?, muted?})` (never throws; local
  mix rules the session on failure). `VoiceMemoRecord` now carries
  `parentMemoId` / `layerGain` / `layerMuted` / `layerOffsetMs` — the
  voice page's stacks now read PERSISTED parentage.
- `useStackPlayer` v2 — the WEB AUDIO SHARED CLOCK: every audible layer
  decodes to an AudioBuffer and starts in one `ctx.currentTime` tick
  (no multi-<audio> drift); per-layer GainNodes with 30ms ramps (live
  mid-playback gain/mute/solo, never a click); pause/resume/seek by
  re-scheduling from position; progress from the context clock; per-layer
  head offsets = alignment store + `layer_offset_ms`. SAFETY LADDER: no
  Web Audio or any decode failure → ALL layers fall back to the original
  element engine (a split engine can't stay in sync) — same interface,
  never worse. New opts: `initialGains`/`initialMuted`/`serverOffsets`;
  new `setGain(id, v)`.
- `MemoStack`: a quiet per-layer volume slider (accent = contributor
  color, live + persisted debounced 600ms via `setLayerMix`), mute now
  persists too; the mixer seeds from the room's shared persisted mix.
  Attribution unchanged (color + initials + name per layer).

**What was verified**
- stackModel 14/14 · voice + capture suites 81/81 · tsc clean · build
  green. Sync-precision and click-free ramps are code-verified (one
  shared `when`, `setTargetAtTime`); the EARS check (3-layer 60s stack,
  no drift) needs a phone.

**Remaining steps (spec §Task order — next passes)**
- Step 2 remainder: the global player STORE (`player.ts` contract) +
  MediaSession/lock-screen; absorb take playback.
- Step 4: the unified Memo Sheet (merge StackSheet + the TakesDrawer
  spec; two labeled verbs).
- Step 5: "Try again" takes flow (keeper nudge, A/B via F21).
- Step 6: layer-record monitoring (never-bleed via the audioSession
  route detection) + measured latency → `layer_offset_ms` at save.
- Step 7: transcribe/commit scoping (base keeper only) + credits events.
- Canvas `toStackView` should thread the persisted mix fields (the canvas
  stack currently plays at default gains until it does).
- Backend asks: types regen (parent_memo_id + layer_* + takes
  transcript_*); quota policy (archived tries free); RLS confirm that
  song members may update `layer_gain/muted` (else mix falls back to
  device-local silently).
