import { useReveal } from "./useReveal";

export default function BrandStatement() {
  const refPremise = useReveal<HTMLDivElement>();
  const refClaim   = useReveal<HTMLParagraphElement>();

  return (
    <section className="bg-stone-50 py-section-lg">
      <div className="container-x">

        {/* Hairline rule — section anchor */}
        <div className="w-full h-px bg-foreground/10 mb-14 md:mb-20" />

        {/* Premise — t-display-2, leads the reveal */}
        <div ref={refPremise} className="reveal">
          <p className="t-display-2 mb-10 md:mb-14 lg:mb-16 wrap-editorial-mobile-off">
            How something is seen
            <br />
            decides what it&rsquo;s worth.
          </p>
        </div>

        {/*
          Claim — consequence of the premise, cascades in 250ms after.
          xl:pl-[25%] indent makes the logical relationship spatial —
          this is the consequence advancing, not a new thought.
          "Our work is…" removed — the strongest claims need no attribution.
        */}
        <p
          ref={refClaim}
          className="reveal t-headline-1 text-foreground/70 xl:pl-[25%] wrap-editorial wrap-editorial-mobile-off"
          style={{ transitionDelay: "250ms" }}
        >
          The difference between
          <br />
          being shown and being remembered.
        </p>

      </div>
    </section>
  );
}
