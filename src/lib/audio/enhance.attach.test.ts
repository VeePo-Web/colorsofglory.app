import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { __resetPolishBus, isPolishSupported, polishAttach } from "./enhance";

/**
 * The FORCED-FAILURE proof for the strictly-additive ladder: at every rung —
 * no Web Audio at all, a chain that fails to build, a source that fails to
 * create, a context that won't run, a remote src — polishAttach must
 * resolve without throwing and leave the element playing exactly as today.
 */

type AnyNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  [k: string]: unknown;
};

const makeNode = (extra: Record<string, unknown> = {}): AnyNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  ...extra,
});

const param = () => ({ value: 0, setTargetAtTime: vi.fn() });

function makeStubCtx() {
  return {
    state: "running" as string,
    currentTime: 0,
    destination: makeNode(),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createGain: vi.fn(() => makeNode({ gain: param() })),
    createBiquadFilter: vi.fn(() =>
      makeNode({ type: "", frequency: param(), Q: param(), gain: param() }),
    ),
    createDynamicsCompressor: vi.fn(() =>
      makeNode({
        threshold: param(),
        ratio: param(),
        knee: param(),
        attack: param(),
        release: param(),
      }),
    ),
    createMediaElementSource: vi.fn(() => makeNode()),
  };
}

let stub: ReturnType<typeof makeStubCtx> | null = null;

function installStub(mutate?: (s: ReturnType<typeof makeStubCtx>) => void) {
  stub = makeStubCtx();
  mutate?.(stub);
  (window as unknown as { AudioContext: unknown }).AudioContext = function (this: unknown) {
    return stub;
  } as unknown as typeof AudioContext;
}

function blobEl(): HTMLAudioElement {
  const el = document.createElement("audio");
  Object.defineProperty(el, "src", {
    value: "blob:http://localhost/take-1",
    writable: true,
    configurable: true,
  });
  return el;
}

describe("polish — the forced-failure ladder (never worse, never throws)", () => {
  beforeEach(() => {
    __resetPolishBus();
    delete (window as { AudioContext?: unknown }).AudioContext;
    stub = null;
  });
  afterEach(() => {
    __resetPolishBus();
    delete (window as { AudioContext?: unknown }).AudioContext;
  });

  it("RUNG 3 — no Web Audio at all: attach no-ops cleanly, twice", async () => {
    expect(isPolishSupported()).toBe(false);
    const el = blobEl();
    await expect(polishAttach(el, {})).resolves.toBeUndefined();
    await expect(polishAttach(el, {})).resolves.toBeUndefined();
    expect(el.src).toBe("blob:http://localhost/take-1"); // untouched
  });

  it("remote src never attaches — signed-URL playback keeps today's path", async () => {
    installStub();
    const el = document.createElement("audio");
    Object.defineProperty(el, "src", { value: "https://cdn.example/take.m4a", writable: true });
    await polishAttach(el, {});
    expect(stub!.createMediaElementSource).not.toHaveBeenCalled();
  });

  it("RUNG 2 — chain build fails (compressor throws): source still routes, no throw", async () => {
    installStub((s) => {
      s.createDynamicsCompressor = vi.fn(() => {
        throw new Error("unsupported node");
      });
    });
    const el = blobEl();
    await expect(polishAttach(el, {})).resolves.toBeUndefined();
    // The source was created and connected to SOMETHING (the loudness-only
    // rung) — a created source must never dangle (dangling = silence).
    expect(stub!.createMediaElementSource).toHaveBeenCalledTimes(1);
    const source = stub!.createMediaElementSource.mock.results[0].value as AnyNode;
    expect(source.connect).toHaveBeenCalled();
  });

  it("source creation fails: element stays dry and a later attach retries", async () => {
    installStub((s) => {
      s.createMediaElementSource = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("InvalidStateNode");
        })
        .mockImplementation(() => makeNode());
    });
    const el = blobEl();
    await expect(polishAttach(el, {})).resolves.toBeUndefined();
    await expect(polishAttach(el, {})).resolves.toBeUndefined();
    // First call threw (stayed dry); second call retried and succeeded.
    expect(stub!.createMediaElementSource).toHaveBeenCalledTimes(2);
  });

  it("suspended context that won't run: attach skips (dry this play), retries next tap", async () => {
    installStub((s) => {
      s.state = "suspended";
      s.resume = vi.fn(async () => {}); // resolves but never becomes running
    });
    const el = blobEl();
    await polishAttach(el, {});
    expect(stub!.createMediaElementSource).not.toHaveBeenCalled();
    // The context comes alive (a real gesture) — the next attach succeeds.
    stub!.state = "running";
    await polishAttach(el, {});
    expect(stub!.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  it("happy path: attach is idempotent — one source per element, ever", async () => {
    installStub();
    const el = blobEl();
    await polishAttach(el, {});
    await polishAttach(el, {});
    await polishAttach(el, {});
    expect(stub!.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  it("downstream connect failure hard-wires the source to the destination", async () => {
    installStub((s) => {
      // makeup gain creation works, but connecting the source to it throws.
      s.createGain = vi.fn(() => {
        const n = makeNode({ gain: param() });
        return n;
      });
    });
    const el = blobEl();
    const source = makeNode();
    source.connect = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("connect failed");
      })
      .mockImplementation(() => {});
    stub!.createMediaElementSource = vi.fn(() => source);
    await expect(polishAttach(el, {})).resolves.toBeUndefined();
    // Second connect call is the hard-wire to destination.
    expect(source.connect).toHaveBeenCalledTimes(2);
    expect(source.connect.mock.calls[1][0]).toBe(stub!.destination);
  });
});
