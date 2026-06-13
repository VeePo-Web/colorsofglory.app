import { useState } from "react";
import { GripVertical, Plus, X, Check } from "lucide-react";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

interface SequenceBuilderProps {
  sections: PracticeSection[];
  sequence: number[];
  onConfirm: (sequence: number[]) => void;
  onCancel: () => void;
}

/**
 * Simple drag-to-reorder sequence builder.
 * Uses HTML5 drag-and-drop (adequate for this use case; keeps zero new deps).
 */
export function SequenceBuilder({
  sections,
  sequence,
  onConfirm,
  onCancel,
}: SequenceBuilderProps) {
  // Local copy — the "pending" sequence the user is building
  const [draft, setDraft] = useState<number[]>(() =>
    sequence.length > 0 ? [...sequence] : [],
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addSection = (index: number) => {
    setDraft(d => [...d, index]);
  };

  const removeStep = (stepIndex: number) => {
    setDraft(d => d.filter((_, i) => i !== stepIndex));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;

    const next = [...draft];
    const [item] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, item);
    setDraft(next);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(28,26,23,0.40)" }}
        onClick={onCancel}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          backgroundColor: "var(--cog-cream)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          animation: "tray-in 300ms var(--cog-ease-reveal) both",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="rounded-full" style={{ width: 36, height: 4, backgroundColor: "var(--cog-border)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--cog-charcoal)",
            }}
          >
            Build sequence
          </span>
          <button
            onClick={onCancel}
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-4">

          {/* Draft sequence (draggable) */}
          {draft.length > 0 ? (
            <div className="flex flex-col gap-2 mb-6">
              <Label>Your sequence</Label>
              {draft.map((sectionIndex, stepIndex) => {
                const section = sections[sectionIndex];
                if (!section) return null;
                const isDragging    = dragIndex === stepIndex;
                const isDragTarget  = dragOverIndex === stepIndex && dragIndex !== stepIndex;

                return (
                  <div
                    key={`${stepIndex}-${sectionIndex}`}
                    draggable
                    onDragStart={e => handleDragStart(e, stepIndex)}
                    onDragOver={e => handleDragOver(e, stepIndex)}
                    onDrop={e => handleDrop(e, stepIndex)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all"
                    style={{
                      backgroundColor: isDragTarget
                        ? "rgba(184,149,58,0.12)"
                        : "rgba(28,26,23,0.05)",
                      border: isDragTarget
                        ? "1.5px solid rgba(184,149,58,0.40)"
                        : "1.5px solid transparent",
                      opacity: isDragging ? 0.4 : 1,
                      cursor: "grab",
                    }}
                  >
                    <GripVertical size={16} color="var(--cog-muted)" />

                    <span
                      className="flex-1"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.9375rem",
                        fontWeight: 500,
                        color: "var(--cog-charcoal)",
                      }}
                    >
                      {section.label}
                    </span>

                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.75rem",
                        color: "var(--cog-warm-gray)",
                        minWidth: 24,
                        textAlign: "center",
                      }}
                    >
                      {stepIndex + 1}
                    </span>

                    <button
                      onClick={() => removeStep(stepIndex)}
                      className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: "rgba(28,26,23,0.08)",
                        color: "var(--cog-warm-gray)",
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-xl mb-6 py-8"
              style={{ backgroundColor: "rgba(28,26,23,0.04)", border: "1.5px dashed var(--cog-border)" }}
            >
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--cog-muted)" }}>
                Tap sections below to add them
              </span>
            </div>
          )}

          {/* Available sections (tap to add) */}
          <div className="flex flex-col gap-2">
            <Label>Available sections</Label>
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => addSection(index)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 w-full text-left transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "rgba(28,26,23,0.04)",
                  border: "1.5px solid transparent",
                }}
              >
                <Plus size={16} color="var(--cog-gold)" />
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-body)",
                    fontSize: "0.9375rem",
                    color: "var(--cog-charcoal)",
                    fontWeight: 500,
                  }}
                >
                  {section.label}
                </span>
                {section.loopCountThisSession > 0 && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--cog-gold)", fontWeight: 600 }}>
                    ×{section.loopCountThisSession}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Confirm footer */}
        <div className="flex-shrink-0 px-5 pt-3 pb-5" style={{ borderTop: "1px solid var(--cog-border)" }}>
          <button
            onClick={() => draft.length > 0 && onConfirm(draft)}
            disabled={draft.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-full transition-all active:scale-[0.97]"
            style={{
              height: 52,
              backgroundColor: draft.length > 0 ? "var(--cog-gold)" : "rgba(28,26,23,0.08)",
              color: draft.length > 0 ? "#fff" : "var(--cog-muted)",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              fontWeight: 600,
              border: "none",
              boxShadow: draft.length > 0 ? "0 4px 16px rgba(184,149,58,0.35)" : "none",
              transition: "all 200ms var(--cog-ease)",
            }}
          >
            <Check size={18} />
            {draft.length === 0 ? "Add sections to confirm" : `Start sequence (${draft.length})`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tray-in {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "var(--cog-warm-gray)",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}
