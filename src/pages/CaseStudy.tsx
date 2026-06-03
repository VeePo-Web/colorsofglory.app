import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import PageShell from "@/components/fly4media/PageShell";
import CaseStudyHero from "@/components/fly4media/CaseStudyHero";
import CaseStudyMeta from "@/components/fly4media/CaseStudyMeta";
import CaseStudyStory from "@/components/fly4media/CaseStudyStory";
import CaseStudyGallery from "@/components/fly4media/CaseStudyGallery";
import CaseStudyNarrative from "@/components/fly4media/CaseStudyNarrative";
import CaseStudyPerspective from "@/components/fly4media/CaseStudyPerspective";
import CaseStudyTakeaway from "@/components/fly4media/CaseStudyTakeaway";
import NextProject from "@/components/fly4media/NextProject";
import { useReveal } from "@/components/fly4media/useReveal";
import { getProject, getNextProject, type Project, type SupportingPlacement } from "@/data/projects";

export default function CaseStudy() {
  const { slug = "" } = useParams();
  const project = getProject(slug);

  useEffect(() => {
    if (project) document.title = `${project.title} — Fly4MEdia`;
  }, [project]);

  if (!project) return <Navigate to="/work" replace />;

  const next = getNextProject(project.slug);
  const isEnhanced = Boolean(project.narrative);

  return (
    <PageShell>
      <article>
        <CaseStudyHero project={project} />
        <CaseStudyMeta project={project} />
        {isEnhanced ? <EnhancedNarrative project={project} /> : <CaseStudyStory project={project} />}
        <CaseStudyGallery project={project} />
        {!isEnhanced && <Outcome text={project.outcome} />}
        <NextProject next={next} />
      </article>
    </PageShell>
  );
}

function EnhancedNarrative({ project }: { project: Project }) {
  const n = project.narrative!;
  const supportFor = (placement: SupportingPlacement) =>
    project.supportingImages?.find((img) => img.placement === placement);

  return (
    <>
      <CaseStudyNarrative
        eyebrow="The Opportunity"
        headline={n.opportunity.headline}
        body={n.opportunity.body}
        image={supportFor("after-opportunity")}
      />
      <CaseStudyNarrative
        eyebrow="The Perception Gap"
        headline={n.problem.headline}
        body={n.problem.body}
        image={supportFor("after-problem")}
        flip
      />
      <CaseStudyPerspective
        eyebrow="The Perspective Shift"
        headline={n.perspectiveShift.headline}
        body={n.perspectiveShift.body}
        image={project.perspectiveImage ?? project.heroImage}
        alt={`${project.title} — perspective shift`}
        videoSources={project.perspectiveVideoSources ?? (project.perspectiveImage ? undefined : project.heroVideoSources)}
      />
      <CaseStudyNarrative
        eyebrow="The Execution"
        headline={n.execution.headline}
        body={n.execution.body}
        image={supportFor("after-execution")}
      />
      <OutcomeStatement
        headline={n.outcome.headline}
        body={n.outcome.body}
      />
      <CaseStudyTakeaway body={n.takeaway} />
    </>
  );
}

function OutcomeStatement({ headline, body }: { headline: string; body: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-background border-y border-border py-section">
      <div ref={ref} className="reveal container-x grid grid-cols-1 md:grid-cols-12 gap-10">
        <p className="md:col-span-3 t-eyebrow text-muted-foreground">The Outcome</p>
        <div className="md:col-span-9 max-w-4xl space-y-8">
          <h2 className="t-display-2 wrap-editorial">{headline}</h2>
          <p className="t-lede text-foreground/85 max-w-2xl">{body}</p>
        </div>
      </div>
    </section>
  );
}

function Outcome({ text }: { text: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="bg-background py-section">
      <div ref={ref} className="reveal container-x grid grid-cols-1 md:grid-cols-12 gap-10">
        <p className="md:col-span-3 t-micro text-muted-foreground">Outcome</p>
        <p className="md:col-span-9 t-headline-3 measure max-w-2xl">{text}</p>
      </div>
    </section>
  );
}
