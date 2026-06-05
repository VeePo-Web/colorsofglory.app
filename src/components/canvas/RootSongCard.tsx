interface RootSongCardProps {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const RootSongCard = ({ title, x, y, width, height }: RootSongCardProps) => (
  <article
    aria-label={`${title} root song card`}
    className="absolute flex flex-col justify-center rounded-2xl px-4 text-center"
    style={{
      left: x,
      top: y,
      width,
      height,
      backgroundColor: "var(--cog-cream-light)",
      border: "1.5px solid rgba(184,149,58,0.32)",
      boxShadow: "0 14px 34px rgba(28,26,23,0.10)",
    }}
  >
    <p
      className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: "var(--cog-gold)" }}
    >
      Root idea
    </p>
    <p
      className="text-lg font-semibold leading-tight"
      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
    >
      {title}
    </p>
  </article>
);

export default RootSongCard;
