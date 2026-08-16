import { useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { ACCEPT_AUDIO, prepareImport } from "@/lib/voice/audioImport";

interface ImportMemoButtonProps {
  disabled?: boolean;
  /** mimeType is the NORMALIZED Content-Type (iOS lies about m4a — T4). */
  onPicked: (file: File, durationMs: number, mimeType: string) => void | Promise<void>;
}

/**
 * The capture lane's import door (Lane D · THE HOMECOMING). One tap → the
 * native picker. The accept string is THE iOS law (T1): bare `audio/*` is
 * broken on iOS Safari — audio files gray out in the Files browser — so the
 * shared ACCEPT_AUDIO leads with explicit extensions. Validation, mime
 * normalization, and the guarded duration read all live in the shared core,
 * so this door behaves identically to every other door.
 */
const ImportMemoButton = ({ disabled, onPicked }: ImportMemoButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const prepared = await prepareImport(file);
    if (!prepared.ok) {
      // Cause + fix in one calm sentence — never a technical rejection.
      toast(prepared.message);
      return;
    }
    await onPicked(prepared.file, prepared.durationMs, prepared.mimeType);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_AUDIO}
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
