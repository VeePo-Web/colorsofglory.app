import { Link } from "react-router-dom";
import { useReveal } from "./useReveal";

const SERVICES = [
  {
    n: "01",
    title: "Aerial Cinematography",
    desc: "For the brand that's tired of looking like every other drone reel.",
  },
  {
    n: "02",
    title: "FPV Drone Filming",
    desc: "Movement the cut can't fake. The shot people rewind.",
  },
  {
    n: "03",
    title: "Aerial Photography",
    desc: "One frame that repositions a place — and the deck it lives in.",
  },
  {
    n: "04",
    title: "Real Estate Media",
    desc: "When the listing has to feel like the destination, not the address.",
  },
  {
    n: "05",
    title: "Tourism & Lifestyle",
    desc: "Films that turn a landscape into a reason to book the flight.",
  },
];

export default function Services() {
  const headRef = useReveal<HTMLDivElement>();

  return (
    <section id="services" className="bg-foreground text-background py-section">
      <div className="container-x">

        {/*
          Section header — display-scale statement, no eyebrow.
          "Tools for shifting perception." earns its context through
          scale alone. The "All services" link moves below the list —
          the invite to see more arrives after the viewer has read what exists.
        */}
        <div ref={headRef} className="reveal mb-16 md:mb-24">
          <h2 className="t-display-2 wrap-editorial max-w-[16ch]">
            Tools for shifting
            <br />
            perception.
          </h2>
        </div>

        {/*
          Service rows — each row has a left-edge accent bar on hover
          (directional, editorial) plus a title nudge right.
          Row border: background/20 (slightly more present than the
          previous background/15 which was near-invisible on near-black).
        */}
        <ul className="border-t border-background/20">
          {SERVICES.map((s) => (
            <ServiceRow key={s.n} {...s} />
          ))}
        </ul>

        {/* "All services" — arrives after the list, right-aligned */}
        <div className="mt-10 md:mt-12 flex justify-end">
          <Link
            to="/services"
            data-cursor="hover"
            className="group inline-flex items-center gap-2 t-button text-background/60 hover:text-background transition-colors duration-300"
          >
            <span className="link-underline">All services</span>
            <span className="link-arrow group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" aria-hidden>↗</span>
          </Link>
        </div>

      </div>
    </section>
  );
}

function ServiceRow({ n, title, desc }: { n: string; title: string; desc: string }) {
  const ref = useReveal<HTMLLIElement>();
  return (
    /*
      Hover system:
      - Left-edge accent bar slides in (translateX -100% → 0)
      - Title nudges right (translateX 0 → 8px)
      - Row background stays unchanged (the 4% tint was imperceptible anyway)
      The bar + nudge communicates directionality and selection — not just "on/off".

      The oversized number is positioned absolute as spatial texture
      (Aristide Benoist technique: 100-180px at 3% opacity, background architecture
      not readable content). Hidden on mobile — it's spatial, not informational.
    */
    <li
      ref={ref}
      className="reveal relative group border-b border-background/20 py-7 md:py-9 lg:py-11 overflow-hidden"
    >
      {/* Oversized ghost number — spatial texture, desktop only */}
      <span
        className="pointer-events-none select-none absolute right-0 top-1/2 -translate-y-1/2 t-display-0 text-background leading-none opacity-[0.03] hidden lg:block"
        aria-hidden
      >
        {n}
      </span>

      {/* Left-edge accent bar — slides in on hover */}
      <span
        className="absolute left-0 top-0 h-full w-[3px] bg-background/60 -translate-x-full group-hover:translate-x-0 transition-transform duration-[360ms] ease-[var(--ease-out-soft)]"
        aria-hidden
      />

      {/*
        Row content:
        Desktop: number (1 col) | title (5 col) | desc (6 col) at baseline
        Mobile: title on top, desc below — number hidden (it's texture not content)
      */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-2 md:gap-6 md:items-baseline pl-0 md:pl-6">

        {/* Number — meta label, desktop only */}
        <span className="hidden md:block md:col-span-1 t-micro text-background/40 tabular-nums">
          {n}
        </span>

        {/* Title — nudges right on hover */}
        <h3
          className="md:col-span-5 t-headline-2 text-background transition-transform duration-[360ms] ease-[var(--ease-out-soft)] group-hover:translate-x-2"
        >
          {title}
        </h3>

        {/* Description */}
        <p className="md:col-span-6 t-body text-background/60 leading-relaxed">
          {desc}
        </p>

      </div>
    </li>
  );
}
