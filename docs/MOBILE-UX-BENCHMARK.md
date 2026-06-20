# COLORS OF GLORY — THE MOBILE UX/UI BENCHMARK
## The standard every Claude screen is measured against. Made for mobile. Apple-grade. CapCut-easy.

> This app is **made for mobile** — not a desktop site that shrinks. Every screen is
> designed thumb-first, for one hand, in motion, in real light, by a songwriter with
> an idea that's about to slip away. If a screen would not feel at home next to
> **iOS Voice Memos, CapCut, Things 3, and Cash App** on a home screen, it isn't done.
> Referenced by every `C*` prompt. Pairs with `CLAUDE.md` §2 (design system) and the
> design bible.

---

## 1. THE MANDATE

1. **Mobile is the product, 390px is the canvas.** Design at iPhone width first;
   desktop is a courtesy, never the source of truth.
2. **The tool disappears behind the song.** Apple's *deference* — content (the idea)
   is the hero; chrome recedes.
3. **You're creating in 2 seconds.** CapCut's gift: no setup, no blank dashboard —
   the primary creative action is the first thing you can do.
4. **Faith-calm, not tech-loud.** Cream + gold, serif warmth, reverent pacing. No red
   badges, no nagging, no dopamine slot-machine. A sanctuary, not a feed.

---

## 2. THE BENCHMARK APPS — WHAT EACH ONE TEACHES

| App | The lesson we steal |
|---|---|
| **iOS Voice Memos** | Tap to record, tap to stop. Bulletproof. Capture must *never* fail or confuse. |
| **CapCut** | Zero-friction start · direct manipulation (drag/trim/pinch) · tool rail always in thumb reach · instant preview · smart auto (captions/templates) · forgiving + non-destructive. |
| **Apple (HIG)** | Clarity · deference · depth. SF-style type hierarchy, spring motion, large targets, sheets, haptics, gesture-native. |
| **Things 3** | Calm beauty · the "magic" + button · delight in the small moments without noise. |
| **Cash App** | Bold simplicity — one obvious primary action per screen, huge tap targets. |
| **Instagram/TikTok capture** | Full-screen, immersive, gesture-driven creation; the camera/mic *is* the screen. |
| **Spotify** | The persistent mini-player — playback that follows you (our Practice mini-player). |
| **Linear (mobile)** | Speed as a feature — instant transitions, optimistic UI, no spinners. |
| **Arc Search** | Opinionated, delightful, does-the-work-for-you confidence. |

---

## 3. THE 12 MOBILE LAWS (non-negotiable)

1. **Thumb-zone first.** Primary actions live in the bottom 1/3 (the natural-thumb
   arc). Never put the main action top-left. Bottom nav / bottom sheets / bottom CTAs.
2. **One primary action per screen.** It is the largest, highest-contrast, most
   obvious thing. Everything else is quieter. (Cash App / Hero rules.)
3. **44×44pt minimum touch targets**, 48 preferred; spacing so fat fingers don't
   misfire. Increase hit area with padding, not visual size.
4. **Bottom sheets over modals/new pages.** Secondary tasks slide up from the bottom,
   dismissible by swipe-down. Keep context behind them.
5. **Direct manipulation.** Drag, swipe, long-press, pinch where it maps to the
   content (cards, clips, sections). The screen responds *to your finger*, not to a
   form. (CapCut.)
6. **Instant feel — no spinners.** Optimistic UI; skeletons for loads; results appear
   immediately. Perceived latency < 100ms on tap. (Linear.)
7. **Motion that's physical.** Spring/ease curves with momentum; 60fps; transform +
   opacity only. Transitions explain *where things came from*. Respect
   `prefers-reduced-motion`.
8. **Gestures are first-class but never the only path.** Swipe to delete/navigate, but
   always a visible control too (discoverability + a11y).
9. **Smart defaults & auto.** Do the hard work for the user — auto-transcribe,
   auto-detect sections/BPM, pre-name, pre-fill. The app meets them more than halfway.
   (CapCut auto-captions / Arc.)
10. **Forgiving & non-destructive.** Undo everywhere; nothing important is one mistap
    from gone; "your idea is safe" always. (CapCut history.)
11. **Calm information.** No red count badges, no notification spam, no upsell walls.
    Updates arrive gently ("what changed since you left").
12. **Always reachable, never lost.** Persistent mini-player, clear back paths, a
    bottom nav that says where you are. The user is never stranded.

---

## 4. THE COG TRANSLATION (how the benchmark becomes *this* app)

- **Palette/type:** cream (`--cog-cream`) + gold (`--cog-gold`), serif display
  (`--font-display`) for song titles/headings, humanist sans body. The signature
  **radial gold glow** on every active-song screen = warmth/presence.
- **Primary action = the gold mic.** It is the Cash-App-style single obvious action,
  always thumb-reachable (bottom-center, raised).
- **Motion = reverent.** Cinematic/gentle curves (`--cog-ease-reveal`), entrances
  fade-up; nothing bouncy or loud. (Christian/Ministry mode.)
- **Sheets = the workhorse.** Capture review, pickers, settings — all bottom sheets.
- **Tone of copy = encouraging + plainspoken.** "What's on your heart?" not "Create
  new project." Never "Submit"/"Learn More."

---

## 5. COMPONENT & PATTERN STANDARDS

- **Bottom nav:** 3 thumb tabs max, center action raised (the mic). Active state in
  gold. `aria-current`.
- **FAB / primary CTA:** gold, ≥56px, bottom-right or bottom-center, with a clear verb.
- **Bottom sheet:** rounded-top, drag handle, swipe-to-dismiss, safe-area padding,
  backdrop blur, spring-in.
- **Cards:** 16px radius, cream-light surface, gold border on select; tap = scale 0.97.
- **Lists:** swipe actions + visible affordance; section headers in serif; empty state
  is designed, never blank.
- **Inputs:** large, single-column, correct mobile keyboard (`inputMode`),
  inline validation, never a red wall.
- **Loading:** skeletons in brand tones; the persistent listening/processing pulse;
  no raw browser spinners.
- **Audio:** custom on-brand player (gold play/scrubber), never default `<audio controls>`.
- **Feedback:** subtle haptics where supported (Android); visual confirmation always
  (iOS Safari has no vibrate).

---

## 6. THE GOLDEN PATH — creating a song, the ideal route

This is the experience we are building toward. Every feature serves this arc. It must
feel like the app is *catching* the song, not making you file paperwork.

> **Act I — Catch the spark (≤ 5 seconds, zero friction)**
> 1. Open the app → you land **on the mic** (home *is* creation, not a dashboard).
>    A warm serif prompt: *"What's on your heart?"*
> 2. **Tap the gold mic** → it's recording instantly. Hum the melody, sing the line.
>    The waveform breathes; a calm "listening" pulse says *I've got you.*
> 3. **Tap to stop.** Done. The idea is captured before it could slip away.

> **Act II — The app does the work (smart auto)**
> 4. Review slides up: **playback on a beautiful gold player**, and the app
>    **auto-transcribes** the hum/words into lyrics and **auto-detects sections**
>    ("Verse", "Chorus") and **BPM/key**. The user edits, doesn't author from scratch.
> 5. One tap **"Keep / file into a song."** It becomes a **song with its own room** —
>    titled smartly, never a blank "Untitled."

> **Act III — The song becomes whole (the Room)**
> 6. The **Room** opens: *everything for this song stays connected here* — the voice
>    memo, the lyrics, chords, notes, people — each a glanceable panel, one tap deep.
> 7. Add as you go via the **one-tap rail** (Lyrics / Chords / Section / Scripture /
>    Idea) — progressive, never a form maze. Chords via the tap-to-build picker;
>    Scripture via reference lookup. Smart, fast, forgiving.

> **Act IV — Shape & arrange (the Canvas, optional/advanced)**
> 8. For non-linear writing, open the **Canvas**: idea cards branch off the song,
>    drag to arrange, group into sections, promote the keepers toward the final.
>    Direct manipulation, CapCut-smooth.

> **Act V — Together & better (the loops)**
> 9. **Invite a collaborator** in two taps (the growth loop) — they land in the room
>    with the right role; their color threads through their contributions.
> 10. **Practice** the song with the looping player (Spotify-style persistent
>     mini-player) until it's in the hands.
> 11. Come back later → a **calm "what changed since you left"** recap. Credits
>     remember who shaped what.

**The feeling at every step:** *fast, safe, warm, and obvious.* If any step makes the
user stop and think "how do I…?", that step has failed the benchmark.

---

## 7. THE UNIVERSAL AVOID LIST (mobile)

- Desktop layouts shrunk to fit · tiny tap targets · top-left primary actions.
- Spinners where a skeleton/optimistic UI belongs · visible content pop-in.
- Multi-step forms for what should be one tap · modal-on-modal.
- Red badges, notification spam, upsell interstitials, dark patterns.
- Default browser widgets (`<audio controls>`, native selects) in premium surfaces.
- Gesture-only actions with no visible control · motion that ignores reduced-motion.
- Blank empty states · "Untitled" everything · "Submit"/"Learn More" copy.

---

## 8. THE BAR — how to know a screen is done

- [ ] **The 3-second test:** a first-timer knows what this screen is and the one thing
      to do, in 3 seconds, one-handed.
- [ ] **The thumb test:** the primary action is reachable by the right thumb without
      shifting grip.
- [ ] **The CapCut test:** the core action is doable in ≤2 taps from landing, with
      instant feedback.
- [ ] **The Apple test:** type hierarchy, spacing, motion, and haptics feel
      intentional; nothing is default.
- [ ] **The sanctuary test:** it feels calm and warm — no noise, no nagging.
- [ ] **The home-screen test:** it would not look out of place beside Voice Memos,
      CapCut, and Things 3.
- [ ] All five interactive states · reduced-motion · 44×44 · tokens only · 60fps.

*Last updated: 2026-06-19. The standard for every `C*` (Claude) prompt.*
