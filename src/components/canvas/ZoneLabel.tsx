import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import { ROOT_HEIGHT, ROOT_TOP } from "@/lib/canvas/canvasGeometry";

/**
 * The two zone header labels: "Ideas Tree" and "Final Song".
 *
 * Compact by design: the floating Ideas/Final quick-nav pills are now the
 * primary zone indicator, so these in-canvas markers stay small and sit BELOW
 * the root song card (which anchors the top-left of the Ideas zone) rather
 * than colliding with it. DERIVED from the root box so a root-height change
 * can never shingle the label under the card again.
 */
const LABEL_TOP = ROOT_TOP + ROOT_HEIGHT + 24;

const ZoneMarker = ({
  left,
  eyebrow,
  title,
  sub,
  color,
}: {
  left: number;
  eyebrow: string;
  title: string;
  sub: string;
  color: string;
}) => (
  <div aria-hidden="true" style={{ position: "absolute", left, top: LABEL_TOP, pointerEvents: "none", maxWidth: 240 }}>
    <p
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.20em",
        fontFamily: "var(--font-body)",
        marginBottom: 4,
      }}
    >
      {eyebrow}
    </p>
    <p
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: "#1A1A1A",
        fontFamily: "var(--font-display)",
        lineHeight: 1.1,
        marginBottom: 2,
      }}
    >
      {title}
    </p>
    <p style={{ fontSize: 12, color: "var(--cog-warm-gray, #6B6459)", fontFamily: "var(--font-body)", lineHeight: 1.45 }}>
      {sub}
    </p>
  </div>
);

const ZoneLabels = () => (
  <>
    <ZoneMarker left={48} eyebrow="Ideas Tree" title="Every idea, unfiltered" sub="Nothing is deleted — capture and explore." color="#B5935A" />
    <ZoneMarker left={DIVIDER_X + 48} eyebrow="Final Song" title="Ready to worship" sub="The chosen arrangement, in order." color={GLORY.sage.dark} />
  </>
);

export default ZoneLabels;
