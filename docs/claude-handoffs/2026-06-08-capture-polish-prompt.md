# Claude prompt — polish the Capture → Review → Canvas flow

Copy this into Claude when he's back. The Lovable session already shipped the working pipeline; this prompt is for visual/motion polish and the two stretch features.

---

## Context

The capture flow is live and saves end-to-end:

- `src/components/capture/CaptureScene.tsx` — wires everything.
- `src/components/capture/BigMic.tsx` — gold mic.
- `src/components/capture/SideRail.tsx` — five labeled chips.
- `src/components/capture/CaptureSheet.tsx` — generic side-rail sheet (idle taps).
- `src/components/capture/ReviewSheet.tsx` — auto-opens after stop. Calls `requestTranscript` + `pollTranscriptUntilReady`, lets the user edit blocks, then `commitTakeToCanvas` → navigates to `/songs/:id/canvas?from=capture`.
- SDK: `src/integrations/cog/{transcript,canvas,takes,intake,songs}.ts`.
- Backend: `transcribe-take` (Gemini 2.5 Flash) + `commit-take` edge functions; `canvas_cards` table with RLS.

## What I want you to polish (UI only — no data contract changes)

1. **ReviewSheet visual rhythm** — Replace the basic `<audio controls>` with a custom gold scrubber matching the COG palette (cream surface, gold playhead, serif timecode). Add a waveform if cheap.
2. **Block cards** — Add subtle entrance animation (Framer Motion `translateY(8px)` → `0`, 250ms) as transcript blocks arrive. Section labels in `var(--font-display)`. Drag-to-reorder using `framer-motion` Reorder.
3. **Section chips inside LiveTranscript** — When a section keyword fires mid-recording, slide in an inline chip ("Chorus", "Verse 2"). Hook into the live `manualMarkers` state already exposed.
4. **Canvas arrival pulse** — In `src/pages/SongCanvasPage.tsx`, when `?from=capture` is in the URL, query `listCanvasCards(songId)` and pulse newly-created cards gold for 1.5s. Tapping a card with `take_id + start_ms` should play that slice using `getTakeSignedUrl(storage_path)`.
5. **Empty-state copy** — Capture scene when idle: warm one-liner above the mic ("Hum it. Speak it. Mark it.") in serif. Don't be subtle — Adobe rule.

## Stretch — only if time

1. **`useLiveTranscript()` hook** at `src/hooks/useLiveTranscript.ts` using browser `SpeechRecognition` (webkit prefix on iOS). Stream partials into `LiveTranscript`. Batch transcript from `transcribe-take` remains the source of truth on stop.
2. **Keyboard shortcuts** — Space toggles mic; 1–5 fire rail chips (only on `/` and `/capture`).
3. **Pending-pin merge UX** — When pending blocks exist and the user stops a take, surface them alongside transcript blocks with a "from your pins" badge.

## Constraints (locked)

- Cream background, gold mic and CTAs, serif section labels. No Adobe purple/dark.
- Mobile-first 390px. Respect `prefers-reduced-motion`.
- Do NOT change: `commit-take`/`transcribe-take` request/response shapes, `canvas_cards` columns, the `submitSharedAudio` contract, or the `requestTranscript` polling cadence.
- Do NOT add new backend code — ping Lovable for migrations/edge fns.

## Acceptance check (manual)

1. Sign in → land on `/` → big mic visible immediately.
2. Tap mic → say "Verse 1, ..." → "Chorus, ..." → tap stop.
3. Review sheet opens. Audio plays. Transcript appears within ~10s.
4. Edit a block. Tap "Add to canvas".
5. Lands on `/songs/:id/canvas` — cards visible, newly-arrived ones pulse gold, tapping plays the audio slice.