import { useReveal } from "./useReveal";

interface Props {
  eyebrow?: string;
  body: string;
}

/**
 * The closing title card of the case study.
 * Dark ground + display scale — the most visually authoritative moment
 * in the case study, carrying the accumulated weight of everything above.
 * Treated identically to the CTA section: bg-foreground, t-display-2.
 */
export default function CaseStudyTakeaway({ eyebrow = "Takeaway", body }: Props) {
  const ref = useReveal<HTMLDivElement>();
  return (
    /*
      Dark close — mirrors the CTA section treatment.
      The takeaway is Act III resolution: it should land with more
      weight than any individual section above it.
    */
    <section className="bg-foreground text-background py-section-lg">
      <div ref={ref} className="reveal container-x">

        {/* Eyebrow — very quiet, doesn't compete with the statement */}
        <p className="t-eyebrow text-background/30 mb-8 md:mb-12">
          {eyebrow}
        </p>

        {/*
          The takeaway at t-display-2 — was t-headline-2 (same scale as
          section headers). This sentence is the reason the case study exists.
          It earns display scale.
          max-w-[22ch] keeps lines punchy at large type sizes.
          text-wrap: balance (from t-display-2) handles mobile wrapping gracefully.
        */}
        <p className="t-display-2 wrap-editorial max-w-[22ch]">
          {body}
        </p>

      </div>
    </section>
  );
}
