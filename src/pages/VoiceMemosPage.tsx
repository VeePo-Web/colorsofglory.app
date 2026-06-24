import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Pause, Play, Upload } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";
import RecordingSheet from "@/components/voice/RecordingSheet";
import VoiceReviewSheet from "@/components/voice/VoiceReviewSheet";
import UploadDropZone from "@/components/voice/UploadDropZone";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";
import {
  listVoiceMemos,
  getSignedUrl,
  deleteMemo,
  type VoiceMemoRecord,
} from "@/lib/voice/voiceApi";
import {
  formatDuration,
  getAudioFileDuration,
  getBestMimeType,
  getFileExtension,
} from "@/lib/voice/audioFormat";
import { audioCache } from "@/lib/voice/audioCache";
import { enqueueCaptureUpload, subscribeOutbox } from "@/lib/voice/captureOutbox";
import { canPlayMemo } from "@/lib/voice/memoPlayback";
import { generateWaveform } from "@/lib/canvas/waveformSeed";
import { supabase } from "@/integrations/supabase/client";

// ─── Playable memo card ───────────────────────────────────────────────────────

interface MemoCardProps {
  memo: VoiceMemoRecord;
  onDelete: (id: string) => void;
}

const WAVEFORM_BARS = 28;
const WAVEFORM_MAX_H = 44;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploading: { label: "Uploading…", color: "#B8953A" },
  uploaded:  { label: "Processing…", color: "#B8953A" },
  ready:     { label: "Ready", color: "#53AB8B" },
  finalized: { label: "Ready", color: "#53AB8B" },
  transcribed: { label: "Transcribed", color: "#53AB8B" },
  failed:    { label: "Failed", color: "#E05440" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const MemoCard = ({ memo, onDelete }: MemoCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [hasLocalBlob, setHasLocalBlob] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const bars = generateWaveform(memo.id, WAVEFORM_BARS);
  const statusMeta = STATUS_LABELS[memo.status ?? "ready"] ?? STATUS_LABELS.ready;
  const isReady = memo.status === "ready" || memo.status === "finalized" || memo.status === "transcribed";
  const isProcessing = memo.status === "uploading" || memo.status === "uploaded";
  const isQueued = memo.status === "queued";
  // Play-before-upload: a just-captured take is playable the instant it exists,
  // straight from the cached blob the outbox stored under this card's id — even
  // while it is still queued/uploading (Apple Voice Memos behavior).
  const canPlay = canPlayMemo({ isReady, hasLocalBlob });

  // Detect a locally cached blob so a still-syncing take can play immediately.
  useEffect(() => {
    if (isReady) return; // ready takes resolve their source on demand
    let active = true;
    void audioCache.get(memo.id).then((blob) => {
      if (active) setHasLocalBlob(!!blob);
    });
    return () => { active = false; };
  }, [memo.id, isReady]);

  // Free the object URL + stop audio when this card unmounts (e.g. an optimistic
  // card is swapped for its real record once the take finishes syncing).
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(async () => {
    if (!canPlay) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      const cached = await audioCache.get(memo.id);
      let url: string;

      if (cached) {
        // Local-first: plays instantly, works offline, before the upload lands.
        url = URL.createObjectURL(cached);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
      } else if (isReady) {
        url = await getSignedUrl(memo.id);
        audioCache.prefetch(memo.id, url);
      } else {
        // Not ready and no cached blob — nothing to play yet.
        return;
      }

      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.src = url;
      audio.ontimeupdate = () => setProgress(audio.currentTime / (audio.duration || 1));
      audio.onended = () => { setIsPlaying(false); setProgress(0); };
      await audio.play();
      setIsPlaying(true);
    } catch {
      // playback unavailable
    } finally {
      setIsLoading(false);
    }
  }, [memo.id, canPlay, isReady, isPlaying]);

  return (
    <div
      style={{
        borderRadius: 20,
        padding: "16px 16px 14px",
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border)",
        boxShadow: "0 4px 16px rgba(28,26,23,0.06)",
        position: "relative",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        {/* Icon */}
        <div
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            backgroundColor: "rgba(184,149,58,0.12)",
            border: "1px solid rgba(184,149,58,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Mic size={18} strokeWidth={1.6} style={{ color: "var(--cog-gold)" }} />
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--cog-charcoal)",
              fontFamily: "var(--font-display)",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {memo.title}
          </p>
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 12,
              color: "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
            }}
          >
            {formatDuration(memo.duration_ms)} · {memo.section_label || "Raw idea"} · {timeAgo(memo.created_at)}
          </p>

          {/* Status chip */}
          {(isProcessing || isQueued || memo.status === "failed") && (
            <span
              style={{
                display: "inline-block",
                marginTop: 5,
                padding: "2px 8px",
                borderRadius: 9999,
                backgroundColor: `${statusMeta.color}15`,
                color: statusMeta.color,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "var(--font-body)",
                letterSpacing: "0.04em",
              }}
            >
              {statusMeta.label}
            </span>
          )}
        </div>

        {/* Play / loading button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!canPlay || isLoading}
          style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            backgroundColor: canPlay ? "var(--cog-gold)" : "rgba(0,0,0,0.08)",
            color: "#FFF",
            border: "none",
            cursor: canPlay ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: canPlay ? "0 4px 16px rgba(184,149,58,0.30)" : "none",
            transition: "transform 120ms ease",
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseDown={(e) => canPlay && ((e.currentTarget as HTMLElement).style.transform = "scale(0.95)")}
          onMouseUp={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
          aria-label={isPlaying ? `Pause ${memo.title}` : `Play ${memo.title}`}
        >
          {isLoading ? (
            <span style={{ fontSize: 12 }}>…</span>
          ) : isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
          )}
        </button>

        {/* More menu */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            style={{
              width: 32, height: 44, background: "none", border: "none",
              cursor: "pointer", color: "#CCC", display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="More options"
          >
            ···
          </button>
          {showMenu && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowMenu(false)} aria-hidden="true" />
              <div
                style={{
                  position: "absolute", right: 0, top: "100%", zIndex: 91,
                  backgroundColor: "#FFF", borderRadius: 12,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
                  padding: "4px 0", minWidth: 120,
                }}
              >
                <button
                  type="button"
                  onClick={() => { onDelete(memo.id); setShowMenu(false); }}
                  style={{
                    display: "block", width: "100%", padding: "9px 14px",
                    textAlign: "left", fontFamily: "var(--font-body)",
                    fontSize: 13, color: "#E05440",
                    backgroundColor: "transparent", border: "none", cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: 3, height: WAVEFORM_MAX_H,
          cursor: canPlay ? "pointer" : "default",
        }}
        onClick={canPlay ? togglePlay : undefined}
        aria-hidden="true"
      >
        {bars.map((h, i) => {
          const played = isPlaying && progress > i / WAVEFORM_BARS;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, Math.round(h * WAVEFORM_MAX_H)),
                borderRadius: 3,
                backgroundColor: played ? "#B8953A" : "#D4AE5C",
                opacity: h * 0.6 + 0.25,
                transition: "background-color 150ms ease",
              }}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      {isPlaying && (
        <div
          style={{
            marginTop: 8, height: 3, borderRadius: 9999,
            backgroundColor: "rgba(0,0,0,0.07)", overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%", width: `${progress * 100}%`,
              backgroundColor: "#B8953A", borderRadius: 9999,
              transition: "width 200ms linear",
            }}
          />
        </div>
      )}
    </div>
  );
};

// ─── Section group header ──────────────────────────────────────────────────────

const SectionHeader = ({ label }: { label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
    <span
      style={{
        fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.14em", color: "#B8953A",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, height: 1, backgroundColor: "rgba(184,149,58,0.18)" }} />
  </div>
);

// ─── Group by section ─────────────────────────────────────────────────────────

function groupBySection(memos: VoiceMemoRecord[]): Array<{ label: string; items: VoiceMemoRecord[] }> {
  const map = new Map<string, VoiceMemoRecord[]>();
  for (const m of memos) {
    const key = m.section_label || "Raw idea";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  const order = ["Verse 1","Verse 2","Pre-Chorus","Chorus","Bridge","Outro","Intro","Hook","Raw idea"];
  const result: Array<{ label: string; items: VoiceMemoRecord[] }> = [];
  for (const o of order) {
    if (map.has(o)) result.push({ label: o, items: map.get(o)! });
  }
  for (const [label, items] of map) {
    if (!order.includes(label)) result.push({ label, items });
  }
  return result;
}

// ─── Main page ────────────────────────────────────────────────────────────────

const VoiceMemosPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);

  // Real memo list
  const [memos, setMemos] = useState<VoiceMemoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Recording flow
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  type Flow = "idle" | "recording" | "reviewing";
  const [flow, setFlow] = useState<Flow>("idle");
  const [recordingSection, setRecordingSection] = useState("Raw idea");
  const [recordingNote, setRecordingNote] = useState("");
  const [pendingRecording, setPendingRecording] = useState<RecordingResult | null>(null);
  const memoCountRef = useRef(0);

  // Fetch memo list
  const loadMemos = useCallback(async () => {
    try {
      const data = await listVoiceMemos(songId);
      setMemos(data);
    } catch {
      // show empty state
    } finally {
      setIsLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  // Wire current user name to memos
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // ── Recording handlers ──────────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    setRecordingSection("Raw idea");
    setRecordingNote("");
    setFlow("recording");
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording();
    if (result) {
      setPendingRecording(result);
      setFlow("reviewing");
    } else {
      setFlow("idle");
    }
  }, [stopRecording]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
  }, [cancelRecording]);

  const handleSaveMemo = useCallback(async ({
    name,
    section,
    transcribe,
  }: { name: string; section: string; transcribe: boolean }) => {
    if (!pendingRecording) return;

    memoCountRef.current++;
    const title = name.trim() || `Voice Memo ${memoCountRef.current}`;
    const recording = pendingRecording;

    // Close the review sheet immediately — the take is about to be made durable.
    setFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
    setUploadError(null);

    // Route through the Capture Outbox: the blob is cached to IndexedDB BEFORE
    // any network call, so a dropped connection or offline phone can no longer
    // delete the only copy of a take the songwriter just sang. The outbox
    // uploads in the background and auto-retries on reconnect.
    const { outboxId } = await enqueueCaptureUpload({
      blob: recording.blob,
      songId,
      title,
      mimeType: recording.mimeType,
      durationMs: recording.durationMs,
      sectionLabel: section,
      transcribe,
    });

    // Optimistic card keyed by the outbox id — it is already safe, so it is
    // NEVER removed on failure; it simply shows "Saved · will sync" until the
    // upload lands.
    const optimisticMemo: VoiceMemoRecord = {
      id: outboxId,
      song_id: songId,
      title,
      duration_ms: recording.durationMs,
      section_label: section,
      storage_path: "",
      created_at: new Date().toISOString(),
      created_by: currentUserId ?? "You",
      is_processing: true,
      status: "uploading",
    };
    setMemos((prev) => [optimisticMemo, ...prev]);
  }, [pendingRecording, songId, currentUserId]);

  // Reflect outbox results on the optimistic cards: swap to the real record on
  // success, or calmly flip to "Saved · will sync" if the upload is still
  // pending. The take is safe throughout — this only updates how it reads.
  useEffect(() => {
    const unsubscribe = subscribeOutbox((event) => {
      if (event.type === "change") return;
      if (event.songId !== songId) return;
      if (event.type === "success") {
        setMemos((prev) => prev.filter((m) => m.id !== event.outboxId));
        void listVoiceMemos(songId).then(setMemos).catch(() => {});
      } else if (event.type === "failed") {
        setMemos((prev) =>
          prev.map((m) => (m.id === event.outboxId ? { ...m, status: "queued", is_processing: true } : m)),
        );
      }
    });
    return unsubscribe;
  }, [songId]);

  // ── File upload handler ─────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);

    try {
      const durationMs = await getAudioFileDuration(file);
      const mimeType = file.type || getBestMimeType();
      const ext = getFileExtension(mimeType);
      const count = memos.length + 1;
      const title = file.name.replace(/\.[^.]+$/, "") || `Voice Memo ${count}`;
      const fileName = `${title.replace(/\s+/g, "-")}-${Date.now()}.${ext}`;

      // Route imports through the same Capture Outbox as recorded takes: the file
      // is cached locally first and the upload auto-retries, so a dropped network
      // never strands an import either. The outbox subscription reconciles the
      // optimistic card on success / "will sync" on failure.
      const { outboxId } = await enqueueCaptureUpload({
        blob: file,
        songId,
        title,
        mimeType,
        durationMs,
        sectionLabel: "Raw idea",
        fileName,
      });
      setMemos((prev) => [
        {
          id: outboxId,
          song_id: songId,
          title,
          duration_ms: durationMs,
          section_label: "Raw idea",
          storage_path: "",
          created_at: new Date().toISOString(),
          created_by: currentUserId ?? "You",
          is_processing: true,
          status: "uploading",
        },
        ...prev,
      ]);
    } catch {
      setUploadError("Couldn't read that file — please try another.");
    } finally {
      setIsUploading(false);
    }
  }, [songId, memos.length, currentUserId]);

  const handleDelete = useCallback(async (memoId: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== memoId));
    try {
      await deleteMemo(memoId);
    } catch {
      await loadMemos();
    }
  }, [loadMemos]);

  const openMicSettings = useCallback(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      window.location.href = "app-settings:";
    } else if (/Android/.test(ua)) {
      alert("Go to Settings → Apps → Colors of Glory → Permissions → Microphone");
    } else {
      alert("Click the 🔒 lock icon in your address bar → Site Settings → Microphone → Allow");
    }
  }, []);

  const grouped = groupBySection(memos);

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-5 pb-36"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="pt-14 pb-4 flex items-center justify-between">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>

          {/* Upload toggle */}
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-1.5 text-sm rounded-xl px-3 py-2 transition-all duration-150 active:scale-95"
            style={{
              backgroundColor: showUpload ? "rgba(184,149,58,0.12)" : "rgba(0,0,0,0.05)",
              color: showUpload ? "#B8953A" : "var(--cog-warm-gray)",
              border: showUpload ? "1px solid rgba(184,149,58,0.25)" : "1px solid transparent",
              fontFamily: "var(--font-body)",
            }}
            aria-pressed={showUpload}
            aria-label="Upload audio file"
          >
            <Upload size={14} strokeWidth={2} />
            Upload
          </button>
        </div>

        <div className="flex justify-center mb-5">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Voice memos
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          {songTitle}
        </p>

        {/* The "Syncing N ideas…" reassurance is now mounted app-globally in
            GlobalCaptureFlow, so it rides on top of every screen. */}

        {/* Upload zone */}
        {showUpload && (
          <div style={{ marginBottom: 20 }}>
            <UploadDropZone onFile={handleFileUpload} disabled={isUploading} />
            {isUploading && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#B8953A", textAlign: "center", marginTop: 6 }}>
                Uploading...
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#E05440", marginBottom: 12 }}>
            {uploadError}
          </p>
        )}

        {/* Memo list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 124, borderRadius: 20,
                  backgroundColor: "rgba(0,0,0,0.04)",
                  animation: "skeleton-pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : memos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                backgroundColor: "rgba(184,149,58,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Mic size={28} style={{ color: "#B8953A" }} />
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--cog-charcoal)", margin: "0 0 6px" }}>
              No voice memos yet
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)" }}>
              Tap Record to capture your first idea for this song.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {grouped.map(({ label, items }) => (
              <div key={label} style={{ marginBottom: 20 }}>
                {grouped.length > 1 && <SectionHeader label={label} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {items.map((memo) => (
                    <MemoCard key={memo.id} memo={memo} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky record button */}
      <div
        className="fixed bottom-0 px-5 pb-8 pt-4 w-full"
        style={{
          background: "linear-gradient(to top, var(--cog-cream) 70%, transparent 100%)",
          maxWidth: "var(--max-w-app)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={() => { void handleStartRecording(); }}
          disabled={flow !== "idle"}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: flow === "recording" ? "#E05440" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: flow === "recording"
              ? "0 0 0 6px rgba(224,84,64,0.18), 0 4px 20px rgba(224,84,64,0.40)"
              : "0 4px 20px rgba(184,149,58,0.40)",
            animation: flow === "recording" ? "mic-pulse 1.4s ease-in-out infinite" : "none",
          }}
        >
          <span className="flex items-center justify-center gap-2">
            <Mic size={18} strokeWidth={1.8} />
            {flow === "recording" ? "Recording…" : "Record new memo"}
          </span>
        </button>
      </div>

      <SongTabBar activeTab="voice" />

      {/* Recording sheet */}
      {(flow === "recording" || recorderState.phase === "permission-denied") && (
        <RecordingSheet
          phase={recorderState.phase}
          durationMs={recorderState.durationMs}
          analyserNode={recorderState.analyserNode}
          error={recorderState.error}
          section={recordingSection}
          onSectionChange={setRecordingSection}
          noteValue={recordingNote}
          onNoteChange={setRecordingNote}
          onStop={handleStopRecording}
          onCancel={handleCancelRecording}
          onOpenSettings={openMicSettings}
        />
      )}

      {/* Review sheet */}
      {flow === "reviewing" && pendingRecording && (
        <VoiceReviewSheet
          recording={pendingRecording}
          defaultName={recordingNote.trim() || `Voice Memo ${memoCountRef.current + 1}`}
          section={recordingSection}
          onSave={handleSaveMemo}
          onDiscard={handleCancelRecording}
        />
      )}

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(224,84,64,0.18), 0 4px 16px rgba(224,84,64,0.45); }
          50%       { box-shadow: 0 0 0 14px rgba(224,84,64,0.08), 0 4px 16px rgba(224,84,64,0.45); }
        }
      `}</style>
    </div>
  );
};

export default VoiceMemosPage;
