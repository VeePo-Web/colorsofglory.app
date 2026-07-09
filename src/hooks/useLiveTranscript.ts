import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/**
 * On-device live transcription wrapper around the Web Speech API
 * (`webkitSpeechRecognition` on Safari/iOS, `SpeechRecognition` elsewhere
 * Chromium-based).
 *
 * - Returns a flat `words` array of finalized words with synthetic ms offsets
 *   anchored to the moment `start()` was called.
 * - Exposes the current interim partial as `partial` so the UI can show a
 *   ghost word at the tail of the transcript pane.
 * - When the browser does not support SpeechRecognition (most desktop Safari,
 *   most mobile non-iOS, some embedded webviews), `supported` is false and the
 *   caller should fall back to the server-side `transcribe-take` batch path.
 *
 * Production note: Web Speech does not give per-word timestamps. We lay the
 * words out RIGHT-ALIGNED inside the wall-clock window each final result
 * arrived in, capping each word's synthetic span: a recognizer finalizes just
 * after speech ends, so the words belong at the window's end and any silence
 * that preceded them becomes a visible GAP before the first word. That gap is
 * exactly the prosody signal the section matcher's command-vs-content
 * confidence uses ("…[pause] chorus" = announcement). The server transcript
 * (real Whisper word timing) takes over in the Review Sheet.
 */

/** Longest plausible span for one spoken word (ms) in the synthetic layout. */
const MAX_SYNTH_WORD_MS = 320;

/**
 * Distribute a final result's tokens inside its arrival window. Dense speech
 * fills the window evenly (unchanged behavior); a window that is much longer
 * than its word count (silence, then a phrase) right-aligns the words so the
 * leading quiet stays a gap instead of being smeared across the words.
 * Pure — exported for unit tests.
 */
export function layoutFinalWords(
  tokens: string[],
  windowStartMs: number,
  windowEndMs: number,
): TranscriptWord[] {
  if (tokens.length === 0) return [];
  const span = Math.max(1, windowEndMs - windowStartMs);
  const per = Math.min(MAX_SYNTH_WORD_MS, span / tokens.length);
  const firstStart = windowEndMs - per * tokens.length;
  return tokens.map((text, j) => ({
    text,
    startMs: Math.round(firstStart + j * per),
    endMs: Math.round(firstStart + (j + 1) * per),
  }));
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseLiveTranscriptOptions {
  /** BCP-47 tag passed to the recognizer. Defaults to the browser locale. */
  lang?: string;
}

export interface UseLiveTranscriptApi {
  /** Whether the runtime supports on-device live STT. */
  supported: boolean;
  /** True between `start()` and `stop()` calls. */
  listening: boolean;
  /** Last non-final partial — shown as a ghost word at the tail. */
  partial: string;
  /** Final words emitted so far, with ms offsets relative to `start()`. */
  words: TranscriptWord[];
  /** Most recent recognition error, if any. */
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useLiveTranscript(
  options: UseLiveTranscriptOptions = {},
): UseLiveTranscriptApi {
  const Ctor = getRecognitionCtor();
  const supported = Ctor != null;

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastEmittedAtRef = useRef<number>(0);
  const wantsListeningRef = useRef<boolean>(false);

  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState<string>("");
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setWords([]);
    setPartial("");
    setError(null);
    lastEmittedAtRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    wantsListeningRef.current = false;
    setListening(false);
    setPartial("");
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const start = useCallback(() => {
    if (!supported || !Ctor) {
      setError("speech_unsupported");
      return;
    }
    // Always start clean — callers expect each take to begin at 0ms.
    reset();
    startedAtRef.current = Date.now();
    lastEmittedAtRef.current = 0;
    wantsListeningRef.current = true;

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "speech_init_failed");
      return;
    }
    rec.lang =
      options.lang ??
      (typeof navigator !== "undefined" ? navigator.language : "en-US");
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      const nowOffset = Date.now() - startedAtRef.current;
      let interim = "";
      const newFinals: TranscriptWord[] = [];
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const result = ev.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const tokens = transcript.trim().split(/\s+/).filter(Boolean);
          if (tokens.length === 0) continue;
          const windowStart = lastEmittedAtRef.current;
          const windowEnd = Math.max(windowStart + 1, nowOffset);
          newFinals.push(...layoutFinalWords(tokens, windowStart, windowEnd));
          lastEmittedAtRef.current = windowEnd;
        } else {
          interim += (interim ? " " : "") + transcript;
        }
      }
      if (newFinals.length > 0) {
        setWords((prev) => prev.concat(newFinals));
      }
      setPartial(interim.trim());
    };

    rec.onerror = (ev) => {
      const code = ev?.error ?? "speech_error";
      // `no-speech` and `aborted` are noisy and self-recoverable.
      if (code !== "no-speech" && code !== "aborted") {
        setError(code);
      }
    };

    rec.onend = () => {
      // Recognizers stop themselves after long silences. If we still want to
      // be listening, transparently restart. Otherwise just settle the state.
      if (wantsListeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through to settle state */
        }
      }
      setListening(false);
      setPartial("");
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "speech_start_failed");
      wantsListeningRef.current = false;
      setListening(false);
    }
  }, [Ctor, options.lang, reset, supported]);

  // Stop on unmount.
  useEffect(() => {
    return () => {
      wantsListeningRef.current = false;
      const rec = recRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { supported, listening, partial, words, error, start, stop, reset };
}

export default useLiveTranscript;