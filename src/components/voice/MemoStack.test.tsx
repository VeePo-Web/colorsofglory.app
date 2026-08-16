import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MemoStack, { type StackMemoView } from "./MemoStack";

vi.mock("@/integrations/cog/memos", () => ({
  setLayerMix: vi.fn(async () => {}),
}));

// The engine is its own tested surface — here we pin the ROW UI, so the
// hook is stubbed (jsdom has no real audio stack to prepare against).
vi.mock("@/hooks/useStackPlayer", () => ({
  useStackPlayer: () => ({
    state: { isPlaying: false, progress: 0, loading: false, muted: new Set(), soloId: null, gains: {} },
    prepare: vi.fn(async () => {}),
    playPause: vi.fn(),
    toggleMute: vi.fn(),
    toggleSolo: vi.fn(),
    setGain: vi.fn(),
  }),
}));

const view = (over: Partial<StackMemoView> & { id: string }): StackMemoView => ({
  title: "Take",
  contributor: "You",
  durationMs: 4200,
  waveformPeaks: null,
  pitchContour: null,
  ...over,
});

const base = view({ id: "base-1", title: "Chorus hum" });
const mine = view({ id: "layer-mine", title: "My harmony", parentMemoId: "base-1" });
const theirs = view({
  id: "layer-sarah",
  title: "Sarah's response",
  contributor: "Sarah",
  parentMemoId: "base-1",
});

/**
 * Layer management from the sheet — the GarageBand capability gap, closed
 * the COG way: remove is own-work only, asks once inline (no modal, no red
 * wall), and Keep walks it back without a trace.
 */
describe("MemoStack — layer remove (own work, one calm confirm)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderStack = (onRemoveLayer = vi.fn()) => {
    render(
      <MemoStack
        base={base}
        layers={[mine, theirs]}
        onRecordOver={vi.fn()}
        onRemoveLayer={onRemoveLayer}
        canRemoveLayer={(id) => id === "layer-mine"}
      />,
    );
    return onRemoveLayer;
  };

  it("offers Remove only on the writer's own layer", () => {
    renderStack();
    expect(screen.getByRole("button", { name: /remove your layer "my harmony"/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove your layer "sarah's response"/i })).toBeNull();
  });

  it("hides Remove everywhere when the host passes no handler (viewers)", () => {
    render(
      <MemoStack base={base} layers={[mine, theirs]} onRecordOver={vi.fn()} canRemoveLayer={() => true} />,
    );
    expect(screen.queryByRole("button", { name: /remove your layer/i })).toBeNull();
  });

  it("asks once inline; Keep walks it back without firing", () => {
    const onRemoveLayer = renderStack();
    fireEvent.click(screen.getByRole("button", { name: /remove your layer "my harmony"/i }));
    expect(screen.getByText(/remove this layer\? it leaves the stack for everyone/i)).toBeInTheDocument();
    // The mixer hides while the question is up — one decision at a time.
    expect(screen.queryByLabelText(/you's layer volume/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /keep this layer/i }));
    expect(screen.queryByText(/remove this layer\?/i)).toBeNull();
    expect(screen.getByLabelText(/you's layer volume/i)).toBeInTheDocument();
    expect(onRemoveLayer).not.toHaveBeenCalled();
  });

  it("confirming fires onRemoveLayer with the layer id and closes the strip", () => {
    const onRemoveLayer = renderStack();
    fireEvent.click(screen.getByRole("button", { name: /remove your layer "my harmony"/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove you's layer from this stack/i }));
    expect(onRemoveLayer).toHaveBeenCalledWith("layer-mine");
    expect(screen.queryByText(/remove this layer\?/i)).toBeNull();
  });

  it("every layer row carries its own waveform shape (not an anonymous strip)", () => {
    const { container } = render(
      <MemoStack base={base} layers={[mine, theirs]} onRecordOver={vi.fn()} />,
    );
    // Base strip + one per layer row (all decorative, hidden from readers).
    const strips = container.querySelectorAll('[aria-hidden="true"]');
    const barStrips = [...strips].filter((el) => el.childElementCount >= 10);
    expect(barStrips.length).toBeGreaterThanOrEqual(3);
  });
});
