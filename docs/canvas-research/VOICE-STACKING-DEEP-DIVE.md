# DEEP DIVE — Voice-Memo Stacking ("record over this")
## Research-only companion to [CANVAS-VOC-AND-UX-DOSSIER.md](./CANVAS-VOC-AND-UX-DOSSIER.md) · gift to the Canvas lane
## The Canvas's #1 differentiator, drilled to the bottom

> Research-only. I do not build in the Canvas lane. Sourced; Reddit/FB uncrawlable → Hypotheses. The Canvas
> Architect + `/canvas` own any build decision.

---

## 1. THE WEDGE, IN ONE SENTENCE

**Apple just proved the demand for "record over this" and then crippled it — leaving the multiplayer,
song-native, unlimited version wide open for COG.**

In iOS 18.2 (late 2024) Apple added **layered recording to Voice Memos** — overdub a vocal on top of a
guitar take, in-app, no headphones, background-cancelled. The press reaction confirms the job is real:
> *"Apple set to introduce track layering to Voice Memos… giving songwriters a quick alternative to a mobile
> DAW."* ([MusicRadar](https://www.musicradar.com/music-tech/software-apps/apple-set-to-introduce-track-layering-to-voice-memos-in-iphone-16-pro-giving-songwriters-a-quick-alternative-to-a-mobile-daw))
> *"The new Apple Voice Memos features are a game-changer for musicians."* ([SoundGuys](https://www.soundguys.com/apple-voice-memos-app-for-musicians-123720/))

And why people reach for the phone first:
> *"Catching the germ of a fleeting idea is perhaps the most challenging thing for any artist, and first
> recordings are frequently made on the device that's close at hand, which is often the iPhone."* ([MusicRadar](https://www.musicradar.com/music-tech/software-apps/apple-set-to-introduce-track-layering-to-voice-memos-in-iphone-16-pro-giving-songwriters-a-quick-alternative-to-a-mobile-daw))

**Apple's crippling limits = COG's differentiation map:**

| Apple Voice Memos layered recording (2024) | COG voice stacking should be… |
|---|---|
| **Max 2 layers**, 2nd track always mono ([MacRumors](https://www.macrumors.com/2024/12/11/ios-18-2-layered-voice-memo-recordings/)) | **Unlimited layered takes** in a stack |
| **iPhone 16 Pro-exclusive** ([MacRumors](https://www.macrumors.com/2024/09/13/multitrack-recording-voice-memos-iphone-16-pro/)) | **Any phone** (secure-context Web Audio, not hardware-gated) |
| **Single-player** (your device only) | **Multiplayer** — each layer carries a *contributor identity + color* |
| **Not song-organized** (a flat memo) | **Attached to the song** + its idea card; feeds Compare/Final/Credits |
| No labels, no "which take wins" | **Mark-the-keeper** + comp-style compare (see §3) |

This is a clean, defensible wedge: COG isn't competing with a DAW or with Apple's 2-layer toy — it's the
**multiplayer, song-attached, unlimited reply-by-audio** layer nobody ships.

---

## 2. HOW MUSICIANS ACTUALLY LAYER (steal the workflow, not the DAW)

**Harmony/overdub building** is bottom-up, part by part:
> *"In a harmony builder, all the parts of a song section are built up one by one, usually from the lowest part
> to the highest."* ([Midnight Music](https://midnightmusic.com/2021/09/how-to-record-a-tiktok-harmony-builder-in-soundtrap-bandlab-or-garageband/))
> *"Layering vocal harmonies is one of the best ways to add emotion, texture, and depth"* (the Ocean Eyes
> quality). ([BandLab](https://blog.bandlab.com/voice-changer-or-harmony-generator-bandlab/))

BandLab/Soundtrap prove cloud + real-time collab layering works — *but* they're DAW track stacks (lanes,
mixing), not song-idea reply-by-audio. COG's stack = **"I like that idea, here's mine on top,"** not a mixer.

---

## 3. VOCAL COMPING → the UX patterns COG should steal for stacked takes

Comping is exactly "many takes → pick the best parts," and its workflow is a ready-made UX for stacks:
- **Loop-and-compare a short section back-to-back:** *"compare just one phrase at a time from each of the takes
  by listening to a short section as the transport loops over it."* ([Sound on Sound](https://www.soundonsound.com/techniques/track-comping)) → maps to COG **Listen Path + Compare** over a stack.
- **Record several, then choose:** *"Record at least 3 takes… ideally 5 to 6."* ([Orpheus Audio Academy](https://www.orpheusaudioacademy.com/record-vocals-in-one-take/)) → stacks should make 3–6 layered takes *frictionless*, not heavy.
- **Color-code keepers/rejects + label:** green = keeper, yellow = potential, red = reject; WU/MT/FIX labels. ([Splice](https://splice.com/blog/vocal-comping-tips/)) → COG could let a stack **mark the keeper take** (the one that flows to Final) with a calm gold marker — no red "reject" energy (faith-context tone).
- **Choose emotion over technical perfection:** *"Choose the phrases… in which the singer has best captured the
  emotion or vibe of the song, even if they're not technically perfect."* ([From Zero To Studio](https://fromzerotostudio.com/blog/vocal-comping-101-combining-multiple-takes)) → the "keeper" affordance is about *feel*, not a waveform editor. Keep it human, not surgical.

**Translation for the Canvas lane:** a stack needs three calm verbs — **add a layer**, **compare layers** (loop
A vs B), **mark the keeper** — and nothing of the DAW (no lanes, no faders, no comp-editing). That's the whole
interaction.

---

## 4. JOBS & TRIGGERS

- **When** someone drops a hum/melody memo, **I want** to record *my* harmony on top of it, **so I can** answer with audio, not words. → *layered take + contributor identity.*
- **When** a base memo has 4 takes, **I want** to loop-compare them back-to-back, **so I can** feel which one wins. → *compare in stack.*
- **When** a take is the one, **I want** to mark it the keeper, **so it** flows to Final without deleting the others. → *keeper marker (additive, lossless).*
- **When** I'm on any phone at rehearsal, **I want** unlimited quick layers, **so I'm** not blocked by a 2-layer / 16-Pro limit. → *the Apple gap.*

---

## 5. RISK REGISTER

| Risk | Why | Mitigation |
|---|---|---|
| **Becomes a DAW** (lanes/faders/mixing) | Comping research is DAW-shaped | Three verbs only — add layer / compare / mark keeper. No mixer. (Canvas persona: anti-DAW) |
| **Mobile audio reliability** | iOS Safari `MediaRecorder`/`AudioContext` quirks; lost takes | iOS-first audio doctrine: resume AudioContext in-gesture; single flush on stop; preserve the take on every failure (already in COG's voice doctrine) |
| **Stack overwhelm** | Unlimited layers could clutter | Grouped base+layers as one tactile stack (8–14° offset), mute/solo hidden until useful (per Canvas persona) |
| **Red "reject" energy** | Comping uses red rejects | Faith-context: mark the keeper in gold; never label a take "rejected" |

---

## 6. HYPOTHESES (Reddit/FB uncrawlable → confirm manually)

- **H1**: The "record over a teammate's memo" moment is the single biggest word-of-mouth wow for worship teams. → demo tests, worship FB groups.
- **H2**: Worship harmony parts (low→high stacking) are a frequent, specific use of stacking. → r/worshipleaders, choir directors.
- **H3**: Users abandon Apple Voice Memos layering specifically because of the 2-layer / 16-Pro / single-player limits. → App Store reviews, MacRumors forum threads.

---

## 7. SOURCES
- [MusicRadar — Voice Memos track layering for songwriters](https://www.musicradar.com/music-tech/software-apps/apple-set-to-introduce-track-layering-to-voice-memos-in-iphone-16-pro-giving-songwriters-a-quick-alternative-to-a-mobile-daw) · [SoundGuys — game-changer for musicians](https://www.soundguys.com/apple-voice-memos-app-for-musicians-123720/)
- [MacRumors — multitrack 16 Pro exclusive](https://www.macrumors.com/2024/09/13/multitrack-recording-voice-memos-iphone-16-pro/) · [MacRumors — iOS 18.2 layered recordings + limits](https://www.macrumors.com/2024/12/11/ios-18-2-layered-voice-memo-recordings/) · [AppleInsider — how-to layered recording](https://appleinsider.com/inside/iphone-16/tips/how-to-add-vocals-voiceovers-with-voice-memos-layered-recording)
- [Sound on Sound — track comping (loop-compare)](https://www.soundonsound.com/techniques/track-comping) · [Splice — vocal comping (color-code keepers)](https://splice.com/blog/vocal-comping-tips/) · [From Zero To Studio — comping (emotion over perfection)](https://fromzerotostudio.com/blog/vocal-comping-101-combining-multiple-takes) · [Orpheus Audio Academy — how many takes](https://www.orpheusaudioacademy.com/record-vocals-in-one-take/)
- [Midnight Music — harmony builder (low→high)](https://midnightmusic.com/2021/09/how-to-record-a-tiktok-harmony-builder-in-soundtrap-bandlab-or-garageband/) · [BandLab — vocal layers](https://blog.bandlab.com/voice-changer-or-harmony-generator-bandlab/)
- **Could NOT verify (agent-blocked):** Reddit, Facebook worship/songwriting groups → §6.
