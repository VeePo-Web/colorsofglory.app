import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImportCoachSheet, {
  IMPORT_COACH_KEY,
  hasSeenImportCoach,
  isIOSDevice,
  markImportCoachSeen,
  shouldCoachImport,
} from "./ImportCoachSheet";
import ImportMemoButton from "@/components/capture/ImportMemoButton";
import UploadDropZone from "./UploadDropZone";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";

let uaSpy: { restore: () => void } | null = null;
const setUA = (ua: string) => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent");
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  uaSpy = {
    restore: () => {
      // Remove the instance shadow so the prototype getter rules again.
      delete (window.navigator as unknown as Record<string, unknown>).userAgent;
      if (original) Object.defineProperty(Navigator.prototype, "userAgent", original);
    },
  };
};

/**
 * Lane D · Moment 2 — the once-per-device picture coach. iOS only (the
 * Files ritual only exists there), shown once, never blocking, marked seen
 * the moment it appears (a dismissal is an answer too).
 */
describe("the coach gate", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    uaSpy?.restore();
    uaSpy = null;
  });

  it("never coaches off-iOS — Android and desktop pickers need no ritual", () => {
    expect(isIOSDevice()).toBe(false); // default jsdom UA
    expect(shouldCoachImport()).toBe(false);
  });

  it("coaches an iPhone exactly once", () => {
    setUA(IPHONE_UA);
    expect(isIOSDevice()).toBe(true);
    expect(shouldCoachImport()).toBe(true);
    markImportCoachSeen();
    expect(shouldCoachImport()).toBe(false);
    expect(hasSeenImportCoach()).toBe(true);
  });
});

describe("ImportCoachSheet — two steps, one gold tap through", () => {
  beforeEach(() => localStorage.clear());

  it("shows the ritual in pictures and marks itself seen on APPEARANCE", () => {
    render(<ImportCoachSheet onChooseFile={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/two taps in voice memos/i)).toBeInTheDocument();
    expect(screen.getByText("Save to Files")).toBeInTheDocument();
    expect(screen.getByText("Recents")).toBeInTheDocument();
    // A dismissal is an answer — the marker lands on mount, never nags twice.
    expect(localStorage.getItem(IMPORT_COACH_KEY)).toBe("1");
  });

  it("'Choose the file' is the one gold action; 'Not now' walks away calmly", () => {
    const onChooseFile = vi.fn();
    const onClose = vi.fn();
    render(<ImportCoachSheet onChooseFile={onChooseFile} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /choose the file/i }));
    expect(onChooseFile).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("the doors open the coach at the right moment", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    uaSpy?.restore();
    uaSpy = null;
  });

  it("capture door: first iOS tap coaches, the gold tap reaches the picker", () => {
    setUA(IPHONE_UA);
    render(<ImportMemoButton onPicked={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /import a voice memo/i }));
    expect(screen.getByText(/two taps in voice memos/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /choose the file/i }));
    expect(screen.queryByText(/two taps in voice memos/i)).toBeNull();
    // Second visit goes straight to the picker — no coach.
    fireEvent.click(screen.getByRole("button", { name: /import a voice memo/i }));
    expect(screen.queryByText(/two taps in voice memos/i)).toBeNull();
  });

  it("drop zone: iOS keeps a quiet forever-door back to the coach", () => {
    setUA(IPHONE_UA);
    markImportCoachSeen(); // even after it's seen…
    render(<UploadDropZone onFile={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /here.s how/i }));
    expect(screen.getByText(/two taps in voice memos/i)).toBeInTheDocument();
  });

  it("drop zone off-iOS: no link, no coach — the zone goes straight in", () => {
    render(<UploadDropZone onFile={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /here.s how/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /upload audio files/i }));
    expect(screen.queryByText(/two taps in voice memos/i)).toBeNull();
  });
});
