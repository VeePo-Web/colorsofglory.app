import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Settings, MicOff, RefreshCw, AlertTriangle } from "lucide-react";
import { formatDuration } from "@/lib/voice/audioFormat";
import { toast } from "sonner";

import { useVoiceRecorder, type RecordingResult } from "@/hooks/useVoiceRecorder";
import { useLiveTranscript } from "@/hooks/useLiveTranscript";
import { submitSharedAudio } from "@/integrations/cog/intake";
import { createSong } from "@/integrations/cog/songs";
import { getPrimaryTakeIdForMemo } from "@/integrations/cog/transcript";
import { supabase } from "@/integrations/supabase/client";
import {
  saveFailedCapture,
  listFailedCaptures,
  getFailedCaptureFile,
  clearAllFailedCaptures,
} from "@/lib/voice/failedCaptureStore";
import { audioCache } from "@/lib/voice/audioCache";
import { saveSeedIdea, listSeedIdeas } from "@/lib/voice/seedIdeaApi";
import { defaultCaptureName } from "@/lib/voice/captureNaming";
import BigMic from "./BigMic";
import SideRail, { type RailAction } from "./SideRail";
import LiveTranscript from "./LiveTranscript";
import CaptureSheet, { type PendingBlock } from "./CaptureSheet";
import ReviewSheet from "./ReviewSheet";
import ImportMemoButton from "./ImportMemoButton";
import LatestPeekStrip from "./LatestPeekStrip";
import CommitRibbon from "./CommitRibbon";
import { buildTranscriptBlocks, detectSectionMarkers } from "@/lib/capture/sectionKeywords";
import type { SectionMarker } from "@/lib/capture/transcriptModel";
import { useSwipeNav } from "@/lib/nav/useSwipeNav";
import { setNavDirection, useSpatialEntrance } from "@/lib/nav/navDirection";
import { preloadOnIdle } from "@/lib/nav/preloadOnIdle";

interface CaptureSceneProps {
  /** When provided, captures attach to this song; otherwise they land in Unfiled. */
  songId?: string;
  songTitle?: string;
}

/**
 * Adobe-Podcast-inspired Capture Scene.
 *
 * Phase 1 ships:
 *  - Big gold mic (tap-to-record / hold-to-hum) wired to the existing recorder.
 *  - Always-labeled action rail (Lyrics, Chords, Section, Scripture, Idea).
 *  - Section-marker pins inserted by the rail at the current timestamp.
 *  - Optimistic transcript placeholder while the take uploads.
 *  - Upload to voice_memos + idea_captures via the existing SDK.
 *
 * Phase 1.5 (Claude handoff, see docs/claude-handoffs/2026-06-08-capture-scene.md):
 *  - Live streaming STT through Lovable AI Gateway.
 *  - Review sheet with rename/merge/split + destination picker.
 *  - Canvas commit that turns each block into a section zone of cards.
 */
const CaptureScene = ({ songId, songTitle }: CaptureSceneProps) => {
  const navigate = useNavigate();
  // Safety net: an interruption (call / Bluetooth), the duration ceiling, or
  // the page being hidden auto-finalizes a take. The hook delivers it here so a
  // captured idea is never lost. The handler is defined below handleAudioFile,
  // so route through a ref to avoid a temporal-dead-zone reference.
  const autoFinalizeRef = useRef<(r: RecordingResult | null) => void>(() => {});
  const recorder = useVoiceRecorder({
    onAutoFinalize: (r) => autoFinalizeRef.current(r),
  });
  const { phase, durationMs, analyserNode } = recorder.state;
  const live = useLiveTranscript();

  const [manualMarkers, setManualMarkers] = useState<SectionMarker[]>([]);
  const [status, setStatus] = useState<
    "idle" | "listening" | "transcribing" | "ready" | "skipped"
  >("idle");
  const [saving, setSaving] = useState(false);
  const [prompt] = useState(() => pickPrompt(new Date()));

  // How many unfiled ideas are waiting on the shelf. On the global capture page
  // (no songId) a hum lands in local Ideas, NOT the DB — so the peek strip can't
  // see it and, without this, a captured idea leaves zero trace on the page it
  // was captured from. Surfacing the count on the "Unfiled" pill makes captures
  // feel kept: the number ticks up the instant you save, so nothing feels lost
  // between a fading toast and the next idea.
  const [seedCount, setSeedCount] = useState(0);
  const refreshSeedCount = useCallback(() => {
    if (songId) return;
    listSeedIdeas()
      .then((records) => setSeedCount(records.length))
      .catch(() => {
        /* count is a nicety — never let it break capture */
      });
  }, [songId]);
  useEffect(() => {
    refreshSeedCount();
  }, [refreshSeedCount]);

  // Side-rail sheet (idle taps)
  const [sheetAction, setSheetAction] = useState<RailAction | null>(null);
  const [pendingBlocks, setPendingBlocks] = useState<PendingBlock[]>([]);

  // Review sheet (auto-opens after stop)
  const [review, setReview] = useState<{
    open: boolean;
    takeId: string | null;
    songId: string | null;
    songTitle?: string;
    storagePath: string | null;
    durationMs: number;
  }>({ open: false, takeId: null, songId: null, storagePath: null, durationMs: 0 });

  // Post-commit ribbon — quiet success → tap to land on the canvas.
  const [ribbon, setRibbon] = useState<{
    open: boolean;
    songId: string | null;
    songTitle?: string;
    blockCount: number;
  }>({ open: false, songId: null, blockCount: 0 });

  // Failed-upload safety net: if the network drops mid-upload we KEEP the
  // recorded file in memory so a precious idea is never lost — the songwriter
  // can retry instead of re-recording.
  const [failedTake, setFailedTake] = useState<{ file: File; durationMs: number } | null>(null);

  // Tear down the mic ONLY when the scene unmounts.
  //
  // Previously this effect depended on [recorder, live]. Both are fresh object
  // literals every render (their .state / values are recreated), so the dep array
  // changed on EVERY render — which fired this cleanup on every render. The instant
  // startRecording() flipped phase to "recording" the component re-rendered, the
  // cleanup ran cancelRecording(), and it killed the recording that had just begun
  // ("flashes listening, then reverts, never records"). Route the latest teardown
  // through a ref and run it only on unmount so a live recording is never cancelled
  // mid-render.
  const teardownRef = useRef<() => void>(() => {});
  teardownRef.current = () => {
    recorder.cancelRecording();
    live.stop();
  };
  useEffect(() => {
    return () => teardownRef.current();
  }, []);

  const blocks = useMemo(() => {
    const markers = detectSectionMarkers(live.words, manualMarkers);
    return buildTranscriptBlocks(live.words, markers);
  }, [live.words, manualMarkers]);

  const handleAudioFile = useCallback(
    async (file: File, fileDurationMs: number) => {
      if (saving) return;
      setStatus("transcribing");
      setSaving(true);
      try {
        // Global capture (no song context) → the idea lands in your Ideas shelf,
        // NEVER a new "junk" song. You file it into a song later, from the shelf
        // (hear / rename / file / discard). This is the "one idea, two homes" model
        // and the world-class benchmark rule: a global capture goes to Seed Ideas;
        // the songwriter chooses when to make it a song.
        if (!songId) {
          await saveSeedIdea({
            blob: file,
            mimeType: file.type || "audio/webm",
            durationMs: fileDurationMs,
            title: defaultCaptureName(),
          });
          setStatus("ready");
          setFailedTake(null);
          void clearAllFailedCaptures();
          // Tick the "Unfiled" pill up immediately — the idea visibly landed.
          refreshSeedCount();
          toast.success("Saved to your Ideas", {
            description: "File it into a song whenever you like.",
            // Close the loop — one tap to go see it on the Ideas shelf.
            action: { label: "View", onClick: () => navigate("/songs") },
          });
          return;
        }

        const targetSongId = songId;
        const targetSongTitle = songTitle;

        const intake = await submitSharedAudio({
          file,
          song_id: targetSongId,
          title: targetSongTitle ? `${targetSongTitle} — capture` : "Capture",
        });

        const takeId = await getPrimaryTakeIdForMemo(intake.voice_memo_id);
        if (!takeId) throw new Error("Take was created but could not be located.");

        // Cache the just-recorded blob under the take id so Review can play it
        // back INSTANTLY from the device — no cloud signed URL, no network wait,
        // works offline. Benchmark: review starts with listening, never on AI/cloud.
        void audioCache.set(takeId, file);

        const { data: takeRow } = await supabase
          .from("takes")
          .select("storage_path")
          .eq("id", takeId)
          .maybeSingle();

        setStatus("ready");
        setFailedTake(null);
        // A recovered take just saved — retire any durable failed-capture record.
        void clearAllFailedCaptures();
        setReview({
          open: true,
          takeId,
          songId: targetSongId,
          songTitle: targetSongTitle,
          storagePath: (takeRow?.storage_path as string | undefined) ?? null,
          durationMs: fileDurationMs,
        });
      } catch (err) {
        setStatus("skipped");
        // Keep the recording so the idea survives a flaky network — never discard.
        setFailedTake({ file, durationMs: fileDurationMs });
        // AND persist it durably, so it survives a reload too (not just React
        // state) — a captured idea must never be lost.
        void saveFailedCapture(file, {
          songId: songId ?? null,
          title: songTitle ? `${songTitle} — capture` : "Capture",
          durationMs: fileDurationMs,
        });
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error("Couldn't save that take — your recording is safe.", { description: msg.slice(0, 120) });
      } finally {
        setSaving(false);
      }
    },
    [saving, songId, songTitle, refreshSeedCount],
  );

  const retryFailedTake = useCallback(() => {
    if (!failedTake) return;
    void handleAudioFile(failedTake.file, failedTake.durationMs);
  }, [failedTake, handleAudioFile]);

  // Recovery sweep: a take whose save failed last session is still safe in the
  // durable store. Surface it on load so the songwriter can retry — the idea
  // survives a reload, not just an in-session retry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = listFailedCaptures();
      if (cancelled || rows.length === 0) return;
      const file = await getFailedCaptureFile(rows[0].id);
      if (cancelled || !file) return;
      setFailedTake({ file, durationMs: rows[0].durationMs });
      setStatus("skipped");
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-saved takes (interruption / ceiling / page hidden) flow through the
  // same upload path as a manual stop, so the idea lands in review either way.
  const handleAutoFinalize = useCallback(
    (result: RecordingResult | null) => {
      live.stop();
      if (!result) {
        setStatus("idle");
        return;
      }
      if (result.reason === "interrupted") {
        toast("Saved — the mic was interrupted, but your idea is safe.", { duration: 3600 });
      } else if (result.reason === "max-duration") {
        toast("Saved — that take reached the length limit.", { duration: 3200 });
      } else if (result.reason === "page-hidden") {
        toast("Saved your idea before you stepped away.", { duration: 3200 });
      }
      const file = new File([result.blob], `take-${Date.now()}.webm`, {
        type: result.mimeType || "audio/webm",
      });
      void handleAudioFile(file, result.durationMs);
    },
    [handleAudioFile, live],
  );

  useEffect(() => {
    autoFinalizeRef.current = handleAutoFinalize;
  }, [handleAutoFinalize]);

  const handleMicTap = useCallback(async () => {
    if (saving) return;

    if (phase === "recording") {
      const result = await recorder.stopRecording();
      live.stop();
      if (!result) return;
      const file = new File([result.blob], `take-${Date.now()}.webm`, {
        type: result.mimeType || "audio/webm",
      });
      await handleAudioFile(file, result.durationMs);
      return;
    }

    // Start recording fresh.
    setManualMarkers([]);
    setStatus("listening");
    live.stop();
    live.reset();
    const started = await recorder.startRecording();
    if (!started) {
      setStatus("idle");
      return;
    }
    // Live STT is a pure enhancement. Let MediaRecorder own the mic first so a
    // speech-recognition permission/session cannot masquerade as recording — and
    // never let a SpeechRecognition throw (e.g. "already started") reject this
    // handler or disturb the recording that just began.
    if (live.supported) {
      try {
        live.start();
      } catch {
        /* recognition is optional; the take keeps recording regardless */
      }
    }
  }, [phase, recorder, saving, live, handleAudioFile]);

  const handleRailAction = useCallback(
    (action: RailAction) => {
      // The rail's lyric / chord / section / scripture / idea tools all write
      // into a song's canvas — which the song-less global page has no way to
      // reach (a block only persists via a take committed to a song). Letting a
      // songwriter type there was a silent void: "Saved" then gone on reload.
      // Instead, guide them into a real song where words actually persist. Voice
      // hums are unaffected — they land in the Ideas shelf.
      if (!songId) {
        toast.message("Lyrics, chords & notes live inside a song", {
          description: "Open or start a song to write — your voice ideas stay right here.",
          action: { label: "Open songs", onClick: () => navigate("/songs") },
        });
        return;
      }
      // While recording, every rail tap drops a timestamped pin (no modal).
      if (phase === "recording") {
        if (action === "section") {
          setManualMarkers((prev) => [
            ...prev,
            { atMs: durationMs, kind: "verse", source: "manual", label: "New Section" },
          ]);
          toast.success("Section marker added", {
            description: `at ${(durationMs / 1000).toFixed(1)}s — rename in the review sheet.`,
          });
          return;
        }
        // Lyrics/Chords/Scripture/Idea pin → store as pending block tied to this moment.
        setPendingBlocks((prev) => [
          ...prev,
          {
            id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: action === "note" ? "idea" : (action as PendingBlock["kind"]),
            section_kind: null,
            label: action === "note" ? "Idea" : action.charAt(0).toUpperCase() + action.slice(1),
            text: "",
            start_ms: durationMs,
            end_ms: durationMs,
          },
        ]);
        toast.message(`${action.charAt(0).toUpperCase() + action.slice(1)} pinned`, {
          description: `at ${(durationMs / 1000).toFixed(1)}s — fill it in when you stop.`,
        });
        return;
      }
      // Idle: open the progressive capture sheet.
      setSheetAction(action);
    },
    [phase, durationMs, songId, navigate],
  );

  const handleSheetSave = useCallback((block: PendingBlock) => {
    setPendingBlocks((prev) => [...prev, block]);
    toast.success("Saved", {
      description: "It'll appear in the next review sheet after you record.",
    });
  }, []);

  const handleReviewClose = useCallback(() => {
    setReview((r) => ({ ...r, open: false }));
    setPendingBlocks([]);
    setManualMarkers([]);
    setStatus("idle");
  }, []);

  const handleReviewCommitted = useCallback(
    (info: { songId: string; songTitle?: string; blockCount: number }) => {
      setReview((r) => ({ ...r, open: false }));
      setPendingBlocks([]);
      setManualMarkers([]);
      setStatus("idle");
      setRibbon({
        open: true,
        songId: info.songId,
        songTitle: info.songTitle ?? songTitle,
        blockCount: info.blockCount,
      });
    },
    [songTitle],
  );

  const handleResumePeek = useCallback(
    async (memoId: string, _songId: string) => {
      const takeId = await getPrimaryTakeIdForMemo(memoId).catch(() => null);
      if (!takeId) {
        toast.message("Take is still uploading", { description: "Try again in a moment." });
        return;
      }
      const { data: takeRow } = await supabase
        .from("takes")
        .select("storage_path, song_id, duration_ms, songs(title)")
        .eq("id", takeId)
        .maybeSingle();
      if (!takeRow) return;
      setReview({
        open: true,
        takeId,
        songId: (takeRow.song_id as string) ?? _songId,
        songTitle: (takeRow.songs as { title?: string } | null)?.title ?? songTitle,
        storagePath: (takeRow.storage_path as string | undefined) ?? null,
        durationMs: (takeRow.duration_ms as number | null) ?? 0,
      });
    },
    [songTitle],
  );

  // Spatial nav — Songs live to the LEFT of Capture. Swiping right pages
  // over to the library (Snapchat/Apple Camera geography); the header
  // chevron stays as the visible contract. The gesture is off while a take
  // is in flight or a sheet is open so it can never interrupt a recording.
  const sceneRef = useRef<HTMLDivElement>(null);
  const goToSongs = useCallback(() => {
    // The wayfinding hint has done its job the moment they go to Songs —
    // by swipe OR by tapping the chevron — so retire it for good.
    try { localStorage.setItem("cog:nav-swipe-hint", "1"); } catch { /* ignore */ }
    setNavDirection("left");
    navigate("/songs");
  }, [navigate]);
  useSwipeNav(sceneRef, {
    onSwipeRight: goToSongs,
    disabled: phase !== "idle" || review.open || sheetAction !== null,
  });
  const enterClass = useSpatialEntrance(useLocation().pathname);

  // Songs are one swipe to the left — have their chunk warm before the
  // first slide so the neighbor appears instantly, never a loading frame.
  useEffect(() => {
    preloadOnIdle(() => import("@/pages/SongCatalogPage"));
  }, []);

  // Self-teaching wayfinding: gently nudge the Songs affordance on every
  // Capture visit UNTIL the songwriter actually goes to Songs once (a single
  // timed breath is trivially missed while looking at the center mic). It
  // retires itself the moment the gesture/tap is used — see goToSongs.
  const [hintNudge] = useState(() => {
    try {
      return !localStorage.getItem("cog:nav-swipe-hint");
    } catch {
      return false;
    }
  });

  return (
    <div ref={sceneRef} className={`relative min-h-[100dvh] w-full ${enterClass}`} style={{ background: "var(--cog-cream)" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 cog-glow" />

      {/* Header */}
      <header
        className="relative flex items-center justify-between"
        style={{ padding: "12px 16px", paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          type="button"
          onClick={goToSongs}
          aria-label="Open songs"
          className={`flex items-center transition-transform active:scale-95 ${hintNudge ? "nav-hint-nudge" : ""}`}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cog-charcoal)",
            cursor: "pointer",
            padding: "8px 10px 8px 6px",
            minHeight: 44,
          }}
        >
          <ChevronLeft size={20} />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              marginLeft: 2,
            }}
          >
            Songs
          </span>
        </button>

        {songId ? (
          <button
            type="button"
            onClick={() => { setNavDirection("up"); navigate(`/songs/${songId}/room`); }}
            aria-label={`Open ${songTitle ?? "song"} room`}
            className="transition-transform active:scale-95"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              color: "var(--cog-charcoal)",
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(184,149,58,0.10)",
              border: "1px solid rgba(184,149,58,0.25)",
              cursor: "pointer",
            }}
          >
            {songTitle ?? "Open room"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goToSongs}
            aria-label={
              seedCount > 0
                ? `View your ${seedCount} unfiled idea${seedCount === 1 ? "" : "s"}`
                : "View your unfiled ideas"
            }
            className="transition-transform active:scale-95"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: "var(--font-display)",
              fontSize: 14,
              color: "var(--cog-charcoal)",
              padding: seedCount > 0 ? "6px 8px 6px 14px" : "6px 14px",
              borderRadius: 999,
              background: "rgba(184,149,58,0.10)",
              border: "1px solid rgba(184,149,58,0.25)",
              cursor: "pointer",
            }}
          >
            Unfiled
            {seedCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "var(--cog-gold)",
                  color: "#fff",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {seedCount}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          aria-label="Settings"
          onClick={() => navigate("/settings")}
          className="flex items-center justify-center transition-transform active:scale-95"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cog-charcoal)",
            cursor: "pointer",
            padding: 8,
            minHeight: 44,
            minWidth: 44,
          }}
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Main scene */}
      <main
        className="relative flex flex-col items-center"
        style={{ padding: "24px 20px 140px", gap: 32 }}
      >
        {/* Rotating serif prompt — fades when the user starts recording so the
            mic and live transcript own the screen. */}
        <p
          aria-hidden={phase === "recording"}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(20px, 5vw, 26px)",
            lineHeight: 1.25,
            color: "var(--cog-charcoal)",
            textAlign: "center",
            maxWidth: 360,
            margin: 0,
            opacity: phase === "recording" ? 0 : 0.92,
            transition: "opacity 600ms var(--cog-ease, cubic-bezier(0.25,0.46,0.45,0.94))",
            minHeight: 64,
          }}
        >
          {prompt}
        </p>

        <BigMic
          phase={phase}
          durationMs={durationMs}
          analyser={analyserNode}
          onTap={handleMicTap}
        />

        {/* Recovery path — a denied or errored mic must never be a dead end. */}
        {phase === "permission-denied" && (
          <RecoveryNotice
            variant="denied"
            onRetry={() => { void handleMicTap(); }}
            onOpenSettings={openMicSettings}
          />
        )}
        {phase === "error" && recorder.state.error && (
          <RecoveryNotice
            variant="error"
            message={recorder.state.error}
            onRetry={() => { void handleMicTap(); }}
          />
        )}

        {/* Failed upload — the recording is held in memory; offer a retry so a
            captured idea never dies to a dropped connection. */}
        {failedTake && !saving && phase !== "recording" && (
          <FailedTakeNotice
            durationMs={failedTake.durationMs}
            onRetry={retryFailedTake}
            onDiscard={() => setFailedTake(null)}
          />
        )}

        {/* Rail is a fixed right-edge overlay so the mic stays dead center. */}
        <SideRail recording={phase === "recording"} onAction={handleRailAction} />

        <LiveTranscript
          blocks={blocks}
          partial={phase === "recording" ? live.partial : ""}
          status={
            phase === "recording"
              ? "listening"
              : saving
                ? "transcribing"
                : status
          }
        />

        {pendingBlocks.length > 0 && phase !== "recording" && !review.open && (
          <p
            className="text-xs"
            style={{ color: "var(--cog-warm-gray)", fontStyle: "italic" }}
          >
            {pendingBlocks.length} {pendingBlocks.length === 1 ? "note" : "notes"} ready · record a take to review.
          </p>
        )}

        {phase !== "recording" && !saving && !review.open && (
          <ImportMemoButton disabled={saving} onPicked={handleAudioFile} />
        )}

        {/* Peek-strip of the last 3 captures — only shown when idle so it
            never competes with the live transcript bloom. */}
        {phase !== "recording" && !saving && !review.open && (
          <LatestPeekStrip onResume={handleResumePeek} />
        )}
      </main>

      <CaptureSheet
        open={sheetAction !== null}
        action={sheetAction}
        onClose={() => setSheetAction(null)}
        onSave={handleSheetSave}
      />

      <ReviewSheet
        open={review.open}
        takeId={review.takeId}
        songId={review.songId}
        songTitle={review.songTitle}
        storagePath={review.storagePath}
        durationMs={review.durationMs}
        pendingBlocks={pendingBlocks}
        onClose={handleReviewClose}
        onCommitted={handleReviewCommitted}
      />

      <CommitRibbon
        open={ribbon.open}
        blockCount={ribbon.blockCount}
        songTitle={ribbon.songTitle}
        onOpenCanvas={() => {
          if (ribbon.songId) {
            navigate(`/songs/${ribbon.songId}/canvas?from=capture`);
          }
          setRibbon((r) => ({ ...r, open: false }));
        }}
        onDismiss={() => setRibbon((r) => ({ ...r, open: false }))}
      />
    </div>
  );
};

export default CaptureScene;

function formatNewSongTitle(): string {
  const now = new Date();
  const day = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `New idea · ${day} · ${time}`;
}

/** Best-effort deep link to OS/browser mic settings, with a guiding toast. */
function openMicSettings(): void {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPad|iPhone|iPod/.test(ua)) {
    window.location.href = "app-settings:";
    setTimeout(() => toast("Open Settings → Colors of Glory → Microphone, then return."), 400);
  } else if (/Android/.test(ua)) {
    toast("Open Settings → Apps → Colors of Glory → Permissions → Microphone.");
  } else {
    toast("Click the lock icon in your address bar → Site settings → Microphone → Allow.");
  }
}

/**
 * FailedTakeNotice — shown when a recording uploaded but the network dropped.
 * The blob is still held in memory, so we reassure ("your recording is safe")
 * and offer a one-tap retry rather than forcing the songwriter to re-perform.
 */
function FailedTakeNotice({
  durationMs,
  onRetry,
  onDiscard,
}: {
  durationMs: number;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        width: "100%",
        maxWidth: 360,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "16px 18px",
        borderRadius: 18,
        background: "var(--cog-cream-light)",
        border: "1px solid rgba(181,74,48,0.30)",
        boxShadow: "0 8px 28px rgba(28,26,23,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: "50%",
            background: "rgba(181,74,48,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#b54a30",
          }}
        >
          <AlertTriangle size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)", margin: 0 }}>
            Couldn't save that take
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)", margin: "2px 0 0" }}>
            Your {formatDuration(durationMs)} recording is safe — let's try again.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onRetry}
          className="transition-transform active:scale-95"
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            background: "var(--cog-gold)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: "0 6px 18px rgba(184,149,58,0.30)",
          }}
        >
          <RefreshCw size={15} />
          Retry
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="transition-transform active:scale-95"
          style={{
            height: 44,
            paddingInline: 16,
            borderRadius: 12,
            background: "transparent",
            color: "var(--cog-warm-gray)",
            border: "1px solid var(--cog-border)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

/**
 * RecoveryNotice — a calm, on-brand way back when the mic is blocked or a take
 * errored. A denied or failed mic must never be a dead end: at scale, a
 * meaningful share of first-time users tap "Don't Allow" by reflex.
 */
function RecoveryNotice({
  variant,
  message,
  onRetry,
  onOpenSettings,
}: {
  variant: "denied" | "error";
  message?: string;
  onRetry: () => void;
  onOpenSettings?: () => void;
}) {
  const denied = variant === "denied";
  return (
    <div
      role="alert"
      style={{
        width: "100%",
        maxWidth: 360,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        padding: "20px 22px",
        borderRadius: 18,
        background: "var(--cog-cream-light)",
        border: "1px solid var(--cog-border)",
        boxShadow: "0 8px 28px rgba(28,26,23,0.06)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "rgba(184,149,58,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--cog-gold)",
        }}
      >
        {denied ? <MicOff size={24} /> : <RefreshCw size={22} />}
      </div>

      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--cog-charcoal)",
          margin: 0,
        }}
      >
        {denied ? "Microphone access is off" : "That take didn't record"}
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--cog-warm-gray)",
          margin: 0,
        }}
      >
        {denied
          ? "Colors of Glory needs your microphone to catch an idea. Turn it on, then come right back."
          : message ?? "Something interrupted the mic. Give it another try."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 4 }}>
        {denied && onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="transition-transform active:scale-95"
            style={{
              height: 48,
              borderRadius: 14,
              background: "var(--cog-gold)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              fontWeight: 700,
              boxShadow: "0 6px 20px rgba(184,149,58,0.32)",
            }}
          >
            Open Settings
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="transition-transform active:scale-95"
          style={{
            height: 48,
            borderRadius: 14,
            background: denied ? "transparent" : "var(--cog-gold)",
            color: denied ? "var(--cog-charcoal)" : "#fff",
            border: denied ? "1px solid var(--cog-border)" : "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 15,
            fontWeight: denied ? 600 : 700,
            boxShadow: denied ? "none" : "0 6px 20px rgba(184,149,58,0.32)",
          }}
        >
          Try again
        </button>
      </div>

      {denied && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--cog-muted)",
            margin: "2px 0 0",
          }}
        >
          Prefer not to? You can still import an existing recording below.
        </p>
      )}
    </div>
  );
}

/**
 * Time-of-day rotating prompt. Sunday gets its own worship-leaning copy.
 * Pure function — no React, no Date.now mocking required for testing.
 */
function pickPrompt(now: Date): string {
  const hour = now.getHours();
  const isSunday = now.getDay() === 0;
  if (isSunday) {
    return "What did worship stir in you today?";
  }
  if (hour < 5) return "Something the night gave you?";
  if (hour < 12) return "What's the first line that came to you?";
  if (hour < 17) return "Hum the melody you can't shake.";
  if (hour < 22) return "Anything from today worth remembering?";
  return "One quiet thought before bed?";
}
