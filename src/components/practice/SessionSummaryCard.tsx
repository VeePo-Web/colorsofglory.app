import { useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { PracticePlayerState } from "@/lib/audio/practiceTypes";

interface SessionSummaryCardProps {
  state: PracticePlayerState;
  onDismiss: () => void;
}

/** 3-second auto-dismissing summary shown when a session ends. */
export function SessionSummaryCard({ state, onDismiss }: SessionSummaryCardProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 5 s
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  // Total loops this session
  const totalLoops = Object.values(state.stats.loopsPerSection).reduce(
    (sum, n) => sum + n,
    0,
  );

  // Duration
  const sessionMs = Date.now() - state.stats.startTimeMs;
  const minutes   = Math.floor(sessionMs / 60000);
  const seconds   = Math.floor((sessionMs % 60000) / 1000);
  const durationLabel = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  // Sections practiced
  const sectionsPracticed = state.sections.filter(s => s.loopCountThisSession > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 pointer-events-none"
      style={{ animation: "summary-in 350ms var(--cog-ease-reveal) both" }}
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--cog-cream-light)",
          border: "1px solid var(--cog-border)",
          boxShadow: "0 8px 40px rgba(28,26,23,0.18)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-3"
          style={{ borderBottom: "1px solid var(--cog-border)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} color="#B8953A" />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "var(--cog-charcoal)",
              }}
            >
              Session complete
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "rgba(28,26,23,0.06)",
              color: "var(--cog-warm-gray)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex px-5 py-4 gap-4">
          <StatCell label="Duration" value={durationLabel} />
          <StatCell label="Total loops" value={String(totalLoops)} />
          {state.stats.fullRunThroughs > 0 && (
            <StatCell label="Full runs" value={String(state.stats.fullRunThroughs)} />
          )}
        </div>

        {/* Per-section breakdown */}
        {sectionsPracticed.length > 0 && (
          <div
            className="px-5 pb-5"
            style={{ borderTop: "1px solid var(--cog-border)", paddingTop: 12 }}
          >
            {sectionsPracticed.map(section => (
              <div
                key={section.id}
                className="flex items-center justify-between py-1.5"
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "var(--cog-charcoal)",
                  }}
                >
                  {section.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--cog-gold)",
                  }}
                >
                  ×{section.loopCountThisSession}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Dismiss hint */}
        <div className="pb-4 flex justify-center">
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "var(--cog-muted)",
            }}
          >
            Dismisses in 5 s
          </span>
        </div>
      </div>

      <style>{`
        @keyframes summary-in {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.6875rem",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--cog-warm-gray)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--cog-charcoal)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
