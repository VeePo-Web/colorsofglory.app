# Colors of Glory — Invite Flow Build Plan
## World-Class Implementation Guide
## Fantasy.co × Church Center UX Standard
## 2026-06-04

---

## EXECUTIVE SUMMARY

Five screens. One goal: a songwriter receives a link in iMessage and is contributing to the song within 60 seconds (new user) or 10 seconds (returning user). Every design and engineering decision in this document is evaluated against that benchmark first.

**Build sequence:** A → A2 → B → C → D → E (in that order — each screen depends on the one before it working correctly)

---

## ARCHITECTURE OVERVIEW

```
src/
  pages/
    invite/
      InviteJoinPage.tsx          ← Screen A: entry + phone input
      InviteWelcomeBackPage.tsx   ← Screen A2: existing user 1-tap
      InviteVerifyPage.tsx        ← Screen B: OTP (thin wrapper on OTPInput)
      InviteNamePage.tsx          ← Screen C: first + last name
      InviteTeamIntroPage.tsx     ← Screen D: collaborator reveal
  
  components/
    invite/
      BlurredLyricsPreview.tsx    ← CSS blur + "Join to contribute" label
      CollaboratorAvatarStack.tsx ← stacked initials circles with stagger anim
      RoleToast.tsx               ← "You joined as Contributor" bottom toast
      FirstActionSheet.tsx        ← bottom sheet with 3 action chips
      PhotoBanner.tsx             ← dismissable "Add a photo" top banner
      InviteErrorCard.tsx         ← expired / already joined / max capacity states
  
  lib/
    invite/
      inviteContext.ts            ← stores token, songId, inviterName, role in sessionStorage
      inviteApi.ts                ← previewInvite(), acceptInvite(), requestNewInvite()
      inviteErrors.ts             ← error code → friendly copy mapping
  
  hooks/
    useInviteToken.ts             ← fetches invite on mount, handles all error states
    useExistingUser.ts            ← checks if phone is already registered
```

---

## SHARED STATE: `inviteContext.ts`

This context travels through all 5 screens via sessionStorage. Never re-fetch from Supabase on each screen — carry it forward.

```typescript
export interface InviteContext {
  // From URL token lookup
  token: string;
  songId: string;
  songTitle: string;
  inviterName: string;
  inviterUserId: string;
  assignedRole: 'viewer' | 'contributor' | 'reviewer';
  lyricsSnippet: string | null;    // first 2–3 lines of lyrics for blur preview
  maxUses: number | null;
  currentUses: number;
  collaborators: {                  // people already in the song (for Screen D)
    id: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
    avatarInitials: string;
  }[];
  
  // Set during the flow
  verifiedPhone: string | null;    // e164 after OTP
  userId: string | null;           // after auth
  isExistingUser: boolean;         // detected after phone entry
  firstName: string | null;        // after Screen C
  lastName: string | null;
}

const KEY = 'cog:invite-context';

export const saveInviteContext = (ctx: Partial<InviteContext>) => { ... }
export const loadInviteContext = (): InviteContext | null => { ... }
export const clearInviteContext = () => { ... }
```

---

## SCREEN A — INVITE JOIN PAGE

### Route
`/invite/[token]` (existing) → rebuild this page entirely

### The one-screen hybrid design — the full layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │ ← #FAFAF6 bg
│              [Crown ⬡ Colors of Glory]              │ ← 64px from top, CogBrand stacked sm
│                                                     │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │  Grace in the Waiting                           │ │ ← Playfair 700, 22px, #1A1A1A
│ │  Parker invited you to collaborate              │ │ ← Inter 400, 14px, #666
│ │                                                 │ │
│ │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │ │
│ │    [BLURRED LYRICS — 3 lines of content]       │ │ ← filter: blur(5px), select: none
│ │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │ │
│ │  Join to read and contribute ↗                  │ │ ← 11px #999, italic
│ └─────────────────────────────────────────────────┘ │ ← white card, gold border 1.5px rgba(181,147,90,0.30)
│                                                     │   radius 20px, shadow
│         ─────── Your phone number ───────           │ ← Inter 400 13px #999, dashes either side
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  🇺🇸  +1  │  (555) 555-5555                   │ │ ← 64px height, white, radius 20px
│  └────────────────────────────────────────────────┘ │   gold border + glow when filled
│                                                     │
│     We'll send a code. No password needed.          │ ← 13px #999 centered
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │              Join this song →                  │ │ ← 56px pill, #B5935A gold
│  └────────────────────────────────────────────────┘ │
│                                                     │
│      Invited songs don't use your free song.        │ ← 12px #999 centered — critical trust line
│                                                     │
│                        ···                          │
│              Terms · Privacy                        │ ← 11px #CCC, safe area bottom
└─────────────────────────────────────────────────────┘
```

### Blurred lyrics component — `BlurredLyricsPreview.tsx`

```tsx
// Renders the first 2-3 lines of the song's lyrics, blurred
// Creates the "something is here, join to see it" visual effect

const BlurredLyricsPreview = ({ snippet }: { snippet: string }) => {
  const lines = snippet.split('\n').slice(0, 3);
  
  return (
    <div className="relative select-none pointer-events-none" aria-hidden="true">
      {/* The blurred text */}
      <div style={{ filter: 'blur(5px)', opacity: 0.65 }}>
        {lines.map((line, i) => (
          <p key={i} className="text-[0.9375rem] leading-relaxed mb-1"
             style={{ color: '#1A1A1A', fontFamily: 'var(--font-display)' }}>
            {line || ' '}  {/* non-breaking space for empty lines */}
          </p>
        ))}
      </div>
      
      {/* Frosted gradient overlay at bottom for clean fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-8"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))'
        }}
      />
    </div>
  );
};
```

### Loading state while fetching invite data

While the token is being validated (Supabase lookup), show:
```
[Crown logo centered]
[Skeleton: 200px × 20px rounded-full, rgba(181,147,90,0.10), pulsing]
[Skeleton: 320px × 80px rounded-2xl, animate-pulse]
```
Never show a spinner in isolation — skeleton preserves layout, reduces perceived load time.

### Error states (handled inside this page, not separate pages)

Handled inline within Screen A with `InviteErrorCard`:

```
EXPIRED / REVOKED:
  ┌─────────────────────────────────────────────────┐
  │  This invite is no longer active.               │ Playfair 600 20px
  │  Parker's link may have been removed.           │ Inter 400 14px #666
  │                                                 │
  │  [Request new invite from Parker]               │ Gold pill CTA
  │  [Go to colorsofglory.app]                      │ Gray text link
  └─────────────────────────────────────────────────┘

ALREADY JOINED:
  ┌─────────────────────────────────────────────────┐
  │  [Gold ✓ circle — 56px]                         │
  │                                                 │
  │  You're already in this song.                   │ Playfair 600 20px
  │  You joined Grace in the Waiting on June 2.     │ Inter 400 14px #666
  │                                                 │
  │  [Open song →]                                  │ Gold pill → /songs/:id/lyrics
  └─────────────────────────────────────────────────┘

MAX CAPACITY:
  ┌─────────────────────────────────────────────────┐
  │  This link has reached its limit.               │
  │  Ask Parker to send you a personal invite.      │
  │                                                 │
  │  [Request access from Parker]                   │ Gold pill
  └─────────────────────────────────────────────────┘
```

### State machine

```typescript
type InvitePageState =
  | { status: 'loading' }          // fetching invite from token
  | { status: 'error'; code: InviteErrorCode }  // invalid/expired/capacity
  | { status: 'already_joined' }   // user is already a member
  | { status: 'input'; phone: string; isValid: boolean }   // phone entry
  | { status: 'submitting' }       // sending OTP
  | { status: 'existing_user'; firstName: string }  // detected existing user
  | { status: 'sent' }             // OTP sent, navigating to verify
```

### Phone detection for existing user

```typescript
// After the user enters a valid phone number (10 digits), but BEFORE they tap submit:
// - Quietly check Supabase if phone exists in users table
// - If yes: transition to Screen A2 (WelcomeBackJoinPage)
// - If no: normal OTP flow (Screen B)

const checkExistingUser = useDebouncedCallback(async (e164: string) => {
  if (!isValidPhone) return;
  const { data } = await supabase
    .from('users')
    .select('id, first_name')
    .eq('phone', e164)
    .single();
  
  if (data) {
    setIsExistingUser(true);
    setExistingFirstName(data.first_name);
    // Don't navigate yet — wait for them to tap "Join this song"
    // The button copy changes to: "Continue as [First Name]"
  }
}, 400);

// CTA copy transforms:
// Default: "Join this song →"
// After detection: "Continue as Parker →"  ← warm, personal
```

---

## SCREEN A2 — WELCOME BACK (EXISTING USER)

### The critical UX principle here
This screen exists because asking someone who already has an account to go through OTP *again* is friction they don't deserve. The goal: **one tap** from seeing their name to entering the song.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Crown ⬡ Colors of Glory]              │ ← 64px from top
│                                                     │
│                   [80px gap]                        │
│                                                     │
│              Grace in the Waiting                   │ ← Playfair 700 28px #1A1A1A
│           Parker invited you to join               │ ← Inter 400 16px #666
│                                                     │
│                   [40px gap]                        │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  ○○                                            │ │ ← user's avatar (initials circle, gold)
│  │  Welcome back, Parker.                         │ │ ← Playfair 600, 20px, #1A1A1A
│  │  Tap to join the song.                         │ │ ← Inter 400, 14px, #666
│  └────────────────────────────────────────────────┘ │ ← white, gold border, radius 20px
│                                                     │
│                   [32px gap]                        │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │         Join Grace in the Waiting →            │ │ ← 56px pill, #B5935A
│  └────────────────────────────────────────────────┘ │
│                                                     │
│           No code needed — you're in.              │ ← 12px #999, centered ← trust signal
│                                                     │
└─────────────────────────────────────────────────────┘
```

### What happens on tap
1. Accept invite silently via Supabase (existing session handles auth)
2. Add user to `song_members` with `assignedRole`
3. Navigate to Screen D (InviteTeamIntroPage) — skip B and C
4. The 10-second benchmark depends entirely on this path being instant

### If silent auth fails (session expired)
Fall back to OTP flow gracefully:
```
"Let's confirm it's you — we'll send a quick code."
→ Navigate to Screen B
```

---

## SCREEN B — INVITE OTP VERIFY

### This is nearly identical to `CodeVerifyPage`
**Do not rebuild it.** Create a thin wrapper that:
1. Changes the headline: "One step from the song"
2. Changes microcopy: "We sent a 6-digit code to join Grace in the Waiting."
3. After verify: routes to Screen C (not `/onboarding/intent`)

```tsx
// InviteVerifyPage.tsx — thin wrapper
const InviteVerifyPage = () => {
  const ctx = loadInviteContext();
  
  const onVerified = async () => {
    // Accept invite now that identity is confirmed
    await acceptInvite(ctx.token);
    navigate('/invite/name');  // → Screen C
  };
  
  return (
    <CodeVerifyPage
      headlineOverride="One step from the song"
      microcopyOverride={`We sent a code to join ${ctx?.songTitle}.`}
      onVerified={onVerified}
    />
  );
};
```

*Note: `CodeVerifyPage` needs a minor refactor to accept these overrides as props. Estimate: 15 minutes.*

---

## SCREEN C — NAME COLLECTION

### Emotional tone: personal, not administrative
The copy "What's your name?" is warm and conversational. The subtext "Your collaborators will see this" is the REASON they should care — it's not just bureaucracy, it's social identity.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Crown ⬡ Colors of Glory]              │
│                                                     │
│                   [52px gap]                        │
│                                                     │
│              What's your name?                      │ ← Playfair 700, 40px, centered, #1A1A1A
│                                                     │
│  Your collaborators will see this in the song.      │ ← Inter 400, 16px, centered, #666
│                                                     │
│                   [36px gap]                        │
│                                                     │
│  First name                                         │ ← Inter 500 14px #666, label above
│  ┌────────────────────────────────────────────────┐ │
│  │  Parker                                        │ │ ← 56px, white, radius 16px
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Last name                                          │
│  ┌────────────────────────────────────────────────┐ │
│  │  Johnson                                       │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│                   [28px gap]                        │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │         Continue to the song →                 │ │ ← 56px pill gold
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  (Disabled until both fields have content)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Field behavior
- First name: `autocomplete="given-name"`, `inputMode="text"`, auto-focus on mount
- Last name: `autocomplete="family-name"`, auto-advances focus from first when Enter pressed
- Return key on last name = submit if both valid
- Both fields use gold border + glow when focused/filled
- CTA disabled (opacity 0.4) until both non-empty

### Auto-populate from phone contacts (iOS / Safari)
Safari's contact autofill works natively for `autocomplete="given-name"` / `"family-name"`. The user can tap the autofill suggestion and both fields populate in one tap. No extra work needed from us — just use the correct `autocomplete` attributes.

---

## SCREEN D — TEAM INTRO

### The emotional arrival moment
This screen does one thing: makes the invitee feel like they're *joining a creative team*, not registering for a service. The avatars of real people already in the song are the entire content. The auto-advance means it never blocks.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Crown ⬡ Colors of Glory]              │ ← small, centered, quiet
│                                                     │
│                   [52px gap]                        │
│                                                     │
│     ┌──┐  ┌──┐  ┌──┐                              │ ← CollaboratorAvatarStack
│     │PK│  │SM│  │CR│                              │   48px circles, colors from aurora palette
│     └──┘  └──┘  └──┘                              │   stagger animation: 0ms / 100ms / 200ms
│                                                     │   slide in from left, opacity 0→1, 300ms
│                   [24px gap]                        │
│                                                     │
│         Parker, Sarah, and Caleb                    │ ← Inter 700, 20px, #1A1A1A, centered
│       are already working on this song.             │ ← Inter 400, 16px, #666, centered
│                                                     │
│                   [32px gap]                        │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  🎵 Grace in the Waiting                       │ │ ← Playfair 600, 22px, #1A1A1A
│  │  Your role: Contributor                        │ │ ← Inter 500, 14px, #B5935A (gold)
│  └────────────────────────────────────────────────┘ │ ← white card, gold border, radius 20px
│                                                     │
│                   [40px gap]                        │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │            Enter the song →                    │ │ ← 56px pill, #B5935A
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [Progress bar — thin 2px gold line at very top,    │
│   animating from 0 to 100% in 2 seconds]            │ ← communicates auto-advance timing
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Auto-advance logic
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    navigate(`/songs/${ctx.songId}/lyrics`);
  }, 2000);
  
  return () => clearTimeout(timer);  // Clean up if user taps manually
}, []);
```

The progress bar at the top ticks from 0% to 100% over 2 seconds using a CSS animation:
```css
@keyframes auto-advance-bar {
  from { width: 0%; }
  to   { width: 100%; }
}
.auto-advance-bar {
  animation: auto-advance-bar 2s linear forwards;
}
```

### Collaborator name formatting
```typescript
// Given: ['Parker', 'Sarah', 'Caleb', 'Jordan']
// Output: "Parker, Sarah, Caleb, and Jordan"

// Given: ['Parker', 'Sarah']
// Output: "Parker and Sarah"

// Given: ['Parker']
// Output: "Parker"

// Given: ['Parker', 'Sarah', 'Caleb', 'Jordan', 'Chris', ...] (>4)
// Output: "Parker, Sarah, and 3 others"

function formatCollaboratorNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length <= 4) {
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others`;
}
```

### Avatar color assignment
Each user gets a consistent color from the aurora palette based on their user ID:
```typescript
const AVATAR_COLORS = ['#8070C4', '#4D8FD2', '#53AB8B', '#D4AE5C', '#C26A95'];

function getAvatarColor(userId: string): string {
  const index = userId.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
```

---

## SCREEN E — LYRICS LANDING (MODIFIED)

### What changes from the existing LyricsEditorPage

The existing page works. Three additions are injected on top of it for the invite flow:

**Addition 1: Role Toast** — `RoleToast.tsx`
```
Trigger: 500ms after mount
Duration: shows for 3 seconds, then fades out

[Contributor chip] You can write lyrics, add voice memos, and comment.

Position: fixed bottom, above safe area
Animation: slide up from bottom (translateY 20px → 0, opacity 0→1, 300ms)
Auto-dismiss: translateY 0 → 20px, opacity 1→0, 200ms after 3s

Visual:
  Rounded pill, full-width minus padding
  bg: rgba(181,147,90,0.12), border: 1px solid rgba(181,147,90,0.25)
  Gold role chip [Contributor] on left
  Text: Inter 400 13px #666
```

**Addition 2: First Action Bottom Sheet** — `FirstActionSheet.tsx`
```
Trigger: 1,500ms after mount (after role toast has auto-dismissed)
Appears once per session (localStorage flag: 'cog:invite-first-action-shown')

[Handle bar — 4px × 40px, rounded, #CCC, centered top]
[18px gap]
[You're inside the song. Start by: — Inter 600 15px #1A1A1A]
[12px gap]
[3 action chips in a row:]
  [+ Write a lyric] [🎤 Voice memo] [💬 Leave a comment]
  
  Each chip: white, border 1.5px rgba(0,0,0,0.10), radius 100px, px 16 py 10
  Icon + label, Inter 500 14px #1A1A1A
  Active/press: scale(0.97), gold border
  
[20px gap]
[Tap anywhere outside to dismiss — Inter 400 12px #999 centered]

Position: fixed bottom, slide up from below screen
Backdrop: rgba(0,0,0,0.20) behind sheet
Dismiss: tap backdrop, swipe down, or tap any chip
```

**Addition 3: Photo Banner** — `PhotoBanner.tsx`
```
Appears: when user has no profile photo set
Dismissible: X button stores 'cog:photo-banner-dismissed' in localStorage
Appears once per session, never again after dismissed

[○ Avatar circle placeholder (dashed)] 
[Add a photo so your collaborators recognize you →]
[X dismiss button — right edge]

Position: fixed top of lyrics content area, below the tab bar
Height: 48px
bg: rgba(181,147,90,0.08), border-bottom 1px rgba(181,147,90,0.15)
Text: Inter 400 13px #666, gold arrow icon
Tap: opens photo picker (not yet wired — Lovable's domain)
```

**Addition 4: Viewer lock indicators** — for `viewer` role
```
On each lyric section textarea:
  [Lock icon 14px #999] [View only — Inter 400 13px #999]
  
On tap of any locked field:
  Toast: "Ask Parker to upgrade your role to edit."
  Duration: 2 seconds, then dismisses
```

---

## COMPONENT: CollaboratorAvatarStack

```tsx
// Used on: Screen D (team intro), eventually in song header

interface AvatarProps {
  users: { initials: string; color: string; name: string }[];
  size?: number;        // default 48px for Screen D, 28px for catalog cards
  maxVisible?: number;  // default 3
  stagger?: boolean;    // enable entrance animation stagger
}

const CollaboratorAvatarStack = ({ users, size = 48, maxVisible = 3, stagger = false }) => {
  const visible = users.slice(0, maxVisible);
  const remainder = users.length - maxVisible;
  
  return (
    <div className="flex -space-x-3">
      {visible.map((user, i) => (
        <div
          key={user.id}
          className="rounded-full flex items-center justify-center font-bold text-white"
          style={{
            width: size,
            height: size,
            backgroundColor: user.color,
            border: `${size > 36 ? 2.5 : 2}px solid #FAFAF6`,
            fontSize: size * 0.3,
            zIndex: visible.length - i,
            animation: stagger
              ? `avatar-slide-in 300ms ${i * 100}ms cubic-bezier(0.22, 1, 0.36, 1) both`
              : 'none',
          }}
          title={user.name}
        >
          {user.initials}
        </div>
      ))}
      {remainder > 0 && (
        <div
          className="rounded-full flex items-center justify-center font-semibold"
          style={{
            width: size,
            height: size,
            backgroundColor: 'rgba(0,0,0,0.06)',
            border: `2px solid #FAFAF6`,
            fontSize: size * 0.28,
            color: '#666',
          }}
        >
          +{remainder}
        </div>
      )}
    </div>
  );
};
```

---

## ROUTING

Add to App.tsx:

```typescript
// Invite flow routes
<Route path="/invite/:token"   element={<InviteJoinPage />} />      // Screen A (replaces existing)
<Route path="/invite/welcome"  element={<InviteWelcomeBackPage />} />  // Screen A2
<Route path="/invite/verify"   element={<InviteVerifyPage />} />    // Screen B
<Route path="/invite/name"     element={<InviteNamePage />} />      // Screen C
<Route path="/invite/team"     element={<InviteTeamIntroPage />} /> // Screen D
// Screen E = existing /songs/:id/lyrics with invite-mode additions
```

---

## DATA FLOW

```
1. User taps colorsofglory.app/join/[token]
   
2. InviteJoinPage mounts:
   → GET /api/invites/preview?token=[token]
   → Returns: { songTitle, inviterName, assignedRole, lyricsSnippet, collaborators, status }
   → If status === 'invalid' | 'revoked' → show InviteErrorCard
   → If status === 'already_member' → show already-joined state
   → If status === 'capacity_exceeded' → show capacity error
   → If status === 'valid' → save to inviteContext, show join form

3. User enters phone → debounced check for existing user
   → If existing: mutate screen to show "Continue as [name]" CTA
   → If new: standard OTP flow

4. User taps "Join this song":
   → signInWithOtp({ phone: e164 })
   → navigate('/invite/verify') — carries token, phone in sessionStorage

5. OTP verified:
   → acceptInvite(token) — creates song_member record in Supabase
   → navigate('/invite/name')

6. Name saved:
   → updateUser({ firstName, lastName }) in Supabase
   → navigate('/invite/team')

7. Team intro (auto-advances 2s):
   → navigate('/songs/[songId]/lyrics?invite=1')
   
8. Lyrics page detects ?invite=1 query param:
   → Shows RoleToast after 500ms
   → Shows FirstActionSheet after 1500ms (if not previously shown)
   → Shows PhotoBanner if no avatar set
```

---

## `inviteApi.ts` — API LAYER

```typescript
export async function previewInvite(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase
    .from('invite_tokens')
    .select(`
      id, song_id, assigned_role, max_uses, current_uses, is_revoked,
      songs ( title, lyrics_snippet ),
      users!created_by ( first_name, last_name ),
      song_members ( users ( first_name, last_name, avatar_color ) )
    `)
    .eq('token', token)
    .single();
  
  if (error || !data) throw new InviteError('INVITE_NOT_FOUND');
  if (data.is_revoked) throw new InviteError('INVITE_REVOKED');
  if (data.max_uses && data.current_uses >= data.max_uses)
    throw new InviteError('INVITE_EXHAUSTED');
  
  // Check if current user is already a member
  const { data: existingMember } = await supabase
    .from('song_members')
    .select('id')
    .eq('song_id', data.song_id)
    .eq('user_id', supabase.auth.getUser().data.user?.id)
    .single();
  
  if (existingMember) throw new InviteError('INVITE_ALREADY_MEMBER');
  
  return mapToInvitePreview(data);
}

export async function acceptInvite(token: string): Promise<{ songId: string }> {
  // Insert song_member, increment invite usage
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) throw new InviteError('ACCEPT_FAILED');
  return { songId: data.song_id };
}

export async function requestNewInvite(token: string): Promise<void> {
  // Sends notification to invite creator that this user wants access
  await supabase.from('invite_requests').insert({ token, requested_by: currentUserId });
}
```

---

## `inviteErrors.ts` — FRIENDLY ERROR COPY

```typescript
export type InviteErrorCode =
  | 'INVITE_NOT_FOUND'
  | 'INVITE_REVOKED'
  | 'INVITE_EXHAUSTED'
  | 'INVITE_ALREADY_MEMBER'
  | 'ACCEPT_FAILED'
  | 'NETWORK_ERROR';

export const INVITE_ERROR_COPY: Record<InviteErrorCode, {
  headline: string;
  body: string;
  ctaLabel: string | null;
  ctaAction: 'request_new' | 'open_song' | 'go_home' | null;
}> = {
  INVITE_NOT_FOUND: {
    headline: "This invite link isn't valid.",
    body: "It may have been removed or the link was changed.",
    ctaLabel: "Request a new invite",
    ctaAction: 'request_new',
  },
  INVITE_REVOKED: {
    headline: "This invite is no longer active.",
    body: "Parker's link may have been removed.",
    ctaLabel: "Request new invite from Parker",
    ctaAction: 'request_new',
  },
  INVITE_EXHAUSTED: {
    headline: "This link has reached its limit.",
    body: "Ask Parker to send you a personal invite.",
    ctaLabel: "Request access from Parker",
    ctaAction: 'request_new',
  },
  INVITE_ALREADY_MEMBER: {
    headline: "You're already in this song.",
    body: null,  // date calculated dynamically: "You joined on June 2."
    ctaLabel: "Open song →",
    ctaAction: 'open_song',
  },
  ACCEPT_FAILED: {
    headline: "Something went wrong.",
    body: "We couldn't add you to the song. Please try again.",
    ctaLabel: "Try again",
    ctaAction: null,
  },
  NETWORK_ERROR: {
    headline: "No connection.",
    body: "Check your internet and try again.",
    ctaLabel: "Retry",
    ctaAction: null,
  },
};
```

---

## ANIMATION SYSTEM FOR THIS FLOW

### Screen-to-screen transitions
Every forward navigation in this flow uses:
```css
/* New screen enters from right */
@keyframes invite-screen-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}
.invite-screen { animation: invite-screen-in 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
```

### Bottom sheet (FirstActionSheet)
```css
@keyframes sheet-up {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.first-action-sheet { animation: sheet-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both; }
```

### Role toast
```css
@keyframes toast-up {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes toast-down {
  from { transform: translateY(0); opacity: 1; }
  to   { transform: translateY(20px); opacity: 0; }
}
```

### Team intro avatar stagger
```css
@keyframes avatar-slide-in {
  from { transform: translateX(-16px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
```

### Auto-advance progress bar (Screen D)
```css
@keyframes progress-bar {
  from { width: 0%; }
  to   { width: 100%; }
}
.auto-advance-bar {
  animation: progress-bar 2000ms linear forwards;
  height: 2px;
  background: #B5935A;
  border-radius: 9999px;
}
```

---

## ACCESSIBILITY

| Requirement | Implementation |
|-------------|---------------|
| Phone input | `inputMode="tel"`, `autocomplete="tel"`, `aria-label="Phone number"` |
| OTP boxes | `aria-label="Code digit X of 6"`, `aria-live="polite"` on error |
| Name fields | `autocomplete="given-name"` / `"family-name"`, `aria-required="true"` |
| Avatars on Screen D | `aria-hidden="true"`, names in `title` attr |
| Role toast | `role="status"`, `aria-live="polite"` |
| First action sheet | `role="dialog"`, `aria-label="First action in this song"`, focus trapped |
| Photo banner | `aria-label="Add profile photo"`, dismiss button `aria-label="Dismiss"` |
| Blurred lyrics | `aria-hidden="true"` — purely decorative |
| Error states | `role="alert"`, `aria-live="assertive"` |
| All CTAs | min 44px touch target, `active:scale-[0.97]` |

---

## PERFORMANCE REQUIREMENTS

| Metric | Target |
|--------|--------|
| Screen A load (invite data) | < 800ms (Supabase single query) |
| OTP delivery | < 10s (Twilio SLA) |
| Screen-to-screen transition | 60fps, no jank |
| First meaningful paint | < 1.5s (skeleton shown) |
| Lyrics load after team intro | < 1s |
| Total: new user phone → in lyrics | < 60s |
| Total: existing user tap → in lyrics | < 10s |

---

## BUILD SEQUENCE

| Step | Task | Time | Depends on |
|------|------|------|-----------|
| 1 | `inviteContext.ts` + `inviteErrors.ts` — shared state | 30min | — |
| 2 | `inviteApi.ts` — previewInvite + acceptInvite | 45min | Supabase tables |
| 3 | Screen A: `InviteJoinPage` — full layout + skeleton + errors | 90min | 1, 2 |
| 4 | Screen A2: `InviteWelcomeBackPage` — existing user path | 45min | 3 |
| 5 | Screen B: `InviteVerifyPage` — thin wrapper | 20min | CodeVerifyPage refactor |
| 6 | Screen C: `InviteNamePage` — name form | 30min | 5 |
| 7 | Screen D: `InviteTeamIntroPage` — avatar stack + auto-advance | 60min | 6 |
| 8 | Screen E additions: `RoleToast` + `FirstActionSheet` + `PhotoBanner` | 90min | LyricsEditorPage |
| 9 | Wire all routes in App.tsx | 15min | 3–8 |
| 10 | Error states: expired, already-joined, capacity | 30min | 3 |
| 11 | `useExistingUser` hook — debounced phone check | 20min | 3 |
| 12 | Test full flow new user + returning user | 30min | all |
| 13 | Desktop responsive check | 20min | all |

**Total estimated: ~9 hours of focused build time**

---

## WHAT LOVABLE MUST BUILD FIRST

Before Claude can wire the Supabase calls, Lovable needs:

1. `invite_tokens` table with RLS:
   - Public can read a token by token value (for preview)
   - Auth required to accept (write to song_members)

2. `song_members` table with roles

3. `accept_invite` Supabase RPC function (atomic: insert member + increment uses)

4. `invite_requests` table (for "request new invite" flow)

5. Phone → user lookup function (or allow anon query on users.phone with RLS)

6. Edge function or Supabase trigger: notify song owner when invite accepted

---

## TESTING CHECKLIST (before shipping)

**Happy paths:**
- [ ] New user: phone → OTP → name → team intro → lyrics ← full 60s benchmark
- [ ] Existing user: phone → welcome back → team intro → lyrics ← 10s benchmark
- [ ] Viewer role: editing is locked with inline indicator
- [ ] Contributor role: can type in lyrics immediately
- [ ] Auto-advance on Screen D fires after exactly 2 seconds
- [ ] FirstActionSheet appears once, never again on second visit
- [ ] Photo banner dismisses and stays dismissed across sessions
- [ ] Role toast auto-dismisses after 3 seconds

**Error paths:**
- [ ] Expired/revoked link → error card with "Request new invite"
- [ ] Already joined → "You're already in" + open song CTA
- [ ] Max capacity → error card with request access
- [ ] Wrong OTP → inline error, boxes clear, no navigation
- [ ] Network offline during invite preview → retry state
- [ ] Existing user silent auth fails → falls back to OTP gracefully

**Edge cases:**
- [ ] Name with special characters (é, ü, etc.) saves correctly
- [ ] Desktop browser → full web flow works
- [ ] Invite link opened while already logged into a different account
- [ ] Multi-use link — 5th person joins successfully, 6th sees capacity error
- [ ] Song owner clicks their own invite link → "You own this song" state

---

*Plan complete · Ready to build Screen A first · 2026-06-04*
