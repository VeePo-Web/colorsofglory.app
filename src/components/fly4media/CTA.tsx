import { useReveal } from "./useReveal";
import { Button } from "./Button";
import ctaBg from "@/assets/cta-background.jpg";

interface Props {
  onContact: () => void;
  /**
   * Optional eyebrow label. Pass an empty string (default) to suppress.
   * Only About page uses this ("If you've read this far —").
   */
  eyebrow?: string;
  heading?: React.ReactNode;
  cta?: string;
  /**
   * Optional background image override. When provided, image renders
   * prominently (not as a 7% texture) with a dark left-to-right gradient
   * so the heading + button stay legible.
   */
  backgroundImage?: string;
  backgroundAlt?: string;
}

export default function CTA({
  onContact,
  eyebrow = "",
  heading,
  cta = "Begin a conversation",
  backgroundImage,
  backgroundAlt = "",
}: Props) {
  const refHeading = useReveal<HTMLDivElement>();
  const refCta     = useReveal<HTMLDivElement>();

  const isFeatureBg = !!backgroundImage;
  const bgSrc = backgroundImage ?? ctaBg;

  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-foreground text-background py-section-lg min-h-[52vh] flex flex-col justify-center"
    >
      <img
        src={bgSrc}
        alt={backgroundAlt}
        aria-hidden={backgroundAlt ? undefined : true}
        loading="lazy"
        decoding="async"
        width={1920}
        height={1080}
        className={
          isFeatureBg
            ? "absolute inset-0 w-full h-full object-cover opacity-[0.62] pointer-events-none select-none"
            : "absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none select-none"
        }
      />

      {/*
        When a feature background is supplied, layer two overlays:
        - L→R gradient keeps the left (text) side dark, image breathes right
        - Bottom-up vignette guarantees button contrast
      */}
      {isFeatureBg && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/65 to-foreground/25 pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-foreground/80 to-transparent pointer-events-none"
          />
        </>
      )}

      <div className="relative container-x">

        {/* Heading — arrives first, argument before action */}
        <div ref={refHeading} className="reveal">
          {eyebrow && (
            <p className="t-eyebrow text-background/40 mb-8 md:mb-10">
              {eyebrow}
            </p>
          )}
          <h2 className="t-display-2 wrap-editorial wrap-editorial-mobile-off max-w-[16ch] mb-10 md:mb-14 lg:mb-16">
            {heading ?? (
              <>
                Some stories deserve
                <br />
                to be seen from above.
              </>
            )}
          </h2>
        </div>

        {/* Button — surfaces 200ms after heading; action follows argument */}
        <div ref={refCta} className="reveal" style={{ transitionDelay: "200ms" }}>
          <Button
            variant="light"
            onClick={onContact}
            arrow
          >
            {cta}
          </Button>
        </div>

      </div>
    </section>
  );
}
