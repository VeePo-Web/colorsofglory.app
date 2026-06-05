# Feature 1 — Song Whiteboard Canvas
## Core Tree System · MVP Specification
## Compiled from 18 decision questions · 2026-06-04

---

## NORTH STAR

> The Canvas IS the song. Every idea lives here. Nothing is deleted. The songwriter moves ideas from unfiltered left to curated right — and the song takes shape spatially, not linearly.

---

## LOCKED DECISIONS (18 questions answered)

| Decision | Choice |
|----------|--------|
| Default landing when opening a song | Canvas opens immediately — Song Workspace hub is replaced |
| Entry point from lyrics editor | Both: Canvas card on workspace + 'Open in Canvas' from lyrics |
| First-time canvas experience | Large centered prompt with 3 chips (Hum / Write / Add chords) |
| Card navigation | Two-finger pan, pinch-to-zoom (0.5× to 2×), tap to place |
| Tree transfer method | Drag across the center divider |
| After drag to Final | Original stays dimmed (40% opacity, "Used in Final"), Final has active copy |
| Card visual style | Same shape per content type, DIFFERENT COLOR = creator's aurora palette color |
| Live collaboration visual | Colored cursor dots per collaborator |
| 50+ card overflow | Cluster view grouped by section label (Verse 1, Chorus, etc.) |
| Toolbar behavior | Context-sensitive: appears/expands based on selection state |
| Single card selected state | Card expands in-place, action buttons appear along its bottom edge |
| 2 cards selected = Compare Mode | Full-screen split A left / B right, Keep A / Keep B gold CTAs |
| Canvas relationship to tabs | Canvas replaces the tab view — it IS the song interior |
| Card color assignment | Collaborator's aurora color (not content type) |
| MVP must include | Base canvas + Ideas/Final trees + drag transfer + hum capture + collaborator colors |
| MVP excludes (V2) | Compare Mode, Listen Path, Arrange Mode |
| First-action prompt chips | [🎤 Hold to hum] [✏️ Write a lyric] [🎵 Add chords] |
| Section clustering threshold | Auto-clusters at ~10+ cards per section |

---

## ARCHITECTURE CHANGES

### `/songs/:id` now opens SongCanvasPage directly

```
Before: /songs/:id → SongWorkspacePage (module card hub)
After:  /songs/:id → SongCanvasPage   (the canvas itself)
```

The module card hub is removed. The SongWorkspacePage is deprecated.

### The Canvas IS the song room. Linear editors are panels inside it.

When a user taps a card on the canvas, they can expand it into a full panel:
- Lyric card → expands to lyrics editor
- Voice memo card → expands to voice memo detail
- Chord card → expands to chord chart

The SongTabBar (Lyrics/Voice/Chords/Notes/People) is replaced by the canvas.

---

## CANVAS LAYOUT

```
┌─────────────────────────────────────────────────────┐
│  ← Songs   [Crown icon]   [Section filter] [Share]  │ ← Top bar (sticky)
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│     IDEAS TREE           │     FINAL SONG           │
│                          │                          │
│  ┌─────────────────┐     │  ┌─────────────────┐    │
│  │ [Parker color]  │  ───│─>│ [Parker color]  │    │
│  │ Verse 1         │     │  │ Verse 1 (active)│    │
│  │ (dimmed 40%)    │     │  └─────────────────┘    │
│  │ ↳ Used in Final │     │                          │
│  └─────────────────┘     │  ┌─────────────────┐    │
│                          │  │ [Sarah color]   │    │
│  ┌─────────────────┐     │  │ Bridge idea     │    │
│  │ [Caleb color]   │     │  └─────────────────┘    │
│  │ Chord idea 🎵   │     │                          │
│  └─────────────────┘     │                          │
│                          │                          │
│  ┌─────────────────┐     │                          │
│  │ [Parker color]  │     │                          │
│  │ Voice memo 🎤   │     │                          │
│  │ 0:42            │     │                          │
│  └─────────────────┘     │                          │
│                          │                          │
├──────────────────────────┴──────────────────────────┤
│  [Context toolbar — appears on selection]            │ ← Bottom
└─────────────────────────────────────────────────────┘
         │                          │
    DRAG ZONE (dashed line when dragging active)
```

---

## CARD SYSTEM

### Five card types — same shape, creator color, different icon

```typescript
type CardType = 'lyric' | 'voice_memo' | 'hum' | 'chord' | 'note';

interface CanvasCard {
  id: string;
  type: CardType;
  tree: 'ideas' | 'final';
  position: { x: number; y: number };    // absolute on canvas
  content: {
    text?: string;                        // lyric / note content
    audioUrl?: string;                    // voice memo or hum
    duration?: number;                    // seconds
    chords?: string[];                    // chord sequence
    sectionLabel?: string;               // "Verse 1", "Chorus", etc.
  };
  creatorUserId: string;
  creatorColor: string;                   // aurora palette color
  creatorInitials: string;               // "PK", "SM", etc.
  isDimmedReference: boolean;            // true = original after being moved to Final
  clusterKey?: string;                   // section grouping key
  connections: string[];                 // IDs of connected cards
  createdAt: string;
  updatedAt: string;
}
```

### Card visual spec

```
Width: 200px
Min-height: 120px (expands with content)
Border-radius: 16px
Background: #FFFFFF
Border: 2px solid [creator aurora color]
Shadow: 0 4px 16px rgba([creator rgb], 0.20)

When dimmed (isDimmedReference = true):
  opacity: 0.40
  border: 1.5px dashed [creator color]
  Small label: "↳ Used in Final" (11px, creator color)

Icon (top-left corner, 24px circle, creator color bg at 15% opacity):
  lyric: FileText icon
  voice_memo: Mic icon, waveform bars preview
  hum: Mic icon + "Quick hum" label
  chord: Music icon, chord chips preview
  note: StickyNote icon

Creator dot (top-right corner):
  24px circle, creator aurora color fill
  initials text 9px white bold
```

### Card selected state (expands in-place)

```
When tapped:
  Card scales to 1.04, shadow deepens
  Action buttons appear along bottom edge:

  [Edit content] [Move → Final OR ← Ideas] [✕ Close]

  If type = voice_memo: [▶ Play] button also appears
  If type = hum: [▶ Play] + [Rename] buttons

  Animation: card height animates open (280ms cinematic)
  Tap outside: card collapses back (200ms)
```

---

## FIRST-TIME CANVAS PROMPT

Appears on first visit only (localStorage flag: `cog:canvas-first-visit-{songId}`).

```
┌──────────────────────────────────────────────┐
│                                              │
│   What's the first idea                     │ ← Playfair 700, 26px, centered
│   for this song?                            │
│                                              │
│   ┌────────────┐ ┌────────────┐ ┌─────────┐│
│   │ 🎤 Hold    │ │ ✏️ Write   │ │ 🎵 Add  ││
│   │  to hum   │ │  a lyric  │ │ chords  ││
│   └────────────┘ └────────────┘ └─────────┘│
│                                              │
└──────────────────────────────────────────────┘

Position: centered vertically, centered horizontally
Background: rgba(255,255,255,0.85), backdrop-blur
Border: 1.5px solid rgba(181,147,90,0.25)
Border-radius: 24px

On chip tap:
  [Hold to hum] → starts HumCapture mode, dismisses prompt
  [Write a lyric] → creates a new LyricCard at center, opens expanded edit
  [Add chords] → creates a new ChordCard at center, opens expanded edit
```

---

## HOLD-TO-RECORD HUM CAPTURE

The signature feature. Triggered from:
1. "Hold to hum" chip in first-action prompt
2. Long-press anywhere on empty canvas (500ms)
3. "🎤" button in context-sensitive toolbar

```
Interaction sequence:

1. Long-press on canvas (500ms threshold)
   → pulse ring animation expands from touch point
   → HapticFeedback.medium() on supported devices
   
2. MediaRecorder.start() (mic permission requested if not granted)
   → While recording: animated waveform bars at touch position
   → Red "recording" indicator in top bar
   → Release to stop, or hold for up to 60s
   
3. On release:
   → Recording stops
   → HumCard appears at the long-press position
   → Card shows waveform preview + "0:42" duration
   → Card auto-enters edit mode (title field focused)

4. HumCard default title: "Hum #{count}"
   User can rename immediately or tap close

HumCard is always in IDEAS TREE on creation.
Creator color = current user's aurora color.
```

---

## DRAG TRANSFER (Ideas → Final)

```
Drag threshold: 60px horizontal movement toward divider

During drag:
  Card lifts: scale(1.04), shadow deepens, opacity 1.0
  Divider appears: dashed gold line between trees
  Drop zone highlights: Final tree pulses with rgba(181,147,90,0.08) bg

On drop in Final:
  Original card: opacity → 0.40, border → dashed, label "↳ Used in Final" appears
  New card in Final: slides in from right, scale 0.95 → 1.0, 280ms spring

On drag back from Final → Ideas:
  Final card: disappears (slides out)
  Original in Ideas: opacity → 1.0, dashed border → solid, label disappears
  Undo available for 8 seconds via top bar notification

Snap-to-grid: 8px grid on release
```

---

## SECTION CLUSTERING

When a section has 10+ cards in the Ideas Tree:

```
Auto-cluster trigger: >= 10 cards with the same sectionLabel

Clustered appearance:
  ┌─────────────────────────────────┐
  │ ▶ Verse 1          (14 ideas)  │ ← Inter 600, tappable
  │   [3 small preview cards]      │ ← first 3 visible
  └─────────────────────────────────┘

On tap: cluster expands showing all cards
On tap collapse button: returns to collapsed state

Cluster header: section label + count badge (amber)
Cluster is draggable as a unit
```

---

## COLLABORATOR CURSOR DOTS

Real-time via Supabase Realtime channel `canvas:{songId}`.

```typescript
// Broadcast on every canvas pan/zoom/interaction
supabase.channel(`canvas:${songId}`)
  .on('broadcast', { event: 'cursor' }, ({ payload }) => {
    updateCursorPosition(payload.userId, payload.x, payload.y);
  })
  .subscribe();

// Each user broadcasts their canvas viewport center every 200ms while active
// Throttled, stops when idle for 3 seconds
```

```
Cursor dot visual:
  24px circle, user's aurora color, white border 2px
  User's initials centered (9px white bold)
  Name tooltip appears on hover (desktop only)
  
  Animated: slides smoothly between positions (lerp, 150ms)
  Fades out after 3s of no movement
  
  Limit: max 8 concurrent cursor dots shown (beyond = hidden)
```

---

## CONTEXT-SENSITIVE TOOLBAR

The toolbar has three states:

### State 1: Nothing selected
```
No toolbar shown. Only the top bar is visible.
(Canvas feels maximally clean)
```

### State 2: One card selected (card expanded in-place)
Action buttons along the card's bottom edge:
```
[✏️ Edit] [→ Final / ← Ideas] [🔗 Connect] [✕]
(if voice/hum): [▶ Play]
```

### State 3: Two cards selected
A floating pill appears ABOVE the second selected card:
```
[⟺ Compare] [⊕ Merge]  
```
Tapping Compare → enters Compare Mode (V2 for now, shows "Coming soon" toast)
Tapping Merge → merges cards (V2)

### State 4: Card being dragged across divider
```
Divider line appears (dashed gold)
Drop zone highlights on the target tree
```

---

## CANVAS PERFORMANCE REQUIREMENTS

- Pan/zoom: 60fps minimum on iPhone 12+
- Never re-render cards during pan — only the viewport container transforms
- Cards use `position: absolute` with `left/top` from stored position
- `requestAnimationFrame` gate on all pan/zoom updates
- `will-change: transform` on the canvas container only (removed after pan stops)
- Max 200 cards before virtualization needed (estimate per song)

---

## MVP BUILD ORDER

| Step | Task | Estimate |
|------|------|---------|
| 1 | `CanvasViewport.tsx` — pan/zoom container with touch gestures | 4h |
| 2 | `CardShell.tsx` — card base (shape, creator color, icon, dimmed state) | 2h |
| 3 | `LyricCard`, `VoiceMemoCard`, `HumCard`, `ChordCard`, `NoteCard` | 3h |
| 4 | Ideas/Final tree layout (two columns, drag zone) | 2h |
| 5 | Drag transfer (card cross-divider, dim original, animate to Final) | 3h |
| 6 | `FirstActionPrompt.tsx` — 3 chips, first-visit detection | 1h |
| 7 | Hold-to-record hum on canvas (MediaRecorder + HumCard creation) | 3h |
| 8 | Creator aurora colors (assign from user ID, apply to card) | 1h |
| 9 | Card expand in-place + action buttons | 2h |
| 10 | Collaborator cursor dots (Supabase Realtime broadcast) | 2h |
| 11 | Section clustering (auto-group at 10+ cards) | 2h |
| 12 | Wire `/songs/:id` → SongCanvasPage (replace hub) | 1h |

**Total MVP estimate: ~26 hours**

---

## WHAT NOT TO BUILD (V2)

- Compare Mode (full-screen A/B split)
- Listen Path (sequential playback)
- Arrange Mode (drag-sort final order)
- Merge/Splice
- Line-level suggestions
- Story/Scripture zone
- Owner review queue
- Version history scrubber on canvas

---

*Spec finalized: 2026-06-04 · Ready to build Step 1 (CanvasViewport)*
