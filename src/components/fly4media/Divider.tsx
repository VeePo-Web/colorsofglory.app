import divider from "@/assets/divider-mountain-pass.jpg";

export default function Divider() {
  return (
    /*
      Reduced from h-[85vh] — 85% of the viewport for a section with zero
      information content was indefensible. 68vh is a deliberate pause,
      not a statement.

      The top gradient ties this section to the dark Services section above —
      the aerial footage emerges from darkness rather than cutting abruptly
      from near-black to full-brightness photograph.
    */
    <section
      className="relative w-full h-[50vh] md:h-[68vh] overflow-hidden bg-[#0a0a0a]"
      aria-label="Aerial still — Canadian Rockies"
    >
      <img
        src={divider}
        alt="Aerial view of a mountain pass in the Canadian Rockies, Alberta"
        loading="lazy"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-cover motion-safe:animate-kenburns"
      />

      {/*
        Top gradient — the image emerges from the darkness of the Services
        section above. Creates a cinematic fade-in rather than a hard cut
        between near-black and full-exposure photograph.
      */}
      <div
        className="absolute inset-x-0 top-0 h-40 md:h-52 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent pointer-events-none"
        aria-hidden
      />

      {/*
        Bottom gradient — legibility ground for the caption.
        Not decorative: the caption below requires a dark surface.
      */}
      <div
        className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0a0a0a]/75 to-transparent pointer-events-none"
        aria-hidden
      />

      {/*
        Editorial caption — bottom-left, authored, location-specific.
        This transforms the image from a decorative spacer into an
        attributed aerial still. The rule before the text is a
        typographic anchor (Aristide Benoist editorial caption technique).
      */}
      <div className="absolute bottom-6 md:bottom-8 inset-x-0 container-x flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-px bg-background/40 shrink-0" />
          <span className="t-micro text-background/50 tracking-[0.14em]">
            Canadian Rockies &nbsp;·&nbsp; Alberta, Canada
          </span>
        </div>
        <span className="t-micro text-background/35 hidden md:block tracking-[0.10em]">
          Fly4MEdia
        </span>
      </div>
    </section>
  );
}
