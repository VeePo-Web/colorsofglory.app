import { useReveal } from "./useReveal";
import type { SupportingImage } from "@/data/projects";

interface Props {
  eyebrow: string;
  headline: string;
  body: string;
  image?: SupportingImage;
  /** When true: image occupies 7 cols (dominant), text occupies 5 cols */
  flip?: boolean;
}

/**
 * Editorial narrative beat — text + optional supporting image.
 *
 * Grid posture:
 * - Default (!flip): text 7 cols, image 5 cols. Text dominates because
 *   context (opportunity, execution) is argument.
 * - Flip: image 7 cols, text 5 cols. Image dominates because
 *   evidence (problem) is visual.
 *
 * Asymmetric 7/5 throughout — the previous 6/6 (50/50) treated every
 * narrative beat as equal. They are not.
 */
export default function CaseStudyNarrative({
  eyebrow,
  headline,
  body,
  image,
  flip = false,
}: Props) {
  const ref = useReveal<HTMLDivElement>();

  /* Text-only layout — no supporting image */
  if (!image) {
    return (
      <section className="bg-background py-section">
        <div ref={ref} className="reveal container-x grid grid-cols-1 md:grid-cols-12 gap-10">
          <p className="md:col-span-3 t-eyebrow text-muted-foreground">{eyebrow}</p>
          <div className="md:col-span-9 max-w-3xl space-y-6">
            <h2 className="t-headline-1 wrap-editorial">{headline}</h2>
            <p className="t-lede text-foreground/80 measure-wide">{body}</p>
          </div>
        </div>
      </section>
    );
  }

  const aspect =
    image.ratio === "wide"    ? "aspect-[16/10]"
    : image.ratio === "portrait" ? "aspect-[4/5]"
    : "aspect-square";

  const imgW = image.ratio === "wide" ? 1920 : 1080;
  const imgH = image.ratio === "wide" ? 1200 : image.ratio === "portrait" ? 1350 : 1080;

  return (
    <section className="bg-background py-section">
      <div ref={ref} className="reveal container-x grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 items-center">

        {/*
          Text column:
          !flip (context/execution beats): 7 cols, text dominates
           flip (evidence/problem beat):   5 cols, image dominates
        */}
        <div
          className={
            flip
              ? "md:order-2 md:col-start-8 md:col-span-5 space-y-5 md:space-y-6"
              : "md:col-span-7 space-y-5 md:space-y-6"
          }
        >
          <p className="t-eyebrow text-muted-foreground">{eyebrow}</p>
          <h2 className="t-headline-2 wrap-editorial">{headline}</h2>
          <p className="t-lede text-foreground/78">{body}</p>
        </div>

        {/*
          Image column:
          !flip: 5 cols (subordinate to text)
           flip: 7 cols (dominant — the image is the evidence)
        */}
        <figure
          className={
            flip
              ? "md:order-1 md:col-start-1 md:col-span-7"
              : "md:col-start-8 md:col-span-5"
          }
        >
          <div className={`media-frame ${aspect}`}>
            <img
              src={image.src}
              alt={image.alt}
              width={imgW}
              height={imgH}
              loading="lazy"
              decoding="async"
              className="media-img"
            />
          </div>
          {image.caption && (
            <figcaption className="t-micro text-muted-foreground mt-4 leading-relaxed">
              {image.caption}
            </figcaption>
          )}
        </figure>

      </div>
    </section>
  );
}
