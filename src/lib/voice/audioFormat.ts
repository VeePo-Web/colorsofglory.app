const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

export function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of PREFERRED_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported can throw on some browsers
    }
  }
  return "";
}

export function getFileExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "audio";
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatDurationLive(ms: number): string {
  return formatDuration(ms);
}

/** Derive audio duration from a File/Blob without uploading it */
export function getAudioFileDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(audio.duration * 1000);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
  });
}

export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
  "audio/x-aac",
];

export const ACCEPTED_AUDIO_EXTENSIONS = ".mp3,.m4a,.wav,.webm,.ogg,.aac";

export function isAudioFile(file: File): boolean {
  if (ACCEPTED_AUDIO_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp3", "m4a", "wav", "webm", "ogg", "aac"].includes(ext);
}
