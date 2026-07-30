/**
 * R43 — "Cut the dead air off the front"
 *
 * Every hum starts with a fumble: the phone comes up, a chair scrapes, three
 * seconds of nothing. Nobody should have to hear that again, and nobody should
 * have to think about "editing audio" to remove it.
 *
 * Trim is non-destructive: the original file is never touched. We store two
 * numbers on the take (trim_start_ms / trim_end_ms) and the player simply
 * starts and stops there. Undo is a single call.
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type TakeTrim = {
  take_id: string;
  trim_start_ms: number;
  trim_end_ms: number | null;
  duration_ms: number | null;
};

/** Effective play window for a take, ready for an <audio> element. */
export function playWindow(t: {
  trim_start_ms?: number | null;
  trim_end_ms?: number | null;
  duration_ms?: number | null;
}): { startSec: number; endSec: number | null; lengthMs: number | null } {
  const start = Math.max(0, t.trim_start_ms ?? 0);
  const end = t.trim_end_ms ?? null;
  const total = t.duration_ms ?? null;
  const stop = end ?? total;
  return {
    startSec: start / 1000,
    endSec: end == null ? null : end / 1000,
    lengthMs: stop == null ? null : Math.max(0, stop - start),
  };
}

/** True when the take is playing exactly as recorded. */
export function isUntrimmed(t: { trim_start_ms?: number | null; trim_end_ms?: number | null }) {
  return (t.trim_start_ms ?? 0) === 0 && (t.trim_end_ms ?? null) === null;
}

/**
 * Suggest a start point by walking the stored waveform peaks and skipping the
 * leading near-silence. Runs client-side in microseconds — no round-trip, so
 * the UI can pre-place the handle the instant the sheet opens.
 */
export function suggestTrimStartMs(
  peaks: number[] | null | undefined,
  duration_ms: number | null | undefined,
  opts: { threshold?: number; padMs?: number } = {},
): number {
  if (!peaks?.length || !duration_ms) return 0;
  const max = Math.max(...peaks);
  if (max <= 0) return 0;
  const threshold = (opts.threshold ?? 0.12) * max;
  const perPeak = duration_ms / peaks.length;
  let i = 0;
  while (i < peaks.length && peaks[i] < threshold) i++;
  if (i === 0 || i >= peaks.length) return 0;
  const pad = opts.padMs ?? 120;
  return Math.max(0, Math.round(i * perPeak - pad));
}

/** Human line for the card: "starts 3s in" / "3s trimmed". */
export function trimLine(t: { trim_start_ms?: number | null; trim_end_ms?: number | null }): string | null {
  if (isUntrimmed(t)) return null;
  const start = Math.round((t.trim_start_ms ?? 0) / 1000);
  if (start > 0) return `starts ${start}s in`;
  return "trimmed";
}

export async function setTakeTrim(
  take_id: string,
  start_ms: number,
  end_ms?: number | null,
): Promise<TakeTrim> {
  const { data, error } = await (supabase as any).rpc("set_take_trim", {
    _take_id: take_id,
    _start_ms: Math.max(0, Math.round(start_ms)),
    _end_ms: end_ms == null ? null : Math.round(end_ms),
  });
  if (error) throw toCogError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row as TakeTrim;
}

export async function clearTakeTrim(take_id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("clear_take_trim", { _take_id: take_id });
  if (error) throw toCogError(error);
}
