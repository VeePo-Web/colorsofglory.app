# Colors of Glory — Master Onboarding Plan
## Compiled from: all 13 reference images + 18 PDF spec docs + Twilio integration
## Date: 2026-06-04 | Status: IMPLEMENTATION READY

---

## NORTH STAR

> Do not onboard users into an app. Onboard them into their first song.
> The first success moment is not "account created." It is: your first song space is ready.

Church Center behavioral simplicity × Fantasy.co visual craft × colorsandshapes.co precision.

---

## VISUAL LANGUAGE (extracted from reference images — IMAGE WINS over previous code)

### Logo (corrected from implementation)
The logo across ALL mockups is:
- **Crown icon**: Simple geometric outline crown (3-point arch, minimal strokes) — NOT the aurora gradient mark
- **Wordmark**: "Colors of Glory" in regular-weight serif below the crown
- **Stacked**: crown above, wordmark centered below — small, quiet, devotional
- **Horizontal lockup** (catalog/referral): crown icon to the left of the text on one line
- **Gold tint** on the crown icon when on dark backgrounds (catalog header)

### Color palette (corrected)
```
Background:      #FAFAF6  (near-white — lighter than current #F5F0E8)
Card surface:    #FFFFFF  (pure white cards)
Dark header:     #1C1A17  (catalog header, near-black)
Primary text:    #1A1A1A  (bold headlines)
Secondary text:  #666666  (subtitles, microcopy)
Muted text:      #999999  (timestamps, labels)
Gold primary:    #B5935A  (CTA buttons, borders, accents)
Gold text:       #A07840  (text links, microcopy gold)
Red recording:   #E05440  (recording timer, stop button, waveform)
Border:          rgba(0,0,0,0.08)
```

### Typography (corrected)
```
Headlines:    Bold/800 weight, Playfair Display — very large, very dark
Subheads:     Regular/400, Inter or system-serif — gray
Body:         Regular/400, Inter — #666
Buttons:      Medium/600, Inter — white or charcoal
Microcopy:    Regular/400, Inter — #999, small
Input text:   Regular/400, Inter — #1A1A1A
```

### Cards
```
background: #FFFFFF
border-radius: 16px
border: 1px solid rgba(0,0,0,0.08)
box-shadow: 0 2px 12px rgba(0,0,0,0.06)
padding: 16px–20px
```

### CTA Buttons (primary)
```
background: #B5935A (muted gold — NOT the bright #B8953A we use)
color: #FFFFFF
border-radius: 100px (full pill)
height: 56px
font: 600 Inter
width: 100%
no icon on most CTAs
```

### Secondary actions
```
text links only — underlined or plain, gold or gray
never a bordered ghost button in onboarding
```

---

## SCREEN INVENTORY — 18 SCREENS

### PHASE 1 — CORE ONBOARDING

---

#### SCREEN 1: Phone Login `/auth/login`

**Visual (from image):**
- Near-white background
- Crown logo + "Colors of Glory" centered, 72px from top
- "Welcome" — Playfair Display, 36px, bold, #1A1A1A
- "Enter your phone number to continue." — Inter 16px, #666
- Phone input row: 🇺🇸 flag + "+1" + "|" divider + (555) 555-5555 — white card, 64px height
- "Continue" — gold pill button, full-width
- "We'll send a secure one-time code. No password needed." — Inter 14px, #999, centered below button
- "Use email instead" — gold underlined link, bottom of screen

**Twilio frontend logic:**
```ts
import { supabase } from '@/lib/supabase'

async function handleContinue(e164: string) {
  // Supabase auth with Twilio SMS provider
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164,
  })
  if (error) throw error
  navigate('/auth/verify', { state: { phone: formatted, e164 } })
}
```

**States:** empty (CTA disabled) → typing (CTA enables at 10 digits) → loading "Sending code..." → error inline

**What changes from current:**
- Background: #FAFAF6 not #F5F0E8
- Logo: simple crown SVG not aurora mark
- Button: pill not rounded-2xl
- Supabase OTP call wired
- Remove fake "Preview demo" bypass (was for demo, now real auth)

---

#### SCREEN 2: Code Verify `/auth/verify`

**Visual (from image):**
- "Check your phone" — Playfair Display bold, large
- "We sent a 5-digit code to +1 (555) 555-5555." — subtitle (spec says 6-digit, image shows 4 large boxes — use 6)
- 6 large OTP input boxes — white, 52px × 64px each, gold border on active/filled
- "Verify" — gold pill CTA
- "Resend code" + "Change number" links below, side by side
- "Codes usually arrive within a few seconds." — muted microcopy

**Twilio frontend logic:**
```ts
async function handleVerify(code: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: code,
    type: 'sms',
  })
  if (error) throw error
  // Route based on user state:
  // - new user → /onboarding/intent
  // - returning user with songs → /
  // - invite context → /invite/:token
  routeAfterVerify(data.user)
}

async function handleResend() {
  await supabase.auth.signInWithOtp({ phone: e164 })
  setCountdown(30)
}
```

**States:** empty (Verify disabled) → typing (auto-advance per digit) → all-filled (auto-submit) → verifying → error → success

---

#### SCREEN 3: First Intent `/onboarding/intent`

**Visual (from image):**
- "What are you working on?" — Playfair bold
- Two large white cards stacked:
  1. **Start a song** — pencil icon (small, gold) — "Create a private space for lyrics, voice memos, chords, and ideas."
  2. **Join a song** — people icon — "Use an invite from someone you are writing with."
- "You can always do both later." — muted small centered
- No gold pill CTA — the cards ARE the action

**Routing:**
- Start a song → `/onboarding/start-song`
- Join a song → `/onboarding/join` (shows code entry) OR if invite token exists → `/invite/:token`

---

#### SCREEN 4: Start First Song `/onboarding/start-song`

**Visual (from image — ChatGPT mockup):**
- Crown logo centered
- "Let's start your first song" — Playfair bold
- "Just the basics. You can add the rest inside." — subtitle
- Large "Song title" input field — white card, tall (placeholder text greyed)
- "Key" + "BPM" in a 2-column row below (smaller inputs)
- "Create song" — gold full-pill CTA
- "Skip for now" — plain gray text link below

**Logic:**
- Skip → create "Untitled Song" → navigate to workspace
- Create → validate title → POST to Supabase songs table → navigate to `/songs/:id?first=1`
- songId returned from Supabase used for all subsequent routes

---

#### SCREEN 5: Invite Preview `/invite/:token`

**Visual (from image — both ChatGPT + download):**
- Crown logo centered top
- "You've been invited" — Playfair bold
- "Open the song and start collaborating." — subtitle
- White card: Song title bold + "Invited by Parker" + avatar row (3 circles) + "3 collaborators" text
- "Open song" — gold pill CTA (full-width)
- "View details" — underlined gray link

**Logic:**
- Fetch invite by token from Supabase (via Lovable API)
- Show song title, inviter name, collaborator count, assigned role
- "Open song" → accept invite → navigate to `/songs/:id`

---

#### SCREEN 6: Founder Code `/onboarding/founder-code`

**Visual (from image — download 1):**
- Crown + "Colors of Glory" (simple centered stacked)
- "Have a founder code?" — Playfair bold
- "Enter it here to unlock your private access." — subtitle
- Centered single pill-style input: `FOUNDER-X7K92Q` placeholder
- "Unlock access" — gold pill CTA
- "I'll do this later" — underlined gray link at bottom

**Success state (right phone in image):**
- No logo (clean/empty screen feel)
- "Founder access unlocked" — Playfair bold, centered
- "Your Pro workspace is ready." — subtitle
- (mostly whitespace)
- "Start a song" — gold pill CTA at bottom of screen

---

### PHASE 2 — FIRST AHA MOMENT

---

#### SCREEN 7: Song Workspace `/songs/:id`

**Visual (from download image — song workspace):**
- Crown logo top center (small)
- "Untitled Song" — Playfair Display, very large, bold
- "Private song space" — subtitle muted gray
- "Start anywhere. Add a lyric, record a voice memo, or invite someone into the song." — centered supporting text
- **Module grid** — 5 cards in 2-column layout:
  - Row 1: [Lyrics] [Voice Memo — larger, spans 2 rows] → actually it's [Lyrics large] [Voice Memo]
  - Looking carefully: 2-column, [Lyrics top-left] [Voice Memo top-right occupies top+bottom] [Chords bottom-left] [Notes and Invite in second row]
  - Actually from image: Lyrics (icon + label), Voice Memo (icon + label), Chords (icon + label) in top row of 3; Notes + Invite in bottom row of 2
  - Wait — image shows: LEFT COLUMN: Lyrics (top), Notes (bottom) | RIGHT COLUMN: Voice Memo (top, taller), Chords (middle), [blank] — then a 2-col bottom: [blank] [Invite]
  - Most accurate reading: 2-column grid. LEFT: Lyrics (top half), Notes (bottom half). RIGHT: Voice Memo (top), Chords (middle). Then row below: full-width or 2-col with Invite

**Actually from the image it's a 2-column card grid:**
```
[  Lyrics  ] [Voice Memo]
[          ] [  Chords  ]
[  Notes   ] [  Invite  ]
```

- Bottom bar: 3 pill buttons — "Write lyric" / "Record memo" (gold when active) / "Invite"
- No BottomNav on this screen (it's a song-interior screen)

---

#### SCREEN 8: Capture First Idea `/songs/:id/capture`

**Visual (from download 2):**
- Crown stacked logo (crown icon above "Colors" + "of Glory" — multiline stacked brand mark)
- "Capture the first idea" — Playfair bold, very large
- "Record a melody, lyric thought, chord idea, or prayer moment." — subtitle gray
- **Large gold circle button** — big (120px diameter), solid gold fill, white mic icon centered
- "Record voice memo" — gold link text below the button
- "Write lyrics instead" — gray link further below
- NO secondary CTA buttons (pill style) — clean, minimal

**Recording state (from download 3 — left phone):**
- Full-screen cream/white background
- **Animated waveform bars** — variable height bars, gradient from amber/orange to dark red/coral, filling center area (full-width, ~200px tall)
- Large red timer: "0:42" — #E05440, 64px bold
- "Recording..." — subtitle, gray
- Red pill "Stop" button — #E05440 background, white text, full-width

---

#### SCREEN 9: Voice Memo Added `/songs/:id/voice-added`

**Visual (from download 3 — right phone):**
- Near-white background (no logo at top — content-first)
- Centered white card with subtle shadow:
  - "Voice Memo 1" — bold
  - "Just now · 0:42" — gray small
  - Row: play button circle (gold) + "Rename" + "Add note" + "Share" — icon + label each
- "Your idea is saved. Now add lyrics, chords, or invite someone to build with you." — centered italic/regular gray text below card

---

#### SCREEN 10: Lyrics + Chords `/songs/:id/lyrics`

**Visual (from download 4):**
- Top: back arrow (←) + crown icon center + "..." menu right
- "Grace in the Waiting" — Playfair bold, 28px, left-aligned
- Tab bar: [Lyrics] [Chords] [Voice] [Notes] — pill/underline style, Lyrics active with underline
- Sections with chord chips above lyric lines:
  - "Verse 1" label (muted, small)
  - Chord chips: `C` `G` `Am` — small oval pills with gray bg
  - Lyric lines below
- "Add section" + "Record idea" — two gold pill buttons at fixed bottom

---

### PHASE 3 — COLLABORATION LOOP

---

#### SCREEN 11: Invite Collaborator `/songs/:id/people`

**Visual (from download 5):**
- Crown stacked logo
- "Invite someone into this song" — Playfair bold
- "They can listen, write, comment, or review depending on the role you choose." — subtitle
- Phone/email input — white, rounded pill style, placeholder "Phone or email"
- Role selection — 3 cards in a row:
  - "Viewer" — white card, border
  - "Contributor" — gold border highlight when selected (thicker gold border)
  - "Reviewer" — white card
- "Send invite" — gold pill CTA
- "Invited songs do not use their free song." — muted small centered microcopy

**Success state (right phone in download 5):**
- Gold checkmark circle (large, centered)
- "Invitation Sent!" — Playfair bold, centered
- Same subtitle

---

#### SCREEN 12: Choose Their Role `/songs/:id/people` (role sheet)

**Visual (from download 6):**
- Crown + "Colors of Glory"
- "Choose their role" — Playfair bold
- **3-card perspective spread**: 
  - Viewer card (left, slightly back/tilted)
  - Contributor card (center, **elevated/forward, gold gradient background**, gold border, larger apparent size)
  - Reviewer card (right, slightly back/tilted)
  - Each card: role name bold + 1-line description
  - Viewer: "Can listen and read."
  - Contributor: "Can add lyrics, memos, comments, and ideas."
  - Reviewer: "Can comment and approve changes."
- "Confirm role" — gold pill CTA

---

#### SCREEN 13: Song Activity `/songs/:id/activity`

**Visual (from download 7 — right phone):**
- Crown + "Colors of Glory" horizontal lockup
- "What changed since you left" — Playfair bold, large, 2 lines
- 4 activity cards (white, rounded, subtle shadow), each with:
  - Left: round avatar (real face photo or initials)
  - Content: timestamp muted + "**Name** action text" (name bold)
  - 2m ago / 15m ago / 1h ago / 2h ago
  - "Sarah added a voice memo"
  - "Parker edited Verse 2"
  - "Caleb suggested a chord change"
  - "**2 comments** need review" (icon instead of avatar for this one)
- "Review changes" — gold pill CTA
- "Open song" — gold text link below

**Returning animation (left phone in download 7):**
- Blurred workspace with "Returning to song..." pill overlay at top
- This is a brief transition state (500ms) before the digest loads

---

### PHASE 4 — BUSINESS MODEL SCREENS

---

#### SCREEN 14: Song Catalog `/`

**Visual (from download 8):**
- **Dark header section** (#1C1A17 charcoal):
  - Crown icon + "Colors of Glory" horizontal — gold tint on dark
  - "Your songs" — white bold, large
  - Tab row: "Owned" | "Invited" | "Archived" — underline style, white active, gray inactive
- **Cream/white content area below**:
  - 2-column song card grid
  - Each card: white bg, song title bold, status dot + "Status" chip, avatar row (2-3 circles), "Last activity 1m ago" small gray
  - Cards have subtle shadow and rounded corners
- Gold "+ New song" full-width pill button at bottom (above tab bar)

---

#### SCREEN 15: Upgrade Moment `/upgrade`

**Visual (from download 9+10):**
- Crown + "Colors of Glory" centered
- "Ready to build your catalog?" — Playfair bold, 2 lines
- "Free includes one active owned song. Upgrade to Pro when one song becomes a real workspace." — subtitle
- Side-by-side cards:
  - **Free card** (white/neutral): "Free" gold header label, "1 owned song" content
  - **Pro card** (gold/highlighted): "Pro" gold header, list: 50 active owned songs / 100GB storage / Voice memos / Version history / Collaborators / Exports
- "Go Pro" — gold full-pill CTA
- "Keep using Free" — underlined gray link

---

#### SCREEN 16: Storage Warning `/settings/storage`

**Visual (from download 11):**
- Crown + "Colors of Glory" centered (horizontal-ish)
- "You're almost out of storage" — Playfair bold
- "Your songs are safe, but new uploads may pause soon." — subtitle
- White card centered:
  - "**850MB** of 1GB used" — bold number
  - Horizontal progress bar: gold fill ~85%, light gray remainder, full-width, 8px height, rounded
- "Add storage" — gold pill CTA
- "Manage files" — underlined gray link

---

#### SCREEN 17: Referral Dashboard `/settings/referral`

**Visual (from download 12):**
- Crown + "Colors of Glory" HORIZONTAL lockup (left-aligned or centered)
- "Invite songwriters. Earn monthly." — Playfair bold, large
- "You earn **$10/month** while each direct referral stays on Pro." — subtitle with $10/month bold
- Large white card: "app.com/ref/PARKER123" — monospace/link style, centered
- 2×2 stat grid, each white card:
  - 👤 Signups / **24**
  - 👑 Active Pro referrals / **18**
  - ⏳ Pending / **3**
  - 💰 Payable / **$180**
- "Copy link" — gold pill CTA
- "Share invite" — underlined link

---

#### SCREEN 18: Returning User Home `/` (returning state)

**Visual (from download 13 — left phone):**
- Crown + "Colors of Glory" centered
- "Welcome back" — Playfair bold
- Large white card:
  - "Continue Grace in the Waiting" — bold, large
  - "Last edited 2 hours ago" — gray small
- 3 info pills (white, full-width, icon + text):
  - ✓ "3 songs need review"
  - 🎵 "1 new voice memo"  
  - 💾 "Storage: 62% used"
- "Open last song" — gold pill CTA
- "View all songs" — gray text link

---

## IMPLEMENTATION PRIORITY ORDER

| # | Screen | File | Hours | Twilio? |
|---|--------|------|-------|---------|
| 1 | Phone Login | `auth/PhoneLoginPage` | 2h | YES — signInWithOtp |
| 2 | Code Verify | `auth/CodeVerifyPage` | 2h | YES — verifyOtp |
| 3 | First Intent | `onboarding/FirstIntentPage` | 1h | No |
| 4 | Start First Song | `onboarding/StartFirstSongPage` | 1.5h | No |
| 5 | Invite Preview | `InvitePreviewPage` | 1.5h | No |
| 6 | Founder Code | `onboarding/FounderCodePage` | 1.5h | No |
| 7 | Song Workspace | `SongWorkspacePage` | 2h | No |
| 8 | Capture First Idea | `onboarding/CaptureFirstIdeaPage` | 2h | No |
| 9 | Voice Memo Added | `onboarding/VoiceMemoAddedPage` | 1.5h | No |
| 10 | Lyrics + Chords | `LyricsEditorPage` | 2h | No |
| 11 | Invite Collaborator | `PeoplePage` | 2h | No |
| 12 | Role Selection | `PeoplePage` (bottom sheet) | 1h | No |
| 13 | Activity Feed | `ActivityPage` | 1.5h | No |
| 14 | Song Catalog | `SongCatalogPage` | 2h | No |
| 15 | Upgrade | `UpgradePage` | 1h | No |
| 16 | Storage Warning | `settings/StoragePage` | 1h | No |
| 17 | Referral | `settings/ReferralPage` | 1h | No |
| 18 | Returning User | New: `ReturningHomePage` | 1.5h | No |

**Total estimate: ~30 hours across all screens**

---

## SUPABASE CLIENT SETUP (required for Twilio)

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

Environment variables needed in `.env.local`:
```
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

**Twilio is connected via Supabase Auth → Phone provider → Twilio SMS.**
The frontend only calls `supabase.auth.signInWithOtp()` and `supabase.auth.verifyOtp()`.
Supabase handles the Twilio API call internally.

---

## SHARED COMPONENT SYSTEM (to create first)

Before rebuilding screens, create these shared primitives:

```
src/components/cog/
  CrownMark.tsx       — Simple SVG crown (geometric outline) — replaces aurora mark in onboarding
  CogBrand.tsx        — Crown + wordmark, stacked or horizontal
  GoldButton.tsx      — Full-pill gold CTA with all states
  TextLink.tsx        — Gold or gray underlined text link
  OnboardingShell.tsx — Cream bg + safe areas + centered max-w-[390px]
  OTPInput.tsx        — 6-box OTP component with auto-advance + paste + auto-submit
```

---

## WHAT CHANGES FROM CURRENT IMPLEMENTATION

| Area | Current | Target |
|------|---------|--------|
| Logo in onboarding | Aurora rainbow mark | Simple crown outline SVG |
| Background | #F5F0E8 warm cream | #FAFAF6 near-white |
| Button shape | rounded-2xl (16px) | pill (100px radius) |
| Gold color | #B8953A | #B5935A (slightly darker, more muted) |
| OTP | 6 custom boxes | 6 boxes, auto-submit on 6th |
| Auth | Fake setTimeout | Real Supabase.auth.signInWithOtp() |
| Song catalog header | Cream | Dark charcoal (#1C1A17) header with light content below |
| Recording screen | Button only | Full-screen animated waveform + timer |
| Role selection | 3 chip cards | 3D card spread, center elevated |
| Returning home | Missing | Full screen with resume card + info pills |

---

## RULES FOR EVERY SCREEN

1. **Image wins** — if spec PDF and mockup image conflict, the image is truth
2. **Crown SVG** — never the aurora mark on onboarding screens
3. **Pill buttons** — border-radius: 9999px on all primary CTAs
4. **No lorem ipsum** — all copy verbatim from spec
5. **Touch targets** — 44px minimum, prefer 56px for primary CTAs
6. **Supabase real** — auth calls are real, not simulated (Twilio connected)
7. **One primary action per screen** — never two gold CTAs
8. **Safe areas** — pt-safe, pb-safe on all screens

---

*Plan finalized: 2026-06-04 | Ready to implement screen by screen | Start with Screen 1*
