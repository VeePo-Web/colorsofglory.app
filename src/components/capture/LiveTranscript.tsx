import { AnimatePresence, motion } from "framer-motion";
import type { TranscriptBlock } from "@/lib/capture/transcriptModel";

interface LiveTranscriptProps {
  blocks: TranscriptBlock[];
  /** Phase 1: shown while we wait for batch transcription to return. */
  status: "idle" | "listening" | "transcribing" | "ready" | "skipped";
  /** Optional in-flight partial word(s) from on-device live STT. */
  partial?: string;
  onWordTap?: (atMs: number) => void;
}

const STATUS_COPY: Record<LiveTranscriptProps["status"], string> = {
  idle: "Your transcript will appear here.",
  listening: "Listening… say \u201cVerse 1\u201d, \u201cChorus\u201d, or \u201cBridge\u201d to split sections.",
  transcribing: "Transcribing your take…",
  ready: "",
  skipped: "Transcription is off for this take.",
};

const SectionDivider = ({ label }: { label: string }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "10px 0 6px",
    }}
  >
    <span style={{ flex: 1, height: 1, background: "rgba(184,149,58,0.35)" }} />
    <span
      style={{
        fontFamily: "var(--font-body)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--cog-gold)",
        padding: "3px 10px",
        borderRadius: 999,
        background: "var(--cog-cream-light, #faf7f2)",
        border: "1px solid rgba(184,149,58,0.35)",
      }}
    >
      {label}
    </span>
    <span style={{ flex: 1, height: 1, background: "rgba(184,149,58,0.35)" }} />
  </motion.div>
);

const LiveTranscript = ({ blocks, status, partial = "", onWordTap }: LiveTranscriptProps) => {
  const populated = blocks.filter((b) => b.words.length > 0);
  const hasBlocks = populated.length > 0;
  const hasPartial = partial.trim().length > 0;

  return (
    <section
      aria-label="Live transcript"
      className="w-full"
      style={{ maxWidth: 460, margin: "0 auto", paddingRight: 72 /* keep rail clear */ }}
    >
      {!hasBlocks && !hasPartial && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--cog-muted, #a09689)",
            textAlign: "center",
            padding: "20px 0",
            margin: 0,
          }}
        >
          {STATUS_COPY[status]}
        </p>
      )}

      {(hasBlocks || hasPartial) && (
        <div
          style={{
            background: "var(--cog-cream-light, #faf7f2)",
            border: "1px solid rgba(184,149,58,0.22)",
            borderRadius: 20,
            padding: "16px 18px",
            boxShadow: "0 6px 20px rgba(28,26,23,0.05)",
          }}
        >
          <AnimatePresence initial={false}>
            {populated.map((block, idx) => {
              // First block usually has the implicit "unlabeled" marker; skip the divider there.
              const showDivider = idx > 0 || block.marker.source !== "voice" && block.marker.kind !== "unlabeled" && idx === 0
                ? block.marker.kind !== "unlabeled"
                : false;
              return (
                <div key={block.id}>
                  {showDivider && idx > 0 && <SectionDivider label={block.marker.label} />}
                  {showDivider && idx === 0 && <SectionDivider label={block.marker.label} />}
                  <motion.p
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 17,
                      lineHeight: 1.55,
                      color: "var(--cog-charcoal)",
                      margin: 0,
                    }}
                  >
                    {block.words.map((word, wIdx) => (
                      <button
                        key={`${block.id}-${wIdx}`}
                        type="button"
                        onClick={() => onWordTap?.(word.startMs)}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          font: "inherit",
                          color: "inherit",
                          cursor: onWordTap ? "pointer" : "default",
                        }}
                      >
                        {word.text}
                        {wIdx < block.words.length - 1 ? " " : ""}
                      </button>
                    ))}
                  </motion.p>
                </div>
              );
            })}
          </AnimatePresence>

          {hasPartial && (
            <p
              aria-live="polite"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--cog-warm-gray, #6b6459)",
                fontStyle: "italic",
                opacity: 0.8,
                margin: hasBlocks ? "6px 0 0" : 0,
              }}
            >
              {partial}
              <span style={{ color: "var(--cog-gold)" }}>{"\u00a0\u258f"}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default LiveTranscript;