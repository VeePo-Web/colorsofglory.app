/**
 * tempoKeyRunner — the F13 orchestration: fire-and-forget detection at
 * capture finalize, OFF the save path.
 *
 *   detect (on-device DSP, timeout-raced) → confidence-gate (silent when
 *   unsure) → fill ONLY the song's EMPTY tempo_bpm/key_signature (atomic
 *   `.is(null)` writes — a user value can never be overwritten) → record the
 *   suggestion so ChordPicker can show the calm "Sounds like G major ·
 *   94 BPM — confirm or change" line with the gold "detected" hint.
 *
 * Every failure mode — decode error, timeout, RLS denial, thrown DSP — ends
 * in "detected nothing": the take is already saved (the outbox sacred
 *promise never waits on this), the manual flow is exactly today's, and the
 * feature is simply invisible. Global captures (no songId) skip entirely.
 */

import {
  detectTempoKeyFromBlob,
  formatKeySignature,
  KEY_CONFIDENCE_FLOOR,
  TEMPO_CONFIDENCE_FLOOR,
  type TempoKeyResult,
} from "./tempoKey";
import { writeDetection } from "./detectedTempoKeyStore";
import { fillSongMusicIfEmpty } from "@/integrations/cog/songs";

/** Detection must never hold resources forever on a pathological decode. */
const DETECT_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

/**
 * Fire-and-forget. Call AFTER the take is durably queued/saved — this
 * function is incapable of blocking or failing a save (it never throws and
 * returns immediately).
 */
export function maybeDetectSongTempoKey(blob: Blob, songId: string | null | undefined): void {
  if (!songId || !blob || blob.size === 0) return;
  void (async () => {
    try {
      const result: TempoKeyResult | null = await withTimeout(
        detectTempoKeyFromBlob(blob),
        DETECT_TIMEOUT_MS,
      );
      if (!result) return;

      // The magic-or-silent gate: only values ABOVE their floor exist at all.
      const tempo =
        result.tempo && result.tempo.confidence >= TEMPO_CONFIDENCE_FLOOR ? result.tempo : null;
      const key = result.key && result.key.confidence >= KEY_CONFIDENCE_FLOOR ? result.key : null;
      if (!tempo && !key) return; // rambly / rubato / atonal → invisible

      const keySignature = key ? formatKeySignature(key.tonic, key.mode) : undefined;

      // Fill ONLY empty fields — this is what lets the metronome and the
      // sheet inherit the values with zero extra steps. RLS/offline failures
      // resolve as "not filled"; the picker suggestion below still surfaces.
      let filledBpm = false;
      let filledKey = false;
      try {
        const filled = await fillSongMusicIfEmpty(songId, {
          tempo_bpm: tempo?.bpm,
          key_signature: keySignature,
        });
        filledBpm = filled.filledBpm;
        filledKey = filled.filledKey;
      } catch {
        /* fill is best-effort; the suggestion still reaches the picker */
      }

      writeDetection(songId, {
        bpm: tempo?.bpm,
        tonic: key?.tonic,
        mode: key?.mode,
        keySignature,
        filledBpm,
        filledKey,
        at: Date.now(),
      });
    } catch {
      /* best-effort by contract — detection can never break a save */
    }
  })();
}
