# TRANSCRIPTION CONTRACT — F12 "Say-It-Structured" (voice → structured song)

*C2 (Capture) owns this contract. Consumers: C3 (sheet), D (canvas), C4 (audio), H1 (scripture), Lovable (`transcribe-take`). Last updated: 2026-07-08.*

**The feature:** a songwriter speaks (or sings) a song into ONE voice memo, announcing the
structure as they go — "verse one… [lyrics]… chorus… [lyrics]… bridge…" — and it lands as a
correctly-split, correctly-labeled song room. Accurate when clear, forgiving when ambiguous,
never silently wrong.

---

## 1. The hybrid pipeline (canonical — Step 1)

Two segmentation paths exist **on purpose**, with explicit, non-overlapping roles:

| Path | Where | Role | Wins when |
|---|---|---|---|
| **Deterministic regex** — `src/lib/capture/sectionKeywords.ts` (+ `musicCues.ts`, `spokenCues.ts`) | on-device, pure, offline | **INSTANT + LIVE + FALLBACK.** Live section-forming while recording; the instant review preview; the guaranteed path when AI fails/offline/credits exhausted | While capturing; in review until the server transcript lands; whenever the server path fails |
| **Server AI** — `transcribe-take` edge fn (Whisper + Claude pass, see `docs/prompts/L12-…`) | Supabase edge | **ACCURATE + AUTHORITATIVE on commit.** Real word timestamps, disfluency cleanup, ambiguous-marker resolution, inferred structure | When it returns `ready` with blocks — it replaces the on-device preview in review |

**The flow:** record → live regex preview (sections snap in as you speak) → stop → durable
outbox upload → ReviewSheet opens **instantly** seeded with the on-device split → server
transcript lands → server blocks replace the preview **unless the writer already edited**
(their hands beat the machine — we toast "kept your edits" instead) → correct/confirm →
`commitTakeToCanvas`.

**Failure rules (never a dead end):**
- Server `failed` / timeout / 402 `credits_exhausted` / 429 → the on-device split stays,
  fully editable and committable. If there is no client content at all, one manual Idea
  block is seeded.
- Live STT unsupported (iOS Safari) → no live preview; the server path is the only
  transcript. Manual chip markers still structure the take. Review still never dead-ends.

## 2. Marker detection + confidence (Steps 2–3, the Dragon model)

`detectSectionMarkers(words, manualMarkers)` returns ALL candidate markers, each voice
marker carrying `confidence: 0..1`:

- **Prosody (word-timestamp pauses) is the primary signal.** Gap before the phrase:
  `≥550ms` → 0.9 · `≥200ms` → 0.72 · continuous → 0.35 · take-start → 0.95.
- **Lexical adjustments:** spoken ordinal ("verse two") +0.2 · absorbed framing fillers
  ("okay this is the…") +0.08 · trailing breath +0.12 · content-preceders
  ("EVERY verse", "IN the chorus") −0.2 · "…verse OF…" follower −0.2. Clamped [0.05, 0.99].
- **`APPLY_CONFIDENCE_THRESHOLD = 0.5`.** `isAppliedMarker` gates `buildTranscriptBlocks`:
  markers below threshold NEVER split silently — they surface via
  `pendingCandidateMarkers()` as one-tap "Split here / It's a lyric" suggestions in review.
  Manual chip markers are always applied and beat voice within ±400ms.
- **Body-strip invariant:** `contentStartMs` = end of the announcement phrase (+fillers).
  Block text NEVER contains the marker words. Filler absorption stops at pauses ≥600ms so a
  lyric tail ("…I am here [pause] chorus") is never eaten.
- **Vocabulary:** intro/verse/pre-chorus/chorus/bridge/tag/outro/interlude/hook + refrain,
  vamp, turnaround, coda, ending, breakdown, channel, instrumental, "the drop",
  "last/final/double chorus", "second time" (repeats the previous section as ordinal 2),
  ordinals through twelve, letter variants (verse 1a/1b), plural/mishear aliases.
- **Live timing honesty:** `useLiveTranscript` lays words out RIGHT-ALIGNED in each
  recognition window (per-word cap 320ms), so silence shows up as a *gap before* a phrase —
  the exact signal the confidence model reads. Server Whisper words carry real timing.

## 3. Broader spoken vocabulary (Step 7)

`detectMusicCues` (key / BPM / chords) + `detectSpokenCues` (`src/lib/capture/spokenCues.ts`):

| Spoken | Detector | Becomes |
|---|---|---|
| "key of G", "120 BPM", "chords are G C D" | `musicCues` | one `chords` block ("Key: G · 120 BPM · G C D") |
| "Psalm twenty three", "John 3 16", "first Corinthians 13" | `spokenCues.scriptures` | a `scripture` block, label = canonical reference |
| "note — remember the key change", "make a note that…" | `spokenCues.notes` | an `idea` block labeled "Note" with the spoken body |

Precision-first: ambiguous book names (mark/acts/job/jude/john/james/…) need strong evidence
(ordinal prefix, the word "chapter", or chapter+verse). Note triggers are pause-gated like
sections ("a love note" never fires). Cues render live in `HeardCuesStrip` and are appended
as PendingBlocks at stop (song captures only — same rule as rail text tools).

**H1 handoff:** a scripture block's verse text is attached in review via H1's
`fetchPassage(reference)` (`src/integrations/cog/scripture.ts`) — "Attach verse" button.
C2 consumes the contract, never owns scripture.

## 4. Correction model (Step 8 — Descript-grade, non-destructive)

In ReviewSheet, every fix is one gesture and blocks are derived copies (raw take + words
never mutated): move/reorder · mergeUp · relabel/rekind · **split at caret** (word-boundary
snapped, time split proportional) · **send caret's line to previous/next block** ·
edit-by-text · **one-tap candidate confirm/dismiss** (`confirmCandidateSplit` splits the
containing block at the flagged moment; server-vs-live timing mismatches fall back to the
nearest block — approximate is honest because the user confirmed a *suggestion*).
Pure logic: `src/lib/capture/reviewEdits.ts`.

Sung takes (Step 5): low words-per-active-second while recording → gentle coach line
("Say the section names — I'll structure it for you"); sparse transcript in review
(< 1.2 chars/sec over 8s+) → calm hint that words may be rough, audio is perfect, spoken
markers still work. Never garbage, never silent.

## 5. Per-section audio (Step 9 — consume C4)

Every committed block carries `start_ms`/`end_ms` bounded by word timestamps
(live path: `contentStartMs` → next marker's `atMs`; server path: Whisper timings).
- **Review:** `ReviewAudioPlayer` exposes `playClip(startSec, endSec)` (imperative handle) —
  the per-block "This part" button plays just that slice of the same full-take element.
  Derived + non-destructive; the main transport always plays the full take.
- **Canvas (D):** `canvas_cards.start_ms/end_ms/take_id` already persist per card — D can
  play a card's slice with C4's players the same way. Ask filed here, not implemented in
  D's files by C2.
- **Reopened takes:** need `transcript_json.words` from the server (L12 ask) since live
  words are session-local.

## 6. The commit payload (Step 10 — what each lane consumes)

`commitTakeToCanvas({ take_id, song_id, blocks })` — blocks are
`{ kind, section_kind, label, text, start_ms, end_ms }`:

- **D (canvas):** one card per block; `kind` drives card type; `section_kind` + `label`
  drive section identity; `start_ms/end_ms` + `take_id` = the card's audio slice.
- **C3 (sheet):** blocks with `section_kind` are the structured-lyrics seed — one
  `SheetSectionDoc` per section block (label → section label, text lines → lyric lines).
  The canvas→sheet sink remains D3/C3's seam; the payload above is the source of truth.
- **H1 (scripture):** `kind === "scripture"` blocks carry the canonical reference in
  `label` (verse text in `text` when attached in review).
- **C4 (audio):** consumes nothing at commit; provides playback engines. Per-section
  clipping = seek+bounded-play on the take's audio; no audio files are cut.

## 7. Server payload (Lovable — `transcribe-take`)

Typed in `src/integrations/cog/transcript.ts`. Current: `{ model, blocks, raw_text }`,
`blocks[] = { id, kind: lyrics|chords|scripture|idea|section, section_kind, label, text,
start_ms, end_ms }`. **Additive extensions** (L12 ask, `docs/prompts/L12-lovable-transcribe-take-llm-segmentation.md`):
`blocks[].confidence?`, `transcript_json.words?` (Whisper word timestamps),
`transcript_json.segmentation? = regex|llm|llm_fallback_regex`. Shape is frozen — the LLM
pass improves the CONTENT of blocks, never the schema. Credit exhaustion (402) and rate
limits (429) keep their current semantics; the client falls back deterministically.

## 8. Onboarding aha (Step 10)

Onboarding 08 (`CaptureFirstIdeaPage`) plants the phrase — "Say 'verse' or 'chorus' as you
go — your words land already structured" — then hands off to the REAL CaptureScene, where
the listening copy teaches it again and sections visibly snap in as they're spoken (gold
bloom on the newest section chip, auto-follow, reduced-motion safe). The first take lands in
review already structured. (Copy line on the onboarding page flagged to B2 in
`docs/features/F12-progress.md`.)

## 9. Invariants (never break)

1. Announcement words are stripped from bodies (`contentStartMs`) — on every path.
2. The raw take + raw words are never mutated — segmentation is derived (E3 ethos).
3. No silent splits below the confidence threshold — flag for one-tap confirmation.
4. AI-credit exhaustion / offline never dead-ends — deterministic path + manual edit always work.
5. C2 hands payloads; it never edits C3/D/C4/H1 files.
