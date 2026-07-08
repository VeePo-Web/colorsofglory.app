import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Glow } from "@/components/ui/glow";

/**
 * COG design-system showcase — a single-source visual reference for the A1
 * foundation. Standalone and unrouted (A5/app-shell may mount it at /styleguide
 * later); import it anywhere to eyeball the tokens, type ramp, primitives,
 * signature glow, and collaborator/aurora colors. Everything here is driven by
 * `var(--cog-*)` tokens — no raw hex — so it doubles as a drift canary.
 */

const Swatch = ({ token, label }: { token: string; label: string }) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="h-14 w-full rounded-card border border-[var(--cog-border)]"
      style={{ background: `var(${token})` }}
    />
    <span className="text-[11px] text-[var(--cog-warm-gray)]">{label}</span>
    <code className="text-[10px] text-[var(--cog-muted)]">{token}</code>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <h2 className="font-display text-2xl text-[var(--cog-charcoal)]">{title}</h2>
    {children}
  </section>
);

export function DesignSystemShowcase() {
  return (
    <div className="relative mx-auto min-h-screen max-w-[var(--max-w-app)] bg-[var(--cog-cream)] px-5 py-10">
      <Glow />
      <div className="relative flex flex-col gap-12">
        <header className="flex flex-col gap-1">
          <span className="text-[var(--t-eyebrow)] uppercase tracking-[0.26em] text-[var(--cog-gold)]">
            Colors of Glory
          </span>
          <h1 className="font-display text-4xl text-[var(--cog-charcoal)]">Design System</h1>
          <p className="text-sm text-[var(--cog-warm-gray)]">
            The living foundation — tokens, type, primitives, motion.
          </p>
        </header>

        <Section title="Palette">
          <div className="grid grid-cols-3 gap-4">
            <Swatch token="--cog-cream" label="Cream" />
            <Swatch token="--cog-cream-light" label="Cream light" />
            <Swatch token="--cog-cream-dark" label="Cream dark" />
            <Swatch token="--cog-charcoal" label="Charcoal" />
            <Swatch token="--cog-warm-gray" label="Warm gray" />
            <Swatch token="--cog-muted" label="Muted" />
            <Swatch token="--cog-gold" label="Gold" />
            <Swatch token="--cog-gold-light" label="Gold light" />
            <Swatch token="--cog-gold-pale" label="Gold pale" />
          </div>
        </Section>

        <Section title="Aurora — collaborator identity">
          <div className="grid grid-cols-4 gap-4">
            <Swatch token="--cog-aurora-teal" label="Teal" />
            <Swatch token="--cog-aurora-gold" label="Gold" />
            <Swatch token="--cog-aurora-purple" label="Purple" />
            <Swatch token="--cog-aurora-rose" label="Rose" />
          </div>
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-4 w-4 rounded-chip"
              style={{ background: "var(--cog-record-red)" }}
            />
            <span className="text-sm text-[var(--cog-warm-gray)]">
              Recording red — <code className="text-[var(--cog-muted)]">--cog-record-red</code>
            </span>
          </div>
        </Section>

        <Section title="Type ramp">
          <div className="flex flex-col gap-2">
            <p className="font-display text-4xl text-[var(--cog-charcoal)]">Song Title — Playfair</p>
            <p className="font-display text-2xl text-[var(--cog-charcoal)]">Section head — Playfair</p>
            <p className="font-sans text-base text-[var(--cog-charcoal)]">
              Body / lyrics — Inter. Everything for this song stays connected here.
            </p>
            <p className="text-[var(--t-eyebrow)] uppercase tracking-[0.26em] text-[var(--cog-warm-gray)]">
              Eyebrow label
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary CTA</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </Section>

        <Section title="Cards & chord chips">
          <Card>
            <CardHeader>
              <CardTitle>Verse 1</CardTitle>
              <CardDescription>A card at 16px radius on cream-light.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Badge variant="chord">C</Badge>
              <Badge variant="chord">G</Badge>
              <Badge variant="chord">Am</Badge>
              <Badge variant="chord">F</Badge>
            </CardContent>
          </Card>
        </Section>

        <Section title="Input">
          <Input placeholder="Name your song…" />
        </Section>

        <Section title="Signature glow">
          <div className="relative h-40 overflow-hidden rounded-card border border-[var(--cog-border)] bg-[var(--cog-cream)]">
            <Glow />
            <div className="relative flex h-full items-center justify-center">
              <span className="font-display text-xl text-[var(--cog-charcoal)]">.cog-glow / &lt;Glow /&gt;</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

export default DesignSystemShowcase;
