import { useReveal } from "./useReveal";
import CinematicMedia from "./CinematicMedia";
import type { VideoSource } from "@/data/projects";

interface Props {
  eyebrow: string;
  headline: string;
  body: string;
  image: string;
  alt: string;
  videoSources?: VideoSource[];
  objectPosition?: string;
}

/**
 * The signature Perspective Shift section — the most significant visual
 * moment in the case study. Media is now true full-bleed (no container-x
 * horizontal padding). The text header and body stay in container-x.
 */
export default function CaseStudyPerspective({
  eyebrow,
  headline,
  body,
  image,
  alt,
  videoSources,
  objectPosition,
}: Props) {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="bg-background py-section-lg">
      <div ref={ref} className="reveal">

        {/* Header — stays in container-x */}
        <div className="container-x mb-12 md:mb-16 grid grid-cols-1 md:grid-cols-12 gap-10">
          <p className="md:col-span-3 t-eyebrow text-muted-foreground">{eyebrow}</p>
          <h2 className="md:col-span-9 t-display-2 wrap-editorial max-w-5xl">{headline}</h2>
        </div>

        {/*
          Full-bleed media — was container-x constrained with horizontal padding.
          The most significant visual moment in a case study deserves the full
          viewport width. No horizontal constraints.
          Mobile: aspect-[4/3] shows more vertical depth on portrait viewports.
          Desktop: aspect-[21/9] cinema scope.
        */}
        <div className="w-full">
          <div className="media-frame aspect-[4/3] md:aspect-[21/9]">
            <CinematicMedia
              image={image}
              alt={alt}
              sources={videoSources}
              objectPosition={objectPosition}
              width={1920}
              height={820}
            />
          </div>
        </div>

        {/* Body quote — stays in container-x, offset right */}
        <div className="container-x mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-9 md:col-start-4 max-w-3xl">
            <p className="t-quote optical-hang">{body}</p>
          </div>
        </div>

      </div>
    </section>
  );
}
