import { useRef, useState } from "react";

interface AlphaScrubberProps {
  letters: string[];
  onJump: (letter: string) => void;
}

/**
 * AlphaScrubber — the Apple Music index rail. Fixed to the right edge on
 * phones when the list is sorted A to Z; tap or drag a finger down the rail
 * to jump between letter sections instantly. Hidden on md+ where the whole
 * catalog is visible anyway.
 */
const AlphaScrubber = ({ letters, onJump }: AlphaScrubberProps) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const lastLetter = useRef<string | null>(null);

  const letterFromY = (clientY: number): string | null => {
    const rail = railRef.current;
    if (!rail) return null;
    const rect = rail.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const index = Math.min(letters.length - 1, Math.max(0, Math.floor(ratio * letters.length)));
    return letters[index] ?? null;
  };

  const scrub = (clientY: number) => {
    const letter = letterFromY(clientY);
    if (!letter || letter === lastLetter.current) return;
    lastLetter.current = letter;
    setActive(letter);
    onJump(letter);
  };

  return (
    <div
      ref={railRef}
      role="navigation"
      aria-label="Jump to letter"
      className="fixed z-[470] flex flex-col items-center md:hidden"
      style={{
        right: 2,
        top: "50%",
        transform: "translateY(-50%)",
        touchAction: "none",
        padding: "6px 4px",
      }}
      onTouchStart={(e) => scrub(e.touches[0].clientY)}
      onTouchMove={(e) => scrub(e.touches[0].clientY)}
      onTouchEnd={() => {
        setActive(null);
        lastLetter.current = null;
      }}
    >
      {letters.map((letter) => (
        <button
          key={letter}
          onClick={() => onJump(letter)}
          aria-label={`Jump to ${letter}`}
          className="flex items-center justify-center"
          style={{
            width: 18,
            height: 14,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "var(--font-body)",
            color: active === letter ? "var(--cog-gold)" : "var(--cog-warm-gray)",
          }}
        >
          {letter}
        </button>
      ))}
    </div>
  );
};

export default AlphaScrubber;
