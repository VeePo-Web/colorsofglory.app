import { useReveal } from "./useReveal";
import { Button } from "./Button";

interface Props {
  onContact: () => void;
}

export default function PricingGuarantee({ onContact }: Props) {
  const refHead = useReveal<HTMLDivElement>();
  const refBody = useReveal<HTMLDivElement>();

  return (
    /*
      Dark-ground peak moment — the guarantee is the most commercially
      important statement on the page. Dark close signals: we are certain.
      Full-bleed, no container constraint, maximum authority.
    */
    <section className="bg-foreground text-background py-section-lg relative overflow-hidden">

      {/* Oversized ghost number — Benoist spatial texture */}
      <span
        className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 t-display-0 text-background leading-none opacity-[0.025] select-none pointer-events-none pr-10"
        aria-hidden
      >
        100%
      </span>

      <div className="container-x relative">

        <div ref={refHead} className="reveal mb-10 md:mb-14">
          <p className="t-eyebrow text-background/40 mb-8">
            The reshoot guarantee
          </p>
          <h2 className="t-display-2 wrap-editorial wrap-editorial-mobile-off max-w-[18ch]">
            If it&rsquo;s not exactly
            <br />
            what we discussed —
            <br />
            we reshoot. Full stop.
          </h2>
        </div>

        <div
          ref={refBody}
          className="reveal grid grid-cols-1 md:grid-cols-12 gap-10 items-end"
          style={{ transitionDelay: "120ms" }}
        >
          <div className="md:col-span-7">
            <p className="t-lede text-background/60 max-w-[46ch]">
              Before every shoot there&rsquo;s a brief — a 20-minute call or a
              written outline that defines what success looks like. If the
              delivered footage doesn&rsquo;t match that brief, we schedule a
              reshoot at no additional cost. No invoice. No argument.
            </p>
            <p className="t-body text-background/45 mt-5 max-w-[44ch]">
              This has happened twice in five years of shooting. The brief
              process exists precisely so it doesn&rsquo;t happen at all.
            </p>
          </div>

          <div className="md:col-span-5 md:flex md:justify-end">
            <Button variant="light" onClick={onContact} arrow>
              Book with confidence
            </Button>
          </div>
        </div>

      </div>
    </section>
  );
}
