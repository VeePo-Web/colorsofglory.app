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

const LiveTranscript = ({ blocks, status, partial = "", onWordTap }: LiveTranscriptProps) => {
  const hasBlocks = blocks.some((b) => b.words.length > 0);
  const hasPartial = partial.trim().length > 0;

  return (
    <section
      aria-label="Live transcript"
      className="w-full"
      style={{ maxWidth: 480, margin: "0 auto" }}
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

      <div className="flex flex-col" style={{ gap: 12 }}>
        {blocks
          .filter((b) => b.words.length > 0)
          .map((block) => (
            <article
              key={block.id}
              style={{
                background: "var(--cog-cream-light, #faf7f2)",
                border: "1px solid rgba(184,149,58,0.30)",
                borderRadius: 16,
                padding: "14px 16px",
                boxShadow: "0 4px 14px rgba(28,26,23,0.05)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--cog-gold)",
                  margin: 0,
                  marginBottom: 6,
                }}
              >
                {block.marker.label}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: "var(--cog-charcoal)",
                  margin: 0,
                }}
              >
                {block.words.map((word, idx) => (
                  <button
                    key={`${block.id}-${idx}`}
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
                    {idx < block.words.length - 1 ? " " : ""}
                  </button>
                ))}
              </p>
            </article>
          ))}

        {hasPartial && (
          <p
            aria-live="polite"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              lineHeight: 1.5,
              color: "var(--cog-warm-gray, #6b6459)",
              fontStyle: "italic",
              opacity: 0.75,
              margin: 0,
              padding: "0 4px",
            }}
          >
            {partial}
            <span style={{ color: "var(--cog-gold)" }}>{"\u00a0\u258f"}</span>
          </p>
        )}
      </div>
    </section>
  );
};

export default LiveTranscript;