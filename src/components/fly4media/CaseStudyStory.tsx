import { useReveal } from "./useReveal";
import type { Project } from "@/data/projects";

const BEATS: { label: string; key: keyof Pick<Project, "challenge" | "perspectiveShift" | "story" | "impact"> }[] = [
  { label: "Challenge", key: "challenge" },
  { label: "Perspective Shift", key: "perspectiveShift" },
  { label: "Cinematic Execution", key: "story" },
  { label: "Emotional Impact", key: "impact" },
];

export default function CaseStudyStory({ project }: { project: Project }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-background py-section">
      <div ref={ref} className="reveal container-x grid grid-cols-1 md:grid-cols-12 gap-10">
        <p className="md:col-span-3 t-eyebrow text-muted-foreground">
          The Project
        </p>
        <div className="md:col-span-9 max-w-3xl space-y-12 md:space-y-16">
          {BEATS.map((beat) => {
            const value = project[beat.key];
            if (!value) return null;
            const isLead = beat.key === "perspectiveShift";
            return (
              <div key={beat.key} className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8">
                <p className="md:col-span-3 t-micro text-muted-foreground pt-2">
                  {beat.label}
                </p>
                <p
                  className={
                    isLead
                      ? "md:col-span-9 t-quote optical-hang"
                      : "md:col-span-9 t-lede text-foreground/85 measure-wide"
                  }
                >
                  {value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
