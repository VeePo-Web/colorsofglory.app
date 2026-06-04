# Colors of Glory — Invite Acceptance Flow
## Complete UX Specification
## Compiled from 22 decision questions · 2026-06-04

---

## THE NORTH STAR

> Someone gets a text from a friend that says "join me in writing this song." They tap the link. Within 90 seconds they are inside the song, reading the lyrics, leaving their first comment. No downloads to wait for. No profile setup blocking them. No confusion about what to do next.

**Church Center UX simplicity × Fantasy.co visual craft**

---

## DECISIONS LOCKED

| Decision | Choice |
|----------|--------|
| Entry screen | One-screen hybrid: song context top + phone input bottom |
| Data collected | Phone + OTP + first + last name |
| Photo | Optional banner inside song, dismissable, once per session |
| Existing user | Auto-detect → "Welcome back [name], tap to join" — no OTP |
| First landing | Lyrics editor directly |
| First-action prompt | Bottom sheet, slides up once, 3 quick-action chips |
| Role display | Shown once on join (toast/banner), then hidden |
| Collaborators shown before join | No — just song title + inviter name |
| Collaborators shown on enter | "Parker, Sarah, and Caleb are here" brief intro screen |
| Blurred lyrics preview | Yes — on invite screen, creates curiosity pull |
| Link format | `colorsofglory.app/join/[token]` |
| Link expiry | No expiry — owner revokes manually |
| Multi-use links | Owner sets limit (e.g., max 5 people can join via this link) |
| Already joined | "You're already in this song — Open it?" + gold CTA |
| Expired link | Error message + "Request new invite from Parker" gold CTA |
| Invite send method | Owner copies link, pastes into iMessage |
| Viewer role | Same UI, editing locked with inline "View only" indicator |
| Owner notification | Owner sets preference per song (default: push on) |
| Desktop | Full web experience — same responsive flow |
| First contribution → owner | Immediate push notification |

---

## THE FLOW

```
colorsofglory.app/join/[token]
        │
        ▼
SCREEN A ─── InviteJoinPage
  "Grace in the Waiting" + "Parker invited you"
  Blurred lyrics snippet (creates curiosity)
  Phone input field
  "Join this song" gold pill CTA
  
  [IF existing user detected by phone]
        ↓
SCREEN A2 ── WelcomeBackJoinPage
  "Welcome back, [First Name]"
  "Tap to join Grace in the Waiting"
  Single gold CTA — no OTP needed
        │
        │ [new user path]
        ▼
SCREEN B ─── InviteVerifyPage
  "Check your phone" OTP screen
  6-digit code, auto-submit
        │
        ▼
SCREEN C ─── InviteNamePage
  "What's your name?"
  First + last name fields
  "Continue to the song →" gold CTA
        │
        ▼
SCREEN D ─── InviteTeamIntroPage
  "Parker, Sarah, and Caleb are already here"
  "Jump into Grace in the Waiting" gold CTA
  (auto-advances after 2s or on tap)
        │
        ▼
SCREEN E ─── LyricsEditorPage (existing, modified)
  [Role toast: "You joined as Contributor" — appears 500ms in, auto-dismisses]
  [Lyrics load in with existing content]
  [After 1.5s: bottom sheet slides up once]
    Bottom sheet: "You're inside the song. Start by:"
    3 chips: [+ Write a lyric] [🎤 Voice memo] [💬 Comment]
  [Photo banner: "Add a photo so your collaborators recognize you →" dismissable X]
```

---

## ERROR STATES

### Expired / Revoked Link
```
Screen: InviteErrorPage
  Crown + "Colors of Glory"
  
  "This invite is no longer active."
  "Parker's link may have expired or been removed."
  
  [Request new invite from Parker] ← gold CTA (pings owner via Supabase notification)
  
  [Go to colorsofglory.app] ← gray link
```

### Already Joined
```
Screen: InviteAlreadyJoinedPage
  Crown + "Colors of Glory"
  
  Gold checkmark circle
  
  "You're already in this song"
  "You joined Grace in the Waiting on June 2."
  
  [Open song →] ← gold CTA → routes to /songs/:id/lyrics
```

### Max Capacity Reached
```
  "This invite link has reached its limit."
  "Ask Parker to send you a personal invite."
  
  [Request access from Parker] ← gold CTA
```

---

## SCREEN-BY-SCREEN DESIGN SPECS

---

### SCREEN A — Invite Join Page

**Route:** `colorsofglory.app/join/[token]`
**Emotional intention:** *I can see this is real. My friend actually invited me. I just need to put my number in.*

```
Layout:

[SAFE AREA TOP — 64px]

[CROWN + "Colors of Glory" — stacked centered, CogBrand size="md"]

[40px gap]

[SONG CONTEXT CARD — white #FFFFFF, radius 20px, padding 20px, border 1.5px rgba(181,147,90,0.30)]
  [SONG TITLE — Playfair 700, 22px, #1A1A1A]
  [8px]
  [Parker invited you to collaborate — Inter 400, 14px, #666]
  [16px]
  [BLURRED LYRICS — 3 lines of blurred text, filter: blur(4px), opacity: 0.7]
    [Small label: "Join to read and contribute" — Inter 400 12px #999]

[24px gap]

[DIVIDER — "Enter your number to join" Inter 400 13px #999 centered, dash lines either side]

[16px gap]

[PHONE INPUT — 64px height, white #FFFFFF, radius 20px, border 1.5px]
  [🇺🇸] [+1] [|] [(555) 555-5555 placeholder]

[8px]

[We'll text you a code. No password. — Inter 400 13px #999 centered]

[20px]

[JOIN THIS SONG — 56px pill, #B5935A gold]

[12px]

[Invited songs don't use your free song. — Inter 400 12px #999 centered]
```

**Technical notes:**
- On mount: fetch invite by token from Supabase → populate song title, inviter name
- If token invalid/expired → redirect to InviteErrorPage
- If user's entered phone matches existing account → redirect to Screen A2
- Store `inviteToken`, `songId`, `inviterName`, `inviterUserId`, `assignedRole` in sessionStorage

---

### SCREEN A2 — Welcome Back (Existing User)

**Emotional intention:** *The app already knows me. One tap and I'm in.*

```
Layout:

[CROWN + "Colors of Glory" — centered]

[60px gap]

[SONG TITLE — Playfair 700, 28px, centered, #1A1A1A]
["Grace in the Waiting" ]

[12px gap]

[Parker invited you to join — Inter 400 16px #666 centered]

[40px gap]

[WELCOME BACK CARD — white, radius 20px, padding 20px, gold border]
  [Avatar / initials — 48px circle, user's own color]
  [Welcome back, [First Name]. — Playfair 600 20px #1A1A1A]
  [Tap to join the song. — Inter 400 14px #666]

[32px gap]

[JOIN GRACE IN THE WAITING — 56px pill gold]
[No code needed — Inter 400 13px #999 centered]
```

**Technical:** Sign in silently (session exists) → accept invite → route to Screen D

---

### SCREEN B — Invite OTP Verify

**Same as CodeVerifyPage** — reuse the component.
Headline changes to: "Check your phone — one step from the song."
Microcopy: "We sent a code to join Grace in the Waiting."

---

### SCREEN C — Name Collection

**Emotional intention:** *I'm about to appear in a creative space with other people. My name matters here.*

```
Layout:

[CROWN + "Colors of Glory" — centered]

[48px gap]

[What's your name? — Playfair 700, 40px, centered, #1A1A1A]

[8px]

[Your collaborators will see this in the song. — Inter 400, 16px, centered, #666]

[36px gap]

[FIRST NAME INPUT — 56px, white, radius 16px, "First name" label above]
[12px gap]
[LAST NAME INPUT — 56px, white, radius 16px, "Last name" label above]

[28px gap]

[CONTINUE TO THE SONG — 56px pill gold, arrow →]
```

**Technical:** Save name to Supabase user profile → proceed to Screen D

---

### SCREEN D — Team Intro

**Emotional intention:** *I'm joining a team of real people. This feels alive.*

```
Layout:

[CROWN + "Colors of Glory" — centered]

[48px gap]

[AVATAR STACK — 3 large circles, 48px each, 2-line arrangement if >3]
  [Slow slide-in from left, stagger 100ms each]

[20px gap]

[Parker, Sarah, and Caleb — Inter 700 18px #1A1A1A centered]
[are already working on this song. — Inter 400 16px #666 centered]

[32px gap]

[SONG CARD — white, gold border, radius 20px, padding 20px]
  [Grace in the Waiting — Playfair 700, 24px, #1A1A1A]
  [Your role: Contributor — Inter 500, 14px, #B5935A]

[40px gap]

[ENTER THE SONG — 56px pill gold]

[Advances automatically after 2 seconds, or tap to skip]
```

---

### SCREEN E — Modified Lyrics Landing (Collaborator Mode)

**After entering, in sequence:**

1. **500ms after mount:** Role toast appears at bottom:
   ```
   [Contributor — small gold chip + "You can write, add memos, and comment"] auto-dismisses 3s
   ```

2. **1,500ms after mount:** Bottom sheet slides up:
   ```
   [You're inside the song. Start by:]
   [+ Write a lyric] [🎤 Voice memo] [💬 Leave a comment]
   [Tapping any chip navigates to that action, sheet dismisses]
   [Tap outside to dismiss]
   ```

3. **Always (if no photo):** Photo banner at top of screen:
   ```
   [○ Add a photo so your collaborators recognize you  →  X]
   [tapping → opens photo picker | X → dismisses forever (localStorage)]
   ```

4. **Blurred fields for Viewer role:**
   ```
   Each lyric textarea shows: [lock icon] [View only — tap to request edit access]
   Tapping → toast: "Ask Parker to upgrade your role to edit."
   ```

---

## SUPABASE TABLES NEEDED

```sql
-- Invite tokens
CREATE TABLE invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,  -- used in the URL
  assigned_role TEXT CHECK (assigned_role IN ('viewer','contributor','reviewer')) DEFAULT 'contributor',
  max_uses INTEGER DEFAULT 1,  -- null = unlimited within limit
  current_uses INTEGER DEFAULT 0,
  is_revoked BOOLEAN DEFAULT false,
  -- No expires_at — owner revokes manually
  created_at TIMESTAMPTZ DEFAULT now()
);

-- When someone accepts an invite
CREATE TABLE invite_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES invite_tokens(id),
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ DEFAULT now()
);

-- Notification preferences per song
CREATE TABLE song_notification_prefs (
  user_id UUID REFERENCES users(id),
  song_id UUID REFERENCES songs(id),
  notify_on_join BOOLEAN DEFAULT true,
  notify_on_contribution BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, song_id)
);
```

---

## FLOW TIMING BENCHMARK

| Step | Target time |
|------|-------------|
| Landing → phone entered | < 15 seconds |
| Phone → OTP received | < 10 seconds (Twilio) |
| OTP → name entered | < 20 seconds |
| Name → inside lyrics | < 5 seconds |
| **TOTAL new user** | **< 60 seconds** |
| **TOTAL existing user** | **< 10 seconds** |

---

## WHAT NOT TO BUILD

- No "Choose your role" screen for invitees — role is pre-assigned by owner
- No profile setup wizard — just name, photo is optional later
- No pricing prompt — invited songs explicitly don't use the free limit
- No app store redirect — works in browser (PWA)
- No "Why are you joining?" survey
- No email verification step
- No profile completion score/progress bar
- No terms of service wall before joining (put T&C at bottom of Screen A)

---

*Spec finalized: 2026-06-04 | Ready to build Screen A through E*
