// F4 audit driver — orchestrates the 12 scenarios over CDP.
// Invoked by scripts/codex/run-f4-audit.sh. Reads env CDP_URL, OUT_DIR, TARGET_URL.

import CDP from "chrome-remote-interface";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.OUT_DIR;
const TARGET = process.env.TARGET_URL;
const CDPU = new URL(process.env.CDP_URL || "http://localhost:9222");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tracesDir = join(OUT, "traces");
const heapDir = join(OUT, "heap");
const shotsDir = join(OUT, "screenshots");
mkdirSync(tracesDir, { recursive: true });
mkdirSync(heapDir, { recursive: true });
mkdirSync(shotsDir, { recursive: true });

const client = await CDP({ host: CDPU.hostname, port: Number(CDPU.port) });
const { Page, Network, Emulation, Input, Tracing, Runtime, HeapProfiler, IO } = client;

await Page.enable();
await Network.enable();
await Runtime.enable();
await HeapProfiler.enable();

await Network.emulateNetworkConditions({
  offline: false, latency: 150,
  downloadThroughput: 196608, uploadThroughput: 98304,
});
await Emulation.setCPUThrottlingRate({ rate: 4 });
await Emulation.setDeviceMetricsOverride({
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
});
await Emulation.setTouchEmulationEnabled({ enabled: true, maxTouchPoints: 5 });

async function trace(name, fn) {
  await Tracing.start({
    transferMode: "ReturnAsStream",
    traceConfig: {
      includedCategories: [
        "devtools.timeline", "blink.user_timing", "loading", "v8.execute",
        "disabled-by-default-devtools.timeline.frame",
        "disabled-by-default-devtools.timeline",
      ],
    },
  });
  let streamHandle;
  const done = new Promise((res) => Tracing.tracingComplete((p) => { streamHandle = p.stream; res(); }));
  try { await fn(); } finally {
    await Tracing.end();
    await done;
    let json = "";
    while (true) {
      const { data, eof } = await IO.read({ handle: streamHandle });
      json += data;
      if (eof) break;
    }
    await IO.close({ handle: streamHandle });
    writeFileSync(join(tracesDir, `${name}.json`), json);
    console.log(`[trace] wrote ${name}.json`);
  }
}

async function screenshot(name) {
  const { data } = await Page.captureScreenshot({ format: "png" });
  writeFileSync(join(shotsDir, `${name}.png`), Buffer.from(data, "base64"));
}

const touch = (type, points) => Input.dispatchTouchEvent({ type, touchPoints: points });

async function navIdle(url) {
  await Page.navigate({ url });
  await Promise.race([
    new Promise((res) => Page.loadEventFired(res)),
    wait(15000),
  ]);
  await wait(500);
}

// P1 cold
await Network.clearBrowserCache();
await Network.clearBrowserCookies();
await trace("P01-cold-load", async () => { await navIdle(TARGET); });
await screenshot("P01-after-lcp");

// P2 hot navigate
await navIdle(TARGET.replace("/canvas", ""));
await trace("P02-hot-navigate", async () => { await navIdle(TARGET); });

// P3 pan
await trace("P03-pan", async () => {
  await touch("touchStart", [{ x: 200, y: 400, id: 1 }]);
  for (let i = 1; i <= 60; i++) {
    await touch("touchMove", [{ x: 200 - i * 3, y: 400 + i * 2, id: 1 }]);
    await wait(16);
  }
  await touch("touchEnd", []);
  await wait(200);
});

// P4 pinch
await trace("P04-pinch", async () => {
  await touch("touchStart", [
    { x: 180, y: 400, id: 1 }, { x: 220, y: 400, id: 2 },
  ]);
  for (let i = 1; i <= 30; i++) {
    await touch("touchMove", [
      { x: 180 - i * 4, y: 400, id: 1 },
      { x: 220 + i * 4, y: 400, id: 2 },
    ]);
    await wait(16);
  }
  await touch("touchEnd", []);
  await wait(200);
});

// P5 tap
await trace("P05-tap", async () => {
  await touch("touchStart", [{ x: 240, y: 360, id: 1 }]);
  await wait(16);
  await touch("touchEnd", []);
  await wait(300);
});
await screenshot("P05-tap-selected");

// P6 drag
await trace("P06-drag", async () => {
  await touch("touchStart", [{ x: 240, y: 360, id: 1 }]);
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", [{ x: 240 + i * 16, y: 360 + i * 8, id: 1 }]);
    await wait(16);
  }
  await touch("touchEnd", []);
  await wait(200);
});
await screenshot("P06-drag-end");

// P7 hold-record (stub mic)
await Page.addScriptToEvaluateOnNewDocument({
  source: `navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop(){} }] });`,
});
await navIdle(TARGET);
await trace("P07-hold-record", async () => {
  await touch("touchStart", [{ x: 195, y: 500, id: 1 }]);
  await wait(50);
  await touch("touchEnd", []);
  await wait(500);
});

// P8 add 50 cards (requires window.__cogSeed; otherwise records baseline)
await trace("P08-add-50", async () => {
  await Runtime.evaluate({ expression: `window.__cogSeed && window.__cogSeed(50);` });
  await wait(400);
});

// P9 long-scroll
await trace("P09-long-scroll", async () => {
  await touch("touchStart", [{ x: 200, y: 600, id: 1 }]);
  for (let i = 1; i <= 120; i++) {
    await touch("touchMove", [{ x: 200, y: 600 - i * 10, id: 1 }]);
    await wait(16);
  }
  await touch("touchEnd", []);
  await wait(200);
});

// P10 memory (6 snapshots; abbreviated to 30s spacing — bump to 60s in CI)
for (let i = 0; i <= 5; i++) {
  const chunks = [];
  const off = HeapProfiler.addHeapSnapshotChunk((p) => chunks.push(p.chunk));
  await HeapProfiler.takeHeapSnapshot({ reportProgress: false });
  await wait(500);
  writeFileSync(join(heapDir, `t${i}.heapsnapshot`), chunks.join(""));
  if (typeof off === "function") off();
  if (i < 5) await wait(30000);
}

// P11 reduced motion
await Emulation.setEmulatedMedia({ features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await trace("P11-reduced-motion", async () => {
  await touch("touchStart", [{ x: 240, y: 360, id: 1 }]);
  await wait(16);
  await touch("touchEnd", []);
  await wait(300);
});
await Emulation.setEmulatedMedia({ features: [] });

// P12 re-render storm
await trace("P12-rerender-storm", async () => {
  await Runtime.evaluate({
    expression: `(async () => {
      const ids = (window.__cogCardIds && window.__cogCardIds()) || [];
      if (!ids.length) return;
      for (let i = 0; i < 60; i++) {
        window.__cogSelectCard && window.__cogSelectCard(ids[i % ids.length]);
        await new Promise((r) => setTimeout(r, 16));
      }
    })();`,
    awaitPromise: true,
  });
});

await client.close();
console.log("[F4-driver] complete.");