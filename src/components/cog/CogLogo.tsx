import CogMark from "./CogMark";

type LogoSize = "sm" | "md" | "lg";

interface CogLogoProps {
  size?: LogoSize;
  className?: string;
}

const sizeConfig: Record<LogoSize, { markSize: number; textStyle: React.CSSProperties }> = {
  sm: {
    markSize: 28,
    textStyle: {
      fontSize: "13px",
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      fontFamily: "var(--font-body)",
      color: "var(--cog-muted)",
      fontWeight: 500,
    },
  },
  md: {
    markSize: 36,
    textStyle: {
      fontSize: "15px",
      letterSpacing: "0.16em",
      textTransform: "uppercase" as const,
      fontFamily: "var(--font-body)",
      color: "var(--cog-warm-gray)",
      fontWeight: 500,
    },
  },
  lg: {
    markSize: 48,
    textStyle: {
      fontSize: "18px",
      letterSpacing: "0.04em",
      fontFamily: "var(--font-display)",
      color: "var(--cog-charcoal)",
      fontWeight: 600,
    },
  },
};

const CogLogo = ({ size = "sm", className }: CogLogoProps) => {
  const config = sizeConfig[size];

  return (
    <div
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
      aria-label="Colors of Glory"
    >
      <div
        style={{
          filter: "drop-shadow(0 2px 6px rgba(184,149,58,0.25))",
          flexShrink: 0,
        }}
      >
        <CogMark size={config.markSize} />
      </div>
      <span style={config.textStyle}>Colors of Glory</span>
    </div>
  );
};

export default CogLogo;
