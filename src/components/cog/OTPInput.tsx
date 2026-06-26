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
 * 6-box OTP input with:
 * - Auto-advance on digit entry
 * - Backspace moves to previous box
 * - Full-code paste support
 * - Auto-submit callback when all digits filled
 * - Gold border on focused/filled state
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
        onChange={(e) => setCode(e.target.value)}
        className="absolute inset-0 z-10 h-full w-full opacity-0 disabled:cursor-not-allowed"
        style={{ caretColor: "transparent" }}
      />
      <div className="flex gap-2 justify-center pointer-events-none">
        {Array.from({ length }).map((_, idx) => {
          const char = code[idx] ?? "";
          const highlight = (char !== "" || (idx === focusedIndex && !disabled)) && !error;
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
