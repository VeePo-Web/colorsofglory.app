import { useRef, useEffect } from "react";

interface OTPInputProps {
  length?: number;
  value: string[];
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  /** Full-power flash on the cells once the code verifies. */
  success?: boolean;
}

/**
 * ROYGBV power-up palette — one refined jewel tone per cell, so each digit
 * "powers up" its box as it lands. Tones are warmed to sit with the cream/gold
 * brand palette (the Y slot IS the brand gold, tying the rainbow to the brand)
 * rather than raw RGB primaries. Index = cell position.
 */
const CELL_HUES = [
  "#C94F4F", // R — warm crimson
  "#CE7A3B", // O — amber
  "#B8953A", // Y — the brand gold
  "#6E9B63", // G — sage
  "#5C7FB8", // B — dusty cobalt
  "#8A64A8", // V — soft violet
];
const hueFor = (idx: number) => CELL_HUES[idx % CELL_HUES.length];

/**
 * 6-box OTP input with:
 * - Auto-advance on digit entry
 * - Backspace moves to previous box
 * - Full-code paste support
 * - Auto-submit callback when all digits filled
 * - Gold focus ring on the active empty cell; each filled cell powers up in its
 *   own ROYGBV jewel tone (see CELL_HUES) with a subtle pop
 *
 * WebOTP auto-read (Android Chrome) is owned by the shared `useWebOtpAutofill`
 * hook at the verify-screen level, NOT here — a single listener avoids competing
 * `navigator.credentials.get({ otp })` requests. iOS keyboard autofill still works
 * via `autoComplete="one-time-code"` on the first box below.
 * Single transparent <input autocomplete="one-time-code"> sitting over styled gold
 * cells (the web.dev SMS-OTP pattern). One real field means iOS Security-Code
 * AutoFill, Android autofill, the QuickType suggestion, and full-code paste ALL land
 * the whole code cleanly — the multi-box approach silently truncated iOS autofill to
 * a single digit. Auto-submits via onComplete when the field is full. Keeps the same
 * props + gold look so callers (CodeVerifyPage) don't change. WebOTP one-tap (Android)
 * is owned by the verify screen's useWebOtpAutofill hook.
 */
const OTPInput = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  success = false,
}: OTPInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const code = value.join("").replace(/\D/g, "").slice(0, length);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // After a wrong/expired code the caller clears the field — pull focus back so
  // retry is instant and the keyboard stays up.
  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const setCode = (raw: string) => {
    const clean = raw.replace(/\D/g, "").slice(0, length);
    onChange(Array.from({ length }, (_, i) => clean[i] ?? ""));
    if (clean.length === length) onComplete?.(clean);
  };

  const focusedIndex = Math.min(code.length, length - 1);

  return (
    <div
      className="relative"
      onClick={() => inputRef.current?.focus()}
    >
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
        aria-invalid={error}
        onChange={(e) => setCode(e.target.value)}
        className="absolute inset-0 z-10 h-full w-full opacity-0 disabled:cursor-not-allowed"
        style={{ caretColor: "transparent" }}
      />
      {/* Power-up pop when a digit lands. Reduced-motion drops the pop —
          the colors stay (color isn't motion). Scoped keyframe, GPU-only. */}
      <style>{`
        @keyframes cogOtpPop {
          0% { transform: scale(1); }
          45% { transform: scale(1.09); }
          100% { transform: scale(1); }
        }
        .cog-otp-pop { animation: cogOtpPop 240ms cubic-bezier(0.34, 1.56, 0.64, 1); }
        @media (prefers-reduced-motion: reduce) { .cog-otp-pop { animation: none; } }
      `}</style>
      {/* Cells are purely visual — the labeled input above carries all semantics.
          Hidden from assistive tech so a screen reader reads one field, not six boxes.
          Each cell powers up in its own ROYGBV hue the instant its digit lands;
          on success the whole row glows at full power. */}
      <div className="flex gap-2 justify-center pointer-events-none" aria-hidden="true">
        {Array.from({ length }).map((_, idx) => {
          const char = code[idx] ?? "";
          const filled = char !== "";
          const hue = hueFor(idx);
          const focusRing = idx === focusedIndex && !disabled && !error && !filled;
          const powered = filled && !error;
          return (
            <div
              key={idx}
              className={`flex items-center justify-center text-2xl font-bold rounded-2xl transition-all duration-200 ${powered ? "cog-otp-pop" : ""}`}
              style={{
                width: 48,
                height: 64,
                backgroundColor: powered ? `${hue}${success ? "1F" : "12"}` : "#FFFFFF",
                border: error
                  ? "1.5px solid #E05440"
                  : powered
                  ? `1.5px solid ${hue}`
                  : focusRing
                  ? "1.5px solid var(--cog-gold)"
                  : "1.5px solid rgba(0,0,0,0.12)",
                color: powered ? hue : "#1A1A1A",
                fontFamily: "var(--font-body)",
                boxShadow: powered
                  ? success
                    ? `0 0 0 3px ${hue}33, 0 6px 18px ${hue}4D`
                    : `0 0 0 3px ${hue}26, 0 4px 14px ${hue}33`
                  : focusRing
                  ? "0 0 0 3px var(--cog-gold-glow)"
                  : "none",
                transform: success && !error ? "scale(1.04)" : "scale(1)",
                opacity: disabled && !success ? 0.4 : 1,
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
