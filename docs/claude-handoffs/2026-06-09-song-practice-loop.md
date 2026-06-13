# Song Practice Loop — Feature Spec
## Handoff: Claude Build Session
### Priority: High · Target: Canvas workspace + Ideas capture space

---

## WHY THIS EXISTS

A songwriter writes a song. The voice memos are in the app. The lyrics are in the app. But memorizing it — actually getting the words and melody into muscle memory — happens while driving, doing dishes, going for a walk. That window is currently dead time because replaying sections requires too many taps.

**The driving mandate is the entire design constraint.** Every interaction must be completable without looking at the screen. This is not a "nice to have" — it is the north star for every UI decision in this feature. If a flow requires more than one deliberate tap to change what's looping, it is too complex.

The result: a songwriter taps "Practice" once inside their song workspace, the current section starts looping, and they can drill the entire song in the car using only their thumb — no eyes, no precision, no menus.

---

## THE TWO ENTRY POINTS

### Entry Point 1: Song Workspace (Canvas) — Primary

Button in the top action bar of any Song Workspace: `Practice ↺`

On tap: opens the Practice Player as a full-screen sheet over the workspace.
The player automatically queues the song's voice memos in section order.

### Entry Point 2: Capture Page / Idea Space — Secondary

On any Seed Idea Card or Voice Memo card: a small `↺` loop icon next to the play button.

On tap: opens the Practice Player in "single idea" mode — just that recording on infinite loop. No section selection, no sequence builder. Pure repeat of one recording.

This mode is explicitly for: "I just hummed a chorus melody. I want to keep looping it while I work out the words."

---

## THE PRACTICE PLAYER — VISUAL ARCHITECTURE

The Practice Player is a **full-screen dark experience** (background: `#1C1A17`) that takes over the entire screen while active. It is NOT a bottom sheet — it is the whole screen. The reason: driving safety requires the entire screen real estate for massive touch targets.

```
┌─────────────────────────────────────────┐
│                                         │
│  ←  Grace in the Waiting          ⚙    │  ← 56px top bar
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  CHORUS                          │   │  ← Active section badge
│  │  Looping · 3 of ∞               │   │    (large, gold, centered)
│  └──────────────────────────────────┘   │
│                                         │
│  ════════════════════════════════════   │  ← Waveform / progress
│                                         │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │  Amazing grace how sweet the     │   │  ← Current section lyrics
│  │  sound that saved a wretch like  │   │    (large, auto-scrolls)
│  │  me. I once was lost but now am  │   │    Tap to toggle show/hide
│  │  found...                        │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
│     ◀◀          ▶ ‖         ▶▶          │  ← 80px tap targets each
│   Prev sec    Play/Pause   Next sec     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ←  Verse 1   Chorus ●   Bridge │    │  ← Section strip (scrollable)
│  └─────────────────────────────────┘    │
│                                         │
│  [ Loop Single ]  [ Sequence ]  [ All ] │  ← Loop mode pills
│                                         │
└─────────────────────────────────────────┘
```

---

## LOOP MODES — THE THREE STATES

### Mode 1: Loop Single (default)

The currently active section loops forever. Every repeat is seamless — 0 gap or a user-configurable 0.5s breath gap (accessed via ⚙ gear icon, not the main screen).

Indicator: `"CHORUS · Looping · ×4"` — shows how many times it's repeated.

Tap the section strip to jump to a different section. That section immediately starts looping.

**This is the primary mode. 80% of use cases are "loop THIS section until I know it."**

### Mode 2: Loop Sequence

User builds a custom ordered list of 2–5 sections.

The sequence plays through in order, then repeats from the start.

Example: `[Chorus → Bridge → Chorus → Bridge]` — great for drilling the section transition.

Indicator: `"CHORUS → BRIDGE → repeat · section 1 of 4"`

**How to build a sequence (without looking — the driving-safe version):**
1. Tap "Sequence" pill
2. Screen shows large section buttons in a 2-column grid (each button 100px tall)
3. Tap sections in the order you want them (they get numbered: 1, 2, 3...)
4. Tap "Start" (large button, bottom center)
5. Sequence plays immediately

**How to reorder / adjust:** Only via the ⚙ gear (settings tray). Not accessible during driving. That is intentional.

### Mode 3: Loop All

All sections in the song, in standard arrangement order, playing through end-to-end, then repeat.

Indicator: `"VERSE 1 → PRE-CHORUS → CHORUS → ... · full song · run 2"`

This is "just play the whole song on repeat" mode — like putting an album on repeat while you learn the words.

---

## THE SECTION STRIP — THE CORE NAVIGATION ELEMENT

This is the horizontal scrollable row of section chips at the bottom of the player. It is the primary navigation for driving-safe use.

Each chip:
- **Minimum height: 52px** — absolutely no smaller (thumb target for driving)
- **Minimum width: 88px**
- **Active chip:** gold background, white text, slightly larger
- **Inactive chips:** cream/dark border, muted text

Behavior:
- Scrollable left/right with inertia (horizontal scroll, no buttons)
- Tap a chip: jumps immediately to that section in Loop Single mode
- Long-press a chip (0.4s): adds it to the current sequence (if in Sequence mode) with haptic feedback and a brief "+1" animation
- Current playing chip always auto-scrolls to center

Driving gesture shortcut:
- **Swipe right** anywhere on the player (not on the section strip): advances to next section
- **Swipe left** anywhere on the player: goes back to previous section
- These are large gesture targets — the entire main area of the screen responds

---

## PLAYBACK SPEED CONTROL

Accessible via the ⚙ gear icon (settings tray):

**Speed options:** `0.5×`, `0.75×`, `1.0×` (default), `1.25×`

**Why this matters:** Learning a difficult verse at 0.75× speed until it's automatic, then stepping up to 1.0×. This is how professional musicians learn.

Default: `1.0×`. The speed persists across the session but resets to 1.0× when the player is closed.

---

## SECTION GAP / BREATH

Accessible via ⚙:

**Options:** `0s gap`, `0.5s gap` (default), `1s gap`, `2s gap`

A gap between loops gives the singer a moment to breathe and prepare for the next repeat. Default 0.5s feels natural. A worship leader learning a fast verse might want 0s. Someone learning chord progressions might want 2s.

---

## COUNT-IN (optional, power feature)

Accessible via ⚙:

Toggle: `Count-in: Off / On`

When enabled: before each section plays (on every loop), a subtle audio click plays 4 clicks at the BPM of the song (if BPM is set). Like a drummer counting in a band.

Implementation note: the BPM is taken from the song's `chord_charts.bpm` field. If no BPM is set, this option is grayed out with a tooltip "Set a BPM in your song's chords to enable count-in."

---

## LYRICS DISPLAY

The lyrics panel shows the full text of the current section.

**Display rules:**
- Font: `var(--font-display)` (Playfair Display, serif) — the song is artistic content
- Size: `clamp(1.1rem, 3.5vw, 1.4rem)` — large enough to read at arms-length in a car
- Color: `rgba(255,255,255,0.85)` on dark background
- Chord chips suppressed (they clutter the view when practicing)
- Section label as an eyebrow above the text: `"CHORUS · 2nd time"` style

**Auto-scroll:** if the section lyrics exceed the panel height, they auto-scroll through the section at the pace of the voice memo duration, then return to top for the next loop.

**Toggle:** tap the lyrics area to show/hide. State persists per session. Hidden state shows a subtle waveform animation instead — less visual noise for driving.

**"No lyrics yet":** If the section has no transcription/lyrics, the panel shows the static waveform bars and the section label. The feature still works — it's just audio.

---

## BACKGROUND AUDIO SESSION — THE DRIVING-CRITICAL PIECE

This feature only matters if audio keeps playing when:
1. The screen locks
2. The user switches apps (Maps, Messages)
3. The phone is face-down in a cupholder

**Implementation requirements:**

```typescript
// src/lib/audio/practiceSession.ts

// Web Audio API / HTML Audio playback must use:
// - audio.play() persists on lock screen
// - MediaSession API for lock screen controls
// - wakeLock API to prevent screen dimming during active session (optional, battery tradeoff)

// MediaSession controls:
navigator.mediaSession.metadata = new MediaMetadata({
  title: currentSection.label,       // "Chorus"
  artist: "Colors of Glory",
  album: song.title,                  // "Grace in the Waiting"
  artwork: [{ src: '/cog-icon-512.png', sizes: '512x512', type: 'image/png' }],
});

navigator.mediaSession.setActionHandler('previoustrack', () => goToPrevSection());
navigator.mediaSession.setActionHandler('nexttrack', () => goToNextSection());
navigator.mediaSession.setActionHandler('play', () => resumeLoop());
navigator.mediaSession.setActionHandler('pause', () => pauseLoop());
navigator.mediaSession.setActionHandler('seekbackward', () => restartCurrentLoop());
navigator.mediaSession.setActionHandler('seekforward', () => goToNextSection());
```

**Lock screen controls the driver sees:**
- Song title: "Grace in the Waiting"
- Track title: "Chorus · ×5" (updates each repeat)
- Previous: jump to previous section
- Next: jump to next section
- Play/Pause: toggle loop
- Scrub bar: position within current section

This is the most important technical requirement. A songwriter who starts practice mode before getting in the car must be able to navigate sections entirely from their lock screen.

---

## THE SETTINGS TRAY (⚙ gear icon)

A bottom sheet that slides up from the gear icon. Not accessible by accident. Contains all the precision controls.

```
┌──────────────────────────────────────────────┐
│  ╌╌╌╌ (handle)                               │
│                                              │
│  Practice Settings                           │
│                                              │
│  Playback speed                              │
│  [0.5×]  [0.75×]  [1.0× ●]  [1.25×]         │
│                                              │
│  Gap between loops                           │
│  [0s]  [0.5s ●]  [1s]  [2s]                 │
│                                              │
│  Count-in (requires BPM)                     │
│  ─────────────────────────── [Toggle OFF]    │
│                                              │
│  Show lyrics during practice                 │
│  ─────────────────────────── [Toggle ON ●]   │
│                                              │
│  Repeat count per section (Sequence mode)    │
│  Play each section  [1×]  [2×]  [3×]  before │
│  advancing to the next.                      │
│                                              │
│  ─────────────────────────────────────────── │
│  Done                                        │
└──────────────────────────────────────────────┘
```

The "Repeat count per section" is powerful: in sequence mode `[V1 → Ch → V2 → Ch]`, you can say "play each section 2× before moving on" — so V1 plays twice, then Chorus plays twice, then V2 plays twice, etc. This lets the songwriter drill each section before the sequence continues.

---

## THE SEQUENCE BUILDER SCREEN

When the user taps "Sequence" pill (while parked / not driving), a full-screen sequence builder appears.

```
┌──────────────────────────────────────────┐
│  ← Build your loop                       │
│                                          │
│  Tap sections in the order to loop them  │
│                                          │
│  ┌─────────────┐  ┌─────────────┐        │
│  │             │  │   2         │        │
│  │  Verse 1    │  │  ● CHORUS   │        │  ← Each section is a large
│  │             │  │             │        │    card (min 100px height)
│  └─────────────┘  └─────────────┘        │
│                                          │
│  ┌─────────────┐  ┌─────────────┐        │
│  │  3          │  │             │        │
│  │  ● Bridge   │  │  Pre-chorus │        │
│  └─────────────┘  └─────────────┘        │
│                                          │
│  ┌─────────────┐  ┌─────────────┐        │
│  │             │  │             │        │
│  │  Bridge 2   │  │  Outro      │        │
│  └─────────────┘  └─────────────┘        │
│                                          │
│  Your sequence:  V1 → Ch → Br            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │            ▶  Start loop           │  │  ← Full-width gold CTA
│  └────────────────────────────────────┘  │
│                                          │
│  Clear sequence                          │  ← Text-link, bottom center
└──────────────────────────────────────────┘
```

Tapping a section that's already in the sequence removes it.
The `Your sequence:` row at bottom updates live: `V1 → Ch → Br`

On "Start loop": transitions to the Practice Player in Sequence mode immediately.

---

## STATE MODEL

```typescript
type LoopMode = "single" | "sequence" | "all";
type PlayerStatus = "idle" | "loading" | "playing" | "paused";

interface PracticeSection {
  id: string;
  label: string;         // "Chorus", "Verse 1", etc.
  memoId: string | null; // null if no voice memo for this section
  lyrics: string | null; // null if no transcription yet
  durationMs: number;
}

interface PracticePlayerState {
  status: PlayerStatus;
  sections: PracticeSection[];
  activeSectionIndex: number;
  loopMode: LoopMode;
  sequence: number[];           // indices into sections[], in order
  sequencePosition: number;     // current position within sequence
  loopCount: number;            // how many times current section has looped
  playbackSpeed: 0.5 | 0.75 | 1.0 | 1.25;
  gapMs: 0 | 500 | 1000 | 2000;
  showLyrics: boolean;
  countInEnabled: boolean;
  repeatPerSection: 1 | 2 | 3;
}
```

---

## COMPONENT ARCHITECTURE

### New files to create:

```
src/components/practice/
  PracticePlayerPage.tsx       Main full-screen player (the UI described above)
  SectionStrip.tsx             Horizontal scrollable section chips
  SequenceBuilder.tsx          The "build a loop" screen
  PracticeSettingsTray.tsx     Bottom sheet for speed/gap/count-in settings
  usePracticePlayer.ts         State machine + playback logic + MediaSession wiring

src/lib/audio/
  practiceSession.ts           Audio scheduling: gap timing, loop logic, speed
  mediaSessionBridge.ts        MediaSession API integration for lock screen
```

### Existing files to modify:

```
src/components/canvas/SongCanvasExperience.tsx
  → Add "Practice ↺" button to the top action bar
  → On click: navigate to /songs/:id/practice OR open PracticePlayerPage as a sheet

src/pages/CapturePage.tsx (already built)
  → Add ↺ icon button to the review state's audio player bar
  → Single-idea loop mode for the captured recording

src/components/capture/SeedIdeaCard.tsx
  → Add ↺ loop icon next to duration metadata
  → Opens PracticePlayerPage in single-idea mode

src/App.tsx
  → Add route: /songs/:id/practice → PracticePlayerPage
```

---

## ROUTES

```
/songs/:id/practice              → PracticePlayerPage (full song, all sections)
/songs/:id/practice?section=V1   → PracticePlayerPage (opens on specific section, Loop Single)
/capture/practice/:ideaId        → PracticePlayerPage (single idea mode)
```

---

## DATA REQUIREMENTS

**What the player needs from the backend:**

1. All voice memos for the song, keyed to their section — `listVoiceMemos(songId)` already returns this via `voiceApi.ts`
2. Playable signed URLs for each memo — `getSignedUrl(memoId)` already exists
3. Lyrics per section — already in the song's section/lyrics structure
4. BPM from chord chart — already in `chord_charts.bpm`

**No new API needed.** The Practice Player is entirely a frontend orchestration layer over existing data.

---

## DRIVING SAFETY — THE COMPLETE RULES CHECKLIST

Every element in the Practice Player must pass these gates before shipping:

- [ ] Minimum tap target: **80×80px** for all controls during playback (not 44px — 80px minimum for driving)
- [ ] Play/Pause button: **120px × 120px** centered (can't miss it)
- [ ] Prev/Next section: **80×80px** each, positioned at opposite sides of the screen
- [ ] Section strip chips: **52px tall minimum**, **full-width scrollable without precision**
- [ ] No menus that require reading during active playback
- [ ] All precision controls (speed, gap, count-in) locked behind the ⚙ gear
- [ ] Swipe gestures work anywhere on the main content area — not just on the controls
- [ ] Audio continues when screen locks (MediaSession API wired up)
- [ ] Lock screen shows section name + loop count + previous/next/play controls
- [ ] Zero modals, zero confirmation dialogs during playback
- [ ] Background color: `#1C1A17` — the dark background reduces screen brightness in a dark car
- [ ] Active section name rendered at minimum **32px** font size
- [ ] Loop count shown clearly: `×5` in large type

---

## ACCEPTANCE CRITERIA (8-point checklist for QA)

1. **Loop Single works:** Opening Practice mode on any song with voice memos starts looping the first section immediately. No loading spinner, no friction.

2. **Section navigation works:** Tapping any section chip in the section strip jumps to that section and loops it. Works in under 150ms response time.

3. **Swipe gesture works:** Swiping right → advances to next section. Swiping left → goes to previous section. Gesture dead zone: 40px (ignore accidental micro-swipes).

4. **Sequence mode works:** Building a 3-section sequence and starting it plays sections in correct order, repeating the full sequence.

5. **Lock screen controls work:** Starting playback, locking the device, then using the lock screen controls to go to the next section works correctly. Audio does not stop on lock.

6. **Audio continues on app switch:** Starting playback, switching to Maps, and returning — audio continued the whole time.

7. **Speed change works:** Changing to 0.75× while a section is mid-loop continues from the same position at the new speed (does not restart).

8. **Single-idea mode works:** Tapping the ↺ icon on a Seed Idea Card opens the player with just that recording on infinite loop. Back button closes the player cleanly.

---

## WHAT THIS IS NOT

- This is NOT a full-featured audio editor — no trimming, splicing, or mixing
- This is NOT a lesson player — no quizzes, no "did you get it right?" features
- This is NOT a metronome — the count-in is a side feature; don't build the metronome here
- This is NOT a chord chart — chord display is handled in the lyrics panel as inline chips, not a separate view

The entire scope is: **play this section, repeat it, let me switch to another section, keep playing.** Everything else is scope creep.

---

## THE EMOTIONAL NORTH STAR

When a worship leader is driving to Sunday morning service, their song is in their head but not quite locked in yet. They open Colors of Glory, tap Practice, and for the next 20 minutes the app drills the bridge they keep stumbling on — section by section — while they drive, hands free, eyes ahead. By the time they pull into the parking lot, they know it.

That is the entire feature. Build for that moment.

---

*Spec written: 2026-06-09 | Feature owner: Colors of Glory*
*Build order: `usePracticePlayer.ts` → `practiceSession.ts` → `mediaSessionBridge.ts` → `SectionStrip.tsx` → `PracticePlayerPage.tsx` → `SequenceBuilder.tsx` → `PracticeSettingsTray.tsx` → wire routes + entry points*
