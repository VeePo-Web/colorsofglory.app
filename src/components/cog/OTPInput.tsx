import { useRef, useEffect } from "react";

interface OTPInputProps {
  length?: number;
  value: string[];
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
}

/**
 * 6-digit OTP entry, built for frictionless autofill.
 *
 * One real <input autocomplete="one-time-code"> spans the whole row (transparent),
 * with the styled gold cells rendered on top. This is the web.dev-recommended
 * single-field pattern: iOS Security-Code AutoFill, Android autofill, and full-code
 * paste all land cleanly with no per-box truncation. Props/behaviour (auto-submit on
 * full code) are identical to the prior box version; the gold-cell look is unchanged.
 */
const OTPInput = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OTPInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const code = value.join("").replace(/\D/g, "").slice(0, length);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const setCode = (raw: string) => {
    const clean = raw.replace(/\D/g, "").slice(0, length);
    const next = Array.from({ length }, (_, i) => clean[i] ?? "");
    onChange(next);
    if (clean.length === length) onComplete?.(clean);
  };

  // The active cell acts as the visible "caret" since the real input is transparent.
  const focusedIndex = Math.min(code.length, length - 1);

  return (
    <div className="relative">
      {/* Real input — transparent, covers the row, owns autofill / paste / keyboard */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        name="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={code}
        disabled={disabled}
        aria-label={`Enter the ${length}-digit code`}
        onChange={(e) => setCode(e.target.value)}
        className="absolute inset-0 z-10 h-full w-full opacity-0 disabled:cursor-not-allowed"
        style={{ caretColor: "transparent" }}
      />

      {/* Visual cells (decorative — taps fall through to the input) */}
      <div className="flex gap-2 justify-center pointer-events-none">
        {Array.from({ length }).map((_, idx) => {
          const char = code[idx] ?? "";
          const filled = char !== "";
          const isActive = idx === focusedIndex && !disabled;
          const highlight = (filled || isActive) && !error;
          return (
            <div
              key={idx}
              className="flex items-center justify-center text-2xl font-bold rounded-2xl transition-all duration-150"
              style={{
                width: 48,
                height: 64,
                backgroundColor: "#FFFFFF",
                border: error
                  ? "1.5px solid #E05440"
                  : highlight
                  ? "1.5px solid var(--cog-gold)"
                  : "1.5px solid rgba(0,0,0,0.12)",
                color: "#1A1A1A",
                fontFamily: "var(--font-body)",
                boxShadow: highlight ? "0 0 0 3px var(--cog-gold-glow)" : "none",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OTPInput;
