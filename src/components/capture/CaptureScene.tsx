import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
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
  const recorder = useVoiceRecorder();
  const { phase, durationMs, analyserNode } = recorder.state;
  const live = useLiveTranscript();

  const [manualMarkers, setManualMarkers] = useState<SectionMarker[]>([]);
  const [status, setStatus] = useState<
    "idle" | "listening" | "transcribing" | "ready" | "skipped"
  >("idle");
  const [saving, setSaving] = useState(false);

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

  const handleMicTap = useCallback(async () => {
    if (saving) return;

    if (phase === "recording") {
      const result = await recorder.stopRecording();
      live.stop();
      if (!result) return;
      setStatus("transcribing");
      setSaving(true);
      try {
        // 1. Make sure we have a destination song.
        let targetSongId = songId ?? null;
        let targetSongTitle = songTitle;
        if (!targetSongId) {
          const newTitle = formatNewSongTitle();
          const { song } = await createSong({ title: newTitle });
          targetSongId = song.id;
          targetSongTitle = newTitle;
          toast.message("Started a new song", { description: newTitle });
        }

        // 2. Upload the audio + create the voice memo + primary take in one call.
        const file = new File([result.blob], `take-${Date.now()}.webm`, {
          type: result.mimeType || "audio/webm",
        });
        const intake = await submitSharedAudio({
          file,
          song_id: targetSongId,
          title: targetSongTitle ? `${targetSongTitle} — capture` : "Capture",
        });

        // 3. Find the take row we'll transcribe + commit.
        const takeId = await getPrimaryTakeIdForMemo(intake.voice_memo_id);
        if (!takeId) throw new Error("Take was created but could not be located.");

        // 4. Resolve the take's storage_path so the review sheet can play it back.
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
          durationMs: result.durationMs,
        });
      } catch (err) {
        setStatus("skipped");
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error("Could not save take", { description: msg.slice(0, 140) });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Start recording fresh.
    setManualMarkers([]);
    setStatus("listening");
    live.reset();
    if (live.supported) live.start();
    await recorder.startRecording();
  }, [phase, recorder, saving, songId, songTitle, live]);

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
          aria-label="More options"
          className="flex items-center justify-center transition-transform active:scale-95"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cog-charcoal)",
            cursor: "pointer",
            padding: 8,
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* Main scene */}
      <main
        className="relative flex flex-col items-center"
        style={{ padding: "16px 20px 120px", gap: 28 }}
      >
        <BigMic
          phase={phase}
          durationMs={durationMs}
          analyser={analyserNode}
          onTap={handleMicTap}
        />

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