# Step 2 — CanvasCard System
## Extreme World-Class UX Plan
## Fantasy.co × Aristide Benoist Standard
## 2026-06-04

---

## NORTH STAR

> Each card must communicate its content type, its creator, and its status before the user reads a single word. The card IS the idea — the visual design carries the emotional weight of the creative work inside it.

A lyric card that looks like a lyric. A voice memo card that looks like sound. A chord card that looks like music theory. Section clusters that feel like physical stacks of paper on a songwriter's desk.

---

## WHAT THIS STEP DELIVERS

Five fully specified card components:
1. `LyricCard` — text-first, Playfair Display body, section label crown
2. `VoiceMemoCard` — waveform preview bars (animated on play), play button, duration, rename
3. `HumCard` — quick capture, pulse animation on the "unlistened" state, compact
4. `ChordCard` — chord chip sequence, key badge, BPM, waveform suggestion line
5. `NoteCard` — freeform text, subtle ruled-line paper feel

Plus:
- `SectionCluster` — 10+ cards collapse into a stacked cluster with count badge
- `CreatorColorSystem` — the complete aurora palette spec with all derived values
- `CardShell` — the shared base container every card type uses

---

## THE AURORA CREATOR COLOR SYSTEM

### The five collaborator colors

Derived from the aurora gradient in the COG mark: purple → blue → teal → gold → rose.
Assigned deterministically by `userId.charCodeAt(0) % 5`. Same user always gets same color.

```typescript
export const AURORA_COLORS = {
  gold:   { base: '#D4AE5C', dark: '#A07830', glow: 'rgba(212,174,92,0.18)',  bg: 'rgba(212,174,92,0.09)'  },
  teal:   { base: '#53AB8B', dark: '#2E7A60', glow: 'rgba(83,171,139,0.18)',  bg: 'rgba(83,171,139,0.09)'  },
  purple: { base: '#8070C4', dark: '#5040A0', glow: 'rgba(128,112,196,0.18)', bg: 'rgba(128,112,196,0.09)' },
  blue:   { base: '#4D8FD2', dark: '#2A5EA0', glow: 'rgba(77,143,210,0.18)',  bg: 'rgba(77,143,210,0.09)'  },
  rose:   { base: '#C26A95', dark: '#8A3A65', glow: 'rgba(194,106,149,0.18)', bg: 'rgba(194,106,149,0.09)' },
} as const;

export type AuroraColorKey = keyof typeof AURORA_COLORS;

export function getCreatorColor(userId: string): typeof AURORA_COLORS[AuroraColorKey] {
  const keys = Object.keys(AURORA_COLORS) as AuroraColorKey[];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AURORA_COLORS[keys[Math.abs(hash) % keys.length]];
}
```

### How the color appears on each card

Every card uses its creator color in exactly four places:
1. **Left border** — 3px solid, full card height (the strongest color signal)
2. **Icon background** — `color.bg` (9% opacity) with `color.base` icon
3. **Creator dot** — top-right, 22px circle, `color.base` fill, white initials
4. **Box shadow** — `0 4px 20px ${color.glow}` (18% opacity) — invisible but felt

What the color does NOT touch: card background (always `#FFFFFF`), text (always `#1A1A1A`), section label (always `#999`).

### Dimmed reference state (after move to Final)

```
opacity: 0.42
border: 3px dashed ${color.base}60      ← dashes communicate "reference, not active"
box-shadow: none
background: rgba(255,255,255,0.70)
cursor: not-allowed
```

A small "↳ Used in Final" label appears at the bottom in `color.base` at 70% opacity.

---

## `CardShell` — THE SHARED BASE

All five card types are wrapped in `CardShell`. Shell handles:
- The physical card container (dimensions, border-radius, white background)
- The creator left-border (3px)
- The box-shadow with creator glow
- The press/drag scale animation
- The selection elevated state
- The dimmed reference state
- The pointer event guard (card interaction blocks canvas pan)

```typescript
interface CardShellProps {
  creatorColor: typeof AURORA_COLORS[AuroraColorKey];
  selected: boolean;
  isDimmedReference: boolean;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: () => void;
  width?: number;   // default 200px
  children: React.ReactNode;
  'aria-label': string;
}
```

### CardShell visual specification

```
Base state:
  width: 200px
  min-height: 140px (expands with content)
  border-radius: 16px
  background: #FFFFFF
  border-left: 3px solid {color.base}
  border-top/right/bottom: 1px solid {color.base}25
  box-shadow: 0 4px 20px {color.glow}
  padding: 14px 14px 14px 12px  ← 12px left (accounts for 3px border)
  cursor: grab
  user-select: none

Selected state (adds elevation):
  box-shadow: 0 12px 40px {color.glow}, 0 0 0 2px {color.base}
  transform: scale(1.04) translateZ(0)
  z-index: 20
  cursor: default

Dragging state:
  transform: scale(1.06) rotate(1.5deg) translateZ(0)
  box-shadow: 0 24px 60px {color.glow}, 0 0 0 2px {color.base}
  opacity: 0.92
  z-index: 50
  cursor: grabbing

DimmedReference state:
  opacity: 0.42
  border-left: 3px dashed {color.base}60
  border-top/right/bottom: 1px dashed {color.base}25
  box-shadow: none
  cursor: not-allowed
  pointer-events: none  ← can't interact with dimmed cards
```

### CardShell animations

```css
/* Card enters canvas (after creation) */
@keyframes card-enter {
  from { opacity: 0; transform: scale(0.82) translateZ(0); }
  to   { opacity: 1; transform: scale(1.0) translateZ(0); }
}
.card-enter { animation: card-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

/* Card press feedback */
.card-shell:active:not(.dragging):not(.dimmed) {
  transform: scale(0.97) translateZ(0);
  transition: transform 80ms ease;
}

/* Move-to-Final animation (card travels across divider) */
@keyframes card-fly-to-final {
  0%   { transform: scale(1.0) translateZ(0); }
  40%  { transform: scale(1.08) rotate(2deg) translateZ(0); }
  100% { transform: scale(1.0) translateZ(0); }
}
.card-flying { animation: card-fly-to-final 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

/* Dim transition (after original moves to Final) */
.card-dimming {
  transition: opacity 400ms ease, border-color 400ms ease;
  animation: none;
}
```

---

## CARD 1 — `LyricCard`

### Emotional intention
*This is the songwriter's handwriting. The lyric deserves reverence — it should feel like reading sheet music, not a note app.*

### Visual anatomy

```
┌─[3px creator border]──────────────────────────────────────┐
│                                                [● PK dot]  │
│  [≡ icon on creator bg]  VERSE 1 [section label]          │
│                                                            │
│  "Grace in the waiting,                                    │ ← Playfair Display 13px
│   peace in the storm"                                      │   line-height: 1.6
│                                                            │
│  [2 lines max, ellipsis after]                             │
│                                                            │
│  ─────────────────────────────────────────────────────    │
│  [word count: 4 words]              [shortlisted chip]    │
└────────────────────────────────────────────────────────────┘
```

### Typography

```
Section label: Inter 600, 9px, uppercase, letter-spacing 0.15em, #999
Title/body: Playfair Display 400, 13px, #1A1A1A, line-height 1.6
Word count: Inter 400, 10px, #BBB
Status chip: Inter 600, 9px, uppercase, letter-spacing 0.10em
```

### Status chips

Each chip uses a muted tint of the creator color:

```
raw:         neutral bg (rgba(0,0,0,0.05)), #999 text, no border
shortlisted: aurora blue bg, #4D8FD2 text
approved:    aurora teal bg, #53AB8B text, ✓ icon
review:      aurora purple bg, #8070C4 text
meaning:     aurora gold bg, #D4AE5C text, ✦ icon (scripture-style)
```

### Selected expansion (in-place)

When selected, LyricCard expands below its fold to show the full text and actions:

```
Expansion: height animates from auto to auto+action bar height
Animation: 240ms cubic-bezier(0.22, 1, 0.36, 1)

Action bar (appears at bottom):
  [→ Final] — gold pill, 30px height
  [✏ Edit] — ghost, same height
  [⌘ Duplicate] — ghost
  [✕] — close selection, muted

All actions: 10px Inter 600
```

---

## CARD 2 — `VoiceMemoCard`

### Emotional intention
*This card must look like sound. The waveform is not a decoration — it IS the idea. The creator color should feel warm and audio-like.*

### Waveform specification

**Source of truth:** The reference image (download 3, left phone) shows:
- 30–38 bars of variable height
- Bars range from ~6px (shortest) to ~72px (tallest) at full scale
- The envelope forms a near-symmetric diamond shape (small → tall → small)
- Color gradient LEFT → RIGHT: `#D4AE5C` (warm amber) → `#C26A95` (rose) 
- Actually for canvas cards: the gradient uses the **creator's aurora color** for all bars, just with lighter opacity on shorter bars

**But wait — the reference shows the RECORDING screen waveform (red/amber gradient). The SAVED card waveform (right phone) shows a static white card with just a play button.** So the canvas card shows a static waveform preview.

**Canvas VoiceMemoCard waveform:**
- 20 bars (manageable at 200px card width)
- Bar width: 5px, gap: 3px, total = 20×5 + 19×3 = 157px (fits in card padding)
- Heights: derived from a Perlin-like seed using the card ID (deterministic, always same shape)
- Color: creator `color.base` at full opacity, with bar height as additional opacity modifier

```typescript
// Deterministic "waveform" from card ID — same every render, no audio analysis needed
function mockWaveform(cardId: string, barCount = 20): number[] {
  let seed = 0;
  for (let i = 0; i < cardId.length; i++) seed = cardId.charCodeAt(i) + ((seed << 5) - seed);
  return Array.from({ length: barCount }, (_, i) => {
    const s = Math.sin(seed * (i + 1) * 0.7) * 0.5 + 0.5;
    // Diamond envelope: taller in middle
    const envelope = 1 - Math.abs((i / (barCount - 1)) * 2 - 1) * 0.4;
    return Math.max(0.12, Math.min(1.0, s * envelope));
  });
}
```

**Waveform bars CSS:**
```
Each bar:
  width: 5px
  border-radius: 3px (pill tops)
  display: inline-block
  vertical-align: bottom
  background: {color.base}
  opacity: {barHeightRatio * 0.7 + 0.3}  ← shorter bars are more transparent
  height: {barHeightRatio * 52px}         ← max 52px at card scale
```

### Visual anatomy

```
┌─[3px creator border]──────────────────────────────────────┐
│                                                [● SM dot]  │
│  [🎤 on creator bg]  VOICE MEMO                           │
│                                                            │
│  "Chorus hook"                               0:42         │ ← title + duration
│                                                            │
│  [████ ██████ ████ ████ ████]                             │ ← waveform bars
│  [  ██ ██████████ ██████ ██]                             │   20 bars, creator color
│                                                            │
│  ─────────────────────────────────────────────────────    │
│  Chorus · Yesterday                       [not played]    │ ← section + age
└────────────────────────────────────────────────────────────┘
```

### Selected expansion — the audio player

When selected, the card expands to show a mini player:

```
Play button: 40px circle, creator color fill, white ▶
Progress bar: 160px wide, 4px height, rounded
  Played: creator color fill
  Remaining: rgba(0,0,0,0.08)
  Thumb: 10px circle, creator color
Duration counter: Inter 400, 10px, #666 — updates as plays

Below player:
  [▶ Play] [✏ Rename] [📎 Add note] [↗ Share]
  Each: icon 14px + label 10px Inter 400 #666
  Tap ▶ Play: starts audio (MediaAudio element, src=card.audioUrl)
```

### "Not yet played" state indicator

A small unlistened dot appears on cards the current user hasn't played:
```
8px circle, creator color, pulse animation:
  @keyframes audio-pulse { 
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.8); }
  }
  animation: audio-pulse 2s ease-in-out infinite
  
Disappears permanently after first play (localStorage: cog:played-{cardId})
```

---

## CARD 3 — `HumCard`

### Emotional intention
*A hum is the most fragile creative idea. It existed for 3 seconds between a feeling and nothing. This card must feel URGENT and warm — like a voice memo, but rawer.*

### Visual anatomy

```
┌─[3px creator border]──────────────────────────────────────┐
│                                                [● PK dot]  │
│  [🎤 on creator bg]  QUICK HUM      [● UNHEARD pulse]    │ ← unlistened dot pulses
│                                                            │
│  "Hum #3"                                   0:12          │
│                                                            │
│  [Single thick waveform bar — wider, less precise]        │ ← visual metaphor for
│                                                            │   "rough idea" vs "composed"
│                                                            │
│  ─────────────────────────────────────────────────────    │
│  Raw · Just now                                           │
└────────────────────────────────────────────────────────────┘
```

**Key visual distinction from VoiceMemoCard:**
- Hum waveform uses FEWER bars (8 bars) but TALLER proportionally — more jagged, less polished
- Background of waveform area has a very subtle `radial-gradient` centered on the tallest bar
- The "QUICK HUM" label uses the creator color directly (not gray like other section labels)

---

## CARD 4 — `ChordCard`

### Emotional intention
*Music theory on a whiteboard. The chords should feel like they SOUND like something — positioned left to right the way they play in time. This card is always for Caleb-types who think structurally.*

### Chord chip specification

**From reference image (download 4):** Chips are small oval pills with:
- Background: `rgba(228, 213, 160, 0.60)` — warm cream/gold-pale tint
- Border: `1px solid rgba(181, 147, 90, 0.28)`
- Text: `#1A1A1A`, Inter 700, 11px
- Border-radius: 9999px (full pill)
- Padding: 3px 7px
- Margin between chips: 4px

**But for canvas cards:** Chips use the CREATOR's color family (not generic gold):
- Background: `{color.base}15` (15% opacity)
- Border: `{color.base}35`
- Text: `{color.dark}` (darkened base for readability)

### Visual anatomy

```
┌─[3px creator border]──────────────────────────────────────┐
│                                                [● CR dot]  │
│  [🎵 on creator bg]  ARRANGEMENT                          │
│                                                            │
│  Warm progression                                         │ ← title
│                                                            │
│  [C] [G] [Am] [F]                                        │ ← chord chips row 1
│  [C] [G] [Am] [F]                                        │ ← chord chips row 2 if needed
│                                                            │
│  ─────────────────────────────────────────────────────    │
│  Key C · 74 BPM · 4/4                    [approved ✓]    │
└────────────────────────────────────────────────────────────┘
```

### The chord progression display

Chord sequence wraps to multiple rows if > 4 chords:
```
Max 4 chips per row
Row 1: [C] [G] [Am] [F]  ← verse/chorus
Row 2: [Am] [F] [C] [G]  ← bridge (if different)
Each row: flex, gap: 4px
```

**Key + BPM badge:**
```
[♪ C]  [♩ 74]  [4/4]

Each tag: rounded-full, px 6 py 1
bg: rgba(0,0,0,0.05)
text: Inter 400, 10px, #666
♪ and ♩ are unicode music symbols (no icon library needed)
```

### Selected expansion

Tap to expand shows:
- Full chord progression with bar lines (| C G | Am F |)
- BPM slider (visual only, no playback)
- "Suggest chord change" input (for collaborators with Contributor role)

---

## CARD 5 — `NoteCard`

### Emotional intention
*A thought between a lyric and a prayer. It should feel handwritten — not a text field, not a sticky note, but something someone actually wrote down at 2am.*

### Visual anatomy

```
┌─[3px creator border]──────────────────────────────────────┐
│                                                [● PK dot]  │
│  [📄 on creator bg]  MEANING ZONE                         │
│                                                            │
│  "Psalm 46:10 — Be still                                  │ ← text slightly smaller
│   before the second verse                                  │   Inter 400, 12.5px
│   turns upward"                                            │   line-height: 1.7
│                                                            │
│  ─────────────────────────────────────────────────────    │
│  3h ago                                    [meaning ✦]   │
└────────────────────────────────────────────────────────────┘
```

**The "paper texture" effect (subtle, not tacky):**
```css
/* Very faint horizontal rule lines — suggests lined notebook paper */
background-image: repeating-linear-gradient(
  to bottom,
  transparent,
  transparent 19px,
  rgba(181,147,90,0.06) 19px,
  rgba(181,147,90,0.06) 20px
);
background-position: 0 34px;  /* start below the header section */
```

---

## THE SECTION CLUSTER SYSTEM

### When does clustering happen?

Automatically triggered when **10 or more cards share the same `sectionLabel`** in the Ideas Tree.

Cards with `sectionLabel === ''` or `'Raw idea'` are exempt — they never cluster.

### The cluster node visual

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      │ ← shadow card 3 (back)
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░      │ ← shadow card 2 (middle)
│  ┌──────────────────────────────────────────────┐        │ ← front card (full opacity)
│  │  [▶] Verse 1                      (14 ideas) │        │
│  │  ─────────────────────────────────────────── │        │
│  │  [mini card 1] [mini card 2] [mini card 3]   │        │
│  │               ...                           │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Stacked shadow cards (behind the front card):**
```
Card 2 (middle shadow):
  transform: translate(6px, -6px) rotate(-1.5deg)
  opacity: 0.55
  z-index: card.z - 1
  border: 1px solid {color.base}30
  no content (just the visual stack)

Card 3 (back shadow):
  transform: translate(12px, -12px) rotate(-3deg)
  opacity: 0.30
  z-index: card.z - 2
```

**The cluster header:**
```
[▶] — disclosure triangle, 14px, {color.base}
Section label: Inter 700, 12px, #1A1A1A (same creator color tinting as label)
Count badge: rounded-full, {color.base} bg, white text, Inter 700, 10px
  "(14 ideas)" → "14" in the badge
```

**Mini-card previews (first 3 cards in the section):**
```
Each mini-card:
  width: 48px
  height: 40px
  border-radius: 8px
  border-left: 2px solid {card.creator.color.base}
  background: #FFFFFF
  box-shadow: 0 2px 6px rgba(0,0,0,0.06)
  overflow: hidden

  Content: just the card's first line, clipped
  font-size: 8px, Inter 400, #666
  padding: 4px 4px 4px 5px

Mini-cards appear in a row, gap: 4px
```

### Cluster expand animation

When the user taps the cluster:

```typescript
// Cards fan out from the cluster position
// Each card flies to its stored (x, y) with a spring + stagger

const EXPAND_STAGGER = 40;  // ms between each card

function expandCluster(cluster: SectionCluster) {
  cluster.cards.forEach((card, index) => {
    setTimeout(() => {
      // Spring animation from cluster center to card's stored position
      animateCardTo(card.id, card.x, card.y, {
        duration: 400,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      });
    }, index * EXPAND_STAGGER);
  });
}
```

**Visual during expand:**
- Cluster node stays visible while cards animate out
- After last card settles, cluster node fades out (opacity 0 → disappears, 200ms)
- If re-collapsed: reverse animation, cards fly back in, cluster node fades in

---

## COMPLETE INTERACTION STATE MATRIX

| Card State | Border | Shadow | Opacity | Transform | Cursor |
|---|---|---|---|---|---|
| Default | 1px base25 + 3px left base | 0 4px 20px glow | 1.0 | scale(1) | grab |
| Hover | 1px base40 + 3px left base | 0 6px 24px glow | 1.0 | scale(1.01) | grab |
| Active/Press | same | same | 0.9 | scale(0.97) | grabbing |
| Selected | 2px base + 3px left base | 0 12px 40px glow + 0 0 0 2px base | 1.0 | scale(1.04) | default |
| Dragging | 2px base + 3px left base | 0 24px 60px glow | 0.92 | scale(1.06) rotate(1.5deg) | grabbing |
| Dimmed ref | 1px base25 dashed + 3px left base60 dashed | none | 0.42 | scale(1) | not-allowed |
| In cluster | hidden behind shadow cards | — | varies | rotated | — |

---

## WAVEFORM BARS — COMPLETE ANIMATION SPEC

### Static (not playing)
- All bars: full height from seed function
- No animation
- Opacity: `barHeight * 0.7 + 0.3` (range: 0.30 – 1.0)

### Playing state
```typescript
// rAF loop while audio is playing
// Each bar oscillates around its seed height by ±15%
function animateWaveform(bars: HTMLElement[], seedHeights: number[]) {
  let frame = 0;
  function tick() {
    if (isPlaying) requestAnimationFrame(tick);
    frame++;
    if (frame % 2 === 0) {  // update every 2 frames (30fps is fine for waveform)
      bars.forEach((bar, i) => {
        const base = seedHeights[i];
        const wave = Math.sin(Date.now() / 200 + i * 0.8) * 0.15;
        const h = Math.max(0.08, Math.min(1.0, base + wave));
        bar.style.height = `${h * MAX_BAR_HEIGHT}px`;
        bar.style.opacity = String(h * 0.7 + 0.3);
      });
    }
  }
  tick();
}
```

### Playback progress
- A playhead line (1px vertical, creator color, 70% opacity) moves left to right
- Speed: `audioElement.currentTime / duration * totalWaveformWidth`
- Bars left of the playhead: full creator color
- Bars right of the playhead: creator color at 30% opacity

---

## FILE ARCHITECTURE FOR STEP 2

```
NEW:
  src/components/canvas/
    CardShell.tsx           ← shared base (creator color, states, animations)
    LyricCard.tsx           ← text-first card with Playfair Display
    VoiceMemoCard.tsx       ← waveform + player + unlistened pulse
    HumCard.tsx             ← compact waveform, raw/urgent feel
    ChordCard.tsx           ← chord chip sequence + key/BPM metadata
    NoteCard.tsx            ← freeform text with paper-line texture
    SectionCluster.tsx      ← stacked shadow cards + expand animation

  src/lib/canvas/
    creatorColors.ts        ← AURORA_COLORS + getCreatorColor()
    waveformSeed.ts         ← deterministic bar height generation
    cardAnimation.ts        ← all animation keyframes + transition helpers

MODIFIED:
  src/pages/SongCanvasPage.tsx
    ← Replace CanvasCardEl with the new typed card components
    ← Pass creatorColor to each card based on card.contributor userId
    ← Add SectionCluster rendering when cluster threshold is reached
```

---

## PERFORMANCE REQUIREMENTS FOR STEP 2

- All card components are `React.memo()` — they never re-render unless their specific props change
- Waveform bars: `height` and `opacity` written directly via `bar.style` (not state)
- Audio playback: single `HTMLAudioElement` instance in a module-level ref (not per-card)
- Section cluster detection: memoized with `useMemo` — only recalculates when card list changes
- The `getCreatorColor()` function is pure and cached via `useMemo` inside the card
- No Framer Motion on cards — all animations are CSS keyframes or direct DOM writes

---

## ACCESSIBILITY FOR STEP 2

```
CardShell:
  role="button"
  aria-pressed={selected}
  aria-label="{type} card: {title} by {contributor}"
  aria-describedby="{cardId}-content"
  tabIndex={isDimmedReference ? -1 : 0}
  onKeyDown: Space/Enter = select, Delete = delete confirmation

VoiceMemoCard play button:
  aria-label="Play {title}, {duration}"
  aria-live="polite" on the duration counter

SectionCluster:
  role="group"
  aria-label="Section cluster: {label}, {count} ideas"
  aria-expanded={isExpanded}
  The cluster toggle: role="button", aria-controls="{clusterId}-cards"

ChordCard chips:
  aria-label="Chord progression: {chords.join(', ')}"
  Each chip has aria-label="{chord} chord"

Waveform:
  aria-hidden="true"  — decorative, audio content communicated by play button
```

---

## STEP 2 ACCEPTANCE CRITERIA

**Creator color system:**
- [ ] Five distinct aurora colors assigned deterministically per userId
- [ ] Left border is always 3px solid creator color (never generic gold)
- [ ] Icon background is `color.bg` with icon in `color.base`
- [ ] Creator dot (22px) in top-right, `color.base` fill, white initials
- [ ] Shadow is `color.glow` — invisible but adds depth
- [ ] Dimmed reference: opacity 0.42, dashed border, "↳ Used in Final" label

**LyricCard:**
- [ ] Section label in 9px Inter uppercase
- [ ] Body text in Playfair Display 13px, line-height 1.6
- [ ] Max 2 lines body, ellipsis after
- [ ] Status chip renders for all 5 states with correct colors
- [ ] Expand action bar appears on selection

**VoiceMemoCard:**
- [ ] 20 waveform bars visible at card scale
- [ ] Bar heights deterministic from cardId (same every render)
- [ ] Bars use creator color with height-based opacity
- [ ] "Not yet played" pulse dot visible when unplayed
- [ ] Expanded state shows play button + progress bar

**ChordCard:**
- [ ] Chord chips displayed in sequence, max 4 per row, wrap to next
- [ ] Chips use creator color family (base15 bg, dark text)
- [ ] Key + BPM displayed in small tags at bottom
- [ ] Chord progression wraps correctly

**NoteCard:**
- [ ] Paper-line texture visible (very subtle, not tacky)
- [ ] Inter 400 body text, NOT Playfair

**SectionCluster:**
- [ ] Appears when 10+ cards share the same non-blank sectionLabel
- [ ] Two shadow cards visible behind the front card (rotated)
- [ ] First 3 card mini-previews visible in cluster
- [ ] Count badge correct
- [ ] Tap to expand: cards fan out with spring + 40ms stagger
- [ ] Cluster node fades out after cards settle
- [ ] Tap to collapse: reverse animation

**Overall:**
- [ ] All cards are `React.memo()` — no unnecessary re-renders during canvas pan
- [ ] Waveform animation runs at rAF (smooth) during playback
- [ ] Audio plays on VoiceMemoCard without lag
- [ ] Screen reader announces card type, title, creator, status
- [ ] Keyboard: Tab cycles cards, Space selects, Delete triggers confirmation

---

*Step 2 estimate: 8 hours · Begins immediately after Step 1 review*
*Depends on: CanvasViewport.tsx (Step 1) · useGesture.ts · CANVAS_WIDTH constant*
