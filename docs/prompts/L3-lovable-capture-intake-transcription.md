# L3 — LOVABLE: Capture Intake + Transcription Pipeline
## Cluster 1 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. Capture's UI is done + hardened (Claude); make its **backend**
> bulletproof and fast. Backend + `cog/*` seam only.

## YOUR ROLE
Lovable: Supabase, storage, edge functions, transcription, the `src/integrations/cog/*`
seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
A recording flows: blob → upload → `voice_memos` + `takes` (storage_path) →
transcription → `voice_memo_transcripts` (text + word timestamps) → section detection.
Relevant surface: `submitSharedAudio`/intake, `commit-take` + transcription edge
functions, tables `voice_memos`, `takes`, `voice_memo_transcripts`. L1 defines the
canonical capture→song data flow — implement it here.

## OBJECTIVE
A reliable, fast, idempotent capture pipeline: every recording lands, transcribes, and
attaches to the right song/section, at scale, with graceful failure.

## TASKS
1. **Idempotent upload + intake:** a take never double-creates rows on retry (Claude's
   failed-upload retry depends on this). Return stable ids.
2. **Storage:** audio bucket + RLS (only song members read a song's audio); signed URLs
   for playback; size/type limits matching the client (≤50MB).
3. **Transcription:** queue/trigger STT → `voice_memo_transcripts` with `transcript_text`
   + `word_timestamps`; statuses (`pending/ready/failed`); handle 402/429 gracefully.
4. **Section detection:** from transcript, populate `song_sections` per the canonical
   flow (the "say Verse/Chorus to split" feature) — server-side, deterministic.
5. **The seam:** expose typed `cog/*` functions for upload, take lookup, transcript
   fetch, signed URL — exactly what Capture + Canvas consume. Document them.
6. **Scale + failure:** retries, dead-letter for failed transcriptions, no orphaned
   takes; cleanup policy for abandoned uploads.

## DELIVERABLES
1. Idempotent intake + commit-take path. 2. Storage bucket + RLS + signed URLs.
3. Transcription pipeline w/ statuses + quota handling. 4. Server-side section detection.
5. Documented `cog/*` capture seam. 6. Failure/retry + cleanup policy doc.

## ACCEPTANCE CRITERIA
- [ ] A recording reliably becomes `voice_memos` + `takes` + transcript, attached to song/section.
- [ ] Retry never duplicates. Audio is member-only via signed URLs.
- [ ] Transcription statuses + 402/429 handled; failures don't lose the take.
- [ ] Seam documented; Claude/Codex consume only typed `cog/*`.

## CONSTRAINTS
Backend + seam only. `lovable/capture-pipeline` → merge → delete. Never weaken RLS.

## REFERENCES
- `supabase/functions/commit-take*`, intake fns, `src/integrations/cog/transcript.ts`, `canvas.ts`
- tables: `voice_memos`, `takes`, `voice_memo_transcripts`, `song_sections`
- `docs/prompts/L1-lovable-schema-consolidation.md`, `CLAUDE.md` §5, `docs/BUILD-PATHWAY.md`
