import type { StatusChipSpec } from "@/lib/library/songStatus";

/** Small muted status pill — human, calm, never a red badge (PV11). */
const StatusChip = ({ spec, small = false }: { spec: StatusChipSpec; small?: boolean }) => {
  const tones: Record<StatusChipSpec["tone"], React.CSSProperties> = {
    gold: { backgroundColor: "var(--cog-gold-pale)", color: "var(--cog-gold)" },
    neutral: { backgroundColor: "var(--cog-cream-dark)", color: "var(--cog-warm-gray)" },
    quiet: {
      backgroundColor: "transparent",
      color: "var(--cog-muted)",
      border: "1px solid var(--cog-border)",
    },
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold ${
        small ? "px-1.5 text-[0.5625rem]" : "px-2 text-[0.625rem]"
      }`}
      style={{
        ...tones[spec.tone],
        height: small ? 16 : 19,
        fontFamily: "var(--font-body)",
        letterSpacing: "0.02em",
      }}
    >
      {spec.label}
    </span>
  );
};

export default StatusChip;
