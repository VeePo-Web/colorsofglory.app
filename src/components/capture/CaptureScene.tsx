import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { uploadVoiceMemo } from "@/integrations/cog/memos";
import { quickCapture } from "@/integrations/cog/capture";
import BigMic from "./BigMic";
import SideRail, { type RailAction } from "./SideRail";
import LiveTranscript from "./LiveTranscript";
import { buildTranscriptBlocks, detectSectionMarkers } from "@/lib/capture/sectionKeywords";
import type { SectionMarker, TranscriptWord } from "@/lib/capture/transcriptModel";

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

  const [manualMarkers, setManualMarkers] = useState<SectionMarker[]>([]);
  const [transcriptWords, setTranscriptWords] = useState<TranscriptWord[]>([]);
  const [status, setStatus] = useState<
    "idle" | "listening" | "transcribing" | "ready" | "skipped"
  >("idle");
  const [saving, setSaving] = useState(false);

  // Reset state if the user navigates between contexts.
  useEffect(() => {
    return () => {
      recorder.cancelRecording();
    };
  }, [recorder]);

  const blocks = useMemo(() => {
    const markers = detectSectionMarkers(transcriptWords, manualMarkers);
    return buildTranscriptBlocks(transcriptWords, markers);
  }, [transcriptWords, manualMarkers]);

  const handleMicTap = useCallback(async () => {
    if (saving) return;
    if (phase === "recording") {
      const result = await recorder.stopRecording();
      if (!result) return;
      setStatus("transcribing");
      setSaving(true);
      try {
        const memoId = await uploadVoiceMemo({
          songId: songId ?? "00000000-0000-0000-0000-000000000000",
          blob: result.blob,
          mimeType: result.mimeType,
          durationMs: result.durationMs,
          title: songTitle ? `${songTitle} — capture` : "Unfiled capture",
        }).catch(() => null);

        if (memoId && songId) {
          // Best-effort linkage to the song's idea feed.
          await quickCapture({
            song_id: songId,
            title: "Voice capture",
            voice_memo_id: memoId,
          }).catch(() => undefined);
        }

        setStatus(memoId ? "ready" : "skipped");
        toast.success(
          songTitle ? `Saved to ${songTitle}` : "Saved to your Unfiled inbox",
          { description: "Phase 1: review + canvas commit ship next." },
        );
      } catch (err) {
        setStatus("skipped");
        toast.error("Could not save take. Recording is still on your device.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setManualMarkers([]);
    setTranscriptWords([]);
    setStatus("listening");
    await recorder.startRecording();
  }, [phase, recorder, saving, songId, songTitle]);

  const handleRailAction = useCallback(
    (action: RailAction) => {
      if (action !== "section") {
        toast.message(`${action[0].toUpperCase() + action.slice(1)} sheet coming next.`, {
          description: "Phase 1.5 will open the progressive capture sheet here.",
        });
        return;
      }
      if (phase !== "recording") {
        toast.message("Start a take first, then tap Section to mark a new part.");
        return;
      }
      setManualMarkers((prev) => [
        ...prev,
        {
          atMs: durationMs,
          kind: "verse",
          source: "manual",
          label: "New Section",
        },
      ]);
      toast.success("Section marker added", {
        description: `at ${(durationMs / 1000).toFixed(1)}s — rename in the review sheet.`,
      });
    },
    [phase, durationMs],
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
          {songTitle ?? "Unfiled"}
        </div>

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
          status={
            phase === "recording"
              ? "listening"
              : saving
                ? "transcribing"
                : status
          }
        />

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
    </div>
  );
};

export default CaptureScene;