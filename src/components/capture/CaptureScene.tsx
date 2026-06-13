import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Settings } from "lucide-react";
import { toast } from "sonner";

import { useVoiceRecorder, type RecordingResult } from "@/hooks/useVoiceRecorder";
import { useLiveTranscript } from "@/hooks/useLiveTranscript";
import { submitSharedAudio } from "@/integrations/cog/intake";
import { createSong } from "@/integrations/cog/songs";
import { getPrimaryTakeIdForMemo } from "@/integrations/cog/transcript";
import { supabase } from "@/integrations/supabase/client";
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
  const [humMode, setHumMode] = useState(false);
  const [prompt] = useState(() => pickPrompt(new Date()));

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

  // Reset state if the user navigates between contexts.
  useEffect(() => {
    return () => {
      recorder.cancelRecording();
      live.stop();
    };
  }, [recorder, live]);

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
        let targetSongId = songId ?? null;
        let targetSongTitle = songTitle;
        if (!targetSongId) {
          const newTitle = formatNewSongTitle();
          const { song } = await createSong({ title: newTitle });
          targetSongId = song.id;
          targetSongTitle = newTitle;
          toast.message("Started a new song", { description: newTitle });
        }

        const intake = await submitSharedAudio({
          file,
          song_id: targetSongId,
          title: targetSongTitle ? `${targetSongTitle} — capture` : "Capture",
        });

        const takeId = await getPrimaryTakeIdForMemo(intake.voice_memo_id);
        if (!takeId) throw new Error("Take was created but could not be located.");

        const { data: takeRow } = await supabase
          .from("takes")
          .select("storage_path")
          .eq("id", takeId)
          .maybeSingle();

        setStatus("ready");
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
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error("Could not save take", { description: msg.slice(0, 140) });
      } finally {
        setSaving(false);
        setHumMode(false);
      }
    },
    [saving, songId, songTitle],
  );

  // Auto-saved takes (interruption / ceiling / page hidden) flow through the
  // same upload path as a manual stop, so the idea lands in review either way.
  const handleAutoFinalize = useCallback(
    (result: RecordingResult | null) => {
      live.stop();
      if (!result) {
        setHumMode(false);
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
    setHumMode(false);
    setStatus("listening");
    live.reset();
    if (live.supported) live.start();
    await recorder.startRecording();
  }, [phase, recorder, saving, live, handleAudioFile]);

  const handleHoldStart = useCallback(async () => {
    if (saving || phase === "recording") return;
    setManualMarkers([]);
    setHumMode(true);
    setStatus("listening");
    live.reset();
    if (live.supported) live.start();
    await recorder.startRecording();
  }, [phase, recorder, saving, live]);

  const handleHoldEnd = useCallback(async () => {
    if (phase !== "recording") return;
    const result = await recorder.stopRecording();
    live.stop();
    if (!result) {
      setHumMode(false);
      return;
    }
    const file = new File([result.blob], `hum-${Date.now()}.webm`, {
      type: result.mimeType || "audio/webm",
    });
    await handleAudioFile(file, result.durationMs);
  }, [phase, recorder, live, handleAudioFile]);

  const handleRailAction = useCallback(
    (action: RailAction) => {
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
    [phase, durationMs],
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

  return (
    <div className="relative min-h-[100dvh] w-full" style={{ background: "var(--cog-cream)" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 cog-glow" />

      {/* Header */}
      <header
        className="relative flex items-center justify-between"
        style={{ padding: "12px 16px", paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/songs")}
          aria-label="Open songs"
          className="flex items-center transition-transform active:scale-95"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cog-charcoal)",
            cursor: "pointer",
            padding: 8,
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
            onClick={() => navigate(`/songs/${songId}/room`)}
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
          <div
            aria-label="Capture destination"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              color: "var(--cog-charcoal)",
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(184,149,58,0.10)",
              border: "1px solid rgba(184,149,58,0.25)",
            }}
          >
            Unfiled
          </div>
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
          onHoldStart={handleHoldStart}
          onHoldEnd={handleHoldEnd}
          humMode={humMode}
        />

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

        {recorder.state.error && (
          <p
            role="alert"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "#b54a30",
              textAlign: "center",
            }}
          >
            {recorder.state.error}
          </p>
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