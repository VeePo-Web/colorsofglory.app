/**
 * audioImport — THE shared import core (Lane D · THE HOMECOMING, Phase D1).
 *
 * Every surface that lets a user bring an existing recording into a song
 * (capture import, the Voice tab drop zone, the canvas voice sheet, the
 * library's add-memos gesture) validates and prepares the file HERE, so the
 * flagship story — an iPhone Voice Memos .m4a — behaves identically at every
 * door. The platform truths this module encodes (sourced in
 * docs/prompts/LANE-D-THE-HOMECOMING.md):
 *
 *  T1 · Bare `accept="audio/*"` is broken on iOS Safari (open WebKit bug —
 *      audio files gray out in the Files browser). The working string lists
 *      explicit extensions FIRST and keeps `audio/*` LAST for Android.
 *  T4 · iOS reports .m4a as the nonstandard `audio/x-m4a` — or nothing at
 *      all. Validate by EXTENSION first, then MIME, and normalize to a
 *      server-allowed Content-Type before upload. Never trust `File.type`,
 *      and never borrow the recorder's mime as a fallback.
 *  T3 · Since iOS 18.2 a layered memo can export `.qta` (QuickTime Audio) —
 *      browsers cannot play it; it gets a kind redirect, not an error.
 *  T6 · A Files pick that hasn't downloaded from iCloud can arrive empty.
 *  T9 · The server truth is 50MB with an exact-match mime allowlist
 *      (audio/webm · audio/mp4 · audio/mpeg · audio/wav · audio/x-wav ·
 *      audio/ogg). One size limit, one honest sentence, everywhere.
 *  T7 · iOS can suspend an <audio> metadata load forever — every duration
 *      read is watchdog-raced; unknown duration is honest (0).
 */

/** The ONE size truth — mirrors the server cap in voice-memo-upload-url. */
export const IMPORT_MAX_BYTES = 50 * 1024 * 1024;

/**
 * The ONE accept string (T1). Explicit extensions first (un-grays audio in
 * the iOS Files picker), concrete MIMEs next, `audio/*` last so Android's
 * picker still filters. Only formats the server accepts are invited —
 * showing a user a file we must later refuse is the GarageBand sin.
 */
export const ACCEPT_AUDIO =
  ".m4a,.mp3,.wav,.ogg,.webm,audio/mp4,audio/x-m4a,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/*";

/** Extensions that upload as-is, mapped to the server-allowed Content-Type. */
const MIME_BY_EXTENSION: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  webm: "audio/webm",
};

/** MIME aliases the wild reports → the server-allowed spelling. */
const MIME_ALIASES: Record<string, string> = {
  "audio/mp4": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/ogg": "audio/ogg",
  "audio/webm": "audio/webm",
};

/** Audio formats we can name but the pipeline can't serve yet (server
 *  allowlist + browser playback truth). They get a kind sentence, not a 400. */
const KNOWN_UNSUPPORTED = new Set(["aac", "flac", "amr", "3gp", "3gpp", "aiff", "aif", "wma", "alac", "caf"]);

export type ImportRejectReason = "qta" | "not-audio" | "format" | "empty-file" | "too-big";

export type ImportValidation =
  | { ok: true; mimeType: string; title: string | null }
  | { ok: false; reason: ImportRejectReason; message: string };

/** Verbatim copy system (LANE-D Part 6) — calm, cause + fix in one sentence. */
export const IMPORT_REJECT_COPY: Record<ImportRejectReason, string> = {
  qta: "That's an Apple layered recording — in Voice Memos, share it again and choose the standard option.",
  "empty-file": "That file didn't finish downloading from iCloud — open it once in Files, then try again.",
  "too-big": "That one's over 50MB — likely a Lossless recording. Trim it, or set Voice Memos quality to Compressed, then share again.",
  "not-audio": "That file isn't audio — MP3, M4A, or WAV work.",
  format: "That audio format needs converting first — MP3, M4A, or WAV work best.",
};

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** The filename is a SUGGESTED title, never an identifier (T3): strip the
 *  extension, keep everything else — spaces, apostrophes, emoji, dots. */
export function titleFromFileName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  // dot >= 0 (not > 0): a dotfile like ".m4a" has an extension and NO stem —
  // it must fall through to the caller's default name, never title itself.
  const base = (dot >= 0 ? name.slice(0, dot) : name).trim();
  return base.length > 0 ? base : null;
}

/**
 * Synchronous gate — extension first, MIME second (T4). Safe for drop zones
 * that must answer before any async work.
 */
export function validateImportFile(file: File): ImportValidation {
  const ext = extensionOf(file.name);
  if (ext === "qta") return { ok: false, reason: "qta", message: IMPORT_REJECT_COPY.qta };

  const mimeFromExt = MIME_BY_EXTENSION[ext];
  const mimeFromType = MIME_ALIASES[file.type.split(";")[0].trim().toLowerCase()];
  const looksAudio = Boolean(mimeFromExt || mimeFromType) || file.type.startsWith("audio/") || KNOWN_UNSUPPORTED.has(ext);
  if (!looksAudio) return { ok: false, reason: "not-audio", message: IMPORT_REJECT_COPY["not-audio"] };

  // Real audio, but a shape the pipeline can't serve end-to-end yet — the
  // kind sentence beats the silent parked upload it would otherwise become.
  const mimeType = mimeFromExt ?? mimeFromType;
  if (!mimeType) return { ok: false, reason: "format", message: IMPORT_REJECT_COPY.format };

  if (file.size <= 0) return { ok: false, reason: "empty-file", message: IMPORT_REJECT_COPY["empty-file"] };
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, reason: "too-big", message: IMPORT_REJECT_COPY["too-big"] };

  return { ok: true, mimeType, title: titleFromFileName(file.name) };
}

/** Watchdog-raced duration read (T7). Exported for reuse; injectable below. */
export function measureImportDurationMs(file: Blob, watchdogMs = 4000): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (ms: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      done(Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : 0);
    };
    audio.onerror = () => done(0);
    setTimeout(() => done(0), watchdogMs);
    audio.src = url;
  });
}

export type PreparedImport =
  | { ok: true; file: File; mimeType: string; title: string | null; durationMs: number }
  | { ok: false; reason: ImportRejectReason; message: string };

/**
 * The full async preparation every import handler runs: validate →
 * normalize the Content-Type → suggest a title → read the duration safely.
 * Waveform peaks are NOT computed here — `saveMemoDurable` already owns
 * that (with the decode gates), and one owner beats two.
 */
export async function prepareImport(
  file: File,
  deps: { measureDurationMs?: (file: Blob) => Promise<number> } = {},
): Promise<PreparedImport> {
  const validation = validateImportFile(file);
  if (!validation.ok) return validation;
  const measure = deps.measureDurationMs ?? measureImportDurationMs;
  const durationMs = await measure(file).catch(() => 0);
  return { ok: true, file, mimeType: validation.mimeType, title: validation.title, durationMs };
}
