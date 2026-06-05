# F4 Audit — 12 Scenarios

| # | Name | Goal | Pass criteria |
|---|---|---|---|
| P1 | Cold load | LCP / TBT on first paint | LCP < 1.2 s, TBT < 200 ms (Fast 3G + 4× CPU) |
| P2 | Hot navigate | Tab into canvas | Route paint < 120 ms (P75) |
| P3 | Pan | 60 touchMove @ 16 ms | 0 long tasks > 50 ms; INP < 100 ms |
| P4 | Pinch zoom | 2-finger spread 30 frames | ≥ 55 fps |
| P5 | Tap card | Select toggle | INP < 100 ms |
| P6 | Drag card 200 px | 12 touchMoves | ≥ 55 fps; no dropped frames > 32 ms |
| P7 | Hold-to-record | Mic prompt + ring | Prompt < 200 ms; ring ≥ 55 fps |
| P8 | Add 50 cards | Bulk insert | First card < 50 ms; no GC > 16 ms |
| P9 | Long-song scroll | Pan 1200 px / 2 s | ≥ 55 fps |
| P10 | Memory after 5 min | Idle + 30 cards | Heap growth < 15 MB; no retained Audio/AudioContext |
| P11 | Reduced motion | `prefers-reduced-motion: reduce` | No animation > 1 ms |
| P12 | Re-render storm | 60 selection toggles | Scripting < 400 ms over 1 s |

Each scenario writes
`docs/codex-audit-artifacts/f4/traces/P{NN}-name.json`. P10 also writes
`heap/t0…t5.heapsnapshot`. P1/P5/P6 write screenshots.

The runner script `scripts/codex/run-f4-audit.sh` drives all 12 over CDP.
After the run, fill the "Measured (Codex)" section in
`docs/codex-audit-artifacts/f4/SUMMARY.md`.