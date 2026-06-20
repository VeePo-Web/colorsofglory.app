# L5 — LOVABLE: Voice-Memo Storage, Layering & Analysis Wiring
## Cluster 5 · Lane: `lovable/*` · Owner: Lovable (data spine)

> Paste into Lovable. The durable home for every recording: storage, layered takes,
> quotas, and the seam that feeds analysis (BPM/key/chords from LX). Backend + seam only.

## YOUR ROLE
Lovable: Supabase storage, RLS, edge functions, the `cog/*` seam. No UI. `docs/BUILD-PATHWAY.md`.

## CONTEXT
Voice memos are first-class content (CLAUDE.md §11.8). Tables: `voice_memos`, `takes`,
`voice_memo_transcripts`, `chord_progressions`. Capture writes them (L3); AI enrichment
comes from **LX** (enhancement/transcription/analysis). This prompt makes storage solid,
adds **layered recording** (record over a take), and exposes everything the list/player
UI (C4) needs via the seam. Spec: Feature 10 (Voice Memo Cards/Waveforms), Feature 16
(Layered Voice Memo Recording).

## OBJECTIVE
Reliable, member-scoped audio storage with layered takes, storage accounting, and a
typed seam that returns memos + signed URLs + waveform + analysis states for C4.

## TASKS
1. **Storage + RLS:** audio bucket(s); only song members read a song's audio; users write
   their own. Signed URLs for playback (short-lived). Size/type limits.
2. **Multiple takes per memo + layering (F16):** model `takes` so a memo can have layered
   takes (e.g. piano + harmony) that play together; expose order/mix metadata. Preserve
   originals.
3. **Waveform data:** store/serve a precomputed waveform peak array per take (cheap to
   render) so the client doesn't decode whole files. (Client may also seed locally.)
4. **Storage accounting:** track per-user/song storage (`storage_usage`) toward plan
   quotas (coordinate with L9); expose remaining quota via the seam.
5. **Analysis wiring:** surface LX's enhancement URL + transcript + BPM/key/chords through
   the same seam with explicit states (pending/ready/failed/unavailable).
6. **Lifecycle:** soft-delete + restore (don't hard-delete ideas); cleanup of abandoned uploads.

## DELIVERABLES
1. Audio bucket + RLS + signed URLs. 2. Layered-takes model + mix/order metadata.
3. Waveform peak storage/serve. 4. Storage accounting toward quota.
5. Seam: list memos (+ takes, waveform, signed URL, transcript, key/BPM/chords, states).
6. Soft-delete/restore + cleanup policy.

## ACCEPTANCE CRITERIA
- [ ] Audio is member-only via signed URLs; writes are self-only.
- [ ] A memo supports layered takes that play together; originals preserved.
- [ ] Waveform served without client full-file decode; storage usage tracked vs quota.
- [ ] One typed seam returns everything C4 needs incl. analysis states.
- [ ] Soft-delete/restore works; no orphaned/abandoned audio.

## CONSTRAINTS
Backend + seam only. Never weaken RLS or expose service-role. `lovable/voice-storage` → merge → delete.

## REFERENCES
- tables: `voice_memos`, `takes`, `voice_memo_transcripts`, `chord_progressions`, `storage_usage`
- `docs/prompts/L3-…intake-transcription.md`, `LX-…capture-ai-intelligence.md`, `L1-…schema-consolidation.md`
- Features: F10 (Voice Memo Cards/Waveforms), F16 (Layered Recording) in `zip_extracted/…/3. System operations/`
- `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §5/§11
