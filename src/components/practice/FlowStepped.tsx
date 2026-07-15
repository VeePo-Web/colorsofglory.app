import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import { KaraokeLyrics } from "./KaraokeLyrics";
import { ChordLine } from "./ChordScroll";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

interface FlowSteppedProps {
  sections: PracticeSection[];
}

interface Step {
  sectionIndex: number;
  /** Index into the section's transcriptLines, or null = the whole section. */
  lineIndex: number | null;
}

/**
 * FlowStepped — Flow without motion. Because Flow IS motion, prefers-reduced-
 * motion (or the performer's own toggle) swaps the continuous scroll for this:
 * one section (or one timed line) at a time, advanced by a tap anywhere — or
 * by the keys a Bluetooth foot pedal sends (PageDown/ArrowDown/Space/Enter;
 * PageUp/ArrowLeft steps back). Same song, same serif, no scroll.
 */
const FlowStepped = ({ sections }: FlowSteppedProps) => {
  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    sections.forEach((section, sectionIndex) => {
      if (!section.chordLines?.length && section.transcriptLines?.length) {
        section.transcriptLines.forEach((_, lineIndex) => out.push({ sectionIndex, lineIndex }));
      } else {
        out.push({ sectionIndex, lineIndex: null });
      }
    });
    return out;
  }, [sections]);

  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];
  const section = step ? sections[step.sectionIndex] : undefined;
  const color = getSectionColor(section?.label ?? "");

  const advance = () => setIndex((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Foot-pedal / keyboard advance — pedals present as PageDown/ArrowDown keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["PageDown", "ArrowDown", "ArrowRight", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (["PageUp", "ArrowUp", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  if (!section) return null;

  return (
    <button
      type="button"
      onClick={advance}
      aria-label={`${section.label} — tap to show the next part`}
      className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 px-6 w-full"
      style={{ background: "transparent", border: "none", cursor: "pointer" }}
    >
      {/* Section label in its color, for peripheral recognition */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.875rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: color.bg,
        }}
      >
        {section.label}
      </span>

      {section.chordLines?.length ? (
        <span className="flex flex-col overflow-y-auto" style={{ gap: 10, maxHeight: "55vh" }}>
          {section.chordLines.map((line, li) => (
            <span key={li} style={{ textAlign: "center", display: "block" }}>
              <ChordLine
                line={line}
                lyricSize="clamp(1.375rem, 4.6vmin, 2rem)"
                chordSize="clamp(0.875rem, 2.8vmin, 1.125rem)"
                chordRow="1.6rem"
                emphasized
              />
            </span>
          ))}
        </span>
      ) : (
        <KaraokeLyrics
          lyrics={section.lyrics}
          transcriptLines={step.lineIndex != null ? section.transcriptLines : null}
          currentPositionMs={
            step.lineIndex != null
              ? (section.transcriptLines?.[step.lineIndex]?.startMs ?? 0) + 1
              : 0
          }
          show
          driveMode
        />
      )}

      <span
        className="flex items-center gap-4"
        style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-muted)" }}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label="Previous part"
          onClick={(e) => {
            e.stopPropagation();
            back();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              back();
            }
          }}
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44, background: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)" }}
        >
          <ChevronLeft size={18} />
        </span>
        {index + 1} / {steps.length} · tap or pedal to advance
      </span>
    </button>
  );
};

export default FlowStepped;
