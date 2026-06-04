interface CrownMarkProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * The simple geometric crown mark — matches the reference mockups exactly.
 * Three-arch crown, open base, minimal strokes.
 * Used on ALL onboarding screens (NOT the aurora gradient mark).
 */
const CrownMark = ({
  size = 32,
  color = "#B5935A",
  className = "",
}: CrownMarkProps) => (
  <svg
    width={size}
    height={size * 0.75}
    viewBox="0 0 48 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Crown body — three arch points */}
    <path
      d="M4 30 L4 22 L14 10 L24 20 L34 4 L44 22 L44 30 Z"
      stroke={color}
      strokeWidth="2.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
    {/* Base band */}
    <rect
      x="4"
      y="30"
      width="40"
      height="4"
      rx="1"
      fill={color}
    />
    {/* Center peak tip dot */}
    <circle cx="34" cy="4" r="2" fill={color} />
    {/* Left base dot */}
    <circle cx="4" cy="22" r="1.5" fill={color} />
    {/* Right base dot */}
    <circle cx="44" cy="22" r="1.5" fill={color} />
  </svg>
);

export default CrownMark;
