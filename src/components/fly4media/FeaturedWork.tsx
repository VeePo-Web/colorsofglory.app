import { Link } from "react-router-dom";
import { useReveal } from "./useReveal";
import CinematicMedia from "./CinematicMedia";
import { projects, type Project } from "@/data/projects";

/*
  Section 02 — "Proof, not portfolio."

  Fantasy.co-grade composition:
  - Chapter opener (eyebrow counter + display + hairline + supporting line)
  - One hero card (project[0]) at cinema scope, four supporting in asymmetric grid
  - Per-card ghost numerals as spatial anchors
  - Tagline reveals on hover; arrow-circle lockup replaces bare ↗
  - Column-aware stagger via --reveal-i
  - Generous CTA exit moment with hairline frame
*/

interface SupportingLayout {
  lg: string;
  offset: string;
  mobile: string;
  revealI: number;
  numeralPos: string;
}

const SUPPORTING_LAYOUTS: SupportingLayout[] = [
  // project[1]
  { lg: "lg:col-span-5 lg:col-start-2", offset: "",          mobile: "",            revealI: 1, numeralPos: "-top-6 -right-2 md:-right-4" },
  // project[2]
  { lg: "lg:col-span-6 lg:col-start-7", offset: "lg:mt-32",  mobile: "ml-[6%]",     revealI: 2, numeralPos: "-top-8 -left-4 md:-left-6" },
  // project[3]
  { lg: "lg:col-span-5 lg:col-start-2", offset: "lg:mt-12",  mobile: "",            revealI: 2, numeralPos: "-top-6 -right-2 md:-right-4" },
  // project[4]
  { lg: "lg:col-span-6 lg:col-start-7", offset: "lg:mt-24",  mobile: "ml-[6%]",     revealI: 3, numeralPos: "-top-8 -left-4 md:-left-6" },
];

export default function FeaturedWork() {
  const headRef = useReveal<HTMLDivElement>();
  const ctaRef = useReveal<HTMLDivElement>();

  const [hero, ...rest] = projects;
  const supporting = rest.slice(0, 4);

  return (
    <section id="work" className="bg-background py-section-lg">
      <div className="container-x">

        {/* ── Chapter opener ───────────────────────────────────────── */}
        <div ref={headRef} className="reveal grid grid-cols-1 lg:grid-cols-12 gap-y-8 lg:gap-x-6 mb-20 md:mb-28 lg:mb-36">
          <div className="lg:col-span-12 flex items-baseline justify-between">
            <p className="t-eyebrow text-muted-foreground">
              Selected work
            </p>
            <p className="t-eyebrow text-muted-foreground tabular-nums">
              {String(projects.length).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
            </p>
          </div>

          <h2 className="lg:col-span-12 t-display-2 wrap-editorial mt-6">
            Proof,
            <br />
            not portfolio.
          </h2>

          <div className="lg:col-span-12 mt-10 md:mt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-12">
            <span className="block h-px bg-foreground/15 w-full md:w-[38%] self-end" aria-hidden />
            <p className="t-lede text-muted-foreground max-w-[42ch] md:text-right md:ml-auto">
              Five projects. Each one shifted how a place was seen.
            </p>
          </div>
        </div>

        {/* ── Hero card ────────────────────────────────────────────── */}
        <HeroCard project={hero} />

        {/* ── Supporting grid ─────────────────────────────────────── */}
        <div className="mt-24 md:mt-40 grid grid-cols-1 lg:grid-cols-12 gap-x-6 gap-y-20 lg:gap-y-32 relative">
          {supporting.map((project, i) => {
            const layout = SUPPORTING_LAYOUTS[i] ?? SUPPORTING_LAYOUTS[0];
            return (
              <SupportingCard
                key={project.slug}
                project={project}
                index={i + 2}
                layout={layout}
              />
            );
          })}
        </div>

        {/* ── CTA exit moment ──────────────────────────────────────── */}
        <div ref={ctaRef} className="reveal mt-32 md:mt-48 pt-16 md:pt-20 border-t border-foreground/10">
          <Link
            to="/work"
            data-cursor="hover"
            className="group flex flex-col items-center gap-3 py-6 md:py-10"
          >
            <span className="inline-flex items-center gap-4 t-headline-3 text-foreground">
              <span className="link-underline">See all {projects.length} projects</span>
              <span className="link-arrow transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:translate-x-1.5 group-hover:-translate-y-1.5" aria-hidden>↗</span>
            </span>
            <span className="t-meta text-muted-foreground tabular-nums">
              2024 — 2026
            </span>
          </Link>
        </div>

      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function HeroCard({ project }: { project: Project }) {
  const ref = useReveal<HTMLAnchorElement>();
  return (
    <Link
      ref={ref as never}
      to={`/work/${project.slug}`}
      data-cursor="hover"
      className="reveal group block lg:col-span-10 lg:col-start-2"
      style={{ ["--reveal-i" as never]: 0 }}
    >
      <div className="relative">
        <span className="ghost-numeral hidden md:block -top-10 -left-6 lg:-left-10" aria-hidden>
          {project.number}
        </span>
        <div className="media-frame aspect-[21/9]">
          <CinematicMedia
            image={project.cardImage}
            alt={project.title}
            sources={project.cardVideoSources}
            objectPosition={project.cardObjectPosition}
            width={project.cardImgW}
            height={project.cardImgH}
          />
        </div>
      </div>

      <div className="media-meta mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-end">
        <div className="md:col-span-8">
          <p className="t-eyebrow text-muted-foreground mb-3">
            {project.number} — {project.category} · {project.year}
          </p>
          <h3 className="t-headline-1">
            <span className="link-underline">{project.title}</span>
          </h3>
          <p className="card-tagline t-lede text-muted-foreground mt-4 max-w-[44ch]">
            {project.tagline}
          </p>
        </div>
        <div className="md:col-span-4 md:flex md:justify-end">
          <span className="arrow-circle" aria-hidden>↗</span>
        </div>
      </div>
    </Link>
  );
}

function SupportingCard({
  project,
  index,
  layout,
}: {
  project: Project;
  index: number;
  layout: SupportingLayout;
}) {
  const ref = useReveal<HTMLAnchorElement>();
  return (
    <Link
      ref={ref as never}
      to={`/work/${project.slug}`}
      data-cursor="hover"
      className={`reveal group block ${layout.lg} ${layout.offset} ${layout.mobile}`}
      style={{ ["--reveal-i" as never]: layout.revealI }}
    >
      <div className="relative">
        <span className={`ghost-numeral hidden md:block ${layout.numeralPos}`} aria-hidden>
          {String(index).padStart(2, "0")}
        </span>
        <div className={`media-frame ${project.cardAspect}`}>
          <CinematicMedia
            image={project.cardImage}
            alt={project.title}
            sources={project.cardVideoSources}
            objectPosition={project.cardObjectPosition}
            width={project.cardImgW}
            height={project.cardImgH}
          />
        </div>
      </div>

      <div className="media-meta mt-6 lg:mt-8 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="t-eyebrow text-muted-foreground mb-2">
            {String(index).padStart(2, "0")} — {project.category}
          </p>
          <h3 className="t-headline-2">
            <span className="link-underline">{project.title}</span>
          </h3>
          <p className="card-tagline t-body text-muted-foreground/80 mt-2 max-w-[32ch]">
            {project.tagline}
          </p>
        </div>
        <span className="arrow-circle shrink-0" aria-hidden>↗</span>
      </div>
    </Link>
  );
}
