# F4 Audit — Chrome flags + CDP throttling

## Headed Chromium launch

```
chromium \
  --user-data-dir=/tmp/cog-f4-audit \
  --window-size=390,844 \
  --force-device-scale-factor=3 \
  --enable-precise-memory-info \
  --js-flags="--expose-gc" \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --disable-features=Translate,InterestFeedV2 \
  --disable-background-timer-throttling \
  "http://localhost:8080/song/1/canvas"
```

On macOS replace `chromium` with the Google Chrome app binary path.

## CDP throttling (apply after navigate, before any scenario)

- `Network.emulateNetworkConditions` — Fast 3G: latency 150 ms, 1.5 Mbps down, 750 Kbps up.
- `Emulation.setCPUThrottlingRate` — `{ "rate": 4 }` (mid-tier Android).
- `Emulation.setDeviceMetricsOverride` — 390×844 @ 3x, mobile=true.
- `Emulation.setTouchEmulationEnabled` — `{ "enabled": true, "maxTouchPoints": 5 }`.

## Tracing config (per scenario)

`Tracing.start` with `transferMode: "ReturnAsStream"` and included categories:

- `devtools.timeline`
- `blink.user_timing`
- `loading`
- `v8.execute`
- `disabled-by-default-devtools.timeline.frame`
- `disabled-by-default-devtools.timeline`
- `disabled-by-default-v8.cpu_profiler`

## Heap snapshots (P10 only)

`HeapProfiler.takeHeapSnapshot { reportProgress: false }` at t=0, 60, 120,
180, 240, 300 s while idling on the canvas with 30 cards. Diff snapshot[5]
vs snapshot[0]; flag any retained `HTMLAudioElement`, `AudioContext`, or
`KeyframeEffect`.