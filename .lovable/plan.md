## The verdict from research

Studied: **Suno mobile**, **Adobe Podcast**, **Dubnote**, **Suonote**, **Lyric Genie**, **AudioPen**, **Voicenotes**, **Otter**. Best ideas — distilled — that fit Colors of Glory's warmth (no DAW chrome, no startup blue):

| Source | Steal this | Reject this |
|---|---|---|
| **Adobe Podcast / Enhance Speech** | One big inviting target. Whole canvas is the action. Zero chrome. | Studio-tech aesthetic, dark grays. |
| **Suno mobile** | One-thumb composition. Prompt-bar pinned to the bottom; results bloom upward. Big tactile generate button. | AI-as-author. We're capture, not generation. |
| **Dubnote** | **Auto-split a single recording into sections** (verse/hook/riff) on-device. BPM auto-detect. Friendly section chips. | Heavy folder hierarchy. |
| **Suonote** | "Compose by sections" — recording lives inside a section card, not a flat list. Lyrics-in-context. | Crowded studio screen. |
| **AudioPen / Voicenotes** | The "talk → it becomes clean text" magic. Zero post-edit pressure. | Generic productivity vibe. |
| **Lyric Genie** | Inline AI assist on a lyric line. | Notepad-feel; not enough room metaphor. |

**Our north star (now locked):**
> *Big mic in the middle. Talk. By the time you've put the phone down, your idea is already a card on a canvas — labeled, transcribed, split into sections, and waiting for the next thought.*

---

## The Capture Scene becomes the home (already true — extend it)

`CapturePage` is already wired at `/` and `/capture`. We keep that. We elevate it to feel like the front door of the product, not a tool tucked inside a song. Mockup intent:

```text
┌─────────────────────────────┐
│  Today                  ⚙   │  ← only 2 chrome elements
│                             │
│        "What's on your      │
│         heart right now?"   │  ← serif, charcoal, breathes
│                             │
│                             │
│           ◉ ◉ ◉             │  ← live waveform when active
│         ╭───────╮           │
│         │   🎤  │           │  ← BigMic, 128px, gold glow
│         ╰───────╯           │
│         Hold to hum         │
│                             │
│  ┌─────┬─────┬─────┬─────┐  │  ← SideRail, now a bottom dock
│  │Lyric│Chord│Scrip│Idea │  │      (one-thumb reach on 390px)
│  └─────┴─────┴─────┴─────┘  │
│                             │
│       Latest: "Hook idea"   │  ← peek-strip of last 3 captures
│       28s · 2 sections      │
└─────────────────────────────┘
```

Cream background, single radial glow under the mic, serif prompt, no nav bar, no song picker (defaults to **Unfiled**, song chip only appears when one is selected). Settings is one icon, top-right.

---

## What we're building (Phase 1.6 of capture)

Eight focused upgrades. Each is small, ships independently, and every one removes a tap.

### 1. **Idle prompt that rotates by time of day** *(UI only)*
- Morning: *"What's the first line that came to you?"*
- Afternoon: *"Hum the melody you can't shake."*
- Evening: *"Anything from today worth remembering?"*
- Sunday: *"What did worship stir in you?"*

Charcoal serif, 24px, fades 600ms when recording starts.

### 2. **Hold-vs-tap mic with intent visible** *(UX clarity)*
- **Tap** → records until you tap again (toplines/full ideas).
- **Hold** → hum mode, releases when you let go (the 8-second melody fragment).
- Tooltip ring under the mic shows which mode is engaged in real time. (Adobe Podcast big-target language.)

### 3. **Live transcript bloom** *(existing, polished)*
While you speak, transcript appears **above** the mic in muted gold partials → snaps to charcoal on finalize. The phone never feels like a form.

### 4. **Auto section split — the headline feature** *(Dubnote stolen well)*
On stop, the take is auto-split into section cards via two signals:
1. **Spoken markers** in transcript ("verse one", "this is the chorus", "bridge", "tag", "intro", "outro"). Already partially handled by `sectionKeywords.ts` — extend its vocabulary, add fuzzy match ("the chorus part", "okay chorus"), and ensure the marker word itself is stripped from the card body.
2. **Acoustic silence boundaries** — pauses ≥ 1.6s become soft splits. Uses `AnalyserNode` RMS dip detection (no new dep, no upload).

Each split renders as its own **section card** with: auto-label (`Verse 1`, `Hook`, etc.), waveform thumbnail, transcript snippet, durations. User can drag, rename, or merge cards before committing.

### 5. **The Review Sheet becomes the canvas pre-stage** *(existing → enhanced)*
Today's `ReviewSheet` is functional but flat. New layout:
- Top: friendly name field with AI suggestion ("Morning Mercy — Verse 1").
- Middle: **stack of section cards** (from #4) the user can swipe-reorder, swipe-left to merge with previous, tap to rename.
- Bottom: **destination chip** with three big targets — *Unfiled* / *This Song* / *New Song* — and a single primary CTA **"Send to canvas →"**.
- A single tap commits all cards as nodes on the song's Canvas (existing `/songs/:id/canvas` route).

### 6. **Latest peek-strip** *(returning-user delight)*
Below the dock, a horizontally-scrollable strip of the **last 3 captures** as 96px mini-cards: title, duration, "2 sections" pill, tiny gold play affordance. Tap to resume in Review Sheet. Builds the muscle memory that capture *goes somewhere*.

### 7. **One-tap "Open Canvas" after commit** *(removes a navigation tax)*
Today: commit → toast → user has to find the canvas. New: commit shows a 1.5s ribbon — *"3 cards added to **Morning Mercy** →"* — tappable, deep-links straight to the canvas with those new nodes pulsing for 800ms so the user sees where their work landed.

### 8. **Side rail labeled-icons, always visible** *(per user spec)*
The dock buttons (Lyrics / Chords / Scripture / Idea) keep their label always-on, not on hover. Tapping any of them while idle opens the CaptureSheet for that block. While recording, they become **markers** — tapping "Chords" mid-take pins a chord-section marker at the current timestamp (same mechanism as #4 spoken markers).

---

## Files (UI only — Lovable boundary respected)

All work in `src/components/capture/**` plus a tiny lib helper. Backend, schema, edge functions, and `src/integrations/cog/**` untouched — everything exists.

**Edit**
- `src/components/capture/CaptureScene.tsx` — rotating prompt, peek-strip slot, settings icon, idle/recording state polish.
- `src/components/capture/BigMic.tsx` — hold-vs-tap intent ring, friendly mode label.
- `src/components/capture/SideRail.tsx` — promote to bottom dock with always-on labels.
- `src/components/capture/ReviewSheet.tsx` — section-card stack, destination chip, "Send to canvas" CTA, post-commit ribbon.
- `src/lib/capture/sectionKeywords.ts` — extend vocab + fuzzy match, strip marker word from card body.

**Create**
- `src/components/capture/SectionCardStack.tsx` — reorderable + mergeable card list used by Review Sheet.
- `src/components/capture/LatestPeekStrip.tsx` — horizontal scroll of last 3 captures.
- `src/components/capture/CommitRibbon.tsx` — post-commit deep-link toast-ribbon.
- `src/lib/capture/acousticSplits.ts` — RMS-dip silence detection from a `Blob` + `AudioContext` (zero deps).
- `src/test/capture/acousticSplits.test.ts` — unit test on a stub buffer.
- `src/test/capture/sectionKeywords.test.ts` — extend with fuzzy + strip cases.

**Do not touch**
- `src/integrations/cog/**` (Lovable boundary).
- Any migration, edge function, or backend file.
- Storage bucket policies. The existing `voice-memos` flow handles the upload + ELabs transcription already.

---

## Out of scope (intentional — these are the *next* round, not this one)

- BPM/key detection from acoustic features (needs a real DSP pass; later).
- Canvas-side node entrance animation polish (Claude Code handoff already covers `/songs/:id/canvas`).
- Voice command shortcuts ("delete that", "rename verse 2"). Belongs in a v2 once dictation lands.
- Apple Voice Memos import beyond what `ImportMemoButton` already does.

---

## Acceptance scenarios

1. **Cold open** — Open the app. Cream screen, serif prompt, mic glowing. No nav, no menus. Tap mic, speak for 18 seconds saying "verse one … under your wing I rest … chorus … you are my hiding place." Stop. Review Sheet opens with **two section cards** — Verse 1 and Chorus — each with its own waveform and transcript snippet. Marker words don't appear in card bodies.
2. **One-thumb** — Whole flow (open → record → name → send to canvas) reachable with right thumb on a 390px viewport.
3. **Returning** — Open the app the next morning. Peek-strip shows "Morning Mercy", "Bridge hum", "Scripture: Psalm 91". Tap "Bridge hum" → Review Sheet re-opens at that take.
4. **Hum mode** — Hold the mic for 4 seconds. Release. Take saves as an 8-second-or-less *hum* card, no transcript expected, waveform-only.
5. **Mid-take marker** — Recording. Tap "Chords" in the dock. Continue. Stop. Review Sheet shows a chord-marker pinned at the moment of the tap, separating sections.
6. **Canvas handoff** — Tap "Send to canvas". Ribbon appears: "3 cards added to Morning Mercy →". Tap. Land on `/songs/:id/canvas` with the three new nodes pulsing gold for 800ms.

---

## Why this is the right next step

The bones are already here — `CaptureScene`, `BigMic`, `SideRail`, `LiveTranscript`, `ReviewSheet`, `useVoiceRecorder`, `useLiveTranscript`, `transcribe-take` edge function, `idea_captures` + `takes` tables, the Canvas route. The plan finishes the **last mile** between "I had a thought" and "it's already on the canvas" without adding any backend surface area. Everything else (dictation everywhere, scripture picker, smart chords) plugs in on top of this scene without rework.
