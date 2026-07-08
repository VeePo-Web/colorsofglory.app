# Colors of Glory — Design System

The living reference for the A1 visual foundation. Everything below is owned by the
design-system layer and single-sourced. Feature screens **consume** these tokens and
primitives; they never redefine colors, fonts, or motion locally.

> Visual demo: [`src/components/ui/DesignSystemShowcase.tsx`](../src/components/ui/DesignSystemShowcase.tsx)
> — a standalone, token-driven component rendering every item on this page. Mount it
> anywhere (A5 may route it at `/styleguide`).

---

## Single source of truth

| Concern | Source of truth |
|---|---|
| Palette, radius, motion, frame tokens | [`src/styles/tokens.css`](../src/styles/tokens.css) |
| shadcn HSL bridge (`--background`, `--gold-warm`, …) | [`src/index.css`](../src/index.css) |
| Tailwind token wiring (fonts, radius, shadows) | [`tailwind.config.ts`](../tailwind.config.ts) |
| Framer-motion variants | [`src/lib/motion/variants.ts`](../src/lib/motion/variants.ts) |
| Branded primitives | `src/components/ui/**` |

**Rule:** raw brand hex is legal **only** in `tokens.css`. Everywhere in the foundation
lane, reference `var(--cog-*)` or a Tailwind token. Enforced by
[`src/test/design-drift-guard.test.ts`](../src/test/design-drift-guard.test.ts).

---

## Color tokens

### Backgrounds
- `--cog-cream` `#F5F0E8` — primary background
- `--cog-cream-light` `#FAF7F2` — elevated card / surface
- `--cog-cream-dark` `#EDE7DA` — subtle dividers

### Text
- `--cog-charcoal` `#1C1A17` — primary text
- `--cog-warm-gray` `#6B6459` — secondary / metadata
- `--cog-muted` `#A09689` — placeholder / disabled

### Gold (earned — CTAs, active borders, links, crown, selected only)
- `--cog-gold` `#B8953A` · `--cog-gold-light` `#D4AE5C` · `--cog-gold-pale` `#E8D5A0` · `--cog-gold-alt` `#B77722`
- Glow: `--cog-gold-glow` (0.15) · `--cog-gold-glow-18` (0.18)
- **Alpha ladder** (use instead of raw `rgba(184,149,58,x)`):
  `--cog-gold-a04 / a10 / a12 / a15 / a25 / a30 / a45`

### Recording & Aurora identity
- `--cog-record-red` `#E05440` — recording active state **only**, never a CTA
- Collaborator aurora: `--cog-aurora-teal #53AB8B` · `--cog-aurora-gold #D4AE5C` · `--cog-aurora-purple #8070C4` · `--cog-aurora-rose #C26A95`

### Borders & elevation
- `--cog-border` · `--cog-border-light` · `--cog-border-gold`
- `--cog-shadow-card` · `--cog-shadow-sm` · `--cog-shadow-fab` (Tailwind: `shadow-cog-card / cog-sm / cog-fab`)

---

## Typography

- **Titles / headings:** Playfair Display (self-hosted woff2, weights 600/700) — Tailwind `font-display` or `font-serif`.
- **Body / UI:** Inter variable (self-hosted, weights 100–900) — Tailwind `font-sans`.
- Fonts are self-hosted in [`public/fonts/`](../public/fonts) with `@font-face` + `font-display: swap`
  in `tokens.css`, and preloaded in `index.html`. **No CDN** — offline / PWA / CSP-safe.
- Ramp: `--t-song-title` (clamp) · `--t-section-head` · `--t-body` · `--t-label` · `--t-eyebrow`.

Typography **is** the hierarchy — no decorative dividers, no colored section headers.

---

## Radius & elevation

- `--radius-card` 16px · `--radius-card-lg` 20px · `--radius-chip` / `--radius-pill` 9999px
- Tailwind: `rounded-card`, `rounded-card-lg`, `rounded-chip`, `rounded-pill`.
- Cards render 16–20px; primary CTAs and chord chips are pills.

---

## Motion (CLAUDE.md §2.5)

- Easing: `--cog-ease` (standard) · `--cog-ease-reveal` (entrance)
- Durations: `--dur-instant 90` · `--dur-fast 150` · `--dur-base 250` · `--dur-slow 400` · `--dur-modal 600`
- JS variants ([`src/lib/motion/variants.ts`](../src/lib/motion/variants.ts)):
  `cardEntrance`, `pageSlideIn` / `pageSlideOut`, `sheetIn`, `stagger`, `buttonPress`.
  These mirror the CSS entrance classes (`.cog-page-enter`, `.cog-sheet-enter`, `.cog-stagger`) so the two systems agree.

---

## Signature effects

- **Glow** — `.cog-glow` class **or** [`<Glow />`](../src/components/ui/glow.tsx) (single source: `tokens.css`).
  `radial-gradient(ellipse 60% 40% at 50% 85%, var(--cog-gold-glow-18) 0%, transparent 70%)`.
- **Frame:** `--max-w-app` 430px cap (390px design baseline).
- **Safe area:** `.pb-safe` / `.pt-safe`.

---

## Branded primitives

| Primitive | Brand behavior |
|---|---|
| `Button` | `default` = gold pill (white text); `link` = gold; gold focus ring; `active:scale-0.97`. `outline`/`ghost`/`secondary`/`editorial` preserved. |
| `Card` | Cream-light surface, 16px radius, token border + `shadow-cog-card`, gold hover border. |
| `Input` / `Textarea` | Gold focus ring (`--cog-gold-a45`) + gold focus border. |
| `Badge` | Added `chord` variant — gold-pale pill chord chip. |

---

## Drift guard

`src/test/design-drift-guard.test.ts` fails the build if a raw brand hex appears
anywhere in the foundation lane (`src/components/ui`, `src/lib/motion`, `src/styles`)
outside `tokens.css`. Run with `npm test`.

**Known debt:** the wider app (feature screens) still carries legacy raw hex pending the
cross-lane purge (A1 Step 6). Widen the guard's `SCAN_DIRS` as those files are converted
to tokens.
