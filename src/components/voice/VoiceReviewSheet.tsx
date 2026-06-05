import { useEffect, useRef, useState } from "react";
import { Play, Pause, Trash2 } from "lucide-react";
import SectionChip from "./SectionChip";
import { formatDuration } from "@/lib/voice/audioFormat";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";

// Re-use waveform seed from audioFormat domain (simple inline version)
function buildPreviewBars(seed: string, count: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    let h = 0;
    for (let j = 0; j < seed.length; j++) {
      h += seed.charCodeAt(j) * (i + 1) * (j + 1);
    }
    const t = i / (count - 1);
    const envelope = 1 - Math.abs(t - 0.5) * 1.4;
    const wave = Math.sin(i * 0.8 + (h % 100) * 0.06) * 0.35 + 0.5;
    bars.push(Math.max(0.1, Math.min(1, wave * envelope + 0.1)));
  }
  return bars;
}


const PREVIEW_BAR_COUNT = 24;
const PREVIEW_BAR_MAX_H = 40;

interface VoiceReviewSheetProps {
  recording: RecordingResult;
  defaultName: string;
  section: string;
  isPro?: boolean;
  onSave: (params: { name: string; section: string; transcribe: boolean }) => Promise<void>;
  onDiscard: () => void;
}

const VoiceReviewSheet = ({
  recording,
  defaultName,
  section: initialSection,
  isPro = false,
  onSave,
  onDiscard,
}: VoiceReviewSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(defaultName);
  const [section, setSection] = useState(initialSection);
  const [transcribe, setTranscribe] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const previewBars = buildPreviewBars(recording.blob.size.toString(), PREVIEW_BAR_COUNT);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    // Create object URL for playback preview
    const url = URL.createObjectURL(recording.blob);
    objectUrlRef.current = url;
    const audio = new Audio(url);
    audio.ontimeupdate = () => {
      setProgress(audio.currentTime / (audio.duration || 1));
    };
    audio.onended = () => { setIsPlaying(false); setProgress(0); };
    audioRef.current = audio;

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [recording.blob]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave({ name: name.trim() || defaultName, section, transcribe });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Frosted backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.65)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review your recording"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 800,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 40, height: 4, borderRadius: 9999,
            backgroundColor: "#CCC",
            margin: "12px auto 20px",
          }}
          aria-hidden="true"
        />

        <div style={{ padding: "0 24px" }}>
          {/* Waveform preview row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            {/* Play button */}
            <button
              type="button"
              onClick={togglePlay}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                backgroundColor: "#B8953A",
                color: "#FFF",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(184,149,58,0.35)",
                flexShrink: 0,
              }}
              aria-label={isPlaying ? "Pause preview" : "Play preview"}
            >
              {isPlaying
                ? <Pause size={16} fill="white" />
                : <Play size={16} fill="white" style={{ marginLeft: 2 }} />}
            </button>

            {/* Static preview waveform */}
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, height: PREVIEW_BAR_MAX_H }}>
              {previewBars.map((h, i) => {
                const played = isPlaying && progress > i / PREVIEW_BAR_COUNT;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: Math.round(h * PREVIEW_BAR_MAX_H),
                      borderRadius: 2,
                      backgroundColor: played ? "#B8953A" : "#D4AE5C",
                      opacity: h * 0.6 + 0.25,
                      transition: "background-color 100ms ease",
                    }}
                  />
                );
              })}
            </div>

            {/* Duration */}
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "#999",
                flexShrink: 0,
              }}
            >
              {formatDuration(recording.durationMs)}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 3,
              borderRadius: 9999,
              backgroundColor: "rgba(0,0,0,0.08)",
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                backgroundColor: "#B8953A",
                borderRadius: 9999,
                transition: "width 200ms linear",
              }}
            />
          </div>

          {/* Name field */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Memo name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1.5px solid rgba(0,0,0,0.10)",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "#1A1A1A",
                backgroundColor: "#FFFFFF",
                outline: "none",
                caretColor: "#B8953A",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#B8953A"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(0,0,0,0.10)"; }}
            />
          </div>

          {/* Section picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#666" }}>
              Save to:
            </span>
            <SectionChip value={section} onChange={setSection} />
          </div>

          {/* Transcribe toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 12,
              backgroundColor: isPro ? "rgba(184,149,58,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${isPro ? "rgba(184,149,58,0.18)" : "rgba(0,0,0,0.08)"}`,
              marginBottom: 20,
              cursor: isPro ? "pointer" : "not-allowed",
              opacity: isPro ? 1 : 0.6,
            }}
            onClick={() => { if (isPro) setTranscribe((v) => !v); }}
            role="button"
            tabIndex={isPro ? 0 : -1}
            onKeyDown={(e) => { if (e.key === " " && isPro) setTranscribe((v) => !v); }}
            aria-label={`Auto-transcribe to lyrics draft. ${isPro ? "" : "Pro feature."}`}
          >
            <div>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
                {!isPro && "🔒 "}Auto-transcribe to lyrics draft
              </p>
              <p style={{ margin: "2px 0 0", fontFamily: "var(--font-body)", fontSize: 11, color: "#999" }}>
                {isPro ? "Powered by AI · ~30s after saving" : "Upgrade to Pro"}
              </p>
            </div>
            {/* Toggle pill */}
            <div
              style={{
                width: 40, height: 22, borderRadius: 11,
                backgroundColor: isPro && transcribe ? "#B8953A" : "rgba(0,0,0,0.14)",
                position: "relative",
                transition: "background-color 200ms ease",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3, left: 3,
                  width: 16, height: 16,
                  borderRadius: "50%",
                  backgroundColor: "#FFF",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  transition: "transform 200ms ease",
                  transform: isPro && transcribe ? "translateX(18px)" : "translateX(0)",
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onDiscard}
              disabled={isSaving}
              style={{
                flex: 1, height: 48, borderRadius: 12,
                backgroundColor: "transparent",
                border: "1.5px solid rgba(224,84,64,0.30)",
                color: "#E05440",
                fontFamily: "var(--font-body)",
                fontSize: 14, fontWeight: 600,
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                flex: 2, height: 48, borderRadius: 12,
                backgroundColor: isSaving ? "#CCC" : "#B8953A",
                color: "#FFFFFF",
                fontFamily: "var(--font-body)",
                fontSize: 15, fontWeight: 700,
                border: "none",
                cursor: isSaving ? "not-allowed" : "pointer",
                boxShadow: isSaving ? "none" : "0 4px 16px rgba(184,149,58,0.40)",
              }}
            >
              {isSaving ? "Saving..." : "Save memo →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoiceReviewSheet;
