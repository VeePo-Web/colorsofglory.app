# L12 — Lovable ask: `transcribe-take` LLM segmentation & repair (F12 Step 4)

**From:** C2 (Capture lane) · **To:** Lovable (backend) · **Feature:** F12 "Say-It-Structured"
**Consumes:** `docs/TRANSCRIPTION-CONTRACT.md` (the client half of the hybrid pipeline)

## What we're asking for

Upgrade the `transcribe-take` edge function so that, after Whisper transcription, a
**Claude pass segments and repairs the transcript** before the blocks are written to
`takes.transcript_json`. Today the function returns blocks; this ask makes those blocks
world-class on messy, ambiguous, real-world takes:

1. **Resolve ambiguous section markers.** The client's deterministic regex splits on
   clearly-announced sections ("…[pause] verse two [pause]…") and *flags* doubtful ones
   ("every verse of this psalm"). The LLM pass decides the doubtful ones with full context.
2. **Clean disfluencies.** Strip "um/uh/like/you know" fillers from lyric bodies — never
   from the raw transcript, only from the derived block text.
3. **Infer unannounced structure.** When a take has verse-like and chorus-like passages the
   writer never labeled, propose the split ("this reads like a chorus") with a lowered
   `confidence` so the client can show it as a suggestion.
4. **Strip announcements from bodies.** Same invariant as the client: the words "verse two"
   never appear inside the block text — the card shows the lyric, not the announcement.

## Hard constraints (contract)

- **The response shape does NOT change.** Return the same `transcript_json.blocks` —
  `{ id, kind, section_kind, label, text, start_ms, end_ms }[]` with
  `kind ∈ lyrics|chords|scripture|idea|section`. Downstream (ReviewSheet, commit-take,
  canvas) must keep working with zero client changes.
- **Additive fields only** (already typed client-side in `src/integrations/cog/transcript.ts`):
  - `blocks[].confidence?: number` — 0..1 segmentation confidence. `< 0.5` means the client
    treats it as a suggestion (one-tap confirm), not an applied split.
  - `transcript_json.words?: { text, start_ms, end_ms }[]` — Whisper **word-level timestamps**
    (please enable `timestamp_granularities: ["word"]` or equivalent). Powers per-section
    audio clipping when a take is reopened later.
  - `transcript_json.segmentation?: "regex" | "llm" | "llm_fallback_regex"` — which pass
    produced the blocks (observability).
- **Hybrid, not replacement.** Run the deterministic pass first (the same rules as the
  client's `sectionKeywords.ts`; port or approximate them server-side). If the LLM call
  fails, times out, or credits are exhausted → **return the deterministic result** with
  `segmentation: "llm_fallback_regex"`. Transcription must never dead-end on the AI pass.
- **Raw take is never mutated.** `raw_text` keeps the verbatim transcript; segmentation is
  derived data.
- **Keep the existing credit semantics.** 402 `credits_exhausted` / 429 `rate_limited`
  behavior stays exactly as-is — the client already handles both gracefully and falls back
  to its on-device deterministic split.

## Claude call — model + params (per the claude-api reference)

- **Model:** `claude-opus-4-8` (default; do not silently downgrade — if you want a cheaper
  tier for this route, that's a product/cost decision to flag, e.g. `claude-haiku-4-5`).
- **Thinking:** adaptive — `thinking: { type: "adaptive" }`. Do **not** send
  `budget_tokens`, `temperature`, `top_p`, or `top_k` (removed on Opus 4.8; they 400).
- **Effort:** `output_config: { effort: "medium" }` — segmentation is structured extraction,
  not open-ended reasoning; bump to `"high"` only if eval shows misses.
- **Structured outputs:** enforce the block shape with
  `output_config.format = { type: "json_schema", schema: BLOCKS_SCHEMA }` so the response is
  guaranteed-parseable — no regex-fixing model JSON. Schema notes: every object needs
  `additionalProperties: false`; no `minimum`/`maximum` (validate ranges in code).
- **Input:** the Whisper words WITH timestamps (the pause structure is the disambiguation
  signal — the model needs the gaps, not just the text), plus the deterministic pass's
  markers + confidences as candidates to confirm/reject.
- **Prompting:** instruct it to (a) prefer confirming the deterministic markers over
  inventing new ones, (b) never leave announcement words in block text, (c) assign
  `confidence` honestly — inferred/unannounced structure caps at ~0.45 so the client shows
  it as a suggestion, (d) keep `start_ms`/`end_ms` aligned to the word timestamps it was given.
- **Timeout/retry:** one retry on 429/5xx with backoff, then deterministic fallback. The
  poll window client-side is 45s — keep the whole pipeline comfortably under it.

### Example call shape (TypeScript, Deno edge function)

```ts
import Anthropic from "npm:@anthropic-ai/sdk";

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY from env

const response = await anthropic.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 8192,
  thinking: { type: "adaptive" },
  output_config: {
    effort: "medium",
    format: { type: "json_schema", schema: BLOCKS_SCHEMA },
  },
  system: SEGMENTATION_SYSTEM_PROMPT, // stable — cacheable prefix
  messages: [{ role: "user", content: JSON.stringify({ words, candidateMarkers }) }],
});
```

## Acceptance checks

- A clean spoken take ("verse… chorus… bridge") returns the same 3 blocks the regex found —
  `segmentation: "llm"` (or `"regex"` if you skip the LLM when regex confidence is uniformly high).
- "Every verse of this psalm" sung mid-lyric does NOT split; if returned as a candidate its
  `confidence < 0.5`.
- "Um, okay so, uh, grace in the waiting" → block text "grace in the waiting" (raw_text untouched).
- An unlabeled two-part take returns a proposed split with `confidence ≤ 0.45`.
- Kill the Anthropic key → function still returns deterministic blocks with
  `segmentation: "llm_fallback_regex"`; client review continues to work.
- `transcript_json.words` present with per-word `start_ms`/`end_ms`.
