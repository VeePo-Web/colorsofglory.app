# CANVAS — UI / UX PATTERNS DOSSIER
## Research-only · interaction + visual craft · gift to the Canvas lane
## Companion to [CANVAS-VOC-AND-UX-DOSSIER.md](./CANVAS-VOC-AND-UX-DOSSIER.md) (strategy) and [VOICE-STACKING-DEEP-DIVE.md](./VOICE-STACKING-DEEP-DIVE.md) (#1 feature)

> Research-only. I do not build in the Canvas lane. This dossier is the *how-it-feels* layer: the actual
> interface mechanics — card system, gestures, detail sheets, motion. Sourced; Reddit/FB uncrawlable →
> Hypotheses. Build decisions are the Canvas Architect's.

---

## 1. THE INTERFACE THESIS (one line)

**Opinionated structure + direct manipulation + bottom sheets — never a free-form infinite board.** Every
world-class reference that *wins* with non-technical creatives is the structured/opinionated one; every one
that overwhelms is the free-form one.

- Whimsical wins because it is *"clean, fast, opinionated… faster and more structured than a free-form board… very little learning curve."* ([Storyflow](https://storyflow.so/blog/best-milanote-alternatives-2026))
- This is the third independent confirmation (with FigJam>Miro and the joodaloop canvas critique) that **structure beats freedom** for this audience. Hold it.

---

## 2. THE CARD + TREE VISUAL SYSTEM (steal vs avoid)

Mind-map UI canon maps almost 1:1 onto COG's root-song model:
- **Tree, single-parent, root-outward flow:** *"a tree structure with transparent, directed flows from the root outward… all nodes have only one parent (except the root)."* ([Muzli/Medium](https://medium.muz.li/mind-map-within-the-walls-of-ui-ux-cf16e594ca12)) → COG's root song = the one root; every idea card has one parent. Don't build a many-to-many graph.
- **Limit text per card:** *"limit the amount of text on each branch… use keywords or short phrases, not long descriptions… keeps the map clean and accessible."* ([same](https://medium.muz.li/mind-map-within-the-walls-of-ui-ux-cf16e594ca12)) → idea cards show a *title/snippet*, not full lyrics. Detail lives in the sheet (§4).
- **Color = instant categorization:** *"Colors help to categorize and prioritize… differentiate themes at a glance."* → COG's **contributor color** does double duty (authorship + scannability). Pair with name/initials (never color alone).

| Reference | STEAL | AVOID |
|---|---|---|
| **MindNode** ([G2](https://www.g2.com/compare/mindnode-vs-whimsical)) | "Beautiful native Apple experience," **fast Quick Entry capture**, fluid tree | Apple-only, **no collaboration** — COG's exact gap to beat |
| **Milanote** ([Storyflow](https://storyflow.so/blog/best-milanote-alternatives-2026)) | Rich multi-content cards ("cards-on-a-table"), creative-sanctuary calm | Its **spatial moodboard** paradigm (relies on remembered positions) — COG is a *tree*, not a board |
| **Whimsical** ([Storyflow](https://storyflow.so/blog/best-milanote-alternatives-2026)) | **Opinionated, fast, low-learning-curve**; structured > free-form | Diagram/flowchart framing — COG is song-native |

---

## 3. THE GESTURE / DIRECT-MANIPULATION LAYER (CapCut lessons — with one deliberate divergence)

CapCut is the mobile direct-manipulation gold standard:
- *"Drag-and-drop, gesture-driven trimming, real-time preview… significantly reduce cognitive load."* ([Cardsrealm](https://cardsrealm.com/en-us/articles/reviewing-capcuts-user-interface-intuitive-design-for-seamless-editing))
- Direct manipulation = *"select segments and drag edges"* with immediate visual response. Color-coded tracks for instant orientation. ([Cardsrealm](https://cardsrealm.com/en-us/articles/reviewing-capcuts-user-interface-intuitive-design-for-seamless-editing))

**STEAL:** tap a card → it lifts and responds instantly; drag with real-time feedback; color-coding for orientation; "feels like touching the content," low cognitive load.

**DELIBERATE DIVERGENCE (critical):** CapCut leans on **pinch-to-zoom the timeline** as primary navigation.
COG must **NOT** copy that on mobile — pinch/pan is touch's worst interaction for a canvas ([joodaloop](https://joodaloop.com/canvas-ui/)). Use **semantic zoom / zone-jump / tap-a-section-to-go-there** instead. Reserve pinch-zoom for tablet/desktop. This is the single most important mobile UI decision.

---

## 4. CARD DETAIL = BOTTOM SHEET (Apple HIG spec, ready to implement)

Tapping a card opens a **bottom sheet**, not a modal or a navigation. HIG canon:
- A sheet *"helps people perform a scoped task closely related to their current context"* — exactly an idea card's detail/edit. ([Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets))
- **Detents:** medium ≈ half-height, large = full. Open at medium so the canvas stays partly visible (orientation). ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/sheets), [NN/g](https://www.nngroup.com/articles/bottom-sheet/))
- **Drag handle (grabber):** thin rounded bar; drag to resize/dismiss; also provide an explicit close (not swipe-only). ([NN/g](https://www.nngroup.com/articles/bottom-sheet/))
- **Long-press a card → context actions** (the Reply/Forward/Delete pattern) → COG: "Play / Add to Final / Record over / Move to zone." ([NN/g](https://www.nngroup.com/articles/bottom-sheet/))
- **Accessibility (mandatory):** move focus into the sheet on open, **trap focus**, **return focus on close**, make background **inert**, keep background **partially visible**, and **provide a single-pointer alternative for every drag action**. ([TestParty](https://testparty.ai/blog/mobile-accessibility-patterns), [Material 3](https://m3.material.io/components/bottom-sheets/accessibility))

(Note: COG's Version History page I shipped already uses this sheet + focus-management pattern — reuse it.)

---

## 5. MOTION + VISUAL CRAFT
- Calm confirmation, not entertainment: tap→lift 2–4px + focus ring; new card scales 0.98→1 with a soft gold border flash; connector draws subtly; "Saved," never confetti (COG tokens `--dur-*`, `--cog-ease-*`; reduced-motion path on all).
- Color discipline: contributor color for authorship/scannability only; **gold reserved** for action/selection/keeper; cream surfaces, charcoal text, soft tactile cards — not a rainbow.
- Lo-Fi over Hi-Fi early: *"during early phases, create Lo-Fi maps instead of detailing"* ([Muzli](https://medium.muz.li/mind-map-within-the-walls-of-ui-ux-cf16e594ca12)) → cards should feel light/sketch-like to capture, refine later.

---

## 6. UI ANTI-PATTERNS (what to avoid)
- Free-form infinite board as the model (use the tree).
- **Pinch/pan as primary mobile nav** (use semantic zoom/zone-jump).
- Long text on cards (keyword/snippet; detail in the sheet).
- Many-to-many node/edge graph or technical "node/edge/graph" chrome.
- Modals over bottom sheets; full-screen takeovers for a card edit.
- Color-only authorship (always pair with name/initials).
- Position-dependent spatial memory (anchor to the tree, not remembered coordinates).

---

## 7. JOBS & TRIGGERS (UI-level)
- **When** I tap an idea, **I want** a calm sheet with its detail + the 2–3 actions that matter, **so I** never leave the song. → card → bottom sheet (medium detent).
- **When** the board is busy, **I want** to jump to a section by tapping it, **so I** never fight pinch-zoom. → semantic zoom.
- **When** I add an idea, **I want** it to appear instantly and lightly, **so** momentum survives. → optimistic create, Lo-Fi card.

---

## 8. HYPOTHESES (Reddit/FB uncrawlable → confirm manually)
- **H1**: Non-technical worship volunteers complete a card edit faster with a bottom sheet than a full-screen editor. → usability test.
- **H2**: Tap-to-jump (semantic zoom) outperforms pinch-pan for navigating a 10-card song on mobile. → A/B prototype test.
- **H3**: Contributor-color + name reads as "who" faster than avatars alone in a busy room. → quick test.

---

## 9. SOURCES
- [Muzli — Mind Map within UI/UX (tree, limit text, color)](https://medium.muz.li/mind-map-within-the-walls-of-ui-ux-cf16e594ca12) · [Storyflow — Milanote/MindNode/Whimsical compared](https://storyflow.so/blog/best-milanote-alternatives-2026) · [G2 — MindNode vs Whimsical](https://www.g2.com/compare/mindnode-vs-whimsical)
- [Cardsrealm — CapCut UI review (direct manipulation, low cognitive load)](https://cardsrealm.com/en-us/articles/reviewing-capcuts-user-interface-intuitive-design-for-seamless-editing)
- [Apple HIG — Sheets (detents, grabber)](https://developer.apple.com/design/human-interface-guidelines/sheets) · [NN/g — Bottom Sheets guidelines](https://www.nngroup.com/articles/bottom-sheet/) · [TestParty — mobile sheet/gesture accessibility](https://testparty.ai/blog/mobile-accessibility-patterns) · [Material 3 — bottom sheet a11y](https://m3.material.io/components/bottom-sheets/accessibility)
- [joodaloop — Canvas UIs critical review (mobile pinch/pan failure)](https://joodaloop.com/canvas-ui/)
- **Could NOT verify (agent-blocked):** Reddit, Facebook worship/songwriting groups → §8.
