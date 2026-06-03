import { Link } from "react-router-dom";
import { useReveal } from "./useReveal";
import type { Project } from "@/data/projects";

export default function NextProject({ next }: { next: Project }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-background border-t border-border">
      <Link
        to={`/work/${next.slug}`}
        data-cursor="hover"
        className="group block container-x py-16 md:py-24"
      >
        {/*
          Image first on mobile — the preview is the teaser.
          Text first on desktop (order-1) — the context arrives
          before the visual on wide screens where both are in view.
        */}
        <div ref={ref} className="reveal grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center">

          {/*
            Preview image — first on mobile, right column on desktop.
            aspect-[3/2] gives more vertical presence than the previous
            aspect-[16/10], making the preview feel like a proper entry
            point rather than a thumbnail.
          */}
          <div className="order-first md:order-2 md:col-span-5">
            <div className="media-frame aspect-[3/2]">
              <img
                src={next.heroImage}
                alt={next.title}
                loading="lazy"
                decoding="async"
                width={1920}
                height={1280}
                className="media-img"
              />
            </div>
          </div>

          {/* Text — second on mobile, left column on desktop */}
          <div className="md:order-1 md:col-span-7 media-meta">
            <p className="t-eyebrow text-muted-foreground mb-4">
              Next Project
            </p>
            <h3 className="t-headline-1 mb-3">
              {next.title}
            </h3>
            <p className="t-lede text-muted-foreground mb-6">
              {next.category} · {next.year}
            </p>
            <span className="inline-flex items-center gap-2 t-button text-foreground/50 group-hover:text-foreground transition-colors duration-300">
              <span className="link-underline">See the full story</span>
              <span className="link-arrow" aria-hidden>↗</span>
            </span>
          </div>

        </div>
      </Link>
    </section>
  );
}
