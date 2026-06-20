# LX — LOVABLE: AI-Enhanced Capture (Adobe-grade audio + lyrics + music intelligence)
## Cluster 1 (Capture) · Lane: `lovable/*` · Owner: Lovable (data spine + integrations)

> Paste into Lovable. Goal: make a rough phone hum come back **clean, transcribed,
> and musically understood** — the Adobe-Podcast-for-songwriters layer. All third-party
> API keys + calls live here (edge functions/secrets); Claude consumes results only via
> `src/integrations/cog/*`. Pairs with L3 (intake pipeline) and L4 (storage + analysis).

## YOUR ROLE
Lovable: Supabase, storage, **edge functions + third-party AI integrations + secrets**,
the typed `cog/*` seam. No UI. Contract: `docs/BUILD-PATHWAY.md`.

## CONTEXT
Capture's UI + recorder are done/hardened (Claude). A take currently flows
blob → `voice_memos`/`takes` → transcription (Lovable AI Gateway) →
`voice_memo_transcripts`. This prompt adds the **intelligence layer** so capture is
best-in-class for songs, lyrics, and worship ideas — singing, not just speech.

## OBJECTIVE
Three AI capabilities, integrated server-side, exposed through the seam, with graceful
fallback and a privacy-respecting on-device option:

### 1. Audio enhancement (Adobe-grade cleanup)
- Integrate **Dolby.io Media Enhance API** (or equivalent) as an edge function: take →
  enhanced take (denoise, de-reverb, level). Store both (original preserved — never
  destroy the raw idea) and expose the enhanced version for playback.
- Keep it **optional + async**: the raw take is usable immediately; enhancement arrives
  and swaps in when ready. Handle provider failure by falling back to the raw take.
- Baseline already in place client-side: `getUserMedia` `echoCancellation` +
  `noiseSuppression` + `autoGainControl`. Enhancement is the premium layer on top.

### 2. Transcription tuned for singing (lyrics)
- Evaluate **AssemblyAI / Deepgram** (word-level timestamps) vs the current Lovable AI
  Gateway for **sung** audio (harder than speech). Pick the most accurate; keep word
  timestamps (needed for karaoke lyrics + "say Verse/Chorus" section split).
- Populate `voice_memo_transcripts` (`transcript_text`, `word_timestamps`, status).
  Handle 402/429 + low-confidence (mark uncertain words rather than guessing).

### 3. Music analysis (BPM · key · chords from a hum)
- Integrate **Moises / Music.ai API** for BPM, key, and chord detection from a take →
  write to `chord_progressions` / song key+BPM per the L1 data flow. This is the
  songwriting magic (auto-fills the chord/key the writer was reaching for).
- Offer an **on-device alternative** (`Essentia.js` WASM) for basic BPM/key that keeps
  audio private and costs nothing — selectable per user/plan.

## PRIVACY (faith-community stance)
- Audio sent to third-party APIs must be disclosed; provide an **on-device-only mode**
  (Essentia + browser constraints, no cloud AI) for users who want it.
- Never send audio to any provider without the user's take being theirs; document data
  handling + retention per provider. No training on user audio where avoidable.

## SEAM (what Claude consumes)
Expose typed `cog/*` functions: enhanced-take URL, transcript (text + word timestamps +
confidence), and detected key/BPM/chords — with clear "pending/ready/failed/unavailable"
states so the UI can show progress and degrade gracefully. Document them.

## DELIVERABLES
1. Enhancement edge function + original-preserving storage + enhanced playback URL.
2. Singing-tuned transcription with word timestamps + confidence + quota handling.
3. BPM/key/chord detection (cloud Moises/Music.ai + on-device Essentia option).
4. Privacy doc + on-device-only mode.
5. Documented `cog/*` capture-intelligence seam with explicit states.
6. Provider comparison note (cost, accuracy on singing, latency, privacy) + recommendation.

## ACCEPTANCE CRITERIA
- [ ] A rough take returns an enhanced version (raw preserved); failure falls back to raw.
- [ ] Transcription returns word-timestamped lyrics tuned for singing; low-confidence flagged.
- [ ] Key/BPM/chords detected and stored; on-device option works without cloud.
- [ ] All AI states (pending/ready/failed/unavailable) exposed via the seam.
- [ ] Privacy disclosed; on-device-only mode available; no secrets client-side.

## CONSTRAINTS
Backend + integrations + seam only. Secrets in Supabase/edge env, never client. Original
audio is never destroyed. `lovable/capture-ai` → merge → delete. Cost-aware (gate heavy
AI behind plan tiers if needed — coordinate with L9).

## REFERENCES
- `src/integrations/cog/transcript.ts`, `canvas.ts`, `supabase/functions/*`, `commit-take*`
- tables: `voice_memos`, `takes`, `voice_memo_transcripts`, `chord_progressions`, `songs`
- `docs/prompts/L3-lovable-capture-intake-transcription.md`, `L1-…schema-consolidation.md`
- Providers: Dolby.io Media Enhance · AssemblyAI/Deepgram · Moises/Music.ai · Essentia.js
- `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §5
