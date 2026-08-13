import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { isAudioFile, ACCEPTED_AUDIO_EXTENSIONS } from "@/lib/voice/audioFormat";

interface UploadDropZoneProps {
  /** Called once per accepted file — pick five voice memos, five calls. */
  onFile: (file: File) => void;
  isPro?: boolean;
  disabled?: boolean;
}

/**
 * UploadDropZone — desktop drag-and-drop target + mobile file picker trigger.
 * Accepts: mp3, m4a, wav, webm, ogg, aac — MULTIPLE at once (THE BAND SHELF:
 * "upload all their voice memos and drafts"). Each accepted file fires onFile
 * individually, so every file rides its own retry-safe outbox job.
 * On mobile: <input type="file" accept="audio/*" multiple> opens iOS Files
 * (incl. Voice Memos) or the Android picker.
 */
const UploadDropZone = ({ onFile, isPro = false, disabled = false }: UploadDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    validateAndSubmit([...e.dataTransfer.files]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSubmit([...(e.target.files ?? [])]);
    e.target.value = ""; // reset so the same files can be re-picked
  };

  // Accept what's good, name what was skipped — a batch never fails wholesale
  // because one file was wrong.
  const validateAndSubmit = (files: File[]) => {
    setError(null);
    if (files.length === 0) return;

    const maxBytes = isPro ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
    let wrongType = 0;
    let tooBig = 0;
    for (const file of files) {
      if (!isAudioFile(file)) { wrongType += 1; continue; }
      if (file.size > maxBytes) { tooBig += 1; continue; }
      onFile(file);
    }

    const problems: string[] = [];
    if (wrongType > 0) problems.push(`${wrongType} ${wrongType === 1 ? "file isn't" : "files aren't"} audio (try MP3, M4A, WAV, or WebM)`);
    if (tooBig > 0) problems.push(`${tooBig} over the ${isPro ? "200MB" : "20MB"} limit`);
    if (problems.length > 0) setError(`Skipped ${problems.join(" and ")}.`);
  };

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={`audio/*,${ACCEPTED_AUDIO_EXTENSIONS}`}
        onChange={handleInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Drop zone / tap target */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload audio files — tap to browse or drag files here"
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click(); }}
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: `1.5px dashed ${isDragOver ? "#B8953A" : "rgba(0,0,0,0.16)"}`,
          backgroundColor: isDragOver
            ? "rgba(184,149,58,0.08)"
            : disabled
            ? "rgba(0,0,0,0.03)"
            : "#FAFAF6",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          transition: "border-color 150ms ease, background-color 150ms ease",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: "50%",
            backgroundColor: "rgba(184,149,58,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Upload size={15} style={{ color: "#B8953A" }} />
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
            Upload audio files
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: "var(--font-body)", fontSize: 11, color: "#999" }}>
            MP3, M4A, WAV · pick several at once · iOS Voice Memos via Files app
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: 6,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "#E05440",
            padding: "0 4px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default UploadDropZone;
