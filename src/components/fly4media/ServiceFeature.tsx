import { useReveal } from "./useReveal";

interface Props {
  number: string;
  title: string;
  desc: string;
  image: string;
  alt: string;
  variant?: "statement" | "split" | "editorial";
  flip?: boolean;
}

export default function ServiceFeature({
  number,
  title,
  desc,
  image,
  alt,
  variant = "editorial",
  flip = false,
}: Props) {
  const ref = useReveal<HTMLDivElement>();

  /* ─── Statement (Service 01) ──────────────────────────────────
     Full-bleed cinematic image, editorial text block below.
  ─────────────────────────────────────────────────────────────── */
  if (variant === "statement") {
    return (
      <article ref={ref} className="reveal border-t border-border">
        {/* Cinematic scope image — full width, no horizontal padding */}
        <div className="w-full">
          <div className="media-frame aspect-[4/3] md:aspect-[21/9]">
            <img
              src={image}
              alt={alt}
              loading="lazy"
              decoding="async"
              width={1920}
              height={823}
              className="media-img"
            />
          </div>
        </div>

        {/* Text below — editorial 3/9 split */}
        <div className="container-x py-12 md:py-16 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-3">
            <p className="t-eyebrow text-muted-foreground">{number}</p>
          </div>
          <div className="md:col-span-9 max-w-3xl">
            <h3 className="t-headline-1 mb-5">{title}</h3>
            <p className="t-lede text-foreground/75 measure-wide">{desc}</p>
          </div>
        </div>
      </article>
    );
  }

  /* ─── Split (Service 02) ──────────────────────────────────────
     Image 8 cols (aspect-[3/2]), text 4 cols, anchored right.
  ─────────────────────────────────────────────────────────────── */
  if (variant === "split") {
    return (
      <article ref={ref} className="reveal border-t border-border py-section-sm lg:py-section">
        <div className="container-x grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 items-center">
          {/* Image — 8 cols on desktop */}
          <div className="md:col-span-8">
            <div className="media-frame aspect-[3/2]">
              <img
                src={image}
                alt={alt}
                loading="lazy"
                decoding="async"
                width={1920}
                height={1280}
                className="media-img"
              />
            </div>
          </div>
          {/* Text — 4 cols */}
          <div className="md:col-span-4 space-y-5">
            <p className="t-eyebrow text-muted-foreground">{number}</p>
            <h3 className="t-headline-2">{title}</h3>
            <p className="t-lede text-foreground/75">{desc}</p>
          </div>
        </div>
      </article>
    );
  }

  /* ─── Editorial (Services 03–05) ─────────────────────────────
     Asymmetric 7/5 grid, landscape aspect, alternating flip.
  ─────────────────────────────────────────────────────────────── */
  return (
    <article ref={ref} className="reveal border-t border-border py-section-sm lg:py-section">
      <div className="container-x grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 items-center">

        {/* Text column */}
        <div
          className={
            flip
              ? "md:order-2 md:col-start-8 md:col-span-5 space-y-5"
              : "md:col-span-5 space-y-5"
          }
        >
          <p className="t-eyebrow text-muted-foreground">{number}</p>
          <h3 className="t-headline-2">{title}</h3>
          <p className="t-lede text-foreground/75">{desc}</p>
        </div>

        {/* Image column — 7 cols (dominant) */}
        <div
          className={
            flip
              ? "md:order-1 md:col-start-1 md:col-span-7"
              : "md:col-start-6 md:col-span-7"
          }
        >
          <div className="media-frame aspect-[4/3]">
            <img
              src={image}
              alt={alt}
              loading="lazy"
              decoding="async"
              width={1920}
              height={1440}
              className="media-img"
            />
          </div>
        </div>

      </div>
    </article>
  );
}
