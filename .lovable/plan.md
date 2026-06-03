# Pricing hero — Brunson-style scannable copy, blurred image backdrop

## Copy rewrite

Keep the same promise (honest pricing, footage that earns it, $600 start, Alberta) but cut it into Russell Brunson cadence: short punchy lines, one idea per line, a hook → stakes → resolution rhythm. Scannable on a phone in two seconds.

**New hero copy:**

```
h1:    Most drone footage
       just fills space.
       Ours moves people.

meta:  Honest packages from $600 · Alberta
```

- Line 1 is the hook (problem).
- Line 2 is the punch (us, different).
- Subhead collapses price + region into one scannable meta line — no two-sentence lede.

Total: 12 words in the headline, 6 in the meta. Down from the current 11 / 6 but with a real story beat instead of two parallel statements.

## Blurred background image

Mirror the About hero pattern (dark cinematic section, image fills, gradient overlay, text bottom-left) but with the image **blurred** so it reads as atmosphere, not subject — the headline stays the hero.

Use `src/assets/hero-aerial.jpg` (already in the project, aerial Alberta landscape — on-brand and avoids loading a new asset). Lazy-decoded, explicit width/height, no video.

Structure:

```text
<section relative min-h-[100svh] overflow-hidden bg-[#0a0a0a]>
  <img src=hero-aerial.jpg
       class="absolute inset-0 w-full h-full object-cover
              scale-110 blur-lg opacity-70"
       loading="eager" fetchpriority="high" decoding="async"
       width=1620 height=1080 alt="" aria-hidden />
  <div absolute-inset gradient:
       linear-gradient(to top,
         rgba(8,8,8,0.92) 0%,
         rgba(8,8,8,0.55) 40%,
         rgba(8,8,8,0.35) 100%) />
  <div container-x relative, bottom-aligned like About>
     <h1 t-display-2 text-background ...>...</h1>
     <p t-meta text-background/60 ...>...</p>
  </div>
</section>
```

`scale-110` hides the blur edge bleed. `blur-lg` (16px) is enough atmosphere without becoming mush. Dark gradient ensures WCAG AA on the white headline regardless of image region.

## Performance notes (fantasy.co bar)

- Single static JPEG, no video — LCP candidate is the headline text node; image decodes off the critical path because text paints first.
- `loading="eager"` + `fetchpriority="high"` on the bg image so the blur is present at first paint (avoids a flash of black).
- Blur is a CSS filter on a static element — composited once, no per-frame cost; mobile parallax stays on the text wrapper only, so the blurred image never re-rasterizes during scroll.
- Explicit width/height = zero CLS. Gradient overlay is a single paint layer.
- No new IntersectionObservers, no new effects. Existing mobile parallax `useEffect` stays.

## Files touched

- `src/pages/Pricing.tsx` — rewrite `PricingHero` only. Update text content, wrap the section in the dark image-backed shell, switch text colors to `text-background`. Keep parallax ref, keep `animate-fade-up`, keep `min-h-[100svh]` mobile / `md:pt-48 lg:pt-56` desktop padding pattern.

Nothing else changes. Differentiators, ProcessStrip, Packages, Add-ons, Guarantee, FAQ, CTA, schema all untouched.
