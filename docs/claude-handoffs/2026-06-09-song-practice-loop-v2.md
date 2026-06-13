# Song Practice Loop — V2 World-Class Audit & Upgraded Spec
## Handoff: Claude Build Session · Supersedes v1 completely
### Priority: High · Status: Definitive spec — build from this document

---

## PART 1 — WORLD-CLASS BENCHMARK ANALYSIS

*Before writing a single component, understand what the best practitioners in adjacent domains have solved. Each of these apps has solved a specific sub-problem of COG's practice loop. The synthesis is the COG design.*

---

### BENCHMARK 1 — Spotify Car View

**What it does:** An entirely separate UI mode activated by a "Driving" button. Not a phone-held-at-arm's-length version of the normal app. A completely re-architected interface for a different physical context.

**Key elements:**
- Giant album art fills 70% of the screen
- Only 4 elements exist: track info, play/pause (120px), skip forward, skip back
- No search, no queue, no settings — they are inaccessible during Drive View
- The background color is extracted from the album art — you know what's playing by COLOR before reading text

**COG lesson:** The driving experience is not a "bigger buttons" version of the normal player. It requires a fundamentally different screen layout. V1 does not make this distinction — it puts big buttons on the same screen as the section strip, loop mode pills, and gear icon. That is still too complex.

**Specific adoption for COG:** Drive Mode activates a completely different render. 3 elements maximum on screen. Everything else is inaccessible.

---

### BENCHMARK 2 — Apple Music + Lock Screen / CarPlay

**What it does:** Lock screen controls are not just "working" — they are designed with the assumption that the lock screen IS the primary interface for listening in the car. The MediaSession integration updates every 100ms to show accurate position.

**Key elements:**
- Track title updates live: "Chorus · ×7" → "Chorus · ×8" (each new loop increment shows immediately on lock screen)
- Skip backward = restart current track (not go to previous track) — perfect for "oops, restart"
- Skip forward = advance to next section
- Waveform/scrub bar shows exact position within the current loop

**COG lesson:** The lock screen skip-backward action should be "restart current section from beginning" — not "go to previous section." When you mess up a line, you don't want the previous section, you want THIS section from the top. Skip-forward = next section. Skip-backward = restart THIS loop. This is different from v1's spec where seekbackward → restartCurrentLoop but previoustrack → goToPrevSection. The distinction matters enormously during driving.

**Specific adoption for COG:** 
- Lock screen `previoustrack` → go to previous section (change songs)
- Lock screen `seekbackward` → restart current loop from beginning (most common driving action)
- Lock screen `seekforward` → skip to next section
- Lock screen `nexttrack` → skip to next section (same as seekforward — redundant but expected)

---

### BENCHMARK 3 — Simply Piano / Flowkey (Piano Learning Apps)

**What they do:** Section-based practice with adaptive tempo. Not "here is a metronome." Instead: a practice coach that detects your errors, slows down sections you struggle with, and advances speed as you improve.

**Key elements (relevant to COG even without error detection):**
- **Speed Trainer**: "Learn it slow, then fast." Start at 70% speed. After 3 successful completions, auto-advance to 75%. After 3 more → 80%... all the way to 100%. Progress is shown as a circular arc that fills toward completion.
- **Section repeat until target**: The app plays a section until you've gone through it a set number of times. It counts down visibly: `3 → 2 → 1 → ✓`.
- **Mastery tracking**: Each section has a colored dot that fills up over time. Green = mastered. Yellow = needs more work. Gray = untouched. This persists across sessions.
- **Run Through Mode**: After drilling sections, a dedicated "Run Through" button plays the full song without looping for a final test.

**COG lesson:** Practice without progression tracking feels endless. The app should know "you've looped the Chorus 18 times" and show this as accumulating evidence of mastery. The songwriter who sees "Chorus: 18 loops" knows they've done the work. The songwriter who sees "Bridge: 2 loops" knows which section needs more attention.

**Specific adoption for COG:**
- Speed Trainer as an opt-in feature in settings (not on by default — intimidating for casual use)
- Section mastery states (loop count thresholds: 0 = gray, 5 = amber, 15 = gold)
- Run Through mode (play all sections once, no looping)
- Visible countdown: "Loop 4 of 5 before advancing" when repeatPerSection > 1

---

### BENCHMARK 4 — Overcast (Podcast App by Marco Arment)

**What it does:** The most rigorously designed audio-focused app on the App Store. Every feature is deliberate.

**Key elements:**
- **Smart Speed**: Dynamically removes silence, making 1-hour podcasts 45 minutes without changing speech pitch. Not relevant to COG directly — but the PHILOSOPHY is: the app should make practice more efficient, not just more convenient.
- **Voice Boost**: Normalizes audio to the same perceptible volume regardless of recording quality. Directly relevant: voice memos recorded in different environments (bedroom, car, bathroom) have wildly different volumes. Practice mode should normalize audio to a consistent perceptible level.
- **Chapter navigation**: Chapters are first-class citizens in Overcast. Each chapter has a title, image, URL. Chapters = sections in COG. The visual treatment of chapter navigation in Overcast — simple horizontal scrubable track with chapter markers — is the best execution of this pattern anywhere.
- **Sleep timer**: Overcast lets you set "stop playing in 15 minutes." Directly relevant: a worship leader with a limited practice window before Sunday service wants "practice for 20 minutes then stop." This is a natural request that v1 doesn't address.

**COG lesson:** Audio quality normalization is not optional when source files are voice memos recorded on a phone in different locations. The player should apply a gentle volume normalization (Web Audio API GainNode set by measuring RMS over the first 2 seconds of playback) so that a quiet bedroom memo and a loud car memo play at the same perceived volume.

**Specific adoption for COG:**
- Volume normalization via GainNode (not a user-visible setting — just works)
- Practice Timer: "Stop after 10 / 20 / 30 min" option in settings tray
- Chapter-marker style section visualization on the progress bar

---

### BENCHMARK 5 — Duolingo (Language Learning App)

**What it does:** The most psychologically sophisticated learning app ever built. 500M users. Learning voice and tone are warm, encouraging, never condescending.

**Key elements:**
- **Streak system**: The single most powerful retention feature ever implemented. "You're on a 7-day practice streak." COG doesn't need to copy Duolingo's gamification — but the insight is: practice completion should feel earned, not invisible.
- **"One more" mechanic**: Duolingo always shows a path to more. After finishing a lesson: "Great job! Want to practice one more?" The answer is usually yes. For COG: after completing a practice session (timer ends or user manually closes), show "Nice work — you looped the Chorus 12 times" with a single CTA "Do another run?" This is one line, not a gamification menu.
- **Minimal friction to start**: The Duolingo home screen shows ONE button in the center: "Continue." The practice loop entry point in COG should be equally obvious.
- **Celebration that respects intelligence**: Confetti is not embarrassing if it's brief and classy. When a songwriter completes a full Run Through for the first time since practicing, a subtle gold confetti moment is earned and appropriate.

**COG lesson:** The emotional arc of a practice session matters. The app should acknowledge the work at the end, not just stop cold. A "session summary" card that says "20 minutes · Chorus × 14 · Bridge × 9 · Full run-through × 1" is both meaningful data and emotional acknowledgment.

**Specific adoption for COG:**
- Session summary screen (shown when Practice Player closes, 3 seconds, auto-dismisses)
- Practice streak (days practiced in last 7 days — shown as dots in settings, not a badge on home screen)

---

### BENCHMARK 6 — Voice Memos (Apple's own app)

**What it does:** Records, plays back, and timestamps audio memos. The most used audio capture app on iPhone.

**Key elements:**
- The scrubber is a large waveform, not a progress bar. You can see the shape of the audio. Dense areas are louder/more active.
- Long-press on the waveform: shows time markers. Tap a time marker: jump to that point.
- When you switch apps, it keeps playing. When you lock the screen, it keeps playing. No configuration required — it just works.
- Trimming is built-in but not prominent. The app doesn't lead with trimming. It leads with playing.

**COG lesson:** The practice player should show a waveform, not just a progress bar. The waveform is a map of the audio. Dense areas tell you where the energy is. Flat areas tell you where the silence is. For a worship song section, this is meaningful (the big swell, the quiet verse, the instrumental break). 

**Specific adoption for COG:** Use the `RecordingWaveform` component (already in the codebase at `RecordingWaveform.tsx`) in playback mode — driven by `AnalyserNode` on playback, not just recording.

---

### BENCHMARK 7 — Waze (Navigation / Eyes-Free UI)

**What it does:** A navigation app designed to be safe while driving. Not just "big text" — fundamentally re-architected for glance-based interaction.

**Key elements:**
- **One glance = complete information**: The screen tells you everything in a single glance. Street name, distance to next turn, estimated arrival. You never need to read a sentence.
- **Color + icon conveys meaning before text**: Road hazards are orange dots. Traffic is red fill. Police is a badge icon. You know what's happening before you read anything.
- **Interaction is two states**: "driving" state where everything is read-only and giant, and "editing" state (parked) where you can type/search.
- **Confirmation for any input during driving**: If you try to interact with Waze while it detects motion, it shows: "Are you a passenger?" before letting you interact.

**COG lesson:** The COG Practice Player should have an explicit "parked" vs "driving" state. When driving, the UI locks down to Drive Mode automatically or on explicit toggle. Certain interactions (sequence builder, speed adjustment) are inaccessible in Drive Mode — not hidden behind a gear icon, but literally not rendered. They should not be reachable by accident.

**Specific adoption for COG:**
- Drive Mode toggle is a large single button — not a gear icon
- Drive Mode locks the UI: only Play/Pause, Prev Section, Next Section, and the section color background
- A "You're in Drive Mode. Keeping things simple." banner on first activation

---

### BENCHMARK 8 — GarageBand (Region Loop Mode)

**What it does:** GarageBand has a "cycle region" feature — you set loop-in and loop-out points on a timeline, and it loops that region forever. This is the most powerful section-looping metaphor in music production software.

**Key elements:**
- The loop region is visualized as a yellow/gold highlight on the timeline
- You can drag the loop points to adjust where the loop starts and ends
- Loop mode is always visible — it's part of the transport controls, not hidden in settings

**COG lesson:** The "what section is looping" visualization should be central and obvious, not a text label. In v1, it's shown as text: "CHORUS · Looping · ×4". That's fine on a desk. For driving: the ENTIRE BACKGROUND should communicate what section is looping. This is the section color system.

---

## PART 2 — V1 AUDIT

---

### WHAT V1 GOT RIGHT (keep exactly as specified)

1. **Dark background (#1C1A17)** — correct. Night driving, lower brightness, better visibility.
2. **80px minimum tap targets, 120px play/pause** — correct. Non-negotiable for driving.
3. **Three loop modes** (single / sequence / all) — correct. These cover every use case.
4. **MediaSession API wiring** — correct spec. Lock screen controls are mandatory.
5. **Settings tray hidden behind gear icon** — correct. Precision controls behind one gate.
6. **Swipe gestures on main content area** — correct. Full-screen gesture target, not tiny button.
7. **Gap between loops** — correct. The breath moment is essential for vocal practice.
8. **Count-in feature** — correct for power users.
9. **Sequence builder screen** — correct concept. Needs visual refinement (see below).
10. **No new API needed** — correct. All data is already in the existing stack.
11. **Single-idea mode from Capture Page** — correct. Minimal friction for a captured melody.
12. **The emotional north star** — "worship leader driving to Sunday service" — keep forever. Every design decision in every sprint should be tested against this scenario.

---

### CRITICAL GAPS IN V1

Each gap below is classified: BLOCKING (must fix before shipping) or ENHANCEMENT (improves experience).

---

**GAP 1 — No offline pre-caching [BLOCKING]**

V1 assumes network connectivity. In a car, signal is intermittent. A loading spinner while driving = distraction = danger.

The fix: before the Practice Player becomes interactive, it must pre-fetch and cache ALL section audio to IndexedDB. The `audioCache.ts` infrastructure already exists. The Practice Player entry sequence must be:

1. User taps "Practice"
2. "Preparing your practice..." downloads all memos to IndexedDB
3. Player UI appears with a brief shimmer on each section chip until downloaded
4. Once cached: each section chip shows a solid gold indicator (cached ✓)
5. Practice begins — from this point, ZERO network calls during playback

This is not optional. Without this, the feature is unusable in the field.

---

**GAP 2 — No Drive Mode as a distinct UI [BLOCKING for driving safety]**

V1 has big buttons on a screen that still has: a section strip, three loop mode pills, a gear icon, a lyrics panel, and a waveform. That is 5 UI regions to ignore while driving. The sections strip alone has small text labels requiring reading.

The Spotify/Waze lesson: driving requires a completely different render. Not "hide some things" — a completely different component tree.

Drive Mode spec is written in full in Part 3 below.

---

**GAP 3 — No section color identity system [BLOCKING for driving safety]**

In V1, section identity is conveyed by text: "CHORUS" in large letters. While driving you cannot read text at a glance.

The fix: every section TYPE has a color. The entire screen background changes to that color when that section is active. You know you're on the Chorus because the screen is BRIGHT GOLD. You know you're on the Bridge because the screen is CORAL. No reading required.

This is the Waze pattern (hazard type = color) applied to section type.

---

**GAP 4 — Lyrics display is passive scrolling text [ENHANCEMENT → becomes BLOCKING when lyrics exist]**

V1: full section text auto-scrolls. This is reading, not guidance.

The Spotify Lyrics / Genius lesson: show ONE LINE at a time, centered, 36px+, changing with the audio timestamp. This is karaoke mode. The singer knows exactly which line they're on. They don't have to read the full section and track position manually.

When a transcript with timestamp data exists, use it. When it doesn't exist, fall back to full section text in a scrollable panel, then gray text with the waveform visualization.

---

**GAP 5 — No volume normalization [BLOCKING for usability]**

Voice memos will have wildly different recorded volumes — bedroom quiet vs. noisy kitchen vs. car engine background. Without normalization, section A is loud and section B is inaudible. While driving you can't adjust volume per-section.

The fix: on audio load, measure the first 2 seconds via Web Audio API AnalyserNode, compute RMS, apply a GainNode to normalize to a target dB. This is invisible to the user and automatic. Takes < 100ms of processing.

---

**GAP 6 — No persistent session state [ENHANCEMENT]**

If the app is closed mid-practice and reopened, v1 shows the home screen. Apple Music resumes where you were. Spotify remembers your last track.

The fix: persist the minimal session state to localStorage: `{ songId, activeSectionIndex, loopMode, speed, sequence }`. On next open from the song workspace, show a "Resume practice?" card above the Practice button.

---

**GAP 7 — Speed trainer is manual only [ENHANCEMENT]**

V1: user picks a speed and stays there until they manually change it. This requires the user to judge their own readiness — which they're consistently bad at (they'll stay at 0.75× longer than needed, or jump to 1.0× before they're ready).

The fix: an opt-in "Speed Trainer" mode inspired by Simply Piano. When enabled: start at 0.75×. After 5 loops at the current speed, auto-bump +0.1×. Stop at 1.0×. A progress arc around the section chip shows advancement.

---

**GAP 8 — No persistent mini-player [ENHANCEMENT]**

V1: closing the Practice Player stops audio. This means the songwriter cannot look up a chord, switch to Maps, or check a message without the practice loop stopping.

The fix: a mini-player bar that persists at the bottom of every page (above BottomNav). When Practice is active, it shows: `[section color chip] CHORUS · ×7  [play/pause icon]`. Tapping the bar re-opens the full Practice Player. The mini-player disappears when the user explicitly closes practice (taps X or presses "End session").

---

**GAP 9 — No practice history or mastery states [ENHANCEMENT]**

V1: there is no record of practice having happened. After 30 loops of the Bridge, the Bridge chip looks identical to an untouched section.

The fix: persist loop counts per section to localStorage (not the database — this is personal practice data). Display mastery states visually on the section chips.

---

**GAP 10 — No "Run Through" test mode [ENHANCEMENT]**

V1: the only way to play the full song without looping is "Loop All" mode. But Loop All repeats — it doesn't stop at the end. There is no "play it once" mode for testing yourself.

The fix: a "Run Through" button added to the loop mode pills. Plays all sections in arrangement order, no looping, ends gracefully with the session summary.

---

**GAP 11 — No session summary [ENHANCEMENT]**

V1: the player closes and... nothing. No acknowledgment of the work done.

The fix: a 3-second auto-dismissing summary card on player close: "Session done · 18 min · Bridge ×11 · Chorus ×8 · 1 full run-through." This data is intrinsically motivating and costs almost nothing to implement.

---

**GAP 12 — No practice timer [ENHANCEMENT]**

V1: practice runs until you manually close it. A worship leader with a specific time window before service wants the app to stop automatically.

The fix: "Stop after" setting in the tray: Off / 10 min / 20 min / 30 min. A subtle progress ring around the session clock shows how much time remains.

---

**GAP 13 — Entry point is buried in "top action bar" [ENHANCEMENT]**

V1: "a button in the top action bar." The top action bar of the Song Workspace is small and crowded. Practice is the single most valuable thing a songwriter can do with their own song — it deserves better real estate.

The fix: a prominent floating button at the bottom of the Song Workspace, above the section chips: `↺ Practice This Song`. Not a tiny icon. A full-width banner-button when voice memos exist for the song.

---

**GAP 14 — Sequence builder requires looking at the screen [ACKNOWLEDGED — intended for parked use]**

This is correct — the sequence builder is a "before you drive" tool. However, the current spec doesn't make this clear enough to the user. The sequence builder screen must include a visible "Build before you drive ·  Lock it in before you go" microcopy so users understand they should set this up while parked.

---

## PART 3 — V2 COMPLETE SPECIFICATION

---

### 3.1 DESIGN PRINCIPLES (REFINED)

1. **The screen serves the driver.** Every element during driving must be perceivable at a glance. The practice player is not an app you stare at. It is a system that serves you while you look at the road.

2. **Color is communication.** Every section type has a color. During driving, the color IS the section identity. You know what you're practicing from 3 meters away.

3. **Audio is always ready.** The player never shows a loading spinner to a user who has already opened it. Audio is pre-cached before the player becomes interactive.

4. **Completion is celebrated briefly.** Practice is work. The app acknowledges the work — once, briefly, without fanfare.

5. **State persists.** Closing the app is not ending practice. The session resumes exactly where it left off.

---

### 3.2 THE SECTION COLOR IDENTITY SYSTEM

Every section TYPE maps to a color. This is not user-configurable per section — it is a system-level decision. The colors are part of the product's visual language for practice.

```typescript
// src/lib/audio/sectionColors.ts

export const SECTION_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  "verse":       { bg: "#C4913A", text: "#FFFFFF", glow: "rgba(196,145,58,0.40)" },   // warm amber
  "chorus":      { bg: "#E8C44A", text: "#1C1A17", glow: "rgba(232,196,74,0.50)" },   // bright gold (the climax)
  "bridge":      { bg: "#C4735A", text: "#FFFFFF", glow: "rgba(196,115,90,0.40)" },   // coral
  "pre-chorus":  { bg: "#A88040", text: "#FFFFFF", glow: "rgba(168,128,64,0.35)" },   // muted gold
  "hook":        { bg: "#D4905A", text: "#FFFFFF", glow: "rgba(212,144,90,0.40)" },   // warm orange
  "intro":       { bg: "#8090A8", text: "#FFFFFF", glow: "rgba(128,144,168,0.35)" },  // cool slate
  "outro":       { bg: "#8090A8", text: "#FFFFFF", glow: "rgba(128,144,168,0.35)" },  // cool slate
  "instrumental":{ bg: "#7A8C7A", text: "#FFFFFF", glow: "rgba(122,140,122,0.35)" }, // sage green
  "tag":         { bg: "#A06878", text: "#FFFFFF", glow: "rgba(160,104,120,0.35)" }, // dusty rose
  "default":     { bg: "#B8953A", text: "#FFFFFF", glow: "rgba(184,149,58,0.35)" },  // COG gold
};

export function getSectionColor(label: string): { bg: string; text: string; glow: string } {
  const normalized = label.toLowerCase().replace(/\s+\d+$/, "").trim(); // "Verse 1" → "verse"
  return SECTION_COLORS[normalized] ?? SECTION_COLORS["default"];
}
```

This function is used in TWO places:
1. The Practice Player background — transitions to the current section's color
2. The section chips in both the Practice Player and the section strip

---

### 3.3 TWO RENDERING MODES

The Practice Player has two entirely different render trees. These are not "show/hide" states. They are completely separate components returned based on mode.

```typescript
// src/components/practice/PracticePlayerPage.tsx

if (driveMode) {
  return <DriveModePlayer />;   // 3 elements. Nothing else.
}
return <FullPracticePlayer />;   // Full interface
```

---

### 3.4 DRIVE MODE — COMPLETE SPEC

Drive Mode is the stripped-down interface for active driving. It renders three elements and nothing else.

**Activation:** A large "Drive Mode" button in the top-right of the Full Practice Player. Renders a car icon (not a gear icon). Once activated, it persists until the session ends.

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│                                         │  ← The entire background
│     (background: current section color)  │    transitions to the
│                                         │    current section's color
│                                         │    Smooth 400ms cross-fade
│                                         │    when section changes
│                                         │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │  ← Section type rendered
│  │         C H O R U S              │   │    in massive display type
│  │                                  │   │    — white, 56px, tracked
│  │            × 7                   │   │    — loop count below, 40px
│  │                                  │   │    — this is ALL the information
│  └──────────────────────────────────┘   │    a driver needs
│                                         │
│                                         │
│  ┌─────────┐  ┌──────────────────┐  ┌──────────┐  │
│  │         │  │                  │  │          │  │
│  │   ◀◀    │  │       ▶ ‖        │  │    ▶▶    │  │
│  │  Prev   │  │  Play / Pause    │  │   Next   │  │
│  │         │  │                  │  │          │  │
│  └─────────┘  └──────────────────┘  └──────────┘  │
│   96×96px         160×96px            96×96px      │
│                                                     │
│                                         │
│  ╌╌╌╌╌╌╌╌╌╌╌╌╌ DRIVING MODE ╌╌╌╌╌╌╌╌╌╌ │  ← 14px label, 60% opacity
│                                         │
└─────────────────────────────────────────┘
```

**Drive Mode rules:**
- 3 elements: section identity block, 3 playback controls, mode label
- No lyrics panel
- No section strip
- No loop mode pills
- No gear icon
- No navigation back button (prevent accidental close)
- Entire screen is one large tap target for Play/Pause (except the ◀◀ and ▶▶ zones)
- To exit Drive Mode: long-press anywhere for 1 second → brief haptic → exits to Full Player

**Drive Mode section change transition:**
When the section changes, the background color cross-fades over 400ms:
```css
.drive-background {
  transition: background-color 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

The section label text does a brief scale-up (1.0 → 1.08 → 1.0) with a 200ms duration as the new section name fades in. This is the most communication a driver needs: the color change is peripheral vision, the scale pulse is subliminal confirmation.

**Drive Mode haptic language:**
- Loop complete (section starts again): single short pulse [15ms]
- Section change (advance to next section): double pulse [15, 50, 15ms]
- Drive Mode activated: strong triple pulse [20, 30, 20, 30, 20ms]
- Play/Pause tap: very short [8ms]

No other haptics.

---

### 3.5 FULL PRACTICE PLAYER — COMPLETE SPEC

The full player is used when parked, at home, or stationary. It has access to all features.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ←                Grace in the Waiting           🚗 🔑  │  ← Back · song title · Drive Mode button
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │     CHORUS                                       │   │  ← Section badge: colored background
│  │     Looping · ×7                                 │   │    (uses SECTION_COLORS system)
│  │                                                  │   │    56px section type · 28px loop count
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │  ← Live waveform (AnalyserNode on
│  │  ▁▃▅▇▅▃▁▁▁▃▅▇██▇▅▃▁▁▃▅▇▅▃▁▁ ●────────────────  │   │    playback, existing RecordingWaveform
│  └──────────────────────────────────────────────────┘   │    component)
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │  Amazing grace, how sweet the sound              │   │  ← Karaoke lyric mode (when timestamps
│  │  ● that saved a wretch like me.                  │   │    exist) — one highlighted line at a time
│  │  I once was lost, but now am found.              │   │    OR full section text (no timestamps)
│  │                                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│     ◀◀                  ▶ ‖                  ▶▶          │  ← 80×80px each
│   Prev sec           Play/Pause            Next sec     │    120×80px center
│                                                         │
│                                                         │
│  ← V1  Pre-Ch  CHORUS ●  Bridge  Bridge2 →              │  ← Section strip (scrollable)
│        Each chip 52px height · color-coded              │
│                                                         │
│  [ Loop Single ]  [ Sequence ]  [ All ]  [ Run Through ]│  ← Loop mode pills (4 modes)
│                                                         │
│                              Timer: 12:40 remaining     │  ← Only when timer is set
└─────────────────────────────────────────────────────────┘
```

---

### 3.6 OFFLINE PRE-CACHING — MANDATORY ENTRY SEQUENCE

```typescript
// When PracticePlayerPage mounts:

interface CacheStatus {
  memoId: string;
  label: string;
  status: "pending" | "caching" | "cached" | "failed" | "no-memo";
}

// 1. Build the list of all memos needed
const sectionsWithMemos = sections.filter(s => s.memoId !== null);

// 2. For each memo, check audioCache first
for (const section of sectionsWithMemos) {
  const cached = await audioCache.get(section.memoId);
  if (cached) {
    updateStatus(section.memoId, "cached");
    continue;
  }
  
  // 3. Fetch signed URL and download to cache
  updateStatus(section.memoId, "caching");
  try {
    const url = await getSignedUrl(section.memoId);
    const response = await fetch(url);
    const blob = await response.blob();
    await audioCache.set(section.memoId, blob);
    updateStatus(section.memoId, "cached");
  } catch {
    updateStatus(section.memoId, "failed"); // failed sections fall back to streaming
  }
}

// 4. Only show player UI when all "pending" statuses are resolved
// (not all must be "cached" — some may fail, that's OK)
setPlayerReady(true);
```

**Loading UI during pre-cache:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│          ○ Preparing your practice...                │
│                                                      │
│     Verse 1      ██████████████  ✓ Ready             │
│     Chorus       ████████░░░░░░  Downloading...      │
│     Bridge       ░░░░░░░░░░░░░░  Waiting             │
│                                                      │
│          Takes about 5 seconds                       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Show only when download takes > 800ms. Otherwise flash to player immediately.

---

### 3.7 VOLUME NORMALIZATION — INVISIBLE FEATURE

```typescript
// src/lib/audio/volumeNormalizer.ts

export async function normalizeAudio(
  audioContext: AudioContext,
  source: MediaElementAudioSourceNode,
  targetRms: number = -18  // dBFS
): Promise<GainNode> {
  const gainNode = audioContext.createGain();
  
  // Measure RMS of first 2 seconds via OfflineAudioContext
  // This runs once per memo on first load
  // Result is cached alongside the audio blob in IndexedDB
  
  // For implementation: OfflineAudioContext renders the first 2s,
  // then computes RMS, derives the gain multiplier to hit targetRms
  
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  return gainNode;
}
```

This is invisible to the user. It runs once per memo, the result is cached. All sections play at the same perceived volume.

---

### 3.8 KARAOKE LYRIC MODE

When a transcript with word-level timestamps exists (from Whisper transcription), the lyrics panel shows one line at a time, highlighted as the audio plays.

```typescript
// src/components/practice/KaraokeLyrics.tsx

interface TranscriptLine {
  text: string;
  startMs: number;
  endMs: number;
}

interface KaraokeLyricsProps {
  lines: TranscriptLine[];
  currentPositionMs: number;
}
```

**Visual spec:**
- Container: full width, vertically centered in its region
- Non-active lines: `rgba(255,255,255,0.30)`, `1.2rem`
- Active line: `rgba(255,255,255,0.95)`, `1.6rem`, soft gold underline `2px solid rgba(232,196,74,0.60)`
- Transition between lines: opacity + translateY, 150ms
- Show 3 lines: previous (dim), current (bright), next (dim)
- When no timestamps: fall back to full section text in 1.1rem, auto-scrolling

---

### 3.9 SPEED TRAINER (OPT-IN)

When enabled in settings tray, the Speed Trainer replaces manual speed selection.

```typescript
interface SpeedTrainerState {
  enabled: boolean;
  baseSpeed: 0.5 | 0.75 | 1.0;        // starting speed (user sets once)
  targetSpeed: 1.0 | 1.25;             // max speed to advance to
  loopsPerStep: 2 | 3 | 5;             // loops before advancing speed
  currentSpeed: number;                // current playback rate
  loopsAtCurrentSpeed: number;         // counter
}
```

**UI:**
- Section chip shows a thin progress arc (like Apple Watch activity rings) showing progress toward next speed level
- When speed increases: the arc resets, the section chip pulses with a subtle glow, a gentle ascending chime haptic pattern plays [10, 30, 10, 30, 15ms]
- The section label shows current speed: `CHORUS · 0.85×`
- Speed advances from baseSpeed to targetSpeed in 0.1× increments

---

### 3.10 PRACTICE HISTORY + MASTERY STATES

Persisted in localStorage. Key: `cog:practice:${songId}`.

```typescript
interface SectionPracticeHistory {
  label: string;
  totalLoops: number;
  loopsAtFullSpeed: number;  // loops at 1.0× or higher
  totalMinutes: number;
  lastPracticed: string;     // ISO date
}

interface SongPracticeHistory {
  songId: string;
  totalSessions: number;
  totalMinutes: number;
  lastSession: string;
  sections: Record<string, SectionPracticeHistory>;
}
```

**Mastery states (shown on section chips as colored ring):**

```
0 loops           → no ring (untouched)
1-4 loops         → faint amber ring (starting)
5-14 loops        → solid amber ring (working on it)
15-29 loops       → bright gold ring (getting solid)
30+ loops total   → gold filled chip + "✓" mark (this section is yours)
```

The ring only reflects loops AT FULL SPEED (1.0×) toward the mastery count. Slow-speed practice counts as "working" but not "mastered."

---

### 3.11 RUN THROUGH MODE

A 4th loop mode: plays all sections in arrangement order, once each, with no looping. When the last section ends, the session summary appears.

**Pill label:** `Run Through`

**Visual indicator during Run Through:** instead of the "loop count" display, it shows a progress indicator: `Section 2 of 6 · Bridge`

**On completion:** screen fades to dark with a subtle gold glow and the session summary card.

---

### 3.12 PERSISTENT MINI-PLAYER

When the Practice Player is open and the user navigates away (back button, BottomNav tap), audio continues and a mini-player bar appears above the BottomNav on every screen.

```
┌──────────────────────────────────────────────────────┐
│  [🟡 color chip] CHORUS · ×9    [waveform] [▶ / ‖]   │  ← 48px tall
└──────────────────────────────────────────────────────┘
```

- Color chip: current section color (8px × 24px rounded rect)
- Section + loop count: `var(--cog-charcoal)`, 13px
- Mini waveform: 40px wide, animated bars (existing component)
- Play/Pause: 32×32px
- Tap the bar (not the button): re-opens the full Practice Player
- Tap the X that appears on hold: ends the practice session

Implementation note: the mini-player is managed by a `PracticePlayerContext` that wraps the app. The `usePracticePlayer` hook is consumed by both `PracticePlayerPage.tsx` (full screen) and `MiniPracticePlayer.tsx` (the persistent bar).

---

### 3.13 SESSION SUMMARY CARD

Shown for 3 seconds when practice ends (user closes, timer expires, or Run Through completes). Auto-dismisses. Can be dismissed manually by tapping anywhere.

```
┌───────────────────────────────────────────┐
│                                           │
│             ✓  Session done               │  ← 22px, warm white
│                                           │
│     22 minutes practiced                 │
│                                           │
│     Chorus          ×14  ████████████    │
│     Bridge          ×11  ████████        │
│     Verse 1          ×8  █████           │
│     Pre-chorus       ×3  ██              │
│                                           │
│     1 full run-through                   │
│                                           │
│         Practice again ↺                 │  ← tap to reopen
└───────────────────────────────────────────┘
```

---

### 3.14 UPDATED STATE MODEL

```typescript
// src/components/practice/usePracticePlayer.ts

type LoopMode = "single" | "sequence" | "all" | "run-through";
type PlayerStatus = "idle" | "caching" | "ready" | "playing" | "paused" | "ended";
type DriveMode = "off" | "on";
type MasteryLevel = "untouched" | "starting" | "working" | "solid" | "mastered";

interface PracticeSection {
  id: string;
  label: string;
  memoId: string | null;
  lyrics: string | null;
  transcriptLines: TranscriptLine[] | null;  // for karaoke mode
  durationMs: number;
  cacheStatus: "pending" | "caching" | "cached" | "failed";
  masteryLevel: MasteryLevel;
  loopCountThisSession: number;
}

interface PracticeSessionStats {
  startTime: number;
  totalLoops: Record<string, number>;     // sectionId → loop count
  fullRunThroughs: number;
}

interface SpeedTrainer {
  enabled: boolean;
  baseSpeed: number;
  targetSpeed: number;
  loopsPerStep: number;
  currentSpeed: number;
  loopsAtCurrentSpeed: number;
}

interface PracticePlayerState {
  status: PlayerStatus;
  driveMode: DriveMode;
  sections: PracticeSection[];
  activeSectionIndex: number;
  loopMode: LoopMode;
  sequence: number[];
  sequencePosition: number;
  repeatPerSection: 1 | 2 | 3;
  repeatCountThisPosition: number;       // how many times current seq position has played
  loopCount: number;
  playbackSpeed: number;
  gapMs: 0 | 500 | 1000 | 2000;
  showLyrics: boolean;
  countInEnabled: boolean;
  timerEndTime: number | null;           // null = no timer
  speedTrainer: SpeedTrainer;
  stats: PracticeSessionStats;
  persistedSessionState: PersistedPracticeSession | null;  // from localStorage
}

interface PersistedPracticeSession {
  songId: string;
  activeSectionIndex: number;
  loopMode: LoopMode;
  sequence: number[];
  playbackSpeed: number;
  driveMode: DriveMode;
  savedAt: string;
}
```

---

### 3.15 UPDATED COMPONENT ARCHITECTURE

```
src/components/practice/
  PracticePlayerPage.tsx         Main controller — decides which render tree
  DriveModePlayer.tsx            Drive mode render (3 elements only)
  FullPracticePlayer.tsx         Full interface render
  SectionStrip.tsx               Horizontal scrollable section chips with mastery rings
  KaraokeLyrics.tsx              Single-line-at-a-time lyrics with timestamp sync
  SequenceBuilder.tsx            Build-before-driving sequence creation screen
  PracticeSettingsTray.tsx       Bottom sheet (speed, gap, count-in, timer, speed trainer)
  SessionSummaryCard.tsx         End-of-session summary overlay
  MiniPracticePlayer.tsx         Persistent mini-player bar (above BottomNav)
  PracticePlayerContext.tsx      React context: shares state between Page + MiniPlayer

src/hooks/
  usePracticePlayer.ts           State machine, audio scheduling, loop logic
  usePracticeHistory.ts          Read/write localStorage history per song

src/lib/audio/
  practiceSession.ts             Audio scheduling: gap timing, loop, speed, repeat
  mediaSessionBridge.ts          MediaSession API lock screen controls
  volumeNormalizer.ts            RMS measurement + GainNode normalization
  sectionColors.ts               Section type → color mapping

src/lib/
  practiceStorage.ts             localStorage read/write for session persistence
```

---

### 3.16 ENTRY POINTS — REVISED

**Entry Point 1: Song Workspace — Revised (prominent)**

Not in the top action bar. A dedicated floating bar at the bottom of the Song Workspace, above the section chips, when the song has at least one voice memo:

```
┌──────────────────────────────────────────────────────────┐
│  ↺  Practice This Song   →   Drill sections. Drive-safe. │  ← Full-width, 64px tall
└──────────────────────────────────────────────────────────┘
```

Gold bordered, cream background, `var(--cog-gold)` text. Tapping opens Practice Player.

If no voice memos exist, the bar shows dimmed: "Add voice memos to practice this song."

**Entry Point 2: Capture Page — Unchanged from v1**

Small ↺ icon next to the play button on any recorded idea card. Opens single-idea loop mode.

**Entry Point 3: Mini-Player → Full Player**

Tap the mini-player bar to restore the full player.

**Entry Point 4: Resume session prompt**

When opening the Song Workspace for a song that has a saved practice session (< 24 hours old):

```
┌────────────────────────────────────────────┐
│  Resume practice?  Bridge · ×11 last time  │
│  [ Resume ]  [ Start fresh ]               │
└────────────────────────────────────────────┘
```

---

### 3.17 LOCK SCREEN CONTROLS — REVISED SPEC

```typescript
// src/lib/audio/mediaSessionBridge.ts

export function updateMediaSession(state: PracticePlayerState, song: Song): void {
  const section = state.sections[state.activeSectionIndex];
  
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${section.label} · ×${state.loopCount}`,    // "Chorus · ×7"
    artist: "Colors of Glory Practice",
    album: song.title,                                   // "Grace in the Waiting"
    artwork: [{ src: "/cog-practice-artwork.png", sizes: "512x512", type: "image/png" }],
  });

  // seekbackward = restart current section (most useful driving action)
  navigator.mediaSession.setActionHandler("seekbackward", () => {
    restartCurrentSection();
  });

  // seekforward / nexttrack = advance to next section
  navigator.mediaSession.setActionHandler("seekforward", () => {
    goToNextSection();
  });
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    goToNextSection();
  });

  // previoustrack = go to previous section (useful for navigation)
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    goToPrevSection();
  });

  navigator.mediaSession.setActionHandler("play", () => resumeLoop());
  navigator.mediaSession.setActionHandler("pause", () => pauseLoop());

  // Update position state (required for lock screen scrub bar)
  navigator.mediaSession.setPositionState({
    duration: section.durationMs / 1000,
    playbackRate: state.playbackSpeed,
    position: currentPositionMs / 1000,
  });
}
```

**The `title` field updates every loop**: "Chorus · ×7" → "Chorus · ×8". This is the information a driver needs: what section, and how many times I've done it. They know they're getting it by watching the count go up.

---

### 3.18 SETTINGS TRAY — REVISED SPEC

```
┌──────────────────────────────────────────────────────────┐
│  ╌╌╌╌ (handle)                                           │
│                                                          │
│  Practice Settings                                       │
│                                                          │
│  Playback speed                                          │
│  [ 0.5× ]  [ 0.75× ]  [ 1.0× ●]  [ 1.25× ]             │
│                                                          │
│  Gap between loops                                       │
│  [ 0s ]  [ 0.5s ●]  [ 1s ]  [ 2s ]                      │
│                                                          │
│  Count-in  (requires song BPM)                          │
│  ──────────────────────────────────── [ Off ]            │
│                                                          │
│  Show lyrics                                             │
│  ──────────────────────────────────── [ On  ●]           │
│                                                          │
│  Repeat each section  (Sequence mode)                    │
│  [ 1× ●]  [ 2× ]  [ 3× ]  before moving on              │
│                                                          │
│  Speed Trainer  (auto-advance speed as you improve)      │
│  ──────────────────────────────────── [ Off ]            │
│  Start: 0.75×  → Target: 1.0×  · Every 5 loops          │
│  (shown only when Speed Trainer is On)                   │
│                                                          │
│  Stop practice after                                     │
│  [ Off ●]  [ 10 min ]  [ 20 min ]  [ 30 min ]            │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│                          Done                            │
└──────────────────────────────────────────────────────────┘
```

---

### 3.19 ROUTES — FINAL

```typescript
// src/App.tsx additions

const PracticePlayerPage = lazy(() => import("./pages/PracticePlayerPage"));

// Routes:
/songs/:id/practice                   → PracticePlayerPage (full song)
/songs/:id/practice?section=chorus    → PracticePlayerPage (specific section, Loop Single)
/capture/practice/:ideaId             → PracticePlayerPage (single idea mode)
```

---

### 3.20 DRIVING SAFETY CHECKLIST — REVISED (COMPLETE)

Every item below must be verified before shipping. No exceptions.

**Drive Mode — visual**
- [ ] Drive Mode button is visible and labeled with a car icon (not gear)
- [ ] Drive Mode background changes to current section's color on activation
- [ ] Section type text: minimum 52px, white, center-aligned
- [ ] Loop count: minimum 40px, white, center-aligned
- [ ] Previous / Next buttons: minimum 96×96px, positioned at screen edges
- [ ] Play/Pause button: minimum 160×96px, centered
- [ ] No text smaller than 40px on the Drive Mode screen
- [ ] No more than 3 elements rendered in Drive Mode

**Drive Mode — behavior**
- [ ] Section color background cross-fades smoothly on section change (400ms)
- [ ] Section label pulses on change (1.0 → 1.08 → 1.0 scale, 200ms)
- [ ] Drive Mode persists through phone lock and screen-off
- [ ] Drive Mode can ONLY be exited via 1-second long-press (not a single tap)
- [ ] No modals or sheets open while Drive Mode is active
- [ ] Precision settings (speed, gap, count-in) are inaccessible in Drive Mode

**Audio continuity**
- [ ] Audio continues when screen locks (MediaSession API active)
- [ ] Audio continues when user switches to Maps, Messages, etc.
- [ ] Audio continues when screen orientation changes
- [ ] Lock screen shows: section name + loop count + play/pause + prev/next controls
- [ ] Lock screen controls work correctly (seekbackward = restart section, not prev section)
- [ ] Lock screen position state updates every 500ms (scrub bar moves)

**Offline readiness**
- [ ] Practice Player pre-caches all memo audio before becoming interactive
- [ ] No network calls occur during active playback
- [ ] Failed pre-cache sections fall back to streaming gracefully (no crash)
- [ ] Offline pre-cache loading UI shows only if caching takes > 800ms

**Haptic language (Drive Mode)**
- [ ] Loop complete: single 15ms pulse
- [ ] Section change: double pulse [15, 50, 15ms]
- [ ] Drive Mode activation: strong triple pulse [20, 30, 20, 30, 20ms]
- [ ] Play/Pause: 8ms pulse
- [ ] All other interactions: no haptic (prevent confusion)

**Audio quality**
- [ ] Volume normalization applied to every section (invisible to user)
- [ ] Speed change does not restart the section (continues from current position)
- [ ] Gap between loops feels like a natural breath, not a glitch

---

### 3.21 ACCEPTANCE CRITERIA — REVISED (12 gates)

1. **Pre-caching works:** Opening Practice on a song with 4 voice memos — all 4 are cached to IndexedDB within 10 seconds. The player then operates with zero network calls during playback.

2. **Drive Mode activates correctly:** Tapping the car icon switches to Drive Mode. The background becomes the section's color. Only 3 UI elements are visible. The full player is not accessible without a 1-second long-press.

3. **Drive Mode section change is perceptible in peripheral vision:** Section color changes on advance. With eyes looking away from the screen, a person 40cm from the phone can perceive the color shift.

4. **Lock screen drives the session:** Start practice, lock the phone, navigate to the next section using the lock screen skip-forward control. The correct section plays. The lock screen title updates to show the new section name.

5. **Seek-backward on lock screen restarts the current section, not the previous one.** This is tested explicitly because v1 had this backwards.

6. **Volume normalization works:** Two sections with visibly different waveform amplitudes in the Voice Memo view play at the same perceived volume in Practice mode.

7. **Speed Trainer advances automatically:** With Speed Trainer on (base 0.75×, loopsPerStep 3), after 3 loops the speed advances to 0.85×. After 3 more loops it advances to 0.95×. After 3 more it reaches 1.0× and stops.

8. **Sequence mode with repeatPerSection:** A 2-section sequence [Chorus, Bridge] with repeatPerSection = 2 plays: Chorus, Chorus, Bridge, Bridge, Chorus, Chorus, Bridge, Bridge... This matches the spec, not a simpler "play each once then repeat" interpretation.

9. **Run Through mode plays exactly once and ends with summary:** Starting Run Through plays all sections in arrangement order without looping. When the last section ends, the session summary card appears.

10. **Mini-player persists across navigation:** Navigating to the Song Catalog while Practice is active shows the mini-player bar above BottomNav. Tapping it re-opens the full player.

11. **Session persistence works:** Opening Practice, drilling 3 sections, closing the app entirely, re-opening — a "Resume practice?" prompt appears with the last active section.

12. **Session summary is accurate:** The summary shows correct loop counts per section, matching what was actually looped during the session.

---

## PART 4 — BUILD ORDER

Build in this exact sequence. Each step is deployable independently.

```
STEP 1 — Infrastructure
  sectionColors.ts               (no dependencies)
  volumeNormalizer.ts            (no dependencies)
  practiceStorage.ts             (no dependencies)
  mediaSessionBridge.ts          (no dependencies)
  practiceSession.ts             (depends on audioCache, voiceApi)

STEP 2 — Core state hook
  usePracticePlayer.ts           (depends on steps in STEP 1)
  PracticePlayerContext.tsx      (depends on usePracticePlayer)

STEP 3 — Isolated components
  SectionStrip.tsx               (depends on sectionColors)
  KaraokeLyrics.tsx              (no external dependencies)
  SessionSummaryCard.tsx         (no external dependencies)
  PracticeSettingsTray.tsx       (no external dependencies)

STEP 4 — Player screens
  DriveModePlayer.tsx            (depends on STEP 2, STEP 3)
  FullPracticePlayer.tsx         (depends on STEP 2, STEP 3)
  PracticePlayerPage.tsx         (depends on both player screens + STEP 1 pre-cache logic)
  SequenceBuilder.tsx            (depends on sectionColors)

STEP 5 — Persistence + mini-player
  MiniPracticePlayer.tsx         (depends on PracticePlayerContext)
  usePracticeHistory.ts          (depends on practiceStorage)

STEP 6 — Wire up
  App.tsx                        add /songs/:id/practice route
  SongCanvasExperience.tsx       add "Practice This Song" floating bar
  CapturePage.tsx                add ↺ icon to review state
```

---

## PART 5 — THE EMOTIONAL NORTH STAR (UNCHANGED)

*From v1. Kept exactly because it is perfect.*

When a worship leader is driving to Sunday morning service, their song is in their head but not quite locked in yet. They open Colors of Glory, tap Practice, and for the next 20 minutes the app drills the bridge they keep stumbling on — section by section — while they drive, hands free, eyes ahead.

They never look at the screen. The screen's color tells them they're on the Chorus. A double-haptic tells them a new loop has started. The lock screen shows "Bridge · ×5" when they take their eyes off the road for a half-second at a red light.

By the time they pull into the parking lot, they know it.

---

*Spec written: 2026-06-10 | V2 — Supersedes 2026-06-09-song-practice-loop.md completely*
*Build owner: Colors of Glory*
