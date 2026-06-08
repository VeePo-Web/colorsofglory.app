# Handoff — Floating Capture Bar + Progressive Capture Sheet

_Owner: Claude. Backend + SDK already shipped by Lovable._

## SDK

```ts
import { quickCapture } from "@/integrations/cog/capture";
import { createTake, buildTakeStoragePath } from "@/integrations/cog/takes";
import { supabase } from "@/integrations/supabase/client";
```

## Pattern 1 — Capture Bar

- Component: `src/components/cog/CaptureBar.tsx`.
- Mounted in root layout. Hidden on `/auth`, `/onboarding`, `/invite/:token`, full-screen recorder/canvas.
- 56px, sits at `bottom: env(safe-area-inset-bottom) + 16px`. Sits BELOW the mini-player when both visible (capture bar = lower z-index in the combined dock).
- Anatomy: gold mic (left) · input stub `"Start with a title, feeling, or scripture…"` (center) · `+` (right).
- States: hidden | resting | hold-recording (inline waveform) | offline ("Offline — captures will sync").
- Context: inside `/song/:id/*` → captures land in that song. Outside → `song_id: null` (Unfiled — surfaced via `listMyUnfiledCaptures`).
- Zustand store `useCaptureStore`: `{ sheetOpen, currentSongId, mode: 'collapsed'|'expanded' }`.
- A11y: mic `aria-label="Hold to record voice memo"`, input stub `aria-haspopup="dialog"`. Hotkeys: `C` opens, `Space` while focused starts recording.

## Pattern 2 — Progressive Capture Sheet

- Component: `src/components/cog/CaptureSheet.tsx`. shadcn `Sheet`, drag-to-dismiss, max 90vh.
- Stage 1: single serif title input, "Add more" link (gold), `Save idea` CTA.
- Stage 2 (after "Add more"): staggered fade-up reveal of lyric snippet, voice memo attach, section dropdown (only with song context), scripture reference field (`Book Ch:Vv` validation), tags chip input.
- Save → call `quickCapture({ song_id, title, lyric_snippet, scripture_ref, tags, section_id, voice_memo_id })`.
- If voice memo attached: upload to `voice-memos` bucket first using path `buildTakeStoragePath(song_id, user_id, takeId)`, create the `voice_memos` row + `createTake({ make_primary: true })`, then pass `voice_memo_id` to `quickCapture`.
- Toast on success: "Saved to <song title>" or "Saved to Inbox".

## Anti-patterns
- No badge counts on the bar.
- No delete on captures from the sheet (archive lives in detail views).
- Never autoplay anything from the capture flow.