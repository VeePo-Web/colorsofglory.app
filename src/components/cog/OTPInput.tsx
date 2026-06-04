import { useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from "react";

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
 */
const OTPInput = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OTPInputProps) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const handleChange = (idx: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[idx] = char;
    onChange(next);

    if (char && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
    if (char && idx === length - 1) {
      const code = next.join("");
      if (code.length === length) onComplete?.(code);
    }
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const next = Array(length).fill("");
    pasted.split("").forEach((c, i) => { next[i] = c; });
    onChange(next);
    const focusIdx = Math.min(pasted.length, length - 1);
    refs.current[focusIdx]?.focus();
    if (pasted.length === length) onComplete?.(pasted);
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, idx) => {
        const filled = !!value[idx];
        return (
          <input
            key={idx}
            ref={(el) => { refs.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[idx] ?? ""}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={disabled}
            aria-label={`Code digit ${idx + 1} of ${length}`}
            className="text-center text-2xl font-bold rounded-2xl outline-none transition-all duration-150 disabled:opacity-40"
            style={{
              width: 48,
              height: 64,
              backgroundColor: "#FFFFFF",
              border: error
                ? "1.5px solid #E05440"
                : filled
                ? "1.5px solid #B5935A"
                : "1.5px solid rgba(0,0,0,0.12)",
              color: "#1A1A1A",
              fontFamily: "var(--font-body)",
              boxShadow: filled && !error
                ? "0 0 0 3px rgba(181,147,90,0.15)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
};

export default OTPInput;
