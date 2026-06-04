# Colors of Glory
## Master Visual UI Brief — Onboarding Flow
### Fantasy.co × Aristide Benoist × Resn Standard
### For the Visual UI Specialist

---

> **How to use this document.**
> Every section is a design argument, not a suggestion. The emotional intention defines what the viewer must *feel* before they read a single word. The visual direction is the precise execution. The "what not to do" section is non-negotiable — violating it produces a generic screen, not a Colors of Glory screen.
>
> Reference palette throughout: `#FAFAF6` (near-white), `#1A1A1A` (near-black), `#B5935A` (muted gold), `#E05440` (recording red), `#FFFFFF` (card surface), `#666` (secondary text), `#999` (muted).

---

## DESIGN PRINCIPLES (Apply to Every Screen)

**1. The screen is a room, not a form.**
Every onboarding screen is a private, quiet space the user enters. It should feel like opening a beautiful notebook — not filling out paperwork.

**2. Negative space is a first-class element.**
The empty cream/white canvas communicates safety, privacy, and premium. Do not fill it. Let it breathe. The amount of empty space is proportional to emotional weight.

**3. Typography IS the hierarchy.**
There are no decorative dividers, no colored headers, no section boxes. The type scale alone creates structure. One H1. Clear body. Small muted labels.

**4. Gold is earned, not given.**
The gold color (`#B5935A`) appears only on: the primary CTA button, active input borders, link text, and the crown mark. Never as a background. Never decoratively. It must always mean: *this is the action that moves you forward.*

**5. Motion is memory.**
Every transition communicates continuity. The user is not moving between pages — they are moving deeper into a private creative room.

---

## THE LOGO SYSTEM

### Crown Mark
Simple geometric crown: three upward arches from a horizontal base. Thin stroke (1.8–2px), no fill on the body, small filled dots at each arch tip. Always `#B5935A` gold. Never outlined, never filled solid, never colored differently.

### Brand Lockup
- **Stacked**: Crown centered above, "Colors of Glory" in Playfair Display 500 weight below, tight tracking, 13–16px. Used on onboarding screens.
- **Horizontal**: Crown left of text on one baseline. Used on catalog header (dark bg) and referral screen.
- **Placement**: Always top-center of onboarding screens. Top offset: 64–72px from safe area. Never oversized. The crown mark should be 24–32px tall.

---
---

## SCREEN 1 — PHONE LOGIN
### `/auth/login`

**Emotional intention:** *I am not signing up for software. A private creative space is about to open in two taps.*

### Layout

```
[SAFE AREA TOP — 64px]

[CROWN MARK — 28px tall, centered]
[Colors of Glory — Playfair 500, 14px, centered, #1A1A1A]

[60px gap]

[WELCOME — Playfair Display 700, 42px, centered, #1A1A1A, line-height 1.05]

[8px gap]

[Enter your phone number to continue. — Inter 400, 16px, centered, #666]

[40px gap]

[PHONE INPUT CARD — 64px height, white #FFFFFF, border 1.5px rgba(0,0,0,0.12), radius 20px]
  [🇺🇸 flag — 22px] [+1 — Inter 500, 16px, #666] [1px divider — rgba(0,0,0,0.10)] [(555) 555-5555 — Inter 400, 16px, #1A1A1A placeholder #999]

[8px gap]

[We'll send a secure one-time code. No password needed. — Inter 400, 13px, centered, #999]

[24px gap]

[CONTINUE BUTTON — 56px height, radius 9999px (pill), #B5935A gold, white text, Inter 600 16px]

[16px gap]

[Use email instead — Inter 400, 14px, underlined, #B5935A, centered]

[PUSH TO BOTTOM]

[Preview demo › — Inter 400, 11px, #BBBBB, centered, very muted]
[SAFE AREA BOTTOM — 16px]
```

### Input states
- **Empty**: `border: 1.5px solid rgba(0,0,0,0.12)`, CTA opacity 0.4, pointer-events none on CTA
- **Typing**: border transitions to `1.5px solid rgba(0,0,0,0.20)`, subtle deepening
- **Valid (10 digits)**: `border: 1.5px solid #B5935A`, `box-shadow: 0 0 0 3px rgba(181,147,90,0.10)`, CTA becomes full opacity + shadow
- **Loading**: CTA text changes to "Sending code..." + Loader2 spin icon, CTA disabled, input frozen
- **Error**: Inline text below input in `#E05440` — "We could not send the code. Check your connection and try again."

### Motion
- Screen entrance: `opacity 0 → 1`, `translateY(12px) → 0`, `240ms`, `cubic-bezier(0.22, 1, 0.36, 1)`
- Input focus: border color transition `180ms ease`
- CTA press: `scale(0.97)`, `120ms ease`, instant return
- CTA loading: width stays fixed, text crossfade `150ms`
- Transition to Screen 2: slide-out left `180ms`, Screen 2 slides in from right

### What NOT to do
- No social login buttons (Apple, Google)
- No password field, no username
- No background gradient or texture
- No large logo — it must be quiet
- No "Create account" or "Sign up" copy anywhere
- No progress bar showing "Step 1 of X"

---
---

## SCREEN 2 — CODE VERIFY
### `/auth/verify`

**Emotional intention:** *This is faster than I expected. It already feels like my phone knows this app.*

### Layout

```
[SAFE AREA TOP — 64px]

[CROWN + Colors of Glory — stacked, centered, 28px crown]

[52px gap]

[Check your phone — Playfair 700, 42px, centered, #1A1A1A]

[8px gap]

[We sent a 6-digit code to — Inter 400, 16px, #666, centered]
[+1 (555) 555-5555 — Inter 600, 16px, #1A1A1A, centered]

[40px gap]

[6 × OTP BOXES — centered row, gap 10px]
  Each box: 48px wide × 64px tall, white #FFFFFF, radius 16px
  border: 1.5px solid rgba(0,0,0,0.12) default
  border: 1.5px solid #B5935A + box-shadow: 0 0 0 3px rgba(181,147,90,0.15) when filled or focused
  text: Inter 700, 28px, #1A1A1A, centered

[10px gap]

[Codes usually arrive within a few seconds. — Inter 400, 13px, #999, centered]

[24px gap]

[VERIFY BUTTON — 56px pill, #B5935A, disabled opacity 0.4 until all 6 filled]

[20px gap]

[Resend code (30s) ←left    Change number →right — Inter 400, 14px]
  Resend: #B5935A underlined | Change: #999
```

### OTP interaction
- Auto-focus box 1 on mount
- Each digit typed: fill box, advance focus to next
- Backspace on empty box: retreat focus to previous
- Paste full 6-digit string: fill all boxes simultaneously, auto-submit
- Box 6 filled: `500ms` delay then auto-submit (gives user time to see full code)
- Success: brief `scale(1.02)` flash on all 6 boxes simultaneously, green tint transition, then navigate

### Motion
- OTP boxes entrance: stagger `50ms` per box, `translateY(8px) → 0`, `opacity 0 → 1`
- Box fill: scale `1 → 1.04 → 1`, `100ms` bounce, gold border flashes in
- Verify loading: boxes freeze, text crossfades to "Verifying...", pulse animation on all 6 borders
- Error: boxes shake (`translateX: -4px, 4px, -4px, 4px, 0`, `300ms`), borders flash red `#E05440` then return to default

### What NOT to do
- No single text field for the code — must be individual boxes
- No "Enter your OTP" label above boxes — headline already contextualizes it
- No resend button available in the first 30 seconds — prevent abuse
- No technical error strings like "OTP token expired"

---
---

## SCREEN 3 — FIRST INTENT
### `/onboarding/intent`

**Emotional intention:** *This app already understands me. It's asking what I want to do — not who I am.*

### Layout

```
[SAFE AREA TOP — 64px]

[CROWN + Colors of Glory — stacked, centered]

[52px gap]

[What are you working on? — Playfair 700, 42px, centered, #1A1A1A]

[8px gap]

[Choose where to begin. — Inter 400, 16px, centered, #666]

[40px gap]

[START A SONG CARD — white, border 1.5px #B5935A (gold), radius 20px, padding 20px]
  [44px gold-tinted circle icon] [PenLine icon 20px #B5935A]
  [Start a song — Playfair 600 17px #1A1A1A]
  [Create a private space for lyrics, voice memos, chords, and ideas. — Inter 400 14px #666 leading-relaxed]

[12px gap]

[JOIN A SONG CARD — white, border 1.5px rgba(0,0,0,0.08), radius 20px, padding 20px]
  [44px neutral circle icon] [Users icon 20px #666]
  [Join a song — Playfair 600 17px #1A1A1A]
  [Use an invite from someone you are writing with. — Inter 400 14px #666]

[32px gap]

[You can always do both later. — Inter 400, 13px, #999, centered]
```

### Card design
- **Start a song** (primary intent): gold border `1.5px solid #B5935A`, icon background `rgba(181,147,90,0.12)`
- **Join a song** (secondary): neutral border `1.5px solid rgba(0,0,0,0.08)`, icon background `rgba(0,0,0,0.04)`
- Both cards: `box-shadow: 0 2px 12px rgba(0,0,0,0.06)`
- Card hover: `box-shadow` deepens to `0 4px 20px rgba(0,0,0,0.10)`
- Card active/press: `scale(0.98)`, `120ms`

### Motion
- Screen entrance: screen slides in from right
- Cards stagger in: card 1 at `0ms`, card 2 at `80ms`, each `translateY(8px) → 0`, `opacity 0 → 1`, `280ms cinematic`

### What NOT to do
- No "Skip" option — users must choose to start or join
- No icons that look like app features (musical notes, headphones) — these intent cards are directional, not decorative
- No third option ("Browse songs", "Explore") — two choices maximum

---
---

## SCREEN 4 — START FIRST SONG
### `/onboarding/start-song`

**Emotional intention:** *Creating a song should feel lighter than creating a document. This isn't setup — it's the first creative breath.*

### Layout

```
[Back ← Songs — 44px tap target, top-left, #999, ArrowLeft 16px]

[CROWN + Colors of Glory — centered]

[32px gap]

[Let's start your first song — Playfair 700, 40px, centered, #1A1A1A, line-height 1.05]

[8px gap]

[Just the basics. You can add the rest inside. — Inter 400, 16px, centered, #666]

[36px gap]

[Song title — Inter 500, 14px, #666]
[6px gap]
[INPUT — 72px height, white #FFFFFF, radius 20px, border 1.5px rgba(0,0,0,0.10)]
  [Name your song... — Playfair 600 italic, 19px, #999 placeholder → #1A1A1A filled]
  [Gold border + glow when focused/filled]

[20px gap]

[KEY SELECTOR (flex-1) + BPM INPUT (flex-1) — side by side, gap 12px]
  Each: 52px height, white, radius 14px, Inter 400 15px
  [Key — Inter 500, 14px, #666] [optional — Inter 400, 14px, #999]
  [BPM — Inter 500, 14px, #666] [optional — Inter 400, 14px, #999]

[36px gap]

[CREATE SONG — 56px pill, #B5935A gold]

[16px gap]

[Skip for now — Inter 400, 15px, #999, underlined, centered]
```

### The title field
The song title input is the **largest element on the screen** — larger than the body copy, larger than the labels. It should feel like opening to a blank page of sheet music. The placeholder text "Name your song..." should be in italic Playfair Display — communicating that this is creative, not administrative.

### States
- **Empty**: `opacity: 0.4` on Create song, Skip for now always available
- **Title filled**: gold border on title field, Create song full opacity
- **Creating**: Create song shows "Creating..." + spinner, fields frozen
- **Skip flow**: title creates as "Untitled Song", same visual loading state

### Motion
- The title input auto-focuses on mount (500ms delay after entrance animation settles)
- Focus ring: `0 0 0 3px rgba(181,147,90,0.12)` appears over `160ms`
- Key/BPM fields: gold accent on focus, `160ms` transition

### What NOT to do
- No genre dropdown, no "category" or "type" field
- No cover art upload prompt
- No "Add collaborators" option on this screen — creative momentum first
- No progress stepper showing "Step 3 of 8"

---
---

## SCREEN 5 — INVITE PREVIEW
### `/invite/:token`

**Emotional intention:** *Someone I trust brought me here. This feels personal, not like a generic app download.*

### Layout

```
[Back ← — ArrowLeft, top-left]

[CROWN + Colors of Glory — centered]

[52px gap]

[You've been invited — Playfair 700, 42px, centered, #1A1A1A]

[8px gap]

[Open the song and start collaborating. — Inter 400, 16px, centered, #666]

[40px gap]

[INVITE CARD — white #FFFFFF, border 1.5px rgba(181,147,90,0.30), gold-tinted, radius 20px, padding 24px]
  [SONG TITLE — Playfair 700, 22px, #1A1A1A, leading-snug]
  [8px gap]
  [Invited by Parker — Inter 400, 14px, #666, "Parker" in Inter 600 #1A1A1A]
  [24px gap]
  [AVATAR STACK — 3 circles, 32px diameter, 2.5px white border, -10px overlap]
    [Each: initials text 11px bold white, colored bg]
  [+inline: 3 collaborators — Inter 400 14px #666]
  [ROLE CHIP — inline-right: "Contributor", Inter 600 12px #B5935A, bg rgba(181,147,90,0.12), border rgba(181,147,90,0.25), radius 9999px, px 12 py 4]
  [Divider 1px rgba(0,0,0,0.06) — 16px margin top]
  [Role description — Inter 400 13px #999 leading-relaxed]

[16px gap]

[Invited songs do not use your free song. — Inter 400 13px #999 centered]

[32px gap]

[OPEN SONG — 56px pill #B5935A gold]

[16px gap]

[View details — Inter 400 15px #999 underlined centered]
```

### Visual hierarchy insight
The invite card has a gold-tinted border (`rgba(181,147,90,0.30)`) that distinguishes it from all other white cards on the screen. This communicates: *this card is the reason you're here*. The song title inside should be the largest type element in the card — it earns the most visual weight because the invitee should know what song they're joining before anything else.

### Motion
- Invite card: entrance from `scale(0.96) opacity(0)` → `scale(1) opacity(1)`, `400ms cinematic ease`
- Avatar stack: each avatar animates in with `60ms` stagger, sliding in from the left

---
---

## SCREEN 6 — FOUNDER CODE
### `/onboarding/founder-code`

**Emotional intention:** *I have been given something private. This feels like a key, not a coupon.*

### Layout — Entry State

```
[Back ← — top-left]

[CROWN + Colors of Glory — centered]

[48px gap]

[Have a founder code? — Playfair 700, 40px, centered, #1A1A1A, 2 lines, line-height 1.05]

[8px gap]

[Enter it here to unlock your private access. — Inter 400, 16px, centered, #666]

[48px gap]

[CODE INPUT — 60px height, white #FFFFFF, radius 20px, border 1.5px, centered text]
  [FOUNDER-X7K92Q — Inter 600 18px tracking-[0.10em] uppercase, centered]
  [Active: gold border + glow]

[36px gap]

[UNLOCK ACCESS — 56px pill, #B5935A, disabled opacity 0.4 until code has characters]

[PUSH TO BOTTOM]

[I'll do this later — Inter 400 15px #999 underlined centered]
```

### Layout — Success State

```
[Screen: #FAFAF6 white, right-corner amber glow only]

[LARGE EMPTY SPACE — ~35vh of pure white above headline]
[This emptiness is intentional — it communicates: access granted, you are inside]

[Founder access unlocked — Playfair 700, 44px, centered, #1A1A1A, line-height 1.05]
[20px gap]
[Your Pro workspace is ready. — Inter 400, 17px, centered, #666]

[PUSH TO BOTTOM]

[START A SONG — 56px pill #B5935A, full-width, at bottom of screen]
[SAFE AREA — 32px]
```

### The success state is unusual — it has a lot of empty space.
This is intentional. The reference image shows the right phone as almost entirely white with only the headline and the bottom CTA. The message is: *you have been granted access to something private. Take a breath. Now begin.*

### Motion
- Entry to success: content cross-fades, the headline animates up from `translateY(20px)`, `600ms cinematic`
- Success state: the bottom CTA slides up from below the fold, `400ms`, `cubic-bezier(0.22, 1, 0.36, 1)`

---
---

## SCREEN 6.5 — EARN PAGE (NEW)
### `/onboarding/earn`

**Emotional intention:** *I just got access to something. Now I'm being told I can share it and build something financially significant from day one. This isn't a referral program — it's a business.*

### Layout

```
[CROWN + Colors of Glory — centered]

[32px gap]

[TrendingUp icon — 56px circle, rgba(181,147,90,0.12) bg, gold border, #B5935A icon]

[24px gap]

[Invite songwriters.↵Earn every month. — Playfair 700, 40px, centered, #1A1A1A, line-height 1.05]

[12px gap]

[You earn $5/month for every songwriter — Inter 400 16px centered #666]
[$5/month — Inter 700 16px #1A1A1A inline]
[who joins Pro through your link. — continues inline]

[8px gap]

[Stacks infinitely. No cap. Paid monthly while they stay. — Inter 600 13px #B5935A centered]

[32px gap]

[WHAT THIS LOOKS LIKE CARD — white, rounded-2xl, padding 16px]
  [DollarSign icon 14px + WHAT THIS LOOKS LIKE — uppercase 12px #999 tracking-wide]
  [20px gap]
  [STAT ROWS — 4 rows]
    Row 1: Users icon · 10 songwriters · $50/mo · $600/yr — neutral bg
    Row 2: Users icon · 100 songwriters · $500/mo · $6,000/yr — neutral bg
    Row 3: Users icon · 1,000 songwriters · $5,000/mo · $60,000/yr — neutral bg
    Row 4: Users icon · 5,000 songwriters · $25,000/mo · $300,000/yr — GOLD HIGHLIGHT ROW
      [bg: rgba(181,147,90,0.10), border: rgba(181,147,90,0.25)]
      [All text #B5935A for the value, #1A1A1A for the label]
  [20px gap]
  [CALLOUT BOX — rgba(181,147,90,0.06) bg, rounded-xl]
    [Refer 5,000 songwriters → $300,000/year recurring cash — #666 centered leading-relaxed]
    ["5,000 songwriters" bold #1A1A1A, "$300,000/year" bold #B5935A]
    [direct into your account, every month, for as long as they stay.]

[24px gap]

[REFERRAL LINK CARD — white, border 1.5px rgba(181,147,90,0.30), overflow hidden]
  [Your referral link — Inter 500 12px uppercase #999]
  [app.colorsofglory.com/ref/PARKER123 — monospace 15px #1A1A1A truncated]
  [Copy button — rounded-xl, switches to "Copied!" + check icon on tap]

[12px gap]

[Direct referrals only · 30-day payout hold · Payouts begin when referral goes Pro — 12px #999 centered]

[32px gap]

[START MY FIRST SONG → — 56px pill #B5935A]

[16px gap]

[Skip for now — 15px #999 underlined centered]
```

### The stat table design
The four rows create a visual argument: each row doubles/10xs the previous. The final row (`5,000 songwriters = $300,000/year`) breaks the visual pattern — it uses the gold highlight treatment to signal: *this is what we're building toward*. The numbers must be formatted with commas (`$300,000`) and the `/yr` and `/mo` labels must be small and muted so the **big numbers dominate**.

### Typography hierarchy within stat rows
- Number of people: `Inter 500 14px #1A1A1A` (for neutral rows) or `#1A1A1A` (gold row)
- Dollar amount per month: `Inter 700 14px #1A1A1A` (neutral) or `#B5935A` (gold row)
- Dollar per year: `Inter 400 12px #999` — secondary

### Motion
- The stat rows stagger in: `0ms / 60ms / 120ms / 180ms`
- Gold row gets a subtle pulse on entrance: `scale(1.01 → 1.0)`, `400ms ease`
- Copy link: icon crossfades from Copy → Check, text crossfades, `150ms`

---
---

## SCREEN 7 — SONG WORKSPACE
### `/songs/:id`

**Emotional intention:** *I am inside a private room that belongs to this song. Everything I need is right here.*

### Layout

```
[← Songs — top-left, 44px tap target, #999]

[CROWN + Colors of Glory — centered, slight spacing]

[32px gap]

[SONG TITLE — Playfair 700, 36px (clamped), centered, #1A1A1A, line-height 1.1]
[Private song space — Inter 400 15px #666 centered]
[Key · BPM — Inter 400 13px #999 centered, IF available]

[24px gap]

[Start anywhere. Add a lyric, record a voice memo, or invite someone into the song.
 — Inter 400 14px #999 centered leading-relaxed, max-width 300px, centered]

[32px gap]

[2-COLUMN MODULE CARD GRID — gap 12px]
  Each card: white #FFFFFF, radius 20px, border 1px rgba(0,0,0,0.07), shadow 0 2px 10px rgba(0,0,0,0.06)
  Min-height: 110px, padding: 16px
  Contents:
    [Top-left: 36px circle, bg rgba(181,147,90,0.10), icon 18px #B5935A strokeWidth 1.6]
    [Bottom-left: label Inter 600 15px #1A1A1A]
  Cards: Lyrics / Voice Memo / Chords / Notes / Invite

[BOTTOM QUICK-ACTION BAR — fixed, bottom of screen above safe area]
  3 pill buttons in a row, each 44px height, max-width 145px, flex-1
  [Write lyric — #1A1A1A bg, white text, Inter 600 13px, PenLine icon 15px]
  [Record memo — #B5935A gold bg, white text, Inter 600 13px, Mic icon 15px, gold shadow]
  [Invite — #1A1A1A bg, white text, Inter 600 13px, UserPlus icon 15px]
```

### The module card visual language
Cards use **bottom-left anchored content** — the icon in the top-left, label in the bottom-left. This creates a visual rhythm of repeated negative space in the center-right of each card. The card should feel like a mini-section of the workspace, not a navigation button.

### Bottom bar
The three pill buttons are `#1A1A1A` (near-black) except for "Record memo" which is gold. This communicates: *recording is the most important first action*. The contrast of three dark pills with one gold pill is the only visual emphasis on the screen below the module grid.

### Motion
- Module cards stagger on mount: `40ms` between each, `translateY(8px) → 0`, `opacity 0 → 1`
- Card press: `scale(0.97)`, `120ms`
- Quick-action bar slides up from below screen on mount: `translateY(20px) → 0`, `400ms`, `cubic-bezier(0.22, 1, 0.36, 1)`

### What NOT to do
- No large background image or illustration behind the cards
- No sidebar or hamburger menu
- No "tabs" at the top — the module grid IS the navigation
- No song cover art on this screen — the song title carries all the identity

---
---

## SCREEN 8 — CAPTURE FIRST IDEA
### `/songs/:id/capture`

**Emotional intention:** *This is the moment. The blank page is gone — replaced by a giant invitation to begin.*

### Layout — Default State

```
[CROWN + Colors of Glory — stacked centered, 64px from top]

[48px gap]

[Capture the first idea — Playfair 700, 40px, centered, #1A1A1A, line-height 1.05]

[12px gap]

[Record a melody, lyric thought, chord idea, or prayer moment.
 — Inter 400, 16px, centered, #666, max-width 280px]

[56px gap]

[LARGE GOLD MIC BUTTON — 120px diameter circle, #B5935A solid fill]
  [shadow: 0 8px 32px rgba(181,147,90,0.45)]
  [Mic icon — white SVG, 44px, custom drawn (not filled), clean strokes]
  [Centered in screen horizontally, slightly above vertical center]

[24px gap]

[Record voice memo — Inter 500 15px #B5935A underlined centered]

[16px gap]

[PenLine icon 14px #999 inline] [Write lyrics instead — Inter 400 15px #999 centered]
```

### Layout — Recording State (FULL SCREEN)

```
[Background: #FAFAF6 — pure, clean, no logo]

[ANIMATED WAVEFORM — centered, 320px wide × 120px tall]
  32–40 bars, 6–10px wide each, rounded-full tops
  Heights: randomized per-frame via rAF, range 8px – 80px
  Color gradient LEFT → RIGHT:
    Left bars: rgb(200, 120, 60) — warm amber
    Center bars: rgb(220, 100, 50) — deep orange
    Right bars: rgb(224, 84, 64) — red/coral (#E05440)
  Animation: each bar height lerps toward a random target at 0.35 speed per frame, ~60fps

[40px gap]

[TIMER — 0:42 — Inter 700, 64px, #E05440, tabular-nums, line-height 1]

[8px gap]

[Recording... — Inter 400, 16px, #999]

[56px gap]

[STOP BUTTON — 180px wide × 52px height, radius 9999px (pill), #E05440 red]
  [Stop — Inter 600, 16px, white]
  [shadow: 0 4px 16px rgba(224,84,64,0.40)]
```

### The recording screen visual argument
When the user is recording, **the waveform IS the screen**. Nothing else competes for attention. No header, no navigation, no logo. The recording state is the most focused moment in the entire onboarding — the app has reduced itself to a timer, a waveform, and a stop button. This communicates: *your idea is all that matters right now.*

### The waveform
The bars should not be uniform — they should feel like real audio. Use a Perlin noise-inspired or smooth random approach, not pure random (which looks jittery). Adjacent bars should have correlated heights. The color gradient from amber to red creates a visual sense of energy building from left to right.

### Motion
- Tap mic button → immediate visual: button pulses `scale(0.95 → 1.02 → 1.0)`, `200ms spring`, then FULL SCREEN recording state fades in from `opacity(0)`, `300ms`
- Waveform bars: each starts at height 8px, then rAF animation begins immediately
- Stop button: slides up from `translateY(24px)`, `400ms`, once waveform is running
- After Stop: recording state fades to `opacity(0)`, navigate to Screen 9

### What NOT to do
- No waveform if not recording — the button should be the sole focus before recording begins
- No "Cancel" or "Discard" — only "Stop" (commitment language)
- No time limit display unless approaching a limit
- No audio controls, no effects, no EQ

---
---

## SCREEN 9 — VOICE MEMO ADDED
### `/songs/:id/voice-added`

**Emotional intention:** *My idea is safe. The song now has a memory. I didn't just record something — I built something.*

### Layout

```
[Background: #FAFAF6 — no logo at top, content-first screen]

[UPPER THIRD: generous empty cream space — ~100px]

[VOICE MEMO CARD — white #FFFFFF, centered, radius 20px]
[shadow: 0 4px 24px rgba(0,0,0,0.10)]
[padding: 20px]

  [Voice Memo 1 — Inter 700, 18px, #1A1A1A]
  [6px gap]
  [Just now · 0:42 — Inter 400, 13px, #999]
  [20px gap]

  [ROW: Play circle + Rename + Add note + Share]
    [Play: 40px circle, #B5935A gold bg, white ▶ icon, shadow 0 4px 12px rgba(181,147,90,0.30)]
    [Rename / Add note / Share: icon 16px + label 12px Inter 400 #666, 24px apart]

[36px gap]

[Your idea is saved. Now add lyrics, chords, or invite someone to build with you.
 — Inter 400, 15px, #666, centered, italic, leading-relaxed, max-width 280px]

[PUSH TO BOTTOM]

[OPEN SONG ROOM — 56px pill #B5935A gold, full-width]
[16px gap]
[Invite a collaborator — Inter 400 15px #999 underlined centered]
[SAFE AREA BOTTOM]
```

### The waveform (if shown)
If a waveform visualization of the recording is shown inside the card, use amber/gold bars (not red — the recording is over). Bars are static, not animated. Approximately 20 bars showing the amplitude shape of the recording. Left third fully gold (`#B5935A`), right two-thirds at `rgba(181,147,90,0.25)` — communicating "played to this point."

### Motion
- Card entrance: `scale(0.94) → scale(1)`, `opacity 0 → 1`, `500ms cinematic ease`
- The empty space above the card is not empty on entrance — the card slides UP into position from `translateY(20px)`
- The supporting text below fades in `200ms` after card settles

### The copy
"Your idea is saved. Now add lyrics, chords, or invite someone to build with you." — this copy should be in a slightly softer rendering than headline text. Consider making it italic for warmth. The tone is: *your idea is cherished. Now let's build.*

---
---

## SCREEN 10 — LYRICS + CHORDS
### `/songs/:id/lyrics`

**Emotional intention:** *I am writing a real song. The app has gotten out of my way.*

### Layout

```
[← back arrow — top-left] [Crown icon only — top-center, 22px] [⋯ menu — top-right]

[Song Title — Playfair 700, 28px, #1A1A1A, left-aligned, px 20px]

[12px gap]

[TAB BAR — Lyrics / Chords / Voice / Notes — horizontal, underline style]
  Active tab: #1A1A1A text, 2px #B5935A underline
  Inactive: #999 text, no underline
  tabs left-aligned, px 20px, gap 24px

[Divider 1px rgba(0,0,0,0.06)]

[SCROLLABLE CONTENT AREA]

  [VERSE 1 — Inter 500, 13px, uppercase, #999, tracking-wide — section label]
  [8px gap]
  [CHORD CHIPS ROW — flex wrap, gap 6px]
    Each chord: "C" "G" "Am" — Inter 600, 13px, #1A1A1A
    Chip: px 10 py 4, bg rgba(0,0,0,0.05), border 1px rgba(0,0,0,0.08), radius 9999px
  [8px gap]
  [LYRIC LINES — Inter 400, 16px, #1A1A1A, leading-loose]
    Chord chips appear inline above the lyric line they correspond to, positioned by character offset

  [24px section gap]

  [VERSE 2 / CHORUS / BRIDGE labels + content repeat]

[FIXED BOTTOM BAR — above safe area]
  [ADD SECTION — flex-1, 44px, bg #F2EDE5, radius 12px, Inter 600 14px #666]
  [RECORD IDEA — flex-1, 44px, bg #B5935A gold, radius 12px, Inter 600 14px white]
  [gap 10px between buttons]
```

### The chord chip system
Chord chips float above lyric lines with a 4px vertical offset. They are positioned horizontally to align with the character in the lyric where the chord change occurs. The chip background is `rgba(0,0,0,0.05)` — extremely subtle, like a pencil mark above the lyrics.

### Typography note
The lyric text area should be `font-family: Inter` — not Playfair. Lyrics live in the body, not the headline. Playfair is for song titles and onboarding headlines only. Inside the workspace, type shifts to Inter to signal: *this is your workspace, not a design object.*

---
---

## SCREEN 11 — INVITE COLLABORATOR
### `/songs/:id/people`

**Emotional intention:** *I am opening the door to my creative room. The roles are clear — I stay in control.*

### Layout

```
[CROWN + Colors of Glory — centered]

[40px gap]

[Invite someone into this song — Playfair 700, 40px, centered, #1A1A1A]

[8px gap]

[They can listen, write, comment, or review depending on the role you choose.
 — Inter 400, 16px, centered, #666, leading-relaxed]

[36px gap]

[PHONE/EMAIL INPUT — 56px, white, radius 14px, border 1.5px rgba(0,0,0,0.10)]
  [Phone or email — Inter 400 16px #999 placeholder]

[24px gap]

[ROLE SELECTION — 3 cards side by side, gap 8px]
  Each card: white, 112px × 88px, radius 16px, border 1.5px rgba(0,0,0,0.08)
  CENTER TEXT: role name Inter 600 14px + small description Inter 400 12px #666

  SELECTED (Contributor default):
    border: 1.5px solid #B5935A
    box-shadow: 0 0 0 3px rgba(181,147,90,0.12)
    role name: #B5935A
    subtle inner warmth: bg rgba(181,147,90,0.04)

[28px gap]

[SEND INVITE — 56px pill #B5935A gold]

[12px gap]

[Invited songs do not use their free song. — Inter 400, 13px, #999, centered]
```

### Role card content
- **Viewer**: "Can listen and read." — neutral border, #666 text when unselected, #B5935A when selected
- **Contributor** (default selected): "Can add lyrics, memos, comments, and ideas."
- **Reviewer**: "Can comment and approve changes."

### Success state
After "Send invite" completes:
```
[LARGE GOLD CHECK CIRCLE — 64px diameter, #B5935A border 2px, #B5935A checkmark]

[Invitation Sent! — Playfair 700, 36px, centered, #1A1A1A]

[They can listen, write, comment, or review depending on the role you choose.
 — Inter 400, 16px, centered, #666]
```
The success state should feel like relief, not celebration. No confetti. No animation beyond the check circle scaling in.

---
---

## SCREEN 12 — CHOOSE THEIR ROLE
### Role selection sheet within `/songs/:id/people`

**Emotional intention:** *I understand what access I'm granting. This is a protection layer — not bureaucracy.*

### Layout — 3D Card Perspective Spread

```
[CROWN + Colors of Glory — centered]

[40px gap]

[Choose their role — Playfair 700, 40px, centered, #1A1A1A]

[48px gap]

[THREE CARDS IN PERSPECTIVE SPREAD]
  Layout: center card elevated/forward, side cards tilted back

  VIEWER (left, slightly back):
    White, 140px × 160px, radius 20px, shadow: 0 2px 8px rgba(0,0,0,0.08)
    Transform: rotateY(8deg) translateX(-8px) scale(0.95)
    Viewer — Inter 600 16px #1A1A1A
    Can listen and read. — Inter 400 13px #666

  CONTRIBUTOR (center, forward, SELECTED by default):
    Background: linear-gradient(145deg, rgba(181,147,90,0.15), rgba(181,147,90,0.06))
    Border: 2px solid #B5935A
    Width: 156px × 180px (slightly larger), radius 20px
    Shadow: 0 8px 32px rgba(181,147,90,0.30), 0 2px 12px rgba(0,0,0,0.10)
    Transform: translateY(-8px) scale(1.05) — visually in front
    Contributor — Inter 700 17px #B5935A
    Can add lyrics, memos, comments, and ideas. — Inter 400 13px #1A1A1A

  REVIEWER (right, slightly back):
    White, 140px × 160px, radius 20px, shadow: 0 2px 8px rgba(0,0,0,0.08)
    Transform: rotateY(-8deg) translateX(8px) scale(0.95)
    Reviewer — Inter 600 16px #1A1A1A
    Can comment and approve changes. — Inter 400 13px #666

[48px gap]

[CONFIRM ROLE — 56px pill #B5935A gold]
```

### The card perspective effect
Use CSS `transform: perspective(800px) rotateY(8deg)` on side cards. The center card should appear physically closer — larger, more shadow, slightly overlapping the side cards. When a user taps a side card, it should animate to the center position while the previous center slides to the side. This communicates: *role selection is a physical decision, not a radio button.*

### Motion
- Card tap: animate selected card to center (`300ms cubic-bezier(0.34, 1.56, 0.64, 1)` spring)
- All transforms animate simultaneously
- Confirm button: pulsed shadow `0 4px 16px rgba(181,147,90,0.40)` on the successful Confirm tap

---
---

## SCREEN 13 — SONG ACTIVITY
### `/songs/:id/activity`

**Emotional intention:** *The app has been watching while I was gone. It knows what happened. Now it's telling me — calmly.*

### Layout

```
[CROWN + Colors of Glory — horizontal lockup, centered]
  [Crown icon 22px] [Colors of Glory — Inter/Playfair, stacked 2-line or inline]

[40px gap]

[What changed since you left — Playfair 700, 44px, centered, #1A1A1A, line-height 1.0]

[Song name / X changes since — Inter 400, 14px, #999, centered]

[32px gap]

[ACTIVITY CARDS — stacked, gap 10px, full-width]

  Card format: white #FFFFFF, radius 16px, padding 16px, shadow 0 1px 6px rgba(0,0,0,0.06)
  Left border accent: 4px width, border-radius 4px, full height — color from aurora palette:
    Sarah's card: #53AB8B (teal-green)
    Parker's card: #D4AE5C (warm gold)
    Caleb's card: #8070C4 (purple)
    Comments card: no avatar, use MessageSquare icon

  Each card layout:
  [AVATAR CIRCLE 36px — initials Inter 700 13px white, bg = collaborator color]
  [Right of avatar:]
    [2m ago — Inter 400 12px #999]
    [Sarah added a voice memo — Inter 400 14px #1A1A1A, "Sarah" in Inter 600]
    [Sub-detail — Inter 400 13px #999 — "Verse 2 · First melody idea · 0:12"]

[32px gap]

[REVIEW CHANGES — 56px pill #B5935A gold]

[16px gap]

[Open song — Inter 400 15px #B5935A underlined centered]
```

### The left border accent
Each activity card has a 4px left border matching the collaborator's identity color from the aurora palette (`#53AB8B`, `#D4AE5C`, `#8070C4`, `#C26A95`). This color system carries through the entire app — each collaborator always uses the same hue. The card border is the only place color other than gold appears prominently.

### Motion
- Cards slide in from the right, staggered: `0ms / 80ms / 160ms / 240ms`
- Each card: `translateX(20px) → 0`, `opacity 0 → 1`, `320ms cinematic`
- "Returning to song..." pill: appears on left screen as a blurred overlay (from reference image), `1000ms` before digest resolves. This is a transitional micro-screen.

---
---

## SCREEN 14 — SONG CATALOG
### `/` (main app home)

**Emotional intention:** *My creative universe. Everything I've started, everything I've been invited into — in one clean view.*

### Layout

```
[DARK HEADER ZONE — #1C1A17 charcoal, full-width]
  [36px from top safe area]
  [Crown icon #B5935A gold + Colors of Glory — Inter/Playfair, white, horizontal lockup]
  [20px gap]
  [Your songs — Inter 700, 32px, white, #FFFFFF]
  [12px gap]
  [TAB ROW: Owned | Invited | Archived]
    Active: white text, 2px white underline
    Inactive: rgba(255,255,255,0.45), no underline
    [bottom of dark zone, seamlessly transitioning to card area]

[CREAM/WHITE CARD AREA — #FAFAF6, fills rest of screen]
  [Padding top: 20px]

  [2-COLUMN SONG CARD GRID — gap 12px, padding horizontal 16px]

    Each card: white #FFFFFF, radius 16px, border 1px rgba(0,0,0,0.07), shadow 0 2px 8px rgba(0,0,0,0.05)
    Padding: 16px

    [SONG TITLE — Playfair 600, 15px, #1A1A1A, leading-snug, 2 lines max]
    [8px gap]
    [STATUS DOT + STATUS LABEL — 6px circle + Inter 500 12px]
      Active: #53AB8B dot + "Active"
      Draft: #999 dot + "Draft"
      Collaborating: #D4AE5C dot + "Collaborating"
    [8px gap]
    [AVATAR STACK — 2-3 circles, 24px, -8px overlap, white border 1.5px]
    [LAST ACTIVITY — Inter 400 11px #999 — "Last activity 1m ago"]

[FIXED BOTTOM — gold pill "+ New song" 52px height, full-width minus padding, above tab bar]
```

### The dark-to-light transition
The header is charcoal. The card area below is near-white. This contrast creates a visual "shelf" — the dark area holds the navigation, the light area holds the creative work. The transition between them should be crisp (not gradient) — a clean horizontal seam.

### Song card emotional weight
Each card should feel like a physical card you could pick up. The shadow is enough. Do not add gradient fills, color washes, or background images unless there's album art. The song title in Playfair Display gives each card its identity — the typography IS the artwork.

---
---

## SCREEN 15 — UPGRADE MOMENT
### `/upgrade`

**Emotional intention:** *I understand what I'm being offered. This feels fair — not like a trap.*

### Layout

```
[← Back — top-left]

[CROWN + Colors of Glory — centered]

[40px gap]

[Ready to build your catalog? — Playfair 700, 40px, centered, #1A1A1A, line-height 1.05]

[12px gap]

[Free includes one active owned song. Upgrade to Pro when one song becomes a real workspace.
 — Inter 400, 16px, centered, #666, leading-relaxed]

[32px gap]

[TWO PLAN CARDS — side by side, gap 12px]

  FREE CARD (left):
    White, radius 16px, border 1px rgba(0,0,0,0.08), shadow subtle
    [Free — Inter 700 14px #B5935A] [gold label]
    Divider
    [1 owned song — Inter 400 14px #666]
    [500MB storage — #666]
    [Voice memos (limited) — #666]
    [Basic collaboration — #666]

  PRO CARD (right):
    White with gold gradient: linear-gradient(145deg, rgba(181,147,90,0.08), rgba(181,147,90,0.03))
    Border: 1.5px solid #B5935A
    Shadow: 0 4px 16px rgba(181,147,90,0.20)
    [Pro — Inter 700 14px #B5935A] [small "Most popular" chip — rgba(181,147,90,0.12), #B5935A, 11px]
    [/12/month — Inter 400 12px #999]
    Divider
    [50 active owned songs — Inter 500 14px #1A1A1A]
    [100GB storage — #1A1A1A]
    [Voice memos (unlimited) — #1A1A1A]
    [Version history — #1A1A1A]
    [Collaborators (unlimited) — #1A1A1A]
    [Exports — #1A1A1A]

[32px gap]

[GO PRO — 56px pill #B5935A gold, full-width]

[16px gap]

[Keep using Free — Inter 400 15px #999 underlined centered]
```

### The comparison card design
Free should not feel "inferior" — it should feel "limited." Pro should feel "expansive" — not premium. The distinction matters: making Free look bad creates resentment. Making Pro look abundant creates desire.

---
---

## SCREEN 16 — STORAGE WARNING
### `/settings/storage`

**Emotional intention:** *The app is being honest with me. My creative work is safe. I just need more space.*

### Layout

```
[← Back — top-left]

[CROWN + Colors of Glory — centered, horizontal lockup]

[40px gap]

[You're almost out of storage — Playfair 700, 40px, centered, #1A1A1A, line-height 1.05]

[12px gap]

[Your songs are safe, but new uploads may pause soon.
 — Inter 400, 16px, centered, #666, leading-relaxed]

[40px gap]

[STORAGE CARD — white #FFFFFF, radius 20px, padding 20px, shadow 0 2px 12px rgba(0,0,0,0.08)]
  [850MB of 1GB used — "850MB" in Inter 700 15px #1A1A1A, rest Inter 400 15px #666]
  [16px gap]
  [PROGRESS BAR — full-width, 8px height, radius 9999px]
    [bg: rgba(0,0,0,0.06)]
    [fill: linear-gradient(90deg, #B5935A, #D4AE5C) at 85% width, radius 9999px]
    [The bar should taper at the right edge — communicating: almost full but not critical]

[32px gap]

[ADD STORAGE — 56px pill #B5935A gold]

[16px gap]

[Manage files — Inter 400 15px #999 underlined centered]

[32px gap]

[Your songs, lyrics, and memos will not be deleted. Only new uploads pause.
 — Inter 400, 13px, #999, centered, leading-relaxed — CRITICAL reassurance copy]
```

### The progress bar
The bar fill must be **exactly 85% width** for the "850MB of 1GB" state. The gradient `#B5935A → #D4AE5C` communicates warmth, not danger. The red color (`#E05440`) should NOT appear on this bar unless the user is at 99%+. The design choice is: amber = warning, not red = alarm.

---
---

## SCREEN 17 — REFERRAL DASHBOARD
### `/settings/referral`

**Emotional intention:** *This is legitimate, transparent, and mine. I understand exactly what I've earned and what I will earn.*

### Layout

```
[← Back — top-left]

[CROWN + Colors of Glory — HORIZONTAL lockup, centered]
[Crown 20px + "Colors of Glory" Playfair 500 15px on same line]

[36px gap]

[Invite songwriters. Earn monthly. — Playfair 700, 40px, centered, #1A1A1A]

[8px gap]

[You earn $10/month while each direct referral stays on Pro.
 — Inter 400 16px #666, "$10/month" in Inter 700 #1A1A1A]

[32px gap]

[REFERRAL LINK CARD — white, border 1.5px rgba(181,147,90,0.30), radius 16px, overflow hidden]
  [Your referral link — Inter 500 11px uppercase #999 tracking-wide]
  [app.colorsofglory.com/ref/PARKER123 — mono 15px #1A1A1A, truncated]
  [COPY button right — Inter 600 13px, rounded-xl, bg rgba(0,0,0,0.04), transitions to ✓ + "Copied!"]

[24px gap]

[2×2 STAT GRID — gap 12px]
  Each card: white, radius 14px, border 1px rgba(0,0,0,0.07), padding 16px

  CARD FORMAT:
    [Icon 20px #999 — Users / Crown / Clock / DollarSign]
    [Label — Inter 400 12px #999 — "Signups" / "Active Pro referrals" / "Pending" / "Payable"]
    [NUMBER — Inter 700 28px #1A1A1A — 24 / 18 / 3 / $180]

  [Signups: 24] [Active Pro: 18]
  [Pending: 3]  [Payable: $180]

[24px gap]

[COPY LINK — 56px pill #B5935A gold]

[16px gap]

[Share invite — Inter 400 15px #999 underlined centered]

[32px gap]

[HOW REFERRALS WORK — Inter 600 13px #666 uppercase]
  — Direct referrals only. No multi-level structure.
  — You earn $10/month per active Pro referral.
  — Payouts begin 30 days after referral's first Pro payment.
  — No commission during free or founder access periods.
  [Each rule: Inter 400 13px #666, bullet "—" #999]
```

### The stat numbers
`28px`, `Inter 700`, `#1A1A1A` — these must dominate their cards. The labels are small (`12px`) and muted (`#999`). The number-to-label size ratio is approximately 2.3:1. This is how the user reads the card: number first, context second.

---
---

## SCREEN 18 — RETURNING USER HOME
### `/` (returning state, detected via session)

**Emotional intention:** *The app remembers where I was. I don't have to re-orient — I just continue.*

### Layout

```
[CROWN + Colors of Glory — centered]

[40px gap]

[Welcome back — Playfair 700, 36px, centered, #1A1A1A]

[28px gap]

[CONTINUE CARD — white #FFFFFF, radius 20px, padding 24px, shadow 0 4px 20px rgba(0,0,0,0.08)]
  [Continue — Inter 400 12px uppercase #999 tracking-wide]
  [8px gap]
  [Grace in the Waiting — Playfair 700, 28px, #1A1A1A, line-height 1.1]
  [12px gap]
  [Last edited 2 hours ago — Inter 400 13px #999]

[16px gap]

[INFO PILLS — 3 full-width pill rows, each: white, radius 12px, padding 14px]
  [icon 18px #B5935A or #666] + [text Inter 400 14px #1A1A1A]
  Pills:
    [✓] "3 songs need review" — CheckCircle2 icon #B5935A
    [🎵] "1 new voice memo" — Mic icon #666
    [💾] "Storage: 62% used" — HardDrive icon #666

[32px gap]

[OPEN LAST SONG — 56px pill #B5935A gold]

[16px gap]

[View all songs — Inter 400 15px #999 underlined centered]
```

### The continue card
The "Continue" label above the song title creates a subtle narrative: *you were here. Here is where you left off.* The card should be the most prominent element on the screen — larger than all the info pills, more shadow than anything else. It IS the primary destination.

### The info pills
Three pieces of contextual intelligence — not notifications. They are calm updates, not urgent alerts. The icons should be small (18px) and muted. The most important pill should be first: if there are pending reviews, that's the most urgent signal.

### Motion
- Continue card: scales in from `scale(0.95)`, `opacity 0 → 1`, `400ms cinematic`
- Info pills stagger: `0ms / 80ms / 160ms`
- Each pill: `translateY(6px) → 0`, `opacity 0 → 1`

---
---

## APPENDIX: SHARED INTERACTION PATTERNS

### Button States (All Screens)
| State | Visual |
|-------|--------|
| Default | `#B5935A` bg, white text, `0 4px 16px rgba(181,147,90,0.35)` shadow |
| Hover (desktop) | `box-shadow` deepens `+4px` |
| Active/Press | `scale(0.97)`, `120ms ease`, shadow reduces |
| Loading | Width stable, text cross-fades to loading copy, spinner icon appears |
| Disabled | `opacity: 0.40`, no shadow, `pointer-events: none` |

### Input Focus Ring (All Screens)
```
border: 1.5px solid #B5935A
box-shadow: 0 0 0 3px rgba(181,147,90,0.12)
transition: 160ms ease
```

### Error States (All Screens)
- Color: `#E05440`
- Font: Inter 400, 14px
- Placement: directly below the relevant field, 8px gap
- Never: red background, red border on button, modal popup
- Always: inline, small, calm, with a next step implied

### Page Transitions
- Forward navigation: new screen slides in from right (`translateX(24px) → 0`), old screen fades to `opacity(0)`
- Back navigation: new screen slides in from left, old screen fades right
- Duration: `280ms`, `cubic-bezier(0.25, 0.46, 0.45, 0.94)`

### Typography Scale (Summary)
| Role | Font | Size | Weight | Color |
|------|------|------|--------|-------|
| Display H1 | Playfair Display | 40–44px | 700 | #1A1A1A |
| Song title | Playfair Display | 28–36px | 700 | #1A1A1A |
| Card title | Playfair Display | 17–22px | 600 | #1A1A1A |
| Body | Inter | 15–16px | 400 | #666 |
| Label | Inter | 12–14px | 500 | #666 |
| Muted/microcopy | Inter | 11–13px | 400 | #999 |
| Button text | Inter | 15–16px | 600 | #FFFFFF |
| Gold link | Inter | 13–15px | 400 | #B5935A, underlined |

---

*Document prepared by Fantasy.co for Colors of Glory onboarding UI implementation.*
*All visual decisions are arguments. Each argument has been resolved. Do not reopen them.*
*Image always wins over this document if conflict exists.*
