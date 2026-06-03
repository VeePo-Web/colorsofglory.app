import { Link } from "react-router-dom";
import HeroMedia from "./HeroMedia";
import type { Project } from "@/data/projects";

export default function CaseStudyHero({ project }: { project: Project }) {
  return (
    <section className="relative min-h-[90dvh] md:min-h-[100dvh] w-full overflow-hidden bg-[#0a0a0a]">
      <HeroMedia
        image={project.heroImage}
        alt={`${project.title} — ${project.category} · Fly4MEdia`}
        priority
        sources={project.heroVideoSources}
      />

      {/*
        Bottom-only vignette — replaces the previous gradient that had
        `to-foreground/30` adding an arbitrary 30% dark overlay to the TOP
        of the frame (the sky, the peaks, the most visually interesting area).
        Now: darkness only where the text lives, footage breathes above.
      */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#080808]/90 via-[#080808]/32 to-transparent"
        aria-hidden
      />

      <div className="relative container-x pt-28 md:pt-36 pb-12 md:pb-16 min-h-[90dvh] md:min-h-[100dvh] flex flex-col justify-end">

        {/*
          Back navigation — was t-eyebrow (11px uppercase).
          The most important navigation function on the page was being
          rendered at the smallest type size. Now at t-button (14px),
          readable without dominating. Arrow nudges left on hover.
        */}
        <Link
          to="/work"
          className="group mb-8 md:mb-10 inline-flex items-center gap-2 t-button text-background/55 hover:text-background transition-colors duration-300"
        >
          <span className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-x-1" aria-hidden>
            ←
          </span>
          <span className="link-underline">All work</span>
        </Link>

        {/* Project identifier — category + number */}
        <p className="t-eyebrow text-background/50 mb-4">
          {project.number} — {project.category}
        </p>

        {/* Title — staggered in after category */}
        <h1
          className="t-display-1 text-background max-w-5xl animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          {project.title}
        </h1>

        {/* Tagline */}
        <p
          className="t-lede mt-6 max-w-2xl text-background/75 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          {project.tagline}
        </p>

      </div>
    </section>
  );
}
