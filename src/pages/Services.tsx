import { useEffect } from "react";
import PageShell from "@/components/fly4media/PageShell";
import ServiceFeature from "@/components/fly4media/ServiceFeature";
import { useReveal } from "@/components/fly4media/useReveal";
import CTA from "@/components/fly4media/CTA";
import work1 from "@/assets/work-01-mountain-road.jpg";
import work2 from "@/assets/work-02-architecture.jpg";
import work3 from "@/assets/work-03-lake-boat.jpg";
import work4 from "@/assets/work-04-industrial.jpg";
import csCanmore1 from "@/assets/cs-canmore-1.jpg";
import csLake2 from "@/assets/cs-lake-2.jpg";
import csField2 from "@/assets/cs-field-2.jpg";
import strip from "@/assets/services-strip.jpg";
import ctaWedding from "@/assets/cta-wedding-aerial.jpg";

/* ─── Compact services (06–08) rendered as a 3-up grid ─────── */
const COMPACT_SERVICES = [
  {
    number: "06",
    title: "Industrial Aerial Documentation",
    desc: "Engineering precision with cinematic restraint. Footage that holds up in the technical report and earns its place in the annual review.",
    image: work4,
    alt: "Industrial aerial documentation",
  },
  {
    number: "07",
    title: "Social Media Visual Campaigns",
    desc: "Vertical-first cuts engineered for the scroll, mastered for the boardroom. The same story, sized to land everywhere it lives.",
    image: csCanmore1,
    alt: "Social campaign cinematography",
  },
  {
    number: "08",
    title: "Creative Direction",
    desc: "Shot lists, location scouts, and the discipline to decide what not to film. The work before the work — where most of the cinematic happens.",
    image: work3,
    alt: "Top-down lake creative direction",
  },
];

function CompactServiceGrid() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal border-t border-border py-section-sm lg:py-section">
      <div className="container-x grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
        {COMPACT_SERVICES.map((s) => (
          <div key={s.number} className="group">
            <div className="media-frame aspect-square mb-6">
              <img
                src={s.image}
                alt={s.alt}
                loading="lazy"
                decoding="async"
                width={800}
                height={800}
                className="media-img"
              />
            </div>
            <p className="t-eyebrow text-muted-foreground mb-3">{s.number}</p>
            <h3 className="t-headline-2 mb-4">{s.title}</h3>
            <p className="t-body text-foreground/70 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Services() {
  useEffect(() => {
    document.title = "Services — Tools for shifting perception · Fly4MEdia";
  }, []);

  return (
    <PageShell>
      {({ openContact }: { openContact: () => void }) => (
        <>
          {/* Page header */}
          <section className="pt-36 md:pt-48 lg:pt-56 pb-section-sm container-x">
            <h1 className="t-display-2 wrap-editorial wrap-editorial-mobile-off max-w-4xl animate-fade-up">
              Not deliverables.
              <br />
              Tools for shifting perception.
            </h1>
            <p className="t-lede mt-10 lg:mt-12 max-w-xl text-muted-foreground">
              Every brief starts in the same place — the question you're already
              asking yourself: what should this be perceived as?
            </p>
          </section>

          {/* 01 — Aerial Cinematography: signature statement posture */}
          <ServiceFeature
            number="01"
            title="Aerial Cinematography"
            desc="For the brand that's tired of looking like everyone else from above. Patient camera moves, considered framing, and the discipline to wait for the frame that earns the cut."
            image={csCanmore1}
            alt="Aerial cinematography over mountain peaks"
            variant="statement"
          />

          {/* 02 — FPV Drone: wide split posture */}
          <ServiceFeature
            number="02"
            title="FPV Drone Production"
            desc="When a single shot has to do the work of an entire scene. Choreographed, immersive, and built to be the moment the room goes quiet."
            image={csLake2}
            alt="FPV drone over alpine lake"
            variant="split"
          />

          {/* 03–05 — Core services: editorial asymmetric, alternating flip */}
          <ServiceFeature
            number="03"
            title="Tourism & Destination Films"
            desc="Built for the marketing lead who can't run another helicopter-shot-over-the-Rockies cliché. Films that turn a place into a feeling — and a feeling into a booking."
            image={work1}
            alt="Tourism aerial across the Alberta Rockies"
            variant="editorial"
            flip={false}
          />
          <ServiceFeature
            number="04"
            title="Commercial Brand Campaigns"
            desc="End-to-end production for creative directors who think in story arcs, not shot lists. We start every brief with one question — what should this brand be perceived as — and reverse-engineer the campaign from there."
            image={csField2}
            alt="Commercial wind turbine campaign"
            variant="editorial"
            flip={true}
          />
          <ServiceFeature
            number="05"
            title="Real Estate Cinematics"
            desc="For the listing that deserves a launch, not a tour. We frame the property the way the buyer is going to remember it — as a destination, not a transaction."
            image={work2}
            alt="Mountain home architectural aerial"
            variant="editorial"
            flip={false}
          />

          {/* 06–08 — Supporting services: compact 3-up grid */}
          <CompactServiceGrid />

          {/* Visual strip — cinematic full-bleed divider */}
          <section className="bg-[#0a0a0a] relative overflow-hidden">
            <div className="w-full h-[50vh] md:h-[68vh]">
              <img
                src={strip}
                alt="Cinematic mountain ridge at golden hour"
                loading="lazy"
                decoding="async"
                width={1920}
                height={1080}
                className="w-full h-full object-cover opacity-80"
              />
            </div>
            {/* Top fade to merge with content above */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent pointer-events-none" />
            {/* Bottom fade to merge with CTA below */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-foreground/95 to-transparent pointer-events-none" />
          </section>

          <CTA
            onContact={openContact}
            backgroundImage={ctaWedding}
            backgroundAlt="Aerial wedding ceremony in the Canadian Rocky Mountains"
            heading={
              <>
                Some stories deserve
                <br />
                a different angle.
              </>
            }
          />
        </>
      )}
    </PageShell>
  );
}
