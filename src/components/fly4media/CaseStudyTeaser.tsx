import { Link } from "react-router-dom";
import { useReveal } from "./useReveal";
import CinematicMedia from "./CinematicMedia";
import { projects } from "@/data/projects";

export default function CaseStudyTeaser() {
  const featured = projects[0];
  const refMedia = useReveal<HTMLDivElement>();
  const refText  = useReveal<HTMLDivElement>();

  return (
    <section className="bg-background py-section">
      <div className="container-x">

        <Link
          to={`/work/${featured.slug}`}
          data-cursor="hover"
          className="group block"
          aria-label={`View case study: ${featured.title}`}
        >
          {/*
            Media — CinematicMedia replaces the static <img>.
            The viewer sees the actual drone footage, not a poster.
            Aspect ratio:
            - Mobile (default): aspect-[4/3] — taller crop shows the
              pine canopy depth on portrait viewports
            - md+: aspect-[21/9] — cinema scope, the filmic association
              this studio's work deserves. Not 16/9 (broadcast/YouTube).
          */}
          <div ref={refMedia} className="reveal media-frame aspect-[4/3] md:aspect-[21/9]">
            <CinematicMedia
              image={featured.heroImage}
              alt={`${featured.title} — ${featured.category}`}
              sources={featured.heroVideoSources}
              width={1920}
              height={823}
            />
          </div>

          {/*
            Text section — relative so the ghost number can be absolute inside.
            mt-8 md:mt-10 — tighter than the previous mt-8 lg:mt-12,
            keeping the text felt as part of the media, not a separate block.
          */}
          <div
            ref={refText}
            className="reveal relative mt-8 md:mt-10"
            style={{ transitionDelay: "180ms" }}
          >

            {/*
              Ghost project number — Aristide Benoist oversized number technique:
              100-180px at 3-4% opacity as spatial texture / navigation anchor.
              Positioned top-right of the text section so it occupies the
              negative space above the metadata without competing.
              Desktop only — on mobile it would overwhelm the narrow column.
            */}
            <span
              className="hidden lg:block absolute -top-6 right-0 t-display-0 text-foreground leading-none opacity-[0.04] select-none pointer-events-none"
              aria-hidden
            >
              {featured.number}
            </span>

            {/*
              Category + year — quiet orientation line.
              This replaces the "Proof of perspective" eyebrow which was
              a generic label. Category + year is specific and informative.
            */}
            <p className="t-eyebrow text-muted-foreground mb-3 md:mb-4">
              {featured.category}&ensp;·&ensp;{featured.year}
            </p>

            {/*
              Title at t-display-2 — significantly larger than the previous
              t-headline-2. This is the studio's featured work; it earns
              the full display scale.
              Mobile: clamp min (42px) is bold enough to anchor the card.
              max-w constrains the title so it runs 2–3 lines max on any
              viewport — art-directed, not arbitrary wrapping.
            */}
            <h3 className="t-display-2 mb-5 md:mb-7 max-w-[14ch]">
              {featured.title}
            </h3>

            {/*
              Tagline — the single most important editorial line for this project.
              max-w-[44ch] keeps it readable (45–65ch ideal reading measure).
            */}
            <p className="t-lede text-muted-foreground max-w-[44ch] mb-7 md:mb-10">
              {featured.tagline}
            </p>

            {/*
              Link — "See the full story" is more editorial than "View case study".
              It signals: there is a story here, not just a deliverable.
              The ↗ arrow is correct here — forward navigation within the site.
            */}
            <span className="inline-flex items-center gap-2 t-button text-foreground/70 group-hover:text-foreground transition-colors duration-300">
              <span className="link-underline">See the full story</span>
              <span className="link-arrow group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" aria-hidden>↗</span>
            </span>

          </div>
        </Link>
      </div>
    </section>
  );
}
