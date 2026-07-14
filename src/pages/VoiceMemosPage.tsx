import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Pause, Play, RefreshCw, Search, Upload } from "lucide-react";
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
} from "@/lib/voice/audioFormat";
import { audioCache } from "@/lib/voice/audioCache";
import { saveMemoDurable } from "@/lib/voice/saveMemo";
import {
  subscribeOutbox,
  listOutboxJobs,
  retryOutboxJob,
  discardOutboxJob,
} from "@/lib/voice/captureOutbox";
import { defaultCaptureName } from "@/lib/voice/captureNaming";
import { resolveWaveformBars } from "@/lib/canvas/waveformSeed";
import { backfillOnOpen } from "@/lib/audio/melodyBackfill";
import TakeMiniPlayer from "@/components/voice/TakeMiniPlayer";

const HumToFindSheet = lazy(() => import("@/components/voice/HumToFindSheet"));
import { getSessionUser } from "@/integrations/cog/auth";

// ─── Playable memo card ───────────────────────────────────────────────────────

interface MemoCardProps {
  memo: VoiceMemoRecord;
  onDelete: (id: string) => void;
  /** Re-attempt a take whose upload failed (the blob is safe in the cache). */
  onRetry?: (id: string) => void;
  /** Permanently discard a failed take. */
  onDiscardFailed?: (id: string) => void;
  /** Open the take mini-player — swipe between this memo's versions (F15). */
  onOpenTakes?: (memo: VoiceMemoRecord) => void;
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

const MemoCard = ({ memo, onDelete, onRetry, onDiscardFailed, onOpenTakes }: MemoCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [hasLocal, setHasLocal] = useState(false);

  // Melody Lens precedence: contour (bars ride the tune) → real peaks → seed.
  // Memoized so playback's per-frame progress ticks don't rebuild the 28 bars.
  const wave = useMemo(
    () =>
      resolveWaveformBars({
        seedId: memo.id,
        peaks: memo.waveform_peaks,
        contour: memo.pitch_contour,
        barCount: WAVEFORM_BARS,
        maxHeight: WAVEFORM_MAX_H,
      }),
    [memo.id, memo.waveform_peaks, memo.pitch_contour],
  );
  const statusMeta = STATUS_LABELS[memo.status ?? "ready"] ?? STATUS_LABELS.ready;
  const isReady = memo.status === "ready" || memo.status === "finalized" || memo.status === "transcribed";
  const isProcessing = memo.status === "uploading" || memo.status === "uploaded";
  const isFailed = memo.status === "failed" && !!onRetry;
  // A take is playable the instant its blob is on the device — even while it's
  // still uploading, or after a failed upload. Benchmark: "play the take locally
  // while upload is pending." Instant, offline-safe, no signed URL needed.
  const canPlay = isReady || hasLocal;

  useEffect(() => {
    let alive = true;
    void audioCache.get(memo.id).then((b) => { if (alive) setHasLocal(!!b); });
    return () => { alive = false; };
  }, [memo.id, memo.status]);

  const togglePlay = useCallback(async () => {
    if (!canPlay) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    // Melody Lens lazy backfill: opening a memo fetches its audio anyway, so
    // index its melody now (best-effort, off the play path) — Hum-to-Find
    // coverage grows as the library gets browsed. No-op if already indexed.
    backfillOnOpen(memo.id);
    try {
      const cached = await audioCache.get(memo.id);
      let url: string;

      if (cached) {
        // Instant local playback — the source of truth for a just-captured take.
        url = URL.createObjectURL(cached);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
      } else if (isReady) {
        url = await getSignedUrl(memo.id);
        audioCache.prefetch(memo.id, url);
      } else {
        // Local-only take whose cached blob has vanished — nothing to play yet.
        setIsLoading(false);
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
  }, [memo.id, isReady, isPlaying, canPlay]);

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

          {/* Status chip — failed takes read as reassurance ("safe, just retry"),
              never an alarm. The blob is on the device the whole time. */}
          {(isProcessing || isFailed) && (
            <span
              style={{
                display: "inline-block",
                marginTop: 5,
                padding: "2px 8px",
                borderRadius: 9999,
                // Once the blob is on the device the chip reads as reassurance
                // (gold), never an alarm — "your idea is safe here" is the promise.
                backgroundColor: (isFailed || hasLocal)
                  ? "rgba(184,149,58,0.12)"
                  : `${statusMeta.color}15`,
                color: (isFailed || hasLocal) ? "var(--cog-gold)" : statusMeta.color,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "var(--font-body)",
                letterSpacing: "0.04em",
              }}
            >
              {isFailed
                ? "Saved on device · tap retry"
                : hasLocal
                  ? "Saved on device · syncing"
                  : statusMeta.label}
            </span>
          )}
        </div>

        {/* Retry (failed) or Play / loading button */}
        {isFailed ? (
          <button
            type="button"
            onClick={() => onRetry?.(memo.id)}
            style={{
              height: 44, padding: "0 16px", borderRadius: 9999, flexShrink: 0,
              backgroundColor: "var(--cog-gold)",
              color: "#FFF",
              border: "none",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 16px rgba(184,149,58,0.30)",
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700,
              transition: "transform 120ms ease",
            }}
            onMouseDown={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(0.95)")}
            onMouseUp={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
            aria-label={`Retry saving ${memo.title}`}
          >
            <RefreshCw size={15} strokeWidth={2} />
            Retry
          </button>
        ) : (
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
        )}

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
                {isReady && onOpenTakes && (
                  <button
                    type="button"
                    onClick={() => { onOpenTakes(memo); setShowMenu(false); }}
                    style={{
                      display: "block", width: "100%", padding: "9px 14px",
                      textAlign: "left", fontFamily: "var(--font-body)",
                      fontSize: 13, color: "var(--cog-charcoal)",
                      backgroundColor: "transparent", border: "none", cursor: "pointer",
                    }}
                  >
                    Takes
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isFailed && onDiscardFailed) onDiscardFailed(memo.id);
                    else onDelete(memo.id);
                    setShowMenu(false);
                  }}
                  style={{
                    display: "block", width: "100%", padding: "9px 14px",
                    textAlign: "left", fontFamily: "var(--font-body)",
                    fontSize: 13, color: "#E05440",
                    backgroundColor: "transparent", border: "none", cursor: "pointer",
                  }}
                >
                  {isFailed ? "Discard" : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 3, height: WAVEFORM_MAX_H,
          cursor: canPlay ? "pointer" : "default",
        }}
        onClick={canPlay ? togglePlay : undefined}
        aria-hidden="true"
      >
        {wave.bars.map((bar, i) => {
          const played = isPlaying && progress > i / WAVEFORM_BARS;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, bar.height),
                marginTop: bar.top,
                borderRadius: 3,
                backgroundColor: played ? "#B8953A" : "#D4AE5C",
                opacity: bar.voiced ? bar.amp * 0.6 + 0.25 : 0.14,
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
  const [showHumFind, setShowHumFind] = useState(false);

  // Recording flow
  type Flow = "idle" | "recording" | "reviewing";
  const [flow, setFlow] = useState<Flow>("idle");
  const [recordingSection, setRecordingSection] = useState("Raw idea");
  const [recordingNote, setRecordingNote] = useState("");
  const [pendingRecording, setPendingRecording] = useState<RecordingResult | null>(null);
  const memoCountRef = useRef(0);

  // Take mini-player (F15) — swipe between a memo's versions.
  const [takesMemo, setTakesMemo] = useState<VoiceMemoRecord | null>(null);

  // A take that auto-finalized (call, Bluetooth swap, tab hidden, length ceiling)
  // must still reach review — otherwise an interrupted in-song idea is salvaged by
  // the recorder but silently lost from the flow. Surface it; the review sheet
  // greets it with pastoral copy about why it stopped.
  const handleAutoFinalize = useCallback((result: RecordingResult | null) => {
    if (result) {
      setPendingRecording(result);
      setFlow("reviewing");
    } else {
      setFlow("idle");
    }
  }, []);

  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder({
    onAutoFinalize: handleAutoFinalize,
  });

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

  // Reconcile optimistic cards as the Capture Outbox syncs them. Success swaps
  // the card for the real DB record; failure flips it to a calm retriable card
  // — the take itself has been safe in the device cache the whole time.
  useEffect(() => {
    const unsubscribe = subscribeOutbox((event) => {
      if (event.type === "change") return;
      if (event.songId !== songId) return;
      if (event.type === "success") {
        setMemos((prev) => prev.filter((m) => m.id !== event.outboxId));
        void loadMemos();
        setUploadError(null);
      } else if (event.reason === "quota_storage") {
        // Storage is full — the take is SAFE on the device and will sync the
        // moment there's room. Keep the optimistic card as-is (it reads
        // "Saved on device · syncing") and prompt the one action that unblocks it.
        setUploadError("Saved on your device — we'll sync it once there's room. Add storage to finish.");
      } else if (!event.willRetry) {
        setMemos((prev) =>
          prev.map((m) =>
            m.id === event.outboxId ? { ...m, is_processing: false, status: "failed" } : m,
          ),
        );
        setUploadError("Your recording is safe. Tap Retry on the memo to finish saving.");
      }
    });
    return unsubscribe;
  }, [songId, loadMemos]);

  // Recovery sweep: takes whose upload was interrupted last session (tab
  // closed, app killed, network died) are still queued in the outbox with their
  // blobs cached. Surface each as a card; the outbox retries them on its own
  // (load, `online`, heartbeat) — a reconnected device heals itself.
  useEffect(() => {
    const orphans = listOutboxJobs(songId);
    if (orphans.length === 0) return;
    setMemos((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const cards: VoiceMemoRecord[] = orphans
        .filter((o) => !known.has(o.id))
        .map((o) => ({
          id: o.id,
          song_id: o.songId,
          title: o.title,
          duration_ms: o.durationMs,
          section_id: (o.extra?.sectionId as string | undefined) ?? null,
          section_label: o.sectionLabel,
          waveform_peaks: (o.extra?.waveformPeaks as number[] | undefined) ?? null,
          // The melody contour computes async off the save path and lands in
          // the device store; resolveContour heals this null on read/play.
          pitch_contour: null,
          storage_path: "",
          created_at: o.createdAt,
          created_by: "You",
          is_processing: o.status !== "failed",
          status: o.status === "failed" ? "failed" : "uploading",
        }));
      return cards.length ? [...cards, ...prev] : prev;
    });
  }, [songId]);

  // Wire current user name to memos
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    getSessionUser().then((user) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // ── Recording handlers ──────────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    setRecordingSection("Raw idea");
    setRecordingNote("");
    const started = await startRecording();
    setFlow(started ? "recording" : "idle");
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
    const title = name.trim() || defaultCaptureName();

    // The one canonical save: blob → device cache BEFORE any network call →
    // outbox retries on reconnect. Real peaks computed once, in the same call.
    const { optimistic } = await saveMemoDurable({
      blob: pendingRecording.blob,
      songId,
      mimeType: pendingRecording.mimeType,
      durationMs: pendingRecording.durationMs,
      title,
      sectionLabel: section,
      transcribe,
      createdBy: currentUserId ?? "You",
    });

    setMemos((prev) => [optimistic, ...prev]);
    setFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
  }, [pendingRecording, songId, currentUserId]);

  // Retry a take whose upload failed — the blob has been waiting safely in the
  // cache the whole time.
  const handleRetryMemo = useCallback(async (outboxId: string) => {
    setUploadError(null);
    setMemos((prev) =>
      prev.map((m) =>
        m.id === outboxId ? { ...m, is_processing: true, status: "uploading" } : m,
      ),
    );
    await retryOutboxJob(outboxId);
  }, []);

  // Discard a failed take for good — removes the cached blob and the card.
  const handleDiscardFailed = useCallback(async (outboxId: string) => {
    await discardOutboxJob(outboxId);
    setMemos((prev) => prev.filter((m) => m.id !== outboxId));
    setUploadError(null);
  }, []);

  // ── File upload handler ─────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);

    try {
      const durationMs = await getAudioFileDuration(file);
      const mimeType = file.type || getBestMimeType();
      const title = file.name.replace(/\.[^.]+$/, "") || defaultCaptureName();

      // Imports ride the same canonical path as recorded takes: cache-first,
      // auto-retry, real peaks. Downstream, an imported memo is
      // indistinguishable from a recorded one (F11).
      const { optimistic } = await saveMemoDurable({
        blob: file,
        songId,
        mimeType,
        durationMs,
        title,
        sectionLabel: "Raw idea",
        fileName: file.name,
        createdBy: currentUserId ?? "You",
      });
      setMemos((prev) => [optimistic, ...prev]);
    } catch {
      // Reading the file itself failed (corrupt / unsupported) — nothing was
      // captured, so there's nothing to retain. Guide the user, calmly.
      setUploadError("Couldn't read that file. Please try another.");
    } finally {
      setIsUploading(false);
    }
  }, [songId, currentUserId]);

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
        <p className="text-sm mb-4" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          {songTitle}
        </p>

        {/* Hum to find — opt-in melody search over your own memos (Melody Lens
            Feature 2). Quiet until the library is worth searching. */}
        {memos.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHumFind(true)}
            className="flex items-center gap-2 rounded-xl px-3.5 mb-6 transition-all duration-150 active:scale-[0.98]"
            style={{
              minHeight: 44, alignSelf: "flex-start",
              backgroundColor: "rgba(184,149,58,0.10)",
              border: "1px solid rgba(184,149,58,0.22)",
              color: "var(--cog-gold)", fontFamily: "var(--font-body)",
              fontSize: 13, fontWeight: 600,
            }}
            aria-label="Hum to find a melody in your memos"
          >
            <Search size={15} strokeWidth={2} />
            Hum to find a melody
          </button>
        )}

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

        {/* Notice — calm and reassuring (the take is safe on the device), never an
            alarm. Styled in the warm gold family, not red. */}
        {uploadError && (
          <p
            role="status"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--cog-charcoal)",
              backgroundColor: "rgba(184,149,58,0.10)",
              border: "1px solid rgba(184,149,58,0.22)",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
            }}
          >
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
                    <MemoCard
                      key={memo.id}
                      memo={memo}
                      onDelete={handleDelete}
                      onRetry={handleRetryMemo}
                      onDiscardFailed={handleDiscardFailed}
                      onOpenTakes={setTakesMemo}
                    />
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
            backgroundColor: flow === "recording" ? "var(--cog-charcoal)" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: flow === "recording"
              ? "0 0 0 6px var(--cog-gold-glow), 0 4px 20px rgba(28,26,23,0.30)"
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

      {/* Take mini-player — versions of one memo (F15). Distinct from the
          layered stack (F16) and from F2's practice global mini-player. */}
      {takesMemo && (
        <TakeMiniPlayer
          memoId={takesMemo.id}
          memoTitle={takesMemo.title}
          fallbackPeaks={takesMemo.waveform_peaks}
          onClose={() => setTakesMemo(null)}
        />
      )}

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
          defaultName={recordingNote.trim() || defaultCaptureName()}
          section={recordingSection}
          onSave={handleSaveMemo}
          onDiscard={handleCancelRecording}
        />
      )}

      {/* Hum to find — melody search over your own memos (Melody Lens F2) */}
      {showHumFind && (
        <Suspense fallback={null}>
          <HumToFindSheet
            memos={memos}
            onClose={() => setShowHumFind(false)}
            onOpenMemo={(memoId) => {
              const m = memos.find((x) => x.id === memoId);
              if (m) setTakesMemo(m);
            }}
          />
        </Suspense>
      )}

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(184,149,58,0.20), 0 4px 16px rgba(28,26,23,0.35); }
          50%       { box-shadow: 0 0 0 14px rgba(184,149,58,0.08), 0 4px 16px rgba(28,26,23,0.35); }
        }
      `}</style>
    </div>
  );
};

export default VoiceMemosPage;
