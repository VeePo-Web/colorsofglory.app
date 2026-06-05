import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { isAudioFile, ACCEPTED_AUDIO_EXTENSIONS } from "@/lib/voice/audioFormat";

interface UploadDropZoneProps {
  onFile: (file: File) => void;
  isPro?: boolean;
  disabled?: boolean;
}

/**
 * UploadDropZone — desktop drag-and-drop target + mobile file picker trigger.
 * Accepts: mp3, m4a, wav, webm, ogg, aac
 * On mobile: <input type="file" accept="audio/*"> opens iOS Files (incl. Voice Memos) or Android picker.
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

    const file = e.dataTransfer.files[0];
    if (!file) return;
    validateAndSubmit(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSubmit(file);
    e.target.value = ""; // reset so same file can be re-uploaded
  };

  const validateAndSubmit = (file: File) => {
    setError(null);

    if (!isAudioFile(file)) {
      setError("That file type isn't supported. Try MP3, M4A, WAV, or WebM.");
      return;
    }

    const maxBytes = isPro ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Max size is ${isPro ? "200MB" : "20MB"}.`);
      return;
    }

    onFile(file);
  };

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={`audio/*,${ACCEPTED_AUDIO_EXTENSIONS}`}
        onChange={handleInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Drop zone / tap target */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload audio file — tap to browse or drag a file here"
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
            Upload audio file
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: "var(--font-body)", fontSize: 11, color: "#999" }}>
            MP3, M4A, WAV · iOS Voice Memos via Files app
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
