# Colors of Glory — Song Whiteboard Canvas
## In-depth Implementation Plan
## Compiled from: Feature 4, 5, 7, 9, 10, 16, 20, 21, 22, 23, 24 spec PDFs

---

## NORTH STAR

The Song Whiteboard Canvas is the place where songs are built non-linearly before they become final. It is not a DAW. It is not a word processor. It is a **spatial songwriting room** — part cork board, part tape loop machine, part version control.

Every idea lives as a card. Cards connect into arrangements. The user can compare variants, merge fragments, sequence a listen path, and eventually drag everything into a final arrangement — all without losing any earlier ideas.

**Two trees, always visible:**
- **Ideas Tree** — unfiltered, raw, nothing deleted. The creative inbox.
- **Final Tree** — curated, arranged, the song as it actually is.

The user moves ideas from left to right. The app remembers everything.

---

## ROUTE

```
/songs/:id/canvas
```

Accessed from the Song Workspace hub via the **Canvas** module card (to be added in the next sprint after this plan is approved).

---

## PHASE 0 — Foundation (Week 1)

### 0.1 Canvas shell + pan/zoom viewport

**What it is:** An infinite-canvas SVG/div container with touch-drag pan and pinch-to-zoom.

**Implementation:**
```tsx
// src/components/canvas/CanvasViewport.tsx
// - useRef on a container div
// - Track touch/mouse position for pan (two-finger drag on mobile)
// - Pinch gesture for zoom (clamp: 0.5× min, 2× max)
// - transform: `translate(${panX}px, ${panY}px) scale(${zoom})`
// - will-change: transform for GPU compositing
// - Mobile: pointer events, not touch events (unified across iOS/Android)
```

**State shape:**
```ts
type ViewportState = {
  panX: number;
  panY: number;
  zoom: number; // 0.5 – 2.0
};
```

**Performance rules:**
- Never re-render every card on pan — pan only moves the container, not individual cards
- Only the container `transform` updates during pan/zoom (single DOM write per frame)
- Cards use `position: absolute` with `left/top` from their stored position
- `requestAnimationFrame` gate on all pan/zoom updates

### 0.2 Ideas Tree + Final Tree panels

**What they are:** Two vertical columns that organize cards.

```
┌─────────────────┬─────────────────┐
│   IDEAS TREE    │   FINAL TREE    │
│  (unfiltered)   │  (curated)      │
│                 │                 │
│  ┌─────────┐   │  ┌─────────┐   │
│  │ Idea 01 │   │  │ Verse 1 │   │
│  └─────────┘   │  └─────────┘   │
│  ┌─────────┐   │  ┌─────────┐   │
│  │ Idea 02 │   │  │ Chorus  │   │
│  └─────────┘   │  └─────────┘   │
│       ↓        │       ↓        │
│  Drag to right →  to finalize   │
└─────────────────┴─────────────────┘
```

**State shape:**
```ts
type TreeCard = {
  id: string;
  tree: "ideas" | "final";
  position: { x: number; y: number }; // absolute on canvas
  type: "lyric" | "voice-memo" | "chord" | "note" | "hum";
  content: {
    text?: string;
    audioUrl?: string;
    duration?: number;
    chords?: string[];
    sectionLabel?: string; // "Verse 1", "Chorus", "Bridge"
  };
  connections: string[]; // IDs of cards this connects to
  color?: string; // collaborator-assigned from aurora palette
  createdBy: string; // userId
  createdAt: string;
  status: "raw" | "pending-review" | "approved" | "rejected";
};
```

### 0.3 Card component system

Five card types, all with the same outer shell but different inner content:

**LyricCard** — contains lyrics text, section label above, chord chips above lines
**VoiceMemoCard** — waveform bars + play button + duration + name
**HumCard** — large play button (from hold-to-record), labeled "Quick hum" with timestamp
**ChordCard** — chord progression display, key, BPM
**NoteCard** — free text, small, like a sticky note

All cards:
- 200×140px default (expandable to 300×200px on tap)
- `border-radius: 16px`, cream-light background
- Gold border on selected state
- Drop shadow `0 4px 16px rgba(28,26,23,0.12)`
- Long-press or tap to select, drag to move
- Collaborator color dot in top-right corner

---

## PHASE 1 — Core interactions (Week 2)

### F1: Drag-to-move cards

```tsx
// Touch: onPointerDown → track pointer → onPointerMove → update card position → onPointerUp
// Snap to 8px grid on release (satisfying physical feel)
// During drag: z-index elevates, scale(1.04), shadow deepens
// Release: spring back to grid snap (cubic-bezier(0.34, 1.56, 0.64, 1), 200ms)
```

### F2: Hold-to-record hum (Feature 9)

**UX:** The user taps and holds the large gold mic button anywhere on the canvas. A ring pulse expands from center. On release, a new HumCard appears at the tap position.

```tsx
// Long press: 300ms threshold
// On start: show pulse rings (CSS animation), start MediaRecorder
// On end: stop recording, save to Supabase storage, create HumCard at tap position
// Permission: request mic only on first tap, explain "To record ideas directly to this song"
// Mic permission denied: show calm inline message, fallback to type-a-lyric
```

### F3: Connection lines between cards

Cards can be connected to show relationships (e.g., "Verse 1 leads to Chorus").

```tsx
// SVG <line> or <path> drawn between card center points
// Bezier curve, stroke: var(--cog-gold-pale), strokeWidth: 2
// Animated dash on hover
// Tap on connection line to remove it
// Cards in the same "listen path" use a thicker gold line
```

### F4: Move idea from Ideas Tree → Final Tree

**UX:** User drags a card from the left panel to the right panel. A drop target highlights in gold.

```tsx
// Detect when dragged card crosses the center divider
// On drop: animate to Final Tree position, update card.tree = "final"
// Toast: "Idea moved to your final arrangement"
// Undo available for 10 seconds
```

---

## PHASE 2 — Advanced features (Week 3)

### F5: Compare Mode (Feature 21)

**UX:** Two cards appear side-by-side with a vertical divider. User can play both alternately.

```
Chorus A                 vs                Chorus B
[You are my anchor...]        [In the stillness of...]
   ▶ Play A                                ▶ Play B
        
   [Keep A]                            [Keep B]
```

**Implementation:**
- Triggered by: selecting 2 cards → "Compare" action in context menu
- Full-screen overlay on top of canvas
- Both cards rendered at 50% width
- Audio plays one at a time (mutual exclusion)
- "Keep A" or "Keep B" moves the winner to Final Tree

### F6: Listen Path (Feature 20)

**UX:** User taps cards in sequence to define a playback order. Numbered badges appear on each card. A "Play path" button at bottom plays all audio in order.

```tsx
// Enter "path mode" via toolbar toggle
// Tap cards in order → numbered badge appears (1, 2, 3...)
// Animated line connects the path in order
// Play path: sequential audio playback with visual highlight
// Exit path mode: badges disappear, path is saved as a sequence
```

### F7: Merge/Splice (Feature 22)

**UX:** User selects 2 cards → "Merge" → a new combined card appears. The originals shrink and connect to the new card.

```tsx
// Merge: combine content from 2 lyric cards into one
// Both originals marked as "merged", dimmed but not deleted (Ideas Tree preserves them)
// New merged card inherits connections from both parents
// Visual: morph animation (both cards slide toward center, new card expands)
```

### F8: Line-level suggestions (Feature 19)

**UX:** A collaborator suggests a replacement for a single lyric line. The owner sees the suggestion inline with Accept/Reject buttons.

```tsx
// Suggestion card: small yellow-tinted card docked to the specific line
// Contains: suggested text, suggester avatar, timestamp
// Owner sees: "Parker suggests:" + text + [Accept] [Reject]
// Accept: replaces line, suggestion card disappears, activity logged
// Reject: suggestion card disappears with animation, activity logged
```

---

## PHASE 3 — Intelligence layer (Week 4)

### F9: Story/Scripture Zone (Feature 10)

**UX:** A designated zone on the canvas (bottom-right corner) for meaning, inspiration, and theology. Drag a "Scripture" card there or a "Story" card.

```
┌───────────────────────────────┐
│  MEANING ZONE                 │
│                               │
│  📖 Psalm 46:10               │
│  "Be still and know..."       │
│                               │
│  💭 Written after the miscar- │
│  riage. This song is for her. │
└───────────────────────────────┘
```

Cards in the Meaning Zone:
- **ScriptureCard** — Bible reference + verse text
- **StoryCard** — personal narrative/context
- **ThemeCard** — thematic keywords

These do not appear in exports, but ground the song spiritually.

### F10: Owner Review Queue (Feature 11)

**UX:** When collaborators add ideas, the owner sees a "Review" badge on the Ideas Tree. A swipe-up panel shows all pending ideas in a stack.

```tsx
// Review panel: slide-up from bottom
// Each card: swipe right = approve (moves to Final Tree), swipe left = reject
// Batch approve: "Approve all" gold button
// Approved ideas: confetti micro-animation, moved to canvas
// Rejected ideas: slide off, activity logged, collaborator notified
```

### F11: Version History on Canvas (Feature 24)

**UX:** A timeline scrubber at the top of the canvas. Drag left to see earlier states.

```
   [────────●───────────────] Now
    2 days ago            Just now
   
   "Sarah added Bridge idea"  ←  current position label
```

```tsx
// Snapshot stored in Supabase every 30 minutes of activity + on explicit save
// Canvas state serialized as JSON (all card positions, connections, content)
// Scrubbing: interpolate between snapshot states visually
// Restore: "Restore this version" button loads snapshot as current state
```

### F12: Final Arrangement Drag Mode (Feature 23)

**UX:** Special mode where Final Tree cards can be reordered by drag. The arrangement becomes the song order.

```tsx
// Toggle: "Arrange" button in toolbar
// Final Tree becomes a vertical drag-sortable list
// Cards shrink to list-item height (48px), showing just section label + type icon
// Drag handle appears on left
// Reorder updates the song structure
// "Export arrangement" button becomes active after ordering
```

---

## PHASE 4 — Canvas toolbar (Week 4–5)

A floating toolbar at the bottom of the canvas (above BottomNav if shown):

```
┌─────────────────────────────────────────────────────────────┐
│  ⊕ Add    🎤 Hum   ⚡ Compare   🔀 Path   📋 Arrange   ↩ Undo │
└─────────────────────────────────────────────────────────────┘
```

Each tool:
- **Add** → bottom sheet: choose Lyric / Voice / Chord / Note / Scripture
- **Hum** → triggers hold-to-record inline (no bottom sheet)
- **Compare** → activates Compare Mode (disabled unless 2 cards selected)
- **Path** → activates Listen Path mode
- **Arrange** → activates Final Arrangement Drag Mode
- **Undo** → undoes last action (move, delete, connect, merge)

Toolbar behavior:
- Hides when user is actively panning (to reveal canvas)
- Reappears after 800ms idle
- Never covers cards — floats above the canvas viewport

---

## DATA MODEL

### Supabase tables needed (Lovable's domain):

```sql
-- Canvas card (extends existing structure)
CREATE TABLE canvas_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  tree TEXT CHECK (tree IN ('ideas', 'final')) NOT NULL DEFAULT 'ideas',
  type TEXT CHECK (type IN ('lyric', 'voice-memo', 'hum', 'chord', 'note', 'scripture', 'story')) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
  connections TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('raw', 'pending-review', 'approved', 'rejected')) DEFAULT 'raw',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Canvas snapshots (version history)
CREATE TABLE canvas_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  snapshot_json JSONB NOT NULL, -- full canvas state
  label TEXT, -- "Sarah added Bridge idea", "Parker merged Verse 2"
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Listen paths
CREATE TABLE canvas_listen_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  card_sequence TEXT[] NOT NULL, -- ordered card IDs
  name TEXT DEFAULT 'Listen path',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Card suggestions (line-level)
CREATE TABLE card_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES canvas_cards(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  suggested_text TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  suggested_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## COMPONENT ARCHITECTURE

```
src/
  pages/
    SongCanvasPage.tsx              ← Main canvas route (/songs/:id/canvas)
  
  components/
    canvas/
      CanvasViewport.tsx            ← Pan/zoom infinite canvas shell
      CanvasToolbar.tsx             ← Bottom floating toolbar
      IdeasTree.tsx                 ← Left panel organizer
      FinalTree.tsx                 ← Right panel organizer
      ConnectionLines.tsx           ← SVG connection renderer
      
      cards/
        CardShell.tsx               ← Shared outer card (drag, select, shadow)
        LyricCard.tsx               ← Lyric text + section + chord chips
        VoiceMemoCard.tsx           ← Waveform + play + name
        HumCard.tsx                 ← Quick hum record/play
        ChordCard.tsx               ← Chord progression
        NoteCard.tsx                ← Free-text note
        ScriptureCard.tsx           ← Bible reference
      
      modes/
        CompareMode.tsx             ← Full-screen A vs B comparison
        ListenPath.tsx              ← Path recording + playback
        ArrangeMode.tsx             ← Final arrangement drag-sort
        ReviewQueue.tsx             ← Owner review swipe stack
      
      overlays/
        VersionScrubber.tsx         ← Timeline scrubber at top
        MeaningZone.tsx             ← Scripture/story drop target
        SuggestionDock.tsx          ← Line-level suggestion display

  stores/
    canvasStore.ts                  ← Zustand: cards, viewport, mode, selection
    audioStore.ts                   ← Zustand: playback state, active audio

  lib/
    canvas/
      snapshots.ts                  ← Serialize/deserialize canvas state
      gestures.ts                   ← Touch gesture detection utilities
      audio.ts                      ← MediaRecorder wrapper + Supabase upload
```

---

## BUILD SEQUENCE

| Week | Deliverable | Unblocks |
|------|------------|---------|
| **Week 1** | CanvasViewport + pan/zoom + basic card placement | All |
| **Week 1** | LyricCard + VoiceMemoCard + HumCard shells | F2, F3 |
| **Week 2** | Drag-to-move + Ideas/Final tree panels | F4 |
| **Week 2** | Hold-to-record hum (F2) | Audio features |
| **Week 2** | Connection lines (F3) | Listen Path |
| **Week 3** | Compare Mode (F5) | Variant testing |
| **Week 3** | Listen Path (F6) | Playback sequence |
| **Week 3** | Merge/Splice (F7) | Idea management |
| **Week 4** | Line-level suggestions (F8) | Collaboration |
| **Week 4** | Story/Scripture Zone (F9) | Ministry context |
| **Week 4** | Review Queue (F10) | Owner control |
| **Week 4** | Final Arrangement (F12) | Export |
| **Week 5** | Version History / Scrubber (F11) | Full undo/restore |
| **Week 5** | Canvas toolbar + all modes connected | Ship |

**Total: ~5 weeks for a shippable Canvas v1.**

---

## PERFORMANCE REQUIREMENTS ON CANVAS

- Pan/zoom: never drops below 60fps on iPhone 12+
- Card render: < 5ms per card update (avoid React reconciliation during drag)
- Audio playback: < 50ms latency from tap to sound
- Snapshot save: debounced 30s, non-blocking (background Supabase write)
- Max cards before virtualization needed: 200 (estimate per song)
- Touch: all gestures respond in < 16ms from touch start

---

## WHAT THIS IS NOT

- Not a DAW (no timeline, no tracks, no waveform editing)
- Not a word processor (no formatting, no fonts, no document structure)
- Not a whiteboard tool (no free drawing, no shapes, no pointer)
- Not a project manager (no due dates, no assigned tasks)

It is a **private songwriting room with spatial memory.** Everything in its right place.

---

*Plan prepared: 2026-06-03 | Next action: approve plan → begin Week 1 CanvasViewport*
