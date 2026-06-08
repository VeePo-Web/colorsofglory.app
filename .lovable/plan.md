## Research takeaways

From Adobe Podcast/Studio design research, the strongest principles to borrow are:

- **People think in words, not waveforms.** Audio should become editable lyric/idea blocks as quickly as possible.
- **Do not be subtle.** Labeled actions beat icon-only controls; the user should never wonder what a side button does.
- **Fewer knobs, fewer mistakes.** Keep the first scene focused on recording, marking, and reviewing — not advanced editing.
- **Make hard work invisible.** Recording, transcription, section detection, saving, and canvas handoff should feel like one flow.
- **Story-first, not tool-first.** For Colors of Glory this becomes “song idea first,” not “audio file first.”

## Current state

The app already has the right foundation:

- `/` opens the new Capture scene.
- `BigMic` gives a large gold microphone with recording pulse and live amplitude.
- `SideRail` has labeled tools: Lyrics, Chords, Section, Scripture, Idea.
- Spoken section parsing already detects phrases like “Verse 1,” “Chorus,” and “Bridge.”
- Backend/SDK hooks now exist for transcription and committing transcript blocks to canvas.

The main missing product layer is the **frictionless review-and-commit UI** after recording stops.

## Plan

### 1. Make Capture the true first scene

Keep the first screen as a calm, full-screen recording surface:

```text
Top:       destination chip / simple options
Center:    big gold microphone
Side/near: labeled capture buttons
Bottom:    live transcript preview / state text
After stop: review sheet slides up
```

The first impression should be: “I can sing, speak, hum, or mark an idea immediately.”

### 2. Upgrade the side buttons into real capture tools

Turn each rail button into an explicit timestamped action:

- **Lyrics** — starts/marks lyric text capture.
- **Chords** — drops a chord/key/BPM pin.
- **Section** — drops Verse / Chorus / Bridge marker.
- **Scripture** — drops a scripture/meaning note pin.
- **Idea** — drops a general note/theme pin.

While recording, every tap creates a time-linked pin. While idle, tapping opens a compact progressive sheet for typing/pasting that content.

### 3. Add live section intelligence

During recording:

- Spoken phrases like “Verse 1,” “Chorus,” “Bridge,” “Tag,” and “Outro” should show as inline section chips.
- Manual side-button pins should override voice detection near the same timestamp.
- The live transcript area should stay lightweight: last 1–2 lines plus detected section chips, not a full editor.

### 4. Build the post-recording Review Sheet

When the user stops recording, open a bottom sheet instead of only showing a toast.

Review Sheet contents:

- take title / rename field
- duration + small waveform scrubber
- destination picker: current song, unfiled, or new song
- structured blocks:
  - Verse 1
  - Chorus
  - Chords
  - Scripture / note
  - Idea
- simple edit controls:
  - rename block
  - change block type
  - merge/split
  - delete
- primary gold CTA: **Add to canvas**

This is where the voice memo becomes organized songwriting material.

### 5. Canvas handoff behavior

On **Add to canvas**:

- Lyrics blocks become lyric cards/section zones.
- Chord pins become chord cards.
- Scripture pins become meaning/scripture cards.
- Idea pins become idea cards.
- Each card keeps the audio time range so tapping it can play that exact slice later.

The flow should land on `/songs/:id/canvas` with the new cards already visible.

### 6. Keep this in the Colors of Glory design language

Use the locked COG system, not Adobe’s dark/purple style:

- cream background
- warm gold mic and active states
- serif section labels
- explicit labeled buttons
- soft spiritual glow
- mobile-first 390px layout
- calm, non-overwhelming motion

### 7. Role boundary

Because the project memory says Claude owns frontend UI, the implementation should be handed to Claude for files under `src/pages/**` and `src/components/**`.

Lovable should only support this with:

- typed SDK updates under `src/integrations/cog/*` if needed
- backend/function fixes if the review sheet exposes a missing API
- handoff docs describing exact UI behavior and data contracts

## Success criteria

- Opening the app shows the big mic first.
- User can record immediately with one tap.
- Side buttons are obvious and labeled.
- Saying “Verse 1” or “Chorus” creates separate transcript blocks.
- Stopping opens a review sheet, not a dead end.
- User can edit the blocks and send them to canvas in one tap.
- Canvas receives organized cards linked back to the original voice memo.