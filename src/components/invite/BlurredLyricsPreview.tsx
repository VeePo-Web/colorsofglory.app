interface BlurredLyricsPreviewProps {
  snippet: string;
  maxLines?: number;
}

/**
 * Renders the first N lines of a song's lyrics behind a CSS blur.
 * Creates the "something is here — join to see it" visual pull on the invite screen.
 * aria-hidden because it's purely decorative — the content is intentionally illegible.
 */
const BlurredLyricsPreview = ({ snippet, maxLines = 3 }: BlurredLyricsPreviewProps) => {
  const lines = snippet.split('\n').slice(0, maxLines);

  return (
    <div className="relative select-none overflow-hidden" aria-hidden="true">
      {/* Blurred text */}
      <div style={{ filter: 'blur(5px)', opacity: 0.70 }}>
        {lines.map((line, i) => (
          <p
            key={i}
            className="leading-relaxed mb-1 text-[0.9375rem]"
            style={{ color: '#1A1A1A', fontFamily: 'var(--font-display)' }}
          >
            {line || ' '} {/* non-breaking space keeps line height for empty lines */}
          </p>
        ))}
      </div>

      {/* A slow gold sheen sweeps across the blur — the "something is here"
          pull feels alive and tantalizing, not a static frosted block.
          Reduced-motion hides it (no sweep). GPU-only, decorative. */}
      <style>{`
        @keyframes cogLyricShimmer {
          0% { transform: translateX(-120%); }
          55%, 100% { transform: translateX(120%); }
        }
        .cog-lyric-shimmer { animation: cogLyricShimmer 3.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cog-lyric-shimmer { animation: none; opacity: 0; } }
      `}</style>
      <div
        className="cog-lyric-shimmer absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, transparent 42%, rgba(232,213,160,0.45) 50%, transparent 58%)',
          pointerEvents: 'none',
        }}
      />

      {/* Frosted bottom fade — hides the blur edge cleanly */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 28,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.98) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default BlurredLyricsPreview;
