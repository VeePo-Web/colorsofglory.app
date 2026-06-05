#!/usr/bin/env bash
# F4 Whiteboard Canvas — perf audit runner.
#
# Usage:
#   bun dev                                  # terminal 1
#   bash scripts/codex/run-f4-audit.sh       # terminal 2
#
# Output: docs/codex-audit-artifacts/f4/{traces,heap,screenshots}/
#
# This is a thin orchestrator. Codex (or you) opens the resulting traces
# in Chrome DevTools Performance tab and fills SUMMARY.md.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/docs/codex-audit-artifacts/f4"
PROFILE_DIR="/tmp/cog-f4-audit"
DEBUG_PORT="${CHROME_DEBUG_PORT:-9222}"
TARGET_URL="${TARGET_URL:-http://localhost:8080/song/1/canvas}"
CHROME_BIN="${CHROME:-}"

mkdir -p "$OUT/traces" "$OUT/heap" "$OUT/screenshots"

if [[ -z "$CHROME_BIN" ]]; then
  for c in chromium google-chrome chrome \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
    if command -v "$c" >/dev/null 2>&1 || [[ -x "$c" ]]; then
      CHROME_BIN="$c"; break
    fi
  done
fi
if [[ -z "$CHROME_BIN" ]]; then
  echo "ERROR: no chromium found. Set CHROME=/path/to/chrome." >&2
  exit 1
fi

if ! curl -fsS -o /dev/null --max-time 3 "$TARGET_URL"; then
  echo "ERROR: $TARGET_URL unreachable. Start the dev server first (bun dev)." >&2
  exit 1
fi

pkill -f "$PROFILE_DIR" 2>/dev/null || true
rm -rf "$PROFILE_DIR" && mkdir -p "$PROFILE_DIR"

echo "[F4] launching chromium on port $DEBUG_PORT"
"$CHROME_BIN" \
  --user-data-dir="$PROFILE_DIR" \
  --window-size=390,844 \
  --force-device-scale-factor=3 \
  --enable-precise-memory-info \
  --js-flags="--expose-gc" \
  --remote-debugging-port="$DEBUG_PORT" \
  --no-first-run --no-default-browser-check \
  --disable-features=Translate,InterestFeedV2 \
  --disable-background-timer-throttling \
  "$TARGET_URL" >/tmp/cog-f4-chromium.log 2>&1 &

for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://localhost:$DEBUG_PORT/json/version"; then break; fi
  sleep 0.5
done
if ! curl -fsS -o /dev/null "http://localhost:$DEBUG_PORT/json/version"; then
  echo "ERROR: chromium did not expose CDP. See /tmp/cog-f4-chromium.log" >&2
  exit 1
fi

CDP_URL="http://localhost:$DEBUG_PORT" \
OUT_DIR="$OUT" \
TARGET_URL="$TARGET_URL" \
  npx --yes -p chrome-remote-interface@0.33.3 node "$ROOT/scripts/codex/f4-driver.mjs"

echo "[F4] done. Artifacts in $OUT"
echo "[F4] next: open SUMMARY.md and fill the 'Measured (Codex)' section."