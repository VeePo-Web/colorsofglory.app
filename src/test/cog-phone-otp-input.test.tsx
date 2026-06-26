import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import OTPInput from "@/components/cog/OTPInput";

/**
 * Guards the frictionless code-entry contract for phone sign-in (the single-field
 * OTP that backs iOS Security-Code AutoFill, Android autofill, WebOTP, and paste).
 * The shared auth tree churns; these lock the behavior so a future edit can't
 * silently regress autofill back to "keeps only the last digit."
 */

function Harness({ onComplete, error = false }: { onComplete?: (c: string) => void; error?: boolean }) {
  const [value, setValue] = useState<string[]>(Array(6).fill(""));
  return (
    <OTPInput length={6} value={value} onChange={setValue} onComplete={onComplete} error={error} />
  );
}

const getField = (c: HTMLElement) =>
  c.querySelector('input[autocomplete="one-time-code"]') as HTMLInputElement;

describe("OTPInput — frictionless single-field code entry", () => {
  it("accepts the whole code in one shot and auto-submits (autofill + paste path)", () => {
    const onComplete = vi.fn();
    const { container } = render(<Harness onComplete={onComplete} />);
    const input = getField(container);
    fireEvent.change(input, { target: { value: "123456" } });
    expect(input.value).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("strips non-digits and caps at the code length", () => {
    const onComplete = vi.fn();
    const { container } = render(<Harness onComplete={onComplete} />);
    const input = getField(container);
    fireEvent.change(input, { target: { value: "1-2 3a4b5c6d7" } });
    expect(input.value).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("does not auto-submit on a partial code", () => {
    const onComplete = vi.fn();
    const { container } = render(<Harness onComplete={onComplete} />);
    fireEvent.change(getField(container), { target: { value: "123" } });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("is one labeled field with the decorative cells hidden from screen readers", () => {
    const { container, getByLabelText } = render(<Harness />);
    expect(getByLabelText(/enter the 6-digit code/i)).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("flags the field invalid when a code is rejected", () => {
    const { container } = render(<Harness error />);
    expect(getField(container).getAttribute("aria-invalid")).toBe("true");
  });
});
