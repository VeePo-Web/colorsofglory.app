import { useEffect, useRef } from "react";
import PageShell from "@/components/fly4media/PageShell";
import { useReveal } from "@/components/fly4media/useReveal";
import PricingPackages from "@/components/fly4media/PricingPackages";
import PricingGuarantee from "@/components/fly4media/PricingGuarantee";
import PricingFAQ from "@/components/fly4media/PricingFAQ";
import CTA from "@/components/fly4media/CTA";
import heroAerial from "@/assets/hero-aerial.jpg";



/* ─── Data ───────────────────────────────────────────── */
const DIFFERENTIATORS = [
  {
    n: "01",
    heading: "Footage that sells, not documents.",
    body: "The difference between a $200 drone operator and a cinematographer is framing with intent. Every shot is composed to produce a feeling — the feeling that makes the viewer take the next step.",
  },
  {
    n: "02",
    heading: "One operator. Consistent results.",
    body: "You're hiring Toby, not a dispatch service. The footage in the portfolio was shot by the same person who will show up to your project. There's no quality lottery.",
  },
  {
    n: "03",
    heading: "Weather-safe and reshoot-backed.",
    body: "If conditions on the day won't produce footage worth delivering, we reschedule at no cost. If the final cut misses the brief, we reshoot.",
  },
  {
    n: "04",
    heading: "The brief before the shoot.",
    body: "A 20-minute call defines what success looks like before a single prop spins. This is why the reshoot guarantee rarely applies — and why delivery matches the brief, every time.",
  },
];

const PROCESS = [
  {
    n: "01",
    step: "Brief",
    detail:
      "A 20-minute call or written outline. We define the shots, the feeling, and the deliverable formats before anything else.",
  },
  {
    n: "02",
    step: "Shoot day",
    detail:
      "Toby arrives prepared. Weather window confirmed, airspace cleared, and a shot list that reflects the brief. You don't need to be there.",
  },
  {
    n: "03",
    step: "Delivery in 48 hrs",
    detail:
      "Colour-graded, edited, and formatted for every platform you need. A download link, not a hard drive. Most clients receive footage before their competition lists.",
  },
];

/* ─── Hero ───────────────────────────────────────────── */
function PricingHero() {
  // Mobile-only 8px upward parallax — mirrors Work hero behavior.
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let pending = false;
    const apply = () => {
      const p = Math.min(Math.max(window.scrollY / 80, 0), 1);
      if (headerRef.current) {
        headerRef.current.style.transform = `translate3d(0, ${(-8 * p).toFixed(2)}px, 0)`;
      }
      pending = false;
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#0a0a0a]">
      <img
        src={heroAerial}
        alt=""
        aria-hidden
        width={1620}
        height={1080}
        decoding="async"
        loading="eager"
        // @ts-expect-error fetchpriority is valid HTML
        fetchpriority="high"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-70"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(8,8,8,0.92) 0%, rgba(8,8,8,0.55) 40%, rgba(8,8,8,0.35) 100%)",
        }}
        aria-hidden
      />
      <div className="relative container-x min-h-[100svh] flex flex-col justify-end pt-32 md:pt-40 pb-[max(28px,calc(env(safe-area-inset-bottom)+20px))] md:pb-20">
        <div
          ref={headerRef}
          className="will-change-transform"
          style={{ transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <h1
            id="pricing-heading"
            className="t-display-2 wrap-editorial wrap-editorial-mobile-off text-background max-w-4xl animate-fade-up"
            style={{ animationDelay: "0ms" }}
          >
            Most drone footage
            <br />
            just fills space.
            <br />
            Ours moves people.
          </h1>
          <p
            className="t-meta text-background/60 mt-6 animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            Honest packages from $600 · Alberta
          </p>
        </div>
      </div>
    </section>
  );
}



/* ─── Differentiators ────────────────────────────────── */
function DifferentiatorRow({
  n,
  heading,
  body,
}: {
  n: string;
  heading: string;
  body: string;
}) {
  const ref = useReveal<HTMLLIElement>();
  return (
    /*
      Services-section row pattern: left-edge accent bar slides in on hover,
      title nudges right 8px, ghost number at display scale (Benoist).
      Same vocabulary as homepage Services — consistent editorial grammar.
    */
    <li
      ref={ref}
      className="reveal relative group border-b border-border py-7 md:py-9 overflow-hidden"
    >
      {/* Ghost number — spatial texture, desktop only */}
      <span
        className="pointer-events-none select-none absolute right-0 top-1/2 -translate-y-1/2 t-display-0 text-foreground leading-none opacity-[0.03] hidden lg:block"
        aria-hidden
      >
        {n}
      </span>

      {/* Left-edge accent bar */}
      <span
        className="absolute left-0 top-0 h-full w-[3px] bg-foreground/60 -translate-x-full group-hover:translate-x-0 transition-transform duration-[360ms] ease-[var(--ease-out-soft)]"
        aria-hidden
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-2 md:gap-6 md:items-baseline pl-0 md:pl-6">
        <span className="hidden md:block md:col-span-1 t-micro text-muted-foreground tabular-nums">
          {n}
        </span>
        <h3
          className="md:col-span-5 t-headline-2 transition-transform duration-[360ms] ease-[var(--ease-out-soft)] group-hover:translate-x-2"
        >
          {heading}
        </h3>
        <p className="md:col-span-6 t-body text-muted-foreground leading-relaxed">
          {body}
        </p>
      </div>
    </li>
  );
}

function Differentiators() {
  const headRef = useReveal<HTMLDivElement>();
  return (
    <section className="py-section border-b border-border">
      <div className="container-x">
        <div ref={headRef} className="reveal mb-14 md:mb-20">
          <h2 className="t-headline-1 max-w-[28ch] text-muted-foreground">
            Why intent costs more than equipment.
          </h2>

        </div>
        <ul className="border-t border-border">
          {DIFFERENTIATORS.map((d) => (
            <DifferentiatorRow key={d.n} {...d} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─── Process ────────────────────────────────────────── */
function ProcessStrip() {
  const ref = useReveal<HTMLElement>();
  return (
    /*
      Dark section — creates light/dark/light rhythm break between
      Differentiators (light) and Packages (light). Without this,
      five consecutive light sections kill page momentum.
    */
    <section
      ref={ref}
      className="reveal py-section-sm bg-foreground text-background"
    >
      <div className="container-x">
        <p className="t-eyebrow text-background/40 mb-10 md:mb-12">
          How it works
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
          {PROCESS.map((p) => (
            <div key={p.n}>
              <p className="t-micro text-background/35 mb-4 tabular-nums">
                {p.n}
              </p>
              <h3 className="t-headline-2 text-background mb-4">{p.step}</h3>
              <p className="t-body text-background/60 leading-relaxed">
                {p.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────── */
const ADDONS = [
  { n: "A", name: "Extra 10 photographs", detail: "Additional colour-corrected images from any session — aerial or ground.", price: "+$150" },
  { n: "B", name: "Additional vertical cut", detail: "Extra short-form format — Reels, TikTok, YouTube Shorts. Same footage, new edit.", price: "+$120" },
  { n: "C", name: "Rush delivery (24 hrs)", detail: "Your listing goes live tomorrow, not in 48 hours. Priority edit queue.", price: "+$200" },
  { n: "D", name: "Second location (same day)", detail: "Up to 30–45 min drive between sites. Added to any shoot session.", price: "+$300" },
  { n: "E", name: "Sunset / golden-hour window", detail: "Not included in Essential — adds approximately 1 hour to the session window.", price: "+$150" },
  { n: "F", name: "Music upgrade", detail: "Premium sync licence instead of standard stock — broadcast and ad clearance included.", price: "+$100" },
  { n: "G", name: "Travel outside Calgary", detail: "Flat rate per 100km, quoted upfront before booking. No surprises after the fact.", price: "$1.20/km" },
  { n: "H", name: "Additional edit revision", detail: "One revision round is included in all packages. This adds another.", price: "+$80/round" },
];

function PricingAddOns() {
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section className="py-section border-t border-border">
      <div className="container-x">
        <div className="mb-14 md:mb-20">
          <p className="t-eyebrow text-muted-foreground mb-5">À la carte</p>
          <h2 className="t-headline-1 mb-5">Add to any package.</h2>
          <p className="t-lede text-muted-foreground max-w-[48ch]">
            Everything below can be added to any Essential, Elevated, or
            Signature package. Confirm at booking — no surprise invoices.
          </p>
        </div>

        <div
          ref={gridRef}
          className="reveal grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border"
        >
          {ADDONS.map((addon) => (
            <article key={addon.n} className="bg-background p-6">
              <p className="t-micro tabular-nums text-muted-foreground mb-5">
                {addon.n}
              </p>
              <h3 className="t-body font-medium mb-2">{addon.name}</h3>
              <p className="t-micro text-muted-foreground leading-relaxed mb-4">
                {addon.detail}
              </p>
              <p className="t-headline-2 text-foreground">{addon.price}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Pricing() {
  useEffect(() => {
    document.title =
      "Drone Videography Pricing Alberta — Aerial Cinematography Packages · Fly4MEdia";

    const schemaData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Drone Videography Pricing — Fly4MEdia Alberta",
      description:
        "Aerial cinematography packages for real estate, wedding venues, farms, construction, tourism, and commercial brands in Alberta. Prices from $600.",
      url: "https://fly4media.ca/pricing",
      provider: {
        "@type": "LocalBusiness",
        name: "Fly4MEdia",
        telephone: "+14038189686",
        email: "tobyrennick@gmail.com",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Calgary",
          addressRegion: "AB",
          addressCountry: "CA",
        },
        areaServed: "Alberta, Canada",
        priceRange: "$600 – $5,500+",
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <PageShell>
      {({ openContact }: { openContact: () => void }) => (
        <>
          <PricingHero />
          <Differentiators />
          <ProcessStrip />
          <PricingPackages onContact={openContact} />
          <PricingAddOns />
          <PricingGuarantee onContact={openContact} />
          <PricingFAQ />
          <CTA
            onContact={openContact}
            eyebrow="Ready to book"
            heading={
              <>
                One brief.
                <br />
                Footage that works.
              </>
            }
            cta="Start the conversation"
          />
        </>
      )}
    </PageShell>
  );
}
