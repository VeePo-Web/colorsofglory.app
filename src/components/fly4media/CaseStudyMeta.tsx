import { useReveal } from "./useReveal";
import type { Project } from "@/data/projects";

export default function CaseStudyMeta({ project }: { project: Project }) {
  const ref = useReveal<HTMLDivElement>();
  const items = [
    { label: "Client",   value: project.client },
    { label: "Location", value: project.location },
    { label: "Services", value: project.services.join(" · ") },
    { label: "Year",     value: project.year },
  ];

  return (
    /*
      More visible border — border-border/70 was barely registering on white.
      More vertical breathing room — py-14 md:py-20 accommodates the larger values.
    */
    <section className="bg-background border-y border-border/60 py-14 md:py-20">
      <div ref={ref} className="reveal container-x grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8">
        {items.map((it) => (
          <div key={it.label}>
            {/* Label — t-micro stays; it's correctly restrained as a field key */}
            <p className="t-micro text-muted-foreground mb-3">
              {it.label}
            </p>
            {/*
              Value — t-body (16px) → t-lede (17–21px).
              These are the project's editorial credentials.
              They earned more authority than body text.
            */}
            <p className="t-lede text-pretty leading-snug">
              {it.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
