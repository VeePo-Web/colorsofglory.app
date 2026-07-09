# F12 "Say-It-Structured" — Progress Log

*C2 leads. One entry per charter step: what changed, what was verified, payloads handed off.
Contract: `docs/TRANSCRIPTION-CONTRACT.md`. Run of 2026-07-08 (all 10 steps in one pass).*

## Step 1 — Hybrid pipeline reconciled
- Canonical roles documented (contract §1): client regex = instant/live/offline fallback;
  server = authoritative on commit.
- **Code reconciliation (the real gap):** ReviewSheet previously DISCARDED the live split —
  server-fail/timeout left one empty manual block. Now: `liveBlocks` prop seeds review
  instantly (`fromLiveBlocks`), server blocks replace it only when the writer hasn't edited
  (`dirtyRef` guard + "kept your edits" toast), and every failure path keeps the
  deterministic structure editable. Verified: ReviewSheet.test.tsx (6 tests, incl. 2 legacy).

## Step 2 — Vocabulary hardened
- Added: last/final/double chorus (labelOverride "Final Chorus"/"Double Chorus"), "the drop"
  (two-token, → chorus "Drop"), instrumental (→ interlude), channel (→ pre-chorus),
  "second time" (repeatPrevious — re-announces the previous section as ordinal 2; inert
  cold), ordinals six–twelve(+ordinal words), "chorus second time" ordinal-word+time
  absorption, new framing fillers (next/here/heres/comes/gonna/well).
- Filler absorption now pause-guarded (≥600ms gap stops the walk) so lyric tails survive.
- Verified: `sectionVocabulary.test.ts` (9 tests) + all 6 pre-existing keyword suites green.

## Step 3 — Command-vs-content disambiguation (Dragon)
- `SectionMarker.confidence` (0..1) from word-timestamp pauses + lexical signals;
  `APPLY_CONFIDENCE_THRESHOLD = 0.5`; `isAppliedMarker` / `pendingCandidateMarkers`.
- `buildTranscriptBlocks` filters unapplied markers — no silent restructuring; backfill
  numbering skips candidates. Live path: `layoutFinalWords` right-aligns words per
  recognition window so real pauses become visible gaps (the prosody signal).
- Verified: `sectionConfidence.test.ts` — "every verse of this psalm" does NOT split (flagged,
  conf < 0.5); "[pause] verse two [pause]" DOES (conf ≥ 0.5, announcement stripped);
  numbering unshifted by candidates; `liveWordLayout.test.ts` for the timing model.

## Step 4 — LLM segmentation ask filed (Lovable)
- `docs/prompts/L12-lovable-transcribe-take-llm-segmentation.md`: Whisper word timestamps +
  Claude repair pass (claude-opus-4-8, adaptive thinking, effort medium, structured outputs
  json_schema), SAME block shape, additive fields only (`confidence`, `words`,
  `segmentation`), deterministic fallback + credit semantics preserved.
- Client types extended additively in `cog/transcript.ts`. Downstream untouched.

## Step 5 — Sung-vs-spoken robustness
- CaptureScene: analyser-RMS voiced-time vs live word rate → `sungLikely`; gentle coach line
  in LiveTranscript ("Say the section names — I'll structure it for you").
- ReviewSheet: sparse-transcript hint (`looksSung`) — audio is perfect, words may be rough,
  spoken markers still structure. Spoken/tapped markers section a sung body via timestamps
  regardless of lyric quality. Nothing lost on any path.

## Step 6 — Live section-forming
- Sections already snapped in live; elevated: newest section chip blooms (gold pulse,
  reduced-motion-off), transcript pane auto-follows during listening (instant scroll, no
  smooth-scroll animation), 38dvh scroll bound. Live structure === committed structure when
  the server is unavailable (same detector); server refines otherwise (documented §1).

## Step 7 — Full say-it-structured (chords · scripture · notes)
- New `src/lib/capture/spokenCues.ts`: scripture references (66-book table, precision gates
  for ambiguous names, spoken/fused/chapter-word number forms) + pause-gated note triggers.
- CaptureScene: cues → PendingBlocks at stop (scripture/label=reference, note/idea,
  key-tempo-chords → one chords block); HeardCuesStrip shows scripture + note chips live.
- ReviewSheet: "Attach verse" on scripture blocks via H1's `fetchPassage` (consume, not own).
- Verified: `spokenCues.test.ts` (11 tests incl. never-fire guards). Sections unchanged.

## Step 8 — Descript-grade correction
- `src/lib/capture/reviewEdits.ts` (pure): `splitBlockAtChar` (caret, word-boundary snap,
  proportional time), `moveCaretLine` (line → prev/next block), `confirmCandidateSplit`
  (time-anchored split w/ nearest-block fallback). ReviewSheet wires: split button, line
  up/down, candidate row ("Split here" / "It's a lyric"), dirty-guard everywhere.
- Verified: `reviewEdits.test.ts` (7) + ReviewSheet candidate tests (one-tap confirm creates
  the labeled section; dismiss leaves take untouched). Non-destructive throughout.

## Step 9 — Per-section audio clips
- `ReviewAudioPlayer` → forwardRef `playClip(startSec,endSec)`/`stopClip` + `onClipStop`;
  per-block "This part" chip plays just the block's word-timestamp-bounded slice of the SAME
  full-take element (derived, non-destructive; main transport unaffected; seek/full-play
  clears the clip window). Canvas-side slice playback documented for D (cards already carry
  start/end/take_id); server `words` for reopened takes = L12 ask. C4 engine consumed, not forked.

## Step 10 — Commit, aha, contract
- Commit payload documented per consumer (contract §6): D cards, C3 SheetSectionDoc seed,
  H1 scripture refs, C4 clip bounds. No lane's files edited by C2.
- Onboarding aha: CaptureFirstIdeaPage plants "Say 'verse' or 'chorus' as you go…" (copy-only
  touch on a B2 page — **flagged to B2**), then hands off to the real CaptureScene where live
  section-forming IS the aha. `docs/TRANSCRIPTION-CONTRACT.md` published.
- End-to-end verification (no mic in CI — honest scope): the full pipeline is exercised by
  simulated word streams — 3-section spoken song → 3 correctly-split, correctly-labeled
  blocks with announcements stripped (`sectionVariants` golden test + confidence suite);
  ambiguous case flagged-not-split; review fallback/commit payload via ReviewSheet tests;
  typecheck + full vitest + production build green. On-device mic walkthrough (390px)
  remains on the C2 5-min checklist.

## Cross-lane handoffs
- **Lovable:** L12 edge-fn upgrade (above).
- **B2:** one teaching line added to `CaptureFirstIdeaPage` (onboarding 08) — review/restyle freely.
- **D:** per-card clip playback (cards already carry the bounds); canvas→sheet sink unchanged.
- **C3:** section blocks are the sheet seed (contract §6).
- **C4:** clip playback consumed via the review player; no engine fork.
