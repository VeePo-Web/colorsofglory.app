import { useRef, useEffect } from "react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import type { PracticeSection, MasteryLevel } from "@/lib/audio/practiceTypes";

interface SectionStripProps {
  sections: PracticeSection[];
  activeSectionIndex: number;
  onSelect: (index: number) => void;
  /** In Drive Mode we show larger, higher-contrast chips */
  driveMode?: boolean;
}

/** Translates mastery level into the ring style for the chip. */
function masteryRingStyle(level: MasteryLevel): React.CSSProperties {
  switch (level) {
    case "untouched": return {};
    case "starting":  return { boxShadow: "0 0 0 2px rgba(184,149,58,0.30)" };
    case "working":   return { boxShadow: "0 0 0 2px rgba(184,149,58,0.65)" };
    case "solid":     return { boxShadow: "0 0 0 2px #B8953A" };
    case "mastered":  return { boxShadow: "0 0 0 3px #B8953A, 0 0 0 5px rgba(184,149,58,0.30)" };
  }
}

/** Small loop-count badge shown on each chip */
function LoopBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-white"
      style={{
        width: 16,
        height: 16,
        fontSize: 9,
        fontWeight: 700,
        backgroundColor: "var(--cog-gold)",
        fontFamily: "var(--font-body)",
        lineHeight: 1,
      }}
    >
      {count > 99 ? "∞" : count}
    </span>
  );
}

export function SectionStrip({
  sections,
  activeSectionIndex,
  onSelect,
  driveMode = false,
}: SectionStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll to keep active chip centered
  useEffect(() => {
    const chip = activeChipRef.current;
    const container = containerRef.current;
    if (!chip || !container) return;

    const chipLeft = chip.offsetLeft;
    const chipWidth = chip.offsetWidth;
    const containerWidth = container.offsetWidth;
    const target = chipLeft - containerWidth / 2 + chipWidth / 2;
    container.scrollTo({ left: target, behavior: "smooth" });
  }, [activeSectionIndex]);

  const chipHeight = driveMode ? 52 : 40;
  const chipPadX   = driveMode ? 20 : 14;
  const fontSize   = driveMode ? "0.9375rem" : "0.8125rem";

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto"
      style={{
        padding: "4px 16px",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {sections.map((section, index) => {
        const isActive  = index === activeSectionIndex;
        const colors    = getSectionColor(section.label);
        const ringStyle = masteryRingStyle(section.masteryLevel);

        return (
          <button
            key={section.id}
            ref={isActive ? activeChipRef : null}
            onClick={() => onSelect(index)}
            className="relative flex-shrink-0 flex items-center justify-center rounded-full transition-all"
            style={{
              height: chipHeight,
              paddingInline: chipPadX,
              backgroundColor: isActive ? colors.chipBg : "rgba(28,26,23,0.06)",
              border: isActive
                ? `1.5px solid ${colors.bg}`
                : "1.5px solid transparent",
              color: isActive ? colors.bg : "var(--cog-warm-gray)",
              fontSize,
              fontWeight: isActive ? 600 : 500,
              fontFamily: "var(--font-body)",
              transition: "all 200ms var(--cog-ease)",
              transform: isActive ? "scale(1.06)" : "scale(1)",
              whiteSpace: "nowrap",
              ...ringStyle,
            }}
          >
            {section.label}
            <LoopBadge count={section.loopCountThisSession} />
          </button>
        );
      })}

      {/* Trailing spacer so last chip can scroll to center */}
      <div style={{ minWidth: 16, flexShrink: 0 }} />
    </div>
  );
}
