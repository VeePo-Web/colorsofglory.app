import { DIVIDER_X } from "./CanvasViewport";

/**
 * The two zone header labels: "Ideas Tree" and "Final Song"
 * Rendered as absolute elements within the canvas layer.
 * They pan with the canvas, so they always appear in the correct zone.
 */
const ZoneLabels = () => (
  <>
    {/* Ideas Tree label — left zone */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 48,
        top: 40,
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#B5935A",
          textTransform: "uppercase",
          letterSpacing: "0.20em",
          fontFamily: "var(--font-body)",
          marginBottom: 6,
        }}
      >
        Ideas Tree
      </p>
      <p
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#1A1A1A",
          fontFamily: "var(--font-display)",
          lineHeight: 1.1,
          maxWidth: 220,
        }}
      >
        Every idea,{"\n"}unfiltered
      </p>
      <p
        style={{
          fontSize: 13,
          color: "#999",
          fontFamily: "var(--font-body)",
          marginTop: 6,
          maxWidth: 260,
          lineHeight: 1.5,
        }}
      >
        Nothing is ever deleted. Capture, explore, keep going.
      </p>
    </div>

    {/* Final Song label — right zone */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: DIVIDER_X + 48,
        top: 40,
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#53AB8B",
          textTransform: "uppercase",
          letterSpacing: "0.20em",
          fontFamily: "var(--font-body)",
          marginBottom: 6,
        }}
      >
        Final Song
      </p>
      <p
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#1A1A1A",
          fontFamily: "var(--font-display)",
          lineHeight: 1.1,
          maxWidth: 220,
        }}
      >
        Ready to{"\n"}worship
      </p>
      <p
        style={{
          fontSize: 13,
          color: "#999",
          fontFamily: "var(--font-body)",
          marginTop: 6,
          maxWidth: 260,
          lineHeight: 1.5,
        }}
      >
        Drag ideas across to build the final arrangement.
      </p>
    </div>
  </>
);

export default ZoneLabels;
