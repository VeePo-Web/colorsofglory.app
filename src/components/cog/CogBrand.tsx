import CrownMark from "./CrownMark";

type BrandVariant = "stacked" | "horizontal";
type BrandSize = "sm" | "md" | "lg";
type BrandTheme = "light" | "dark";

interface CogBrandProps {
  variant?: BrandVariant;
  size?: BrandSize;
  theme?: BrandTheme;
  className?: string;
}

const SIZE_MAP = {
  sm: { crown: 24, text: "text-[13px]", gap: "gap-1.5" },
  md: { crown: 32, text: "text-[15px]", gap: "gap-2" },
  lg: { crown: 40, text: "text-[18px]", gap: "gap-2.5" },
};

/**
 * Colors of Glory brand lockup — crown + wordmark.
 * Stacked (crown above text) or horizontal (crown left of text).
 * Matches the reference mockup logo exactly.
 */
const CogBrand = ({
  variant = "stacked",
  size = "sm",
  theme = "light",
  className = "",
}: CogBrandProps) => {
  const { crown, text, gap } = SIZE_MAP[size];
  const textColor = theme === "dark" ? "#FFFFFF" : "#1A1A1A";
  const crownColor = "#B5935A"; // always gold

  if (variant === "horizontal") {
    return (
      <div className={`flex items-center ${gap} ${className}`}>
        <CrownMark size={crown} color={crownColor} />
        <span
          className={`font-semibold tracking-tight ${text}`}
          style={{
            fontFamily: "var(--font-display)",
            color: textColor,
            lineHeight: 1,
          }}
        >
          Colors of Glory
        </span>
      </div>
    );
  }

  // Stacked
  return (
    <div className={`flex flex-col items-center ${gap} ${className}`}>
      <CrownMark size={crown} color={crownColor} />
      <span
        className={`font-semibold tracking-tight ${text}`}
        style={{
          fontFamily: "var(--font-display)",
          color: textColor,
          lineHeight: 1,
        }}
      >
        Colors of Glory
      </span>
    </div>
  );
};

export default CogBrand;
