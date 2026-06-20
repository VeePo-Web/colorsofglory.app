import { useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 50 * 1024 * 1024; // mirror intake-voice-memo cap

interface ImportMemoButtonProps {
  disabled?: boolean;
  onPicked: (file: File, durationMs: number) => void | Promise<void>;
}

async function measureDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      done(isFinite(d) && d > 0 ? Math.round(d * 1000) : 0);
    };
    audio.onerror = () => done(0);
    setTimeout(() => done(0), 1500);
    audio.src = url;
  });
}

const ImportMemoButton = ({ disabled, onPicked }: ImportMemoButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!/^audio\//.test(file.type) && !/\.(m4a|mp3|wav|aac|amr|3gp|webm|ogg|flac)$/i.test(file.name)) {
      toast.error("Only audio files can be imported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is bigger than 50MB.");
      return;
    }

    const durationMs = await measureDurationMs(file);
    await onPicked(file, durationMs);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handlePick}
        style={{ display: "none" }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center transition-transform active:scale-95"
        style={{
          gap: 8,
          padding: "0 18px",
          minHeight: 44,
          borderRadius: 999,
          background: "transparent",
          border: "1px solid rgba(184,149,58,0.30)",
          color: "var(--cog-charcoal)",
          fontFamily: "var(--font-display)",
          fontSize: 13,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <Upload size={14} />
        Import a voice memo
      </button>
    </>
  );
};

export default ImportMemoButton;