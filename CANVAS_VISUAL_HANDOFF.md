# CANVAS VISUAL HANDOFF — the Glory Spectrum

**From:** Canvas visual identity pass · 2026-07-08
**Companions:** `CANVAS_COLLABORATION_HANDOFF.md` (data/interaction), `docs/CANVAS-RENDER-CONTRACT.md`

---

## 1. The visual system

The canvas's color language grows from one existing brand moment: the 6-digit
auth code (`src/components/cog/OTPInput.tsx`), where each digit "powers up" a
cell in a warmed ROYGBV jewel tone with the brand gold as the Y slot. That
moment is now a workspace: **soft spectral color says what kind of creative
material you're looking at; gold says the system is speaking; creator colors
say who.** All of it lives as tokens in **`src/lib/canvas/glorySpectrum.ts`**
— never one-off hex values.

### Color meanings

| Token | Hue | Means |
|---|---|---|
| `TYPE_TONE.lyric` | rose `#C94F4F` | lyric fragments (the words) |
| `TYPE_TONE.voice` | gold `#B8953A` | recorded takes (the golden center) |
| `TYPE_TONE.hum` | amber `#CE7A3B` | raw hums (warm, unfinished) |
| `TYPE_TONE.chord` | pale gold `#C4A75B` | the harmonic bed |
| `TYPE_TONE.scripture` | sage `#6E9B63` | meaning anchors |
| `TYPE_TONE.note` | parchment `#8B8272` | free thoughts (stays humble) |
| `PLAYBACK_TONE` | dusty cobalt `#5C7FB8` | listen path, now-sounding ring (soft, never corporate) |
| `REVIEW_TONE` | amber | pending review (attention, never alarm) |
| `COMPARE_A/B_TONE` | rose / violet | the two takes in Compare mode |

Each tone ships five registers (`base/dark/bg/glow/dim`); `dark` values pass
≥4.5:1 on the card surface `#FFFCF7`.

### Where color lives on a card (restraint rules)
- **Stripe + icon chip + eyebrow** = TYPE tone. That's ALL the resting color a
  card carries — resting borders are quiet cream, so forty cards never read as
  a rainbow.
- **Creator dot + name** = creator aurora color (WHO), unchanged.
- **Waveforms & chord chips** = locked gold tokens, always.
- **Rings** = system verbs only: gold (selected/merge), cobalt (playing).

### Composite recipes (in glorySpectrum.ts)
- `GLORY_SELECTED_SHADOW` — gold ring + faint spectral bloom (rose left, cobalt
  right, sage above) leaking from a selected card's edges.
- `GLORY_PLAYING_SHADOW` — soft cobalt halo on the sounding card.
- `GLORY_FIELD_BACKGROUND` — the room's light: five ultra-soft radial washes
  around a gold center (CanvasViewport backdrop, one div, breathes on 14s).
- `GLORY_CROWN_GRADIENT` — the OTP row as a 3px bar: the root song card wears
  the whole spectrum; every card below carries one tone of it.
- `GLORY_RECORDING_AURA` — gold/amber/rose light behind a live waveform.

### Structural light
- **`ZoneFields.tsx`** — two whisper fields behind the trees: Ideas basks in
  amber morning light, Final rests on gold-into-sage with a **luminous rail**
  down its left edge. Dragging a card toward Final brightens the field and
  rail — the drop area invites (fed by the same `isDropActive`/`dragZone`
  signal as the divider).

## 2. Motion states (all reduced-motion safe)

| State | Motion |
|---|---|
| Room light / empty-state aura | `cog-glory-breathe` — opacity 1→0.82, 14s |
| Sounding waveform | `cog-wave-play` — per-bar scaleY breathe, 1.1s, staggered |
| Recording | `cog-rec-aura` — aura scale/opacity pulse behind the live waveform, 2.6s |
| Selected card | ring + spectral bloom via 200ms box-shadow transition |
| Dragged card | lift: scale 1.06 + 1.5° rotate + tone shadow (unchanged from interaction pass) |
| Drop target | ZoneFields border/glow 200–240ms ease-in |

Keyframes: `cog-wave-play` / `cog-glory-breathe` live in CanvasStage's single
injected `<style>`; `cog-rec-aura` is scoped inside RecordingSheet.

## 3. Capture → canvas continuity

The recording aura upgrades `RecordingSheet`, which is composed from the SAME
shared capture components (`CaptureSheetShell`, `RecordingWaveform`,
`CaptureStopButton`) used by global Capture mode — so recording feels
identical in both places. And ideas committed from Capture
(Say-It-Structured → `canvas_cards`) now hydrate straight onto the board (see
collab handoff §1), each wearing its type's glory tone on arrival.

## 4. Collaboration-ready visual hooks

- **Presence**: creator aurora dots/names on cards + header avatar stack (live).
- **Pending review**: amber `REVIEW_TONE` dot via the `cardAdornment` slot —
  comments should reuse the same slot with a small count badge in
  `PLAYBACK_TONE.bg`/charcoal.
- **Roles**: view-only renders the same visual system minus mutating verbs.
- **Attribution**: `contributionType` on every card maps 1:1 to a tone for a
  future credits ledger visualization.
- **Suggestions**: `COMPARE_A/B` two-tone is the visual grammar for "original
  vs proposed" — reuse it for line suggestions.

## 5. Remaining visual risks / follow-ups

1. Card action-row buttons are 44px in CANVAS space — at zoom <1 their
   effective size shrinks. The interaction fix (auto-zoom on select below 1.0)
   is filed in the collab handoff.
2. `SectionCluster` still renders in creator colors — restyle to the dominant
   TYPE tone when clusters get their next pass.
3. The demo board's `accent` values are stamped at module load; real identity
   colors resolve from the roster (already wired).
4. The glory field is tuned for cream; if a future theme darkens surfaces the
   wash opacities (0D–1A) will need a second calibration.
5. Status chips (`STATUS_COLORS`) predate the spectrum — they're warm and
   compliant but could consolidate into glorySpectrum tones later.
