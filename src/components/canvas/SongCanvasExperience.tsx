import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mic, Plus } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";
import CanvasViewport from "@/components/canvas/CanvasViewport";
import RootSongCard from "@/components/canvas/RootSongCard";
import IdeaCanvasCard from "@/components/canvas/IdeaCanvasCard";
import CanvasConnectionLayer from "@/components/canvas/CanvasConnectionLayer";
import AddIdeaSheet from "@/components/canvas/AddIdeaSheet";
import CardDetailDrawer from "@/components/canvas/CardDetailDrawer";
import {
  addIdeaToCanvas,
  createInitialCanvasState,
  getCanvasPermissions,
  moveNodeToZone,
  persistCanvasState,
} from "@/lib/canvas/canvasService";
import type { AddIdeaInput, CanvasRole } from "@/lib/canvas/canvasTypes";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";
import RecordingSheet from "@/components/voice/RecordingSheet";
import VoiceReviewSheet from "@/components/voice/VoiceReviewSheet";
import { uploadVoiceMemo } from "@/lib/voice/voiceApi";
import { formatDuration } from "@/lib/voice/audioFormat";

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const ROLE_VALUES = new Set(["owner", "contributor", "reviewer", "viewer"]);

const toCanvasRole = (value: string | null): CanvasRole =>
  value && ROLE_VALUES.has(value) ? (value as CanvasRole) : "owner";

const SongCanvasSemanticSummary = ({ title }: { title: string }) => (
  <section aria-label="Song room sections" style={VISUALLY_HIDDEN}>
    <p>Everything for this song stays connected here.</p>
    <h2>Lyrics</h2>
    <h2>Voice memos</h2>
    <h2>Chord map</h2>
    <h2>Song notes</h2>
    <h2>Ideas tree</h2>
    <h2>Final tree</h2>
    <h2>In this room</h2>
    <h2>What changed</h2>
    <p>{title} has a central song card and visible song idea cards.</p>
  </section>
);

const SongCanvasExperience = () => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = toCanvasRole(searchParams.get("role"));

  const [canvas, setCanvas] = useState(() => createInitialCanvasState(songId, songTitle, role));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerState, setDrawerState] = useState<"closed" | "addIdea">("closed");

  // ── Voice recording ────────────────────────────────────────────────────────
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  type RecordingFlow = "idle" | "recording" | "reviewing";
  const [recordingFlow, setRecordingFlow] = useState<RecordingFlow>("idle");
  const [recordingSection, setRecordingSection] = useState("Raw idea");
  const [recordingNote, setRecordingNote] = useState("");
  const [pendingRecording, setPendingRecording] = useState<RecordingResult | null>(null);
  const voiceMemoCountRef = useRef(0);

  const permissions = useMemo(() => getCanvasPermissions(role), [role]);
  const nodesById = useMemo(() => new Map(canvas.nodes.map((node) => [node.id, node])), [canvas.nodes]);
  const rootNode = canvas.nodes.find((node) => node.objectType === "root_song");
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) : undefined;
  const selectedCard = selectedNode?.objectType === "idea_card" ? canvas.cardsById[selectedNode.objectId] : undefined;

  const updateCanvas = useCallback((next: typeof canvas) => {
    persistCanvasState(next);
    setCanvas({
      ...next,
      permissions,
      song: { ...next.song, title: songTitle },
    });
  }, [permissions, songTitle]);

  const openAddIdea = useCallback(() => {
    if (!permissions.canCreate) return;
    setDrawerState("addIdea");
    setSelectedNodeId(null);
  }, [permissions.canCreate]);

  const saveIdea = useCallback((input: AddIdeaInput) => {
    const next = addIdeaToCanvas({ ...canvas, permissions }, input);
    setCanvas(next);
    setDrawerState("closed");
    const addedNode = next.nodes[next.nodes.length - 1];
    setSelectedNodeId(addedNode.id);
  }, [canvas, permissions]);

  const moveSelectedNode = useCallback(() => {
    if (!selectedNode || !permissions.canMove) return;
    updateCanvas(moveNodeToZone(canvas, selectedNode.id, "review"));
  }, [selectedNode, permissions.canMove, updateCanvas, canvas]);

  const openRecordMemo = useCallback(async () => {
    if (!permissions.canRecord) return;
    setDrawerState("closed");
    setRecordingSection("Raw idea");
    setRecordingNote("");
    setRecordingFlow("recording");
    await startRecording();
  }, [permissions.canRecord, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording();
    if (result) {
      setPendingRecording(result);
      setRecordingFlow("reviewing");
    } else {
      setRecordingFlow("idle");
    }
  }, [stopRecording]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
  }, [cancelRecording]);

  const handleSaveVoiceMemo = useCallback(async ({
    name,
    section,
    transcribe,
  }: { name: string; section: string; transcribe: boolean }) => {
    if (!pendingRecording) return;

    voiceMemoCountRef.current++;

    // Add card to canvas immediately
    const ideaInput: AddIdeaInput = {
      title: name,
      preview: `🎙 ${formatDuration(pendingRecording.durationMs)} · ${section}`,
      type: "voice",
    };
    const next = addIdeaToCanvas({ ...canvas, permissions }, ideaInput);
    setCanvas(next);
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);

    // Upload in background
    try {
      await uploadVoiceMemo({
        songId,
        blob: pendingRecording.blob,
        mimeType: pendingRecording.mimeType,
        durationMs: pendingRecording.durationMs,
        title: name,
        sectionLabel: section,
        transcribe,
      });
    } catch {
      // upload failed — card stays on canvas, memo won't be in DB
    }
  }, [pendingRecording, canvas, permissions, songId]);

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

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", backgroundColor: "var(--cog-cream)", overflow: "hidden" }}
    >
      <SongCanvasSemanticSummary title={canvas.song.title} />
      <div className="pointer-events-none fixed inset-0 cog-glow" />

      <header
        className="relative z-30 mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-5 pb-3"
        style={{ paddingTop: 46 }}
      >
        <button
          type="button"
          onClick={() => navigate(`/songs/${songId}`)}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "var(--cog-warm-gray)", flexShrink: 0 }}
          aria-label="Back to song workspace"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Song
        </button>

        <div className="min-w-0 flex-1 text-center">
          <CogBrand variant="stacked" size="sm" />
          <h1
            className="mt-1 truncate text-center text-[17px] font-semibold leading-tight"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
          >
            {canvas.song.title}
          </h1>
          <p className="text-[11px] font-medium" style={{ color: "var(--cog-muted)" }}>
            Canvas
          </p>
        </div>

        <div className="flex shrink-0 rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold)" }}>
          {role}
        </div>
      </header>

      <div className="relative z-20 px-5 pb-3">
        <div className="mx-auto max-w-[760px] rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(250,247,242,0.82)", border: "1px solid var(--cog-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
            Start building the song here.
          </p>
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--cog-warm-gray)" }}>
            Add a lyric, voice memo, chord idea, story note, or scripture note. Everything stays connected to this song.
          </p>
          {!permissions.canCreate && (
            <p className="mt-2 text-xs font-medium" style={{ color: "var(--cog-gold)" }}>
              You can view this canvas. Ask the owner if you need to contribute.
            </p>
          )}
        </div>
      </div>

      <main className="relative min-h-0 flex-1" aria-label="Song canvas workspace">
        <section aria-label="Song canvas map" className="h-full">
          <CanvasViewport
            className="h-full w-full"
            initialZoom={0.92}
            overlay={
              <div
                className="pointer-events-none absolute inset-x-0 bottom-[76px] z-40 mx-auto flex max-w-[430px] gap-2 px-5 pb-4"
                style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
              >
                <button
                  type="button"
                  onClick={openAddIdea}
                  disabled={!permissions.canCreate}
                  className="pointer-events-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: "var(--cog-gold)", boxShadow: "var(--cog-shadow-fab)" }}
                >
                  <Plus size={17} strokeWidth={2} />
                  Add idea
                </button>
                <button
                  type="button"
                  onClick={() => { void openRecordMemo(); }}
                  disabled={!permissions.canRecord || recordingFlow !== "idle"}
                  aria-label={recordingFlow === "recording" ? "Recording..." : "Record idea / Record memo"}
                  aria-pressed={recordingFlow === "recording"}
                  className="pointer-events-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                  style={{
                    backgroundColor: recordingFlow === "recording" ? "#E05440" : "var(--cog-cream-light)",
                    border: recordingFlow === "recording" ? "none" : "1px solid var(--cog-border)",
                    color: recordingFlow === "recording" ? "#FFFFFF" : "var(--cog-charcoal)",
                    animation: recordingFlow === "recording" ? "mic-pulse 1.4s ease-in-out infinite" : "none",
                  }}
                >
                  <Mic size={17} strokeWidth={2} />
                  {recordingFlow === "recording" ? "Recording..." : "Record memo"}
                </button>
              </div>
            }
          >
            <CanvasConnectionLayer edges={canvas.edges} nodes={canvas.nodes} />

            {rootNode && (
              <RootSongCard
                title={canvas.song.title}
                x={rootNode.x}
                y={rootNode.y}
                width={rootNode.width}
                height={rootNode.height}
              />
            )}

            {canvas.nodes.map((node) => {
              if (node.objectType !== "idea_card") return null;
              const card = canvas.cardsById[node.objectId];
              if (!card) return null;
              return (
                <IdeaCanvasCard
                  key={node.id}
                  card={card}
                  node={node}
                  selected={selectedNodeId === node.id}
                  onOpen={() => {
                    setSelectedNodeId(node.id);
                    setDrawerState("closed");
                  }}
                />
              );
            })}
          </CanvasViewport>
        </section>

        <div
          aria-live="polite"
          className="absolute left-5 top-3 z-40 rounded-full px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "rgba(250,247,242,0.92)", color: "var(--cog-gold)", border: "1px solid rgba(184,149,58,0.18)" }}
        >
          {canvas.lastStatus}
        </div>

        {drawerState === "addIdea" && (
          <AddIdeaSheet
            onClose={() => setDrawerState("closed")}
            onSave={saveIdea}
          />
        )}

        {selectedCard && selectedNode && drawerState === "closed" && (
          <CardDetailDrawer
            card={selectedCard}
            node={selectedNode}
            permissions={permissions}
            onClose={() => setSelectedNodeId(null)}
            onMove={moveSelectedNode}
          />
        )}
      </main>

      <SongTabBar activeTab="canvas" />

      {/* ── Recording sheet (slides up over canvas) ──────────────────── */}
      {(recordingFlow === "recording" || recorderState.phase === "permission-denied") && (
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

      {/* ── Review sheet (after stopping) ────────────────────────────── */}
      {recordingFlow === "reviewing" && pendingRecording && (
        <VoiceReviewSheet
          recording={pendingRecording}
          defaultName={recordingNote.trim() || `Voice Memo ${voiceMemoCountRef.current + 1}`}
          section={recordingSection}
          onSave={handleSaveVoiceMemo}
          onDiscard={handleCancelRecording}
        />
      )}

      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(224,84,64,0.18), 0 4px 16px rgba(224,84,64,0.45); }
          50%       { box-shadow: 0 0 0 14px rgba(224,84,64,0.08), 0 4px 16px rgba(224,84,64,0.45); }
        }
      `}</style>
    </div>
  );
};

export default SongCanvasExperience;
