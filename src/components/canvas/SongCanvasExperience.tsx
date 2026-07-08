import {
  ElementType,
  lazy,
  Suspense,
  useCallback,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Mic,
  Music,
  Plus,
  StickyNote,
  Users,
  GitBranch,
  BookOpen,
  History,
  UserPlus,
  Inbox,
} from "lucide-react";
import { loadPracticeSections } from "@/lib/practice/practiceApi";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import CreativeActionDock from "@/components/cog/CreativeActionDock";
import SongRoomSaveToast, { type SongRoomSaveMoment } from "@/components/cog/SongRoomSaveToast";
import { useSongTitle } from "@/lib/songContext";
import type { ViewportCtx } from "@/components/canvas/CanvasViewport";
import CanvasStage, { type CanvasCardInteractions } from "@/components/canvas/CanvasStage";
import FirstActionPrompt from "@/components/canvas/FirstActionPrompt";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import { COLUMN_TOP, ideaColumnSlot, finalColumnSlot } from "@/lib/canvas/canvasGeometry";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";
import RecordingSheet from "@/components/voice/RecordingSheet";
import VoiceReviewSheet from "@/components/voice/VoiceReviewSheet";
import VoiceLayerPanel from "@/components/voice/VoiceLayerPanel";
import {
  enqueuePendingUpload,
  flushPendingUpload,
  listPendingUploads,
} from "@/lib/voice/pendingUploads";
import { formatDuration } from "@/lib/voice/audioFormat";
import { loadVoiceMemosForCanvas } from "@/lib/canvas/canvasLoader";
import {
  addLineSuggestion,
  listLineSuggestions,
  removeLineSuggestion,
  type PendingLineSuggestion,
} from "@/lib/canvas/lineSuggestions";
import StackSheet from "@/components/voice/StackSheet";
import type { StackMemoView } from "@/components/voice/MemoStack";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import CoachMark from "@/components/onboarding/CoachMark";
import { useCoachMark } from "@/components/onboarding/useCoachMark";
import { useSongCollaborators } from "@/lib/invite/useSongCollaborators";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { useSongPresence } from "@/lib/canvas/useSongPresence";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { subscribeSongRoom } from "@/integrations/cog/realtime";
import { toast } from "sonner";
import WhatChangedRecapSheet from "@/components/canvas/WhatChangedRecapSheet";
import CanvasRecapGate from "@/components/canvas/CanvasRecapGate";
import LineSuggestionSheet, { type LineSuggestionMode } from "@/components/canvas/LineSuggestionSheet";
import ListenPathBar from "@/components/canvas/ListenPathBar";
import MergeActionBar from "@/components/canvas/MergeActionBar";
import CompareModeSheet from "@/components/canvas/CompareModeSheet";
import FinalArrangementBar from "@/components/canvas/FinalArrangementBar";
import CanvasMetronomeToggle from "@/components/canvas/CanvasMetronomeToggle";
import type { CanvasBoardCard, CanvasBoardCardType } from "@/lib/canvas/canvasTypes";
import {
  useListenPath,
  useCompareMode,
  useMergeSplice,
  useFinalArrangement,
  useCanvasMetronome,
  type CanvasFeatureMutations,
  type CanvasFeatureMeta,
} from "@/lib/canvas/features";

const SongCanvasWorkLayers = lazy(() => import("@/components/cog/SongCanvasWorkLayers"));
const SongCanvasCollabLayers = lazy(() => import("@/components/cog/SongCanvasCollabLayers"));
const ShareSongSheet = lazy(() => import("@/components/invite/ShareSongSheet"));
const CardEditSheet = lazy(() => import("@/components/canvas/CardEditSheet"));
const CardActionsSheet = lazy(() => import("@/components/canvas/CardActionsSheet"));
const AddPartSheet = lazy(() => import("@/components/canvas/AddPartSheet"));
const OwnerReviewQueueSheet = lazy(() => import("@/components/canvas/OwnerReviewQueueSheet"));

// ─── Types ───────────────────────────────────────────────────────────────────

type CanvasCardType = CanvasBoardCardType;
type LayerId = "room" | "lyrics" | "voice" | "chords" | "notes" | "ideas" | "people";

/**
 * Canonical shape lives in @/lib/canvas/canvasTypes (CanvasBoardCard).
 * Re-exported here only for back-compat with older imports.
 */
export type CanvasCard = CanvasBoardCard;

/** Canvas card → the shape the stack engine + sheet consume. */
const toStackView = (c: CanvasCard): StackMemoView => ({
  id: c.id,
  parentMemoId: c.parentMemoId,
  title: c.title,
  contributor: c.contributor,
  durationMs: c.durationMs ?? 0,
  section: c.section,
});

type RecordingFlow = "idle" | "recording" | "reviewing";

const LAYERS: Array<{ id: LayerId; label: string; icon: ElementType }> = [
  { id: "room",   label: "Canvas",  icon: GitBranch },
  { id: "lyrics", label: "Lyrics",  icon: FileText },
  { id: "voice",  label: "Voice",   icon: Mic },
  { id: "chords", label: "Chords",  icon: Music },
  { id: "notes",  label: "Notes",   icon: StickyNote },
  { id: "people", label: "People",  icon: Users },
];

// ─── Initial card data ────────────────────────────────────────────────────────

const INITIAL_CARDS: CanvasCard[] = [
  {
    id: "hum-1",
    tree: "ideas",
    type: "hum",
    title: "First melody hum",
    body: "Soft lift into the chorus. Keep the ache in the first two notes.",
    meta: "0:12 voice",
    section: "Verse 1",
    contributor: "Parker",
    status: "raw",
    accent: getCreatorColor("Parker").base,
    x: 80,
    y: 200,
  },
  {
    id: "verse-line",
    tree: "ideas",
    type: "lyric",
    title: "Verse image",
    body: "I waited in the quiet / You painted morning gold.",
    meta: "Lyric fragment",
    section: "Verse 1",
    contributor: "Sarah",
    status: "shortlisted",
    accent: getCreatorColor("Sarah").base,
    x: 320,
    y: 200,
  },
  {
    id: "meaning-psalm",
    tree: "ideas",
    type: "scripture",
    title: "Meaning anchor",
    body: "Psalm 46:10 — Be still before the second verse turns upward.",
    meta: "Scripture",
    section: "Meaning",
    contributor: "Parker",
    status: "meaning",
    accent: getCreatorColor("Parker").base,
    x: 80,
    y: 440,
  },
  {
    id: "chorus-core",
    tree: "final",
    type: "section",
    title: "Chorus center",
    body: "You are glory in the waiting / Fire in the night.",
    meta: "Approved lyric",
    section: "Chorus",
    contributor: "Parker",
    status: "approved",
    accent: getCreatorColor("Parker").base,
    x: DIVIDER_X + 80,
    y: 200,
  },
  {
    id: "chord-bed",
    tree: "final",
    type: "chord",
    title: "Warm progression",
    body: "C - G - Am - F, 74 BPM. Let the bridge breathe.",
    meta: "Key C",
    section: "Arrangement",
    contributor: "Caleb",
    status: "approved",
    accent: getCreatorColor("Caleb").base,
    x: DIVIDER_X + 80,
    y: 420,
  },
];

const CARDS_KEY = (songId: string) => `cog:canvas-cards-${songId}`;
// Interim store persistence for non-card feature state (saved listen path).
// This key + the CanvasFeatureMutations impl below ARE the A4 replacement
// seam — see docs/CANVAS-FEATURES-CONTRACT.md.
const FEATURES_KEY = (songId: string) => `cog:canvas-features-${songId}`;

const getStoredFeatureMeta = (songId: string): CanvasFeatureMeta => {
  try {
    const stored = localStorage.getItem(FEATURES_KEY(songId));
    return stored ? (JSON.parse(stored) as CanvasFeatureMeta) : {};
  } catch {
    return {};
  }
};
const SHOW_LEGACY_CANVAS_FABS = false;

const getStoredCards = (songId: string): CanvasCard[] => {
  try {
    const stored = localStorage.getItem(CARDS_KEY(songId));
    // Respect a saved board exactly — including an empty one. A songwriter who
    // clears their canvas must not have demo cards resurrected on reload.
    if (stored) {
      const parsed = JSON.parse(stored) as CanvasCard[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fall through to a clean start.
  }
  // No saved board yet: a real song is a private, empty room (the first-action
  // prompt guides the first idea). Only the explicit demo route shows samples,
  // so no real song is ever pre-filled with someone else's words.
  return songId === "demo" ? INITIAL_CARDS : [];
};

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

const SongCanvasSemanticSummary = () => (
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
  </section>
);

// ─── isLayerId guard ──────────────────────────────────────────────────────────

const isLayerId = (v: string | null): v is LayerId =>
  ["room", "lyrics", "voice", "chords", "notes", "ideas", "people"].includes(v ?? "");

// ─── Main page ────────────────────────────────────────────────────────────────

const SongCanvasExperience = () => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewer = searchParams.get("role") === "viewer";

  // First-run tour refs — the canvas hooks live below, after showFirstRun is
  // known, so they can wait for the empty-room first-action guide to finish.
  const featuresTourRef = useRef<HTMLElement>(null);
  const ideasTourRef = useRef<HTMLDivElement>(null);
  const inviteTourRef = useRef<HTMLButtonElement>(null);

  // Real signed-in identity so contributions + presence carry the actual person,
  // not a hardcoded "You". Falls back gracefully before the profile resolves.
  const { profile } = useCurrentAccount();
  const currentUserName = useMemo(() => {
    const display = profile?.display_name?.trim();
    if (display) return display;
    const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
    return full || "You";
  }, [profile]);

  const [cards, setCards] = useState<CanvasCard[]>(() => getStoredCards(songId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasStatus, setCanvasStatus] = useState("Saved to this song.");
  const [isDragOver, setIsDragOver] = useState(false);  // for divider glow
  const [activeLayer, setActiveLayer] = useState<LayerId>(() => {
    const layer = searchParams.get("layer");
    return isLayerId(layer) ? layer : "room";
  });
  const [showWorkPanel, setShowWorkPanel] = useState(activeLayer !== "room" && activeLayer !== "ideas");
  const [saveMoment, setSaveMoment] = useState<SongRoomSaveMoment | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReviewQueue, setShowReviewQueue] = useState(false);
  // Card being edited (write the idea's words) + a card to fly the canvas to
  // once it exists (new cards land below the fold, so we bring them into view).
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  // Card whose overflow action sheet is open (Compare, Suggest, Path, Merge…).
  const [moreCardId, setMoreCardId] = useState<string | null>(null);
  // The "Add a part" section picker (Verse / Chorus / Bridge…).
  const [showAddPart, setShowAddPart] = useState(false);
  // Which zone the viewport is showing — drives the Ideas ⇄ Final quick-nav.
  const [viewZone, setViewZone] = useState<"ideas" | "final">("ideas");
  // Real room roster — the same source the People surface reads.
  const songMembers = useSongCollaborators(songId);
  // Viewport pan/zoom API, bridged out of <CanvasViewport> for presence-jump.
  const viewportApiRef = useRef<ViewportCtx | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [lineSuggest, setLineSuggest] = useState<{
    cardId: string;
    originalLine: string;
    sectionLabel: string;
  } | null>(null);
  // Pending line suggestions from co-writers (Feature 19), owner-reviewed.
  const [lineSuggestions, setLineSuggestions] = useState<PendingLineSuggestion[]>(
    () => listLineSuggestions(songId),
  );

  // ── Practice launcher state ──────────────────────────────────────────────────
  const [isPracticeLaunching, setIsPracticeLaunching] = useState(false);

  const handleLaunchPractice = useCallback(async () => {
    if (isPracticeLaunching) return;
    setIsPracticeLaunching(true);
    try {
      const sections = await loadPracticeSections(songId);
      navigate(`/songs/${songId}/practice`, {
        state: { songTitle, sections },
      });
    } catch {
      setIsPracticeLaunching(false);
    }
  }, [isPracticeLaunching, songId, songTitle, navigate]);

  const showSavedMoment = useCallback((title: string, destination: string, detail?: string) => {
    setSaveMoment({
      id: `save-${Date.now()}`,
      title,
      destination,
      detail,
    });
  }, []);

  // ── Voice recording state ────────────────────────────────────────────────────
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const [recordingFlow, setRecordingFlow] = useState<RecordingFlow>("idle");
  const [recordingSection, setRecordingSection] = useState("Raw idea");
  const [recordingNote, setRecordingNote] = useState("");
  const [pendingRecording, setPendingRecording] = useState<RecordingResult | null>(null);
  const voiceMemoCountRef = useRef(0);
  // When set, the next saved take is a layer recorded over this base memo.
  const recordingParentIdRef = useRef<string | null>(null);
  // The base memo whose stack sheet is currently open (null = closed).
  const [stackBaseId, setStackBaseId] = useState<string | null>(null);

  // ── Canvas feature store (interim A4 seam) ─────────────────────────────────
  // The D2 hooks (src/lib/canvas/features/) own the interaction state machines
  // for Listen Path (F20), Compare (F21), Merge (F22), Final Arrangement (F23)
  // and the metronome (F14). They write ONLY through this CanvasFeatureMutations
  // surface. Today it is implemented over this component's card state; A4's
  // useCanvasStore replaces this object without touching any hook.
  // Contract: docs/CANVAS-FEATURES-CONTRACT.md.
  const [featureMeta, setFeatureMeta] = useState<CanvasFeatureMeta>(() =>
    getStoredFeatureMeta(songId),
  );
  useEffect(() => {
    localStorage.setItem(FEATURES_KEY(songId), JSON.stringify(featureMeta));
  }, [featureMeta, songId]);

  const featureMutations = useMemo<CanvasFeatureMutations>(
    () => ({
      applyMerge: (idA, idB, merged) => {
        setCards((prev) =>
          prev
            .map((c) =>
              c.id === idA || c.id === idB
                ? { ...c, isDimmedReference: true, dimReason: "merged" as const }
                : c,
            )
            .concat(merged),
        );
        setSelectedId(null);
      },
      revertMerge: (mergedId, idA, idB) => {
        setCards((prev) =>
          prev
            .filter((c) => c.id !== mergedId)
            .map((c) =>
              c.id === idA || c.id === idB
                ? { ...c, isDimmedReference: false, dimReason: undefined }
                : c,
            ),
        );
      },
      promoteToFinal: (sourceId, finalCopy) => {
        setCards((prev) =>
          prev
            .map((c) =>
              c.id === sourceId
                ? { ...c, isDimmedReference: true, dimReason: "moved_to_final" as const }
                : c,
            )
            .concat(finalCopy),
        );
        setSelectedId(null);
        setIsDragOver(false);
        setCanvasStatus("Moved. Undo?");
      },
      returnToIdeas: (finalCardId, sourceId) => {
        setCards((prev) =>
          prev
            .filter((c) => c.id !== finalCardId)
            .map((c) =>
              sourceId && c.id === sourceId
                ? { ...c, isDimmedReference: false, dimReason: undefined }
                : c,
            ),
        );
        setSelectedId(null);
        setCanvasStatus("Moved. Undo?");
      },
      patchCards: (patches) => {
        setCards((prev) =>
          prev.map((c) => {
            const found = patches.find((p) => p.id === c.id);
            return found ? { ...c, ...found.patch } : c;
          }),
        );
      },
      saveListenPath: (orderedCardIds) => {
        setFeatureMeta((m) => ({ ...m, listenPath: orderedCardIds }));
      },
    }),
    [],
  );

  // ── D2 feature hooks — the canvas verbs ─────────────────────────────────────
  const listenPath = useListenPath({
    cards,
    mutations: featureMutations,
    initialQueue: featureMeta.listenPath,
  });
  const compare = useCompareMode({
    cards,
    isViewer,
    mutations: featureMutations,
    onMoment: showSavedMoment,
  });
  const merge = useMergeSplice({
    cards,
    isViewer,
    mutations: featureMutations,
    onMoment: showSavedMoment,
  });
  const arrangement = useFinalArrangement({
    cards,
    isViewer,
    mutations: featureMutations,
    finalSlot: finalColumnSlot,
    onMoment: showSavedMoment,
  });
  const metronome = useCanvasMetronome(songId);

  // Card drag position updates flow up through the onMove prop; see CanvasStage.

  useEffect(() => {
    const layer = searchParams.get("layer");
    if (isLayerId(layer)) {
      setActiveLayer(layer);
      setShowWorkPanel(layer !== "room" && layer !== "ideas");
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem(CARDS_KEY(songId), JSON.stringify(cards));
  }, [cards, songId]);

  // Pull any voice memos for this song from the backend and merge in the ones
  // we don't already have. Reused on mount AND on every realtime event, so a
  // collaborator's new memo/layer appears in the room without a reload.
  const hydrateVoiceMemos = useCallback(async () => {
    try {
      const db = await loadVoiceMemosForCanvas(songId);
      const dbCards: CanvasCard[] = db.nodes
        .filter((node) => node.objectType === "idea_card")
        .map((node): CanvasCard | null => {
          const card = db.cards[node.objectId];
          if (!card) return null;
          return {
            id: card.id,
            tree: "ideas" as const,
            type: "voice" as const,
            title: card.title,
            body: card.body || card.preview || "",
            meta: card.preview || "Voice memo",
            section: "Raw idea",
            contributor: card.contributorName,
            status: "raw" as const,
            accent: card.contributorColor,
            x: node.x,
            y: node.y,
          };
        })
        .filter((card): card is CanvasCard => Boolean(card));

      if (dbCards.length === 0) return;
      setCards((prev) => {
        const existing = new Set(prev.map((card) => card.id));
        const fresh = dbCards.filter((card) => !existing.has(card.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    } catch {
      // The local canvas remains usable when backend hydration is unavailable.
    }
  }, [songId]);

  // Mount hydration + live room channel. Any change in the song's room nudges a
  // re-hydrate; the merge dedupes by id so nothing flickers or duplicates.
  useEffect(() => {
    void hydrateVoiceMemos();
    const unsubscribe = subscribeSongRoom(songId, {
      onActivity: () => void hydrateVoiceMemos(),
      onCardChange: () => void hydrateVoiceMemos(),
      onTakeChange: () => void hydrateVoiceMemos(),
      onCaptureChange: () => void hydrateVoiceMemos(),
    });
    return unsubscribe;
  }, [songId, hydrateVoiceMemos]);

  // ── Card manipulation ──────────────────────────────────────────────────────

  /** Called by CanvasStage's pointer-capture card drag with the new canvas-space position. */
  const handleCardMove = useCallback((id: string, x: number, y: number) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, x, y } : c));
  }, []);

  // Move-to-Final / return-to-Ideas mechanics live in useFinalArrangement (D2).

  const addCard = useCallback((type: CanvasCardType) => {
    if (isViewer) return;
    const ideaIndex = cards.filter((card) => card.tree === "ideas" && !card.parentMemoId).length;
    const titleByType: Record<CanvasCardType, string> = {
      hum: "Quick hum",
      lyric: "New lyric",
      chord: "New chord",
      note: "New idea",
      voice: "New voice memo",
      scripture: "Scripture note",
      section: "New section",
    };
    const newCard: CanvasCard = {
      id: `card-${Date.now()}`,
      tree: "ideas",
      type,
      title: titleByType[type],
      body: "",
      meta: "",
      section: "Raw idea",
      contributor: currentUserName,
      status: "raw",
      accent: getCreatorColor(currentUserName).base,
      // A single tidy column under the root, so ideas read like a scrollable
      // feed instead of a scatter dumped off-screen in 2D space.
      ...ideaColumnSlot(ideaIndex),
    };
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
    setCanvasStatus("Saved to this song.");
    // Fly to the new card (it's placed below the fold) AND open the editor so
    // the idea gets written right away — capture-then-fill, nothing lost if
    // they dismiss (the card persists).
    setFocusCardId(newCard.id);
    setEditCardId(newCard.id);
  }, [cards, isViewer, currentUserName]);

  // Add a named song PART (Verse / Chorus / …) — the songwriter's real mental
  // model. Repeatable parts auto-number (Verse 1, Verse 2). Opens the editor.
  const addPart = useCallback((choice: { section: string; type: CanvasCardType }) => {
    if (isViewer) return;
    setShowAddPart(false);
    const ideaIndex = cards.filter((c) => c.tree === "ideas" && !c.parentMemoId).length;
    let section = choice.section;
    if (section === "Verse" || section === "Chorus") {
      const n = cards.filter((c) => c.section?.startsWith(section)).length + 1;
      section = `${section} ${n}`;
    }
    const title =
      choice.section === "Raw idea"
        ? choice.type === "chord" ? "Chord idea" : choice.type === "note" ? "New idea" : "Lyric"
        : section;
    const newCard: CanvasCard = {
      id: `card-${Date.now()}`,
      tree: "ideas",
      type: choice.type,
      title,
      body: "",
      meta: "",
      section,
      contributor: currentUserName,
      status: "raw",
      accent: getCreatorColor(currentUserName).base,
      ...ideaColumnSlot(ideaIndex),
    };
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
    setCanvasStatus("Saved to this song.");
    setFocusCardId(newCard.id);
    setEditCardId(newCard.id);
  }, [cards, isViewer, currentUserName]);

  // ── Voice recording handlers ──────────────────────────────────────────────────
  const handleStartRecording = useCallback(async (parentId?: string) => {
    if (isViewer) return;
    recordingParentIdRef.current = parentId ?? null;
    setRecordingSection(parentId ? "Layer" : "Raw idea");
    setRecordingNote("");
    const started = await startRecording();
    setRecordingFlow(started ? "recording" : "idle");
  }, [isViewer, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording();
    if (result) { setPendingRecording(result); setRecordingFlow("reviewing"); }
    else setRecordingFlow("idle");
  }, [stopRecording]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
  }, [cancelRecording]);

  // Flush a queued canvas take (base OR layer) and reconcile its card. On success
  // the temp card id becomes the real memo id; on failure the card stays put with
  // its blob safe in the cache, to be retried by the recovery sweep on next load /
  // reconnect. The creed holds on the canvas exactly as it does in the song room.
  const flushCanvasUpload = useCallback(async (pendingId: string) => {
    try {
      const memoId = await flushPendingUpload(pendingId);
      setCards((prev) => prev.map((c) =>
        c.id === pendingId ? { ...c, id: memoId ?? c.id, isProcessing: false } : c,
      ));
      setCanvasStatus("Saved to this song.");
    } catch {
      setCards((prev) => prev.map((c) =>
        c.id === pendingId ? { ...c, isProcessing: false } : c,
      ));
      setCanvasStatus("You can keep adding ideas. We'll finish saving when you're back online.");
    }
  }, []);

  const handleSaveMemo = useCallback(async ({ name, section, transcribe }: { name: string; section: string; transcribe: boolean }) => {
    if (!pendingRecording) return;
    const rec = pendingRecording;
    // Capture + clear the "record over" target before any async work so the
    // next normal record can't inherit a stale parent.
    const parentMemoId = recordingParentIdRef.current ?? undefined;
    recordingParentIdRef.current = null;
    voiceMemoCountRef.current++;
    setCanvasStatus("Saving...");
    showSavedMoment(
      name || "Voice memo",
      parentMemoId ? "Layer added to stack" : (section || "Raw idea"),
      "Voice memo",
    );
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
    // Reopen the base's stack so the songwriter sees their layer land.
    if (parentMemoId) setStackBaseId(parentMemoId);

    // Local-first: the blob is cached to the device BEFORE any network call, so a
    // base take or a layered "record over this" can never be lost on a dropped
    // upload. The pending row's id keys both the card and the upload idempotency.
    const pending = await enqueuePendingUpload({
      blob: rec.blob,
      songId,
      mimeType: rec.mimeType,
      durationMs: rec.durationMs,
      title: name,
      sectionLabel: section,
      transcribe,
      parentMemoId,
    });

    setCards((prev) => {
      const ideaIndex = prev.filter((card) => card.tree === "ideas" && !card.parentMemoId).length;
      const newCard: CanvasCard = {
        id: pending.id, tree: "ideas", type: "voice",
        title: name, body: "", meta: formatDuration(rec.durationMs),
        section, contributor: currentUserName, status: "raw", accent: getCreatorColor(currentUserName).base,
        ...ideaColumnSlot(ideaIndex),
        parentMemoId, durationMs: rec.durationMs,
        isProcessing: true,
      };
      return [newCard, ...prev];
    });
    // Bring the new memo card into view — it lands below the fold like any idea.
    if (!parentMemoId) setFocusCardId(pending.id);

    await flushCanvasUpload(pending.id);
  }, [pendingRecording, showSavedMoment, songId, currentUserName, flushCanvasUpload]);

  // Recovery sweep: a canvas take whose upload was interrupted last session is
  // still safe in the cache. Replay each on load — a reconnected device heals
  // itself, the take reaches the song, and its card swaps to the real memo id.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orphans = await listPendingUploads(songId);
      for (const orphan of orphans) {
        if (cancelled) return;
        await flushCanvasUpload(orphan.id);
      }
    })();
    return () => { cancelled = true; };
  }, [songId, flushCanvasUpload]);

  const openMicSettings = useCallback(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) window.location.href = "app-settings:";
    else if (/Android/.test(ua)) alert("Settings → Apps → Colors of Glory → Permissions → Microphone");
    else alert("Click the 🔒 lock icon in your address bar → Site Settings → Microphone → Allow");
  }, []);

  const handleRecordOver = useCallback((baseId: string) => {
    setStackBaseId(null);
    void handleStartRecording(baseId);
  }, [handleStartRecording]);

  const chooseLayer = (layer: LayerId) => {
    setActiveLayer(layer);
    const show = layer !== "room" && layer !== "ideas";
    setShowWorkPanel(show);
    navigate(`/songs/${songId}/canvas?layer=${layer}`, { replace: false });
  };

  // Layers live inside their base's stack, not loose on the board.
  const ideasCards = useMemo(() => cards.filter((c) => c.tree === "ideas" && !c.parentMemoId), [cards]);
  const finalCards = useMemo(() => cards.filter((c) => c.tree === "final" && !c.parentMemoId), [cards]);

  // First-run guide is driven by an ACTUALLY empty board, not a one-time visit
  // flag — so it guides a new song, returns if the room is ever cleared (never
  // a dead-end blank), and never overlays a song that already has ideas.
  const showFirstRun = !isViewer && ideasCards.length === 0 && finalCards.length === 0;

  // Canvas tour beats — armed only once the board isn't empty, so they never
  // compete with the empty-room first-action guide. Declared in teaching order
  // (the one-tip lock presents them in this sequence): Features (the tab bar —
  // orient to every part of the song), then Ideas (the two-tree mental model),
  // then Invite. Ref + hook only; see docs/onboarding/first-run-tour-plan.md.
  const featuresTour = useCoachMark("tour_features_seen", !isViewer && !showFirstRun);
  const ideasTour = useCoachMark("tour_ideas_seen", !isViewer && !showFirstRun);
  const inviteTour = useCoachMark("tour_invite_seen", !isViewer && !showFirstRun);

  // The Final tree is the song's ARRANGEMENT: top-to-bottom is the play order.
  // Number each Final card by its vertical position so it reads like a set list.
  const finalOrder = useMemo(() => {
    const ordered = [...finalCards].sort((a, b) => a.y - b.y);
    const map: Record<string, number> = {};
    ordered.forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [finalCards]);

  // Slot-swap reordering lives in useFinalArrangement (D2): arrangement.moveBy.

  const layerCountByBase = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      if (c.parentMemoId) counts[c.parentMemoId] = (counts[c.parentMemoId] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

  // Per-card wiring for CanvasStage's render loop — the exact closures the old
  // inline loop built, handed across the D1 boundary as a selector. CanvasStage
  // renders the pixels; what each callback DOES stays here with the D2 hooks.
  // Deliberately not memoized: the stage's cards aren't memoized either, so
  // fresh closures per render match the previous behavior exactly.
  const getCardInteractions = (card: CanvasCard): CanvasCardInteractions => ({
    onSelect: () => setSelectedId((prev) => (prev === card.id ? null : card.id)),
    onMoveToFinal: () => arrangement.moveToFinal(card.id),
    onMoveToIdeas: () => arrangement.moveToIdeas(card.id),
    onMove: handleCardMove,
    layerCount: layerCountByBase[card.id] ?? 0,
    onOpenStack:
      card.type === "voice" || card.type === "hum"
        ? () => setStackBaseId(card.id)
        : undefined,
    onSuggestLine:
      card.type === "lyric" && !isViewer
        ? () => setLineSuggest({ cardId: card.id, originalLine: card.body, sectionLabel: card.section })
        : undefined,
    onAddToListenPath: () => listenPath.toggleCard(card.id),
    listenIndex: listenPath.queue.includes(card.id) ? listenPath.queue.indexOf(card.id) : undefined,
    onMergeSelect:
      !isViewer && card.tree === "ideas" && !card.isDimmedReference
        ? () => merge.toggleSelect(card.id)
        : undefined,
    mergeSelected: merge.selection.includes(card.id),
    onEdit: !isViewer && !card.isDimmedReference ? () => setEditCardId(card.id) : undefined,
    onMore: () => setMoreCardId(card.id),
    finalOrder: card.tree === "final" ? finalOrder[card.id] : undefined,
  });

  // Everyone whose hand is on this song — derived from who contributed cards.
  // Stable color/initials per person so the room reads as collaborative at a glance.
  const roomCollaborators = useMemo(() => {
    const seen = new Map<string, { userId: string; firstName: string; lastName: string; avatarColor: string; avatarInitials: string }>();
    for (const c of cards) {
      if (!c.contributor || seen.has(c.contributor)) continue;
      seen.set(c.contributor, {
        userId: c.contributor,
        firstName: c.contributor,
        lastName: "",
        avatarColor: getCreatorColor(c.contributor).base,
        avatarInitials: getCreatorInitials(c.contributor),
      });
    }
    return Array.from(seen.values());
  }, [cards]);

  // Header presence prefers the real roster; card contributors fill in until it loads.
  // Live presence — who is ACTUALLY in the room right now (realtime channel),
  // not merely who authored a card. Stable identity so we don't re-track every
  // render; null until the profile resolves so we never join as a ghost.
  const presenceSelf = useMemo(() => {
    if (!profile?.user_id) return null;
    return {
      userId: profile.user_id,
      name: currentUserName,
      color: getCreatorColor(currentUserName).base,
      initials: getCreatorInitials(currentUserName),
    };
  }, [profile?.user_id, currentUserName]);
  const livePresence = useSongPresence(songId, presenceSelf);
  const othersHereNow = useMemo(
    () => livePresence.filter((m) => !m.isSelf).length,
    [livePresence],
  );
  // Names present right now → the invite sheet's "here now" dots.
  const presentNames = useMemo(
    () => new Set(livePresence.map((m) => m.name.trim().toLowerCase())),
    [livePresence],
  );

  // The arrival moment: when you copy a link and send it, the payoff is seeing
  // them walk in. Toast only for someone NEW after the first sync (so it never
  // fires for everyone already here on load), and never for yourself.
  const knownPresenceRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const currentOthers = livePresence.filter((m) => !m.isSelf);
    const currentIds = new Set(currentOthers.map((m) => m.userId));
    if (knownPresenceRef.current === null) {
      if (livePresence.length > 0) knownPresenceRef.current = currentIds;
      return;
    }
    for (const m of currentOthers) {
      if (!knownPresenceRef.current.has(m.userId)) {
        const first = m.name.split(" ")[0] || m.name;
        toast(`${first} joined the room`, { description: "They're here with you now." });
      }
    }
    knownPresenceRef.current = currentIds;
  }, [livePresence]);

  const presenceStack = useMemo(() => {
    // Prefer the live "here now" roster; fall back to members, then to the
    // people already visible on cards, so the stack is never empty in a
    // populated room even before realtime connects.
    if (livePresence.length > 0) {
      return livePresence.map((m) => {
        const [firstName, ...rest] = m.name.split(" ");
        return {
          userId: m.userId,
          firstName: firstName ?? m.name,
          lastName: rest.join(" "),
          avatarColor: m.color,
          avatarInitials: m.initials,
        };
      });
    }
    return songMembers.length > 0
      ? songMembers.map((m) => ({
          userId: m.userId,
          firstName: m.firstName,
          lastName: m.lastName,
          avatarColor: m.avatarColor,
          avatarInitials: m.avatarInitials,
        }))
      : roomCollaborators;
  }, [livePresence, songMembers, roomCollaborators]);

  // The people layer's roster rows (name + role). Real members first; if the
  // member roster hasn't loaded, fall back to whoever is actually on the board
  // — never fabricated people. Empty for a true solo writer (honest solo state).
  const peopleLayerCollaborators = useMemo(() => {
    if (songMembers.length > 0) {
      return songMembers.map((m) => ({
        initials: m.avatarInitials,
        name: `${m.firstName} ${m.lastName}`.trim(),
        role: m.role,
        color: m.avatarColor,
      }));
    }
    return roomCollaborators.map((c) => ({
      initials: c.avatarInitials,
      name: `${c.firstName} ${c.lastName}`.trim() || c.firstName,
      role: c.firstName === currentUserName ? "You" : "Contributor",
      color: c.avatarColor,
    }));
  }, [songMembers, roomCollaborators, currentUserName]);

  // The invite sheet's roster: real members when they exist, otherwise the
  // people already visible on cards — so presence-jump works in every room.
  const sheetRoster = useMemo(
    () =>
      songMembers.length > 0
        ? songMembers
        : roomCollaborators.map((c) => ({
            userId: c.userId,
            firstName: c.firstName,
            lastName: c.lastName,
            role: "Contributor",
            isOwner: false,
            avatarColor: c.avatarColor,
            avatarInitials: c.avatarInitials,
          })),
    [songMembers, roomCollaborators],
  );

  // Fly the canvas so a card lands at the viewport center, then select it.
  const jumpToCard = useCallback((card: CanvasCard) => {
    const area = canvasAreaRef.current;
    // Land the card's center at the viewport's center (card is 200px wide).
    viewportApiRef.current?.panTo(
      card.x + 100,
      card.y + 70,
      (area?.clientWidth ?? window.innerWidth) / 2,
      (area?.clientHeight ?? window.innerHeight) / 2,
      450,
    );
    setSelectedId(card.id);
  }, []);

  // One-tap navigation to a zone's column — no more panning a 2D void to find
  // Final (it lives 1200px to the right of Ideas).
  const goToZone = useCallback((zone: "ideas" | "final") => {
    setViewZone(zone);
    const area = canvasAreaRef.current;
    const vw = area?.clientWidth ?? window.innerWidth;
    const vh = area?.clientHeight ?? window.innerHeight;
    const columnCenterX = (zone === "ideas" ? 80 : DIVIDER_X + 80) + 100;
    // Land the column's top comfortably: horizontally centred-ish, near the top.
    viewportApiRef.current?.panTo(columnCenterX, COLUMN_TOP + 40, vw * 0.42, vh * 0.3, 420);
  }, []);

  const closeWorkPanel = useCallback(() => {
    setShowWorkPanel(false);
    setActiveLayer("room");
  }, []);

  // Escape closes the work bottom sheet, like every other sheet in the room.
  useEffect(() => {
    if (!showWorkPanel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeWorkPanel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWorkPanel, closeWorkPanel]);

  // Bring a just-created card into view once it's on the board (add / record).
  useEffect(() => {
    if (!focusCardId) return;
    const card = cards.find((c) => c.id === focusCardId);
    if (card) {
      jumpToCard(card);
      setFocusCardId(null);
    }
  }, [focusCardId, cards, jumpToCard]);

  // Write the idea's words into a card (title / body / section).
  const handleSaveCardEdit = useCallback(
    (cardId: string, draft: { title: string; body: string; section: string }) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, title: draft.title, body: draft.body, section: draft.section } : c,
        ),
      );
      setCanvasStatus("Saved to this song.");
    },
    [],
  );

  const jumpToCardId = useCallback(
    (cardId: string) => {
      const target = cards.find((c) => c.id === cardId);
      if (target) jumpToCard(target);
    },
    [cards, jumpToCard],
  );

  // Presence as navigation: fly the canvas to this person's latest idea and
  // select it, so "who is in the room" becomes "where they are working".
  const jumpToCollaborator = useCallback(
    (person: { firstName: string; lastName: string }) => {
      const fullName = `${person.firstName} ${person.lastName}`.trim();
      // Cards are prepended on add, so the first match is the latest idea.
      // Layers live inside stacks — only board-positioned cards are targets.
      const target = cards.find(
        (c) =>
          !c.parentMemoId &&
          (c.contributor === fullName || c.contributor === person.firstName),
      );
      setShowShareSheet(false);
      if (!target) {
        toast(`${person.firstName} hasn't added an idea here yet`, {
          description: "Their work will appear on the canvas as they contribute.",
        });
        return;
      }
      jumpToCard(target);
    },
    [cards, jumpToCard],
  );

  // Calm remote-card arrival: a co-writer's new idea lands off-screen (ideas
  // are placed low on the board), so without this it appears silently and the
  // songwriter never notices. When a genuinely new card from someone else
  // shows up in real time, offer a gentle "see it" toast that flies there.
  // Seeded on first load + a short warmup so the initial hydration is silent.
  const seenCardIdsRef = useRef<Set<string> | null>(null);
  const arrivalWarmupRef = useRef<number>(0);
  useEffect(() => {
    if (seenCardIdsRef.current === null) {
      seenCardIdsRef.current = new Set(cards.map((c) => c.id));
      // Give hydration a beat to settle before any arrival is treated as "live".
      arrivalWarmupRef.current = Date.now() + 3000;
      return;
    }
    const seen = seenCardIdsRef.current;
    const fresh = cards.filter(
      (c) =>
        !seen.has(c.id) &&
        !c.parentMemoId &&
        c.contributor &&
        // Exclude anything I authored — including merges credited "Me & Sarah".
        !c.contributor.includes(currentUserName),
    );
    for (const c of cards) seen.add(c.id);
    if (fresh.length === 0 || Date.now() < arrivalWarmupRef.current) return;

    if (fresh.length === 1) {
      const c = fresh[0];
      const first = c.contributor.split(" ")[0] || c.contributor;
      toast(`${first} added an idea`, {
        description: c.title,
        action: { label: "See it", onClick: () => jumpToCard(c) },
      });
    } else {
      const first = fresh[0];
      toast(`${fresh.length} new ideas from your co-writers`, {
        description: "Tap review to step through them.",
        action: { label: "See", onClick: () => jumpToCard(first) },
      });
    }
  }, [cards, currentUserName, jumpToCard]);

  // The recap digest, from the room's real cards: what other hands added,
  // latest first, each row a deep link to its card (COG Product 12).
  const recapItems = useMemo(
    () =>
      cards
        .filter((c) => !c.parentMemoId && c.contributor && c.contributor !== currentUserName)
        .slice(0, 5)
        .map((c) => ({
          id: `recap-${c.id}`,
          text: `${c.contributor} added "${c.title}" · ${c.section}`,
          dotColor: c.accent,
          targetCardId: c.id,
        })),
    [cards, currentUserName],
  );

  // Real activity for the People-layer "What changed" card — co-writers' cards,
  // latest first. Empty for a solo writer, so the layer shows an honest state
  // instead of fabricated bandmates.
  const layerActivity = useMemo(
    () =>
      cards
        .filter((c) => !c.parentMemoId && c.contributor && c.contributor !== currentUserName)
        .slice(0, 4)
        .map((c) => ({
          id: `act-${c.id}`,
          actor: c.contributor.split(" ")[0] || c.contributor,
          summary: `added "${c.title}"`,
          context: c.section,
          color: c.accent,
        })),
    [cards, currentUserName],
  );

  // Ideas a co-writer added that the owner hasn't acted on yet: still in Ideas,
  // not a stack layer, not already approved/kept/dimmed. This is the pending
  // queue (COG Product 11) — the owner keeps control, contributors suggest.
  const KIND_BY_TYPE: Record<CanvasCardType, string> = useMemo(
    () => ({
      voice: "Voice memo", hum: "Voice memo", lyric: "Lyric", chord: "Chord",
      note: "Idea", scripture: "Theology note", section: "Section",
    }),
    [],
  );
  const pendingReview = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            c.tree === "ideas" &&
            !c.parentMemoId &&
            !c.isDimmedReference &&
            !c.reviewed &&
            c.status !== "approved" &&
            c.contributor &&
            c.contributor !== currentUserName,
        )
        .map((c) => ({
          id: c.id,
          title: c.title,
          body: c.body,
          section: c.section,
          contributor: c.contributor,
          accent: c.accent,
          kind: KIND_BY_TYPE[c.type] ?? "Idea",
        })),
    [cards, currentUserName, KIND_BY_TYPE],
  );

  // Keep-in-Ideas: mark reviewed so it leaves the queue but stays on the board.
  const handleKeepInIdeas = useCallback((cardId: string) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, reviewed: true } : c)));
  }, []);

  // Not-this-one: archive from the board, with a calm Undo (never a hard delete).
  const handleDismissReview = useCallback((cardId: string) => {
    let removed: CanvasCard | undefined;
    setCards((prev) => {
      removed = prev.find((c) => c.id === cardId);
      return prev.filter((c) => c.id !== cardId);
    });
    toast("Idea set aside", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => { if (removed) setCards((prev) => [removed as CanvasCard, ...prev]); },
      },
    });
  }, []);

  // Line suggestions (Feature 19) become their own review items, so a
  // "replace just this line" flows through the SAME owner accept/keep motion.
  const suggestionReviewItems = useMemo(
    () =>
      lineSuggestions.map((s) => ({
        id: s.id,
        title: "Line change",
        body: "",
        section: s.section,
        contributor: s.contributor,
        accent: getCreatorColor(s.contributor).base,
        kind: "Line suggestion",
        suggestion: { originalLine: s.originalLine, proposedLine: s.proposedLine },
      })),
    [lineSuggestions],
  );

  // One unified queue: pending ideas + pending line suggestions.
  const reviewQueueItems = useMemo(
    () => [...suggestionReviewItems, ...pendingReview],
    [suggestionReviewItems, pendingReview],
  );

  // Accept a line suggestion → replace the target card's body, drop the suggestion.
  const handleAcceptLine = useCallback((suggestionId: string) => {
    const s = lineSuggestions.find((x) => x.id === suggestionId);
    if (!s) return;
    setCards((prev) => prev.map((c) => (c.id === s.cardId ? { ...c, body: s.proposedLine } : c)));
    setLineSuggestions(removeLineSuggestion(songId, suggestionId));
    showSavedMoment("Line updated", "Lyrics", s.section);
  }, [lineSuggestions, songId, showSavedMoment]);

  // Keep original → drop the suggestion without touching the line.
  const handleKeepLine = useCallback((suggestionId: string) => {
    setLineSuggestions(removeLineSuggestion(songId, suggestionId));
  }, [songId]);

  const dockActions = useMemo(
    () => [
      {
        id: "practice",
        label: isPracticeLaunching ? "Loading" : "Practice",
        icon: BookOpen,
        onClick: () => { void handleLaunchPractice(); },
        loading: isPracticeLaunching,
        haptic: [4],
      },
      {
        id: "record",
        label: recordingFlow === "recording" ? "Recording" : "Record memo",
        icon: Mic,
        onClick: () => { void handleStartRecording(); },
        primary: true,
        disabled: isViewer || recordingFlow !== "idle",
        haptic: [10],
        ariaLabel: recordingFlow === "recording" ? "Recording voice memo" : "Record memo",
      },
      {
        id: "idea",
        label: "Add part",
        icon: Plus,
        onClick: () => setShowAddPart(true),
        disabled: isViewer,
        haptic: [5],
      },
    ],
    [handleLaunchPractice, handleStartRecording, isPracticeLaunching, isViewer, recordingFlow],
  );

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", backgroundColor: "var(--cog-cream)", overflow: "hidden" }}
    >
      <SongCanvasSemanticSummary />
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-30 flex items-center justify-between gap-3 px-5 pb-3 flex-shrink-0"
        style={{ maxWidth: 1180, margin: "0 auto", width: "100%", paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/songs")}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "var(--cog-warm-gray)", flexShrink: 0 }}
          aria-label="Back to songs"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Songs
        </button>

        {/* Song title centered */}
        <div className="flex flex-col items-center min-w-0 flex-1">
          <CogBrand variant="stacked" size="sm" />
          <h1
            className="text-center font-bold leading-tight truncate"
            style={{ fontSize: 15, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", marginTop: 4, maxWidth: 180 }}
          >
            {songTitle}
          </h1>
        </div>

        {/* Layer chips */}
        <div
          className="flex gap-1 overflow-x-auto flex-shrink-0"
          style={{ maxWidth: 220 }}
        >
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const active = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => chooseLayer(layer.id)}
                aria-pressed={active}
                className="flex min-h-8 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition-all duration-150 active:scale-[0.97]"
                style={{
                  backgroundColor: active ? "#FFFFFF" : "transparent",
                  border: active ? "1px solid rgba(181,147,90,0.30)" : "1px solid transparent",
                  color: active ? "var(--cog-gold)" : "var(--cog-muted)",
                  boxShadow: active ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Icon size={12} strokeWidth={1.8} />
                {layer.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="relative z-30 mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-5 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            aria-live="polite"
            className="truncate rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold)" }}
          >
            {canvasStatus}
          </p>
          {/* F14 one-tap metronome — consumes C4's engine via useCanvasMetronome */}
          <CanvasMetronomeToggle metronome={metronome} />
          <button
            type="button"
            onClick={() => setShowRecap(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70 active:scale-[0.94]"
            style={{ color: "var(--cog-warm-gray)" }}
            aria-label="What changed since you left"
          >
            <History size={16} strokeWidth={1.9} />
          </button>
          {!isViewer && reviewQueueItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReviewQueue(true)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
              style={{
                backgroundColor: "var(--cog-gold)",
                color: "#FFFFFF",
                boxShadow: "0 1px 6px rgba(184,149,58,0.30)",
                fontFamily: "var(--font-body)",
              }}
              aria-label={`Needs your review: ${reviewQueueItems.length} item${reviewQueueItems.length === 1 ? "" : "s"} from your co-writers`}
            >
              <Inbox size={13} strokeWidth={2.2} />
              Review {reviewQueueItems.length}
            </button>
          )}
        </div>
        {isViewer ? (
          <p className="text-right text-xs font-medium" style={{ color: "#6B6459" }}>
            You can view this canvas. Ask the owner if you need to contribute.
          </p>
        ) : (
          <button
            ref={inviteTourRef}
            type="button"
            onClick={() => setShowShareSheet(true)}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1 pl-2 pr-1.5 transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            style={{
              backgroundColor: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(184,149,58,0.25)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}
            aria-label={
              othersHereNow > 0
                ? `${othersHereNow} ${othersHereNow === 1 ? "person is" : "people are"} here now — invite someone`
                : presenceStack.length > 0
                ? `In this room: ${presenceStack.length} ${presenceStack.length === 1 ? "person" : "people"} — invite someone`
                : "Invite someone into this song"
            }
          >
            {presenceStack.length > 0 && (
              <span className="relative flex items-center">
                <CollaboratorAvatarStack collaborators={presenceStack} size={26} maxVisible={3} />
                {othersHereNow > 0 && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5"
                    aria-hidden="true"
                    title="Here now"
                  >
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-60"
                      style={{ backgroundColor: "#53AB8B", animation: "cog-live-ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }}
                    />
                    <span
                      className="relative inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: "#53AB8B", border: "1.5px solid #FAFAF6" }}
                    />
                  </span>
                )}
              </span>
            )}
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
              style={{ backgroundColor: "var(--cog-gold)", color: "#FFFFFF", fontFamily: "var(--font-body)" }}
            >
              <UserPlus size={12} strokeWidth={2.2} />
              Invite
            </span>
          </button>
        )}
      </div>

      {/* ── Canvas stage — D1's render surface (viewport, trees, cards) ──── */}
      <div ref={canvasAreaRef} className="relative flex-1 min-h-0">
        <CanvasStage
          className="w-full h-full"
          initialZoom={0.8}
          songTitle={songTitle}
          ideasCards={ideasCards}
          finalCards={finalCards}
          selectedId={selectedId}
          isDropActive={isDragOver}
          getCardInteractions={getCardInteractions}
          viewportApiRef={viewportApiRef}
          overlay={
            <>
              {/* Ideas ⇄ Final quick-nav — the phone can't show both zones at
                  once, so one tap flies to each. Floating, thumb-reachable. */}
              <div
                className="pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2"
                style={{ top: 12 }}
                role="tablist"
                aria-label="Jump between Ideas and Final"
              >
                <div
                  ref={ideasTourRef}
                  className="pointer-events-auto flex items-center gap-1 rounded-full p-1"
                  style={{ backgroundColor: "rgba(255,255,255,0.92)", border: "1px solid rgba(28,26,23,0.10)", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", backdropFilter: "blur(8px)" }}
                >
                  {(["ideas", "final"] as const).map((zone) => {
                    const active = viewZone === zone;
                    return (
                      <button
                        key={zone}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => goToZone(zone)}
                        className="flex min-h-9 items-center rounded-full px-4 text-[13px] font-bold transition-all duration-150 active:scale-[0.97]"
                        style={{
                          backgroundColor: active ? (zone === "ideas" ? "var(--cog-gold)" : "#53AB8B") : "transparent",
                          color: active ? "#FFFFFF" : "var(--cog-warm-gray)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {zone === "ideas" ? "Ideas" : "Final"}
                      </button>
                    );
                  })}
                </div>
              </div>
              {showFirstRun && (
                <FirstActionPrompt
                  onHum={() => addCard("hum")}
                  onLyric={() => addCard("lyric")}
                  onChords={() => addCard("chord")}
                />
              )}
              <CreativeActionDock actions={dockActions} />
              {SHOW_LEGACY_CANVAS_FABS && (
                <>
              {/* Practice FAB */}
              <button
                type="button"
                onClick={() => { void handleLaunchPractice(); }}
                disabled={isPracticeLaunching}
                className="absolute flex items-center justify-center gap-2 rounded-2xl transition-all duration-150 active:scale-95"
                style={{
                  left: 20, bottom: 80, width: 140, height: 52, zIndex: 40,
                  backgroundColor: isPracticeLaunching ? "rgba(181,147,90,0.55)" : "rgba(181,147,90,0.14)",
                  border: "1px solid rgba(181,147,90,0.40)",
                  color: "#B5935A",
                  boxShadow: "none",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
                aria-label="Practice this song"
              >
                <BookOpen size={18} strokeWidth={2} />
                <span>{isPracticeLaunching ? "Loading…" : "Practice"}</span>
              </button>

              {/* Mic FAB — record voice memo */}
              <button
                type="button"
                onClick={() => { void handleStartRecording(); }}
                disabled={isViewer || recordingFlow !== "idle"}
                className="absolute flex items-center justify-center gap-2 rounded-2xl transition-all duration-150 active:scale-95"
                style={{
                  right: 168, bottom: 80, width: 140, height: 52, zIndex: 40,
                  backgroundColor: recordingFlow === "recording" ? "var(--cog-charcoal)" : "#FFFFFF",
                  border: recordingFlow === "recording" ? "none" : "1px solid rgba(181,147,90,0.28)",
                  color: recordingFlow === "recording" ? "#FFFFFF" : "var(--cog-charcoal)",
                  boxShadow: recordingFlow === "recording"
                    ? "0 0 0 6px var(--cog-gold-glow), 0 4px 16px rgba(28,26,23,0.30)"
                    : "0 8px 24px rgba(28,26,23,0.12)",
                  animation: recordingFlow === "recording" ? "mic-pulse 1.4s ease-in-out infinite" : "none",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
                aria-label={recordingFlow === "recording" ? "Recording..." : "Record idea / Record memo"}
                aria-pressed={recordingFlow === "recording"}
              >
                <Mic size={20} strokeWidth={2} />
                <span>{recordingFlow === "recording" ? "Recording..." : "Record memo"}</span>
              </button>

              {/* Quick-add FAB */}
              <button
                type="button"
                onClick={() => addCard("note")}
                disabled={isViewer}
                className="absolute flex items-center justify-center gap-2 rounded-2xl text-white transition-all duration-150 active:scale-95"
                style={{
                  right: 20, bottom: 80, width: 140, height: 52, zIndex: 40,
                  backgroundColor: "#B5935A",
                  boxShadow: "0 4px 16px rgba(181,147,90,0.45)",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 800,
                }}
                aria-label="Add idea"
              >
                <Plus size={22} strokeWidth={2.5} />
                <span>Add idea</span>
              </button>
                </>
              )}
            </>
          }
        />

        {/* Work layer — a mobile bottom sheet (was a desktop right drawer) */}
        {showWorkPanel && (
          <>
            <div
              onClick={closeWorkPanel}
              aria-hidden="true"
              style={{
                position: "fixed", inset: 0, zIndex: 70,
                backgroundColor: "rgba(26,26,26,0.5)",
                animation: "cog-fade-in 220ms ease",
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${LAYERS.find((l) => l.id === activeLayer)?.label ?? "Song"} panel`}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 71,
                backgroundColor: "#FAFAF6",
                borderRadius: "24px 24px 0 0",
                borderTop: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
                maxWidth: 480, margin: "0 auto",
                maxHeight: "85dvh", overflowY: "auto",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
                animation: "cog-sheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 8px" }} aria-hidden="true" />
              <button
                type="button"
                onClick={closeWorkPanel}
                className="flex items-center justify-center rounded-full"
                style={{ position: "absolute", top: 10, right: 14, width: 44, height: 44, backgroundColor: "rgba(0,0,0,0.06)", color: "#666", border: "none", cursor: "pointer" }}
                aria-label="Close panel"
              >
                ×
              </button>
              <div style={{ padding: "4px 16px 8px" }}>
                {activeLayer === "voice" ? (
                  <VoiceLayerPanel
                    songId={songId}
                    currentUserName={currentUserName}
                    onRecord={() => { closeWorkPanel(); void handleStartRecording(); }}
                  />
                ) : (
                  <>
                    <Suspense fallback={<div style={{ height: 200, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 16 }} />}>
                      <SongCanvasWorkLayers activeLayer={activeLayer} />
                    </Suspense>
                    <Suspense fallback={null}>
                      <SongCanvasCollabLayers
                        activeLayer={activeLayer}
                        collaborators={peopleLayerCollaborators}
                        activity={layerActivity}
                        onInvite={isViewer ? undefined : () => setShowShareSheet(true)}
                        onOpenRecap={() => setShowRecap(true)}
                        onOpenCredits={() => navigate(`/songs/${songId}/credits`)}
                      />
                    </Suspense>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <MergeActionBar
        selection={merge.selection}
        cards={[...ideasCards, ...finalCards]}
        onRemove={merge.removeFromSelection}
        onMerge={merge.executeMerge}
        onClear={merge.clearSelection}
      />
      <ListenPathBar
        queue={listenPath.queue}
        cards={[...ideasCards, ...finalCards]}
        step={listenPath.step}
        playing={listenPath.playing}
        onPlayPause={listenPath.playPause}
        onPrev={listenPath.prev}
        onNext={listenPath.next}
        onStepTo={listenPath.goTo}
        onRemove={listenPath.removeCard}
        onClear={listenPath.clear}
        onSave={listenPath.save}
      />
      <FinalArrangementBar
        arranging={arrangement.arranging}
        canArrange={arrangement.canArrange}
        orderedCards={arrangement.orderedFinalCards}
        onBegin={arrangement.begin}
        onMove={arrangement.moveBy}
        onSave={arrangement.save}
        onCancel={arrangement.cancel}
      />
      {compare.pair && (
        <CompareModeSheet
          cards={compare.pair}
          playingId={compare.playingId}
          onTogglePlay={compare.togglePlay}
          onChoose={compare.choose}
          onKeepBoth={compare.keepBoth}
          onClose={compare.close}
        />
      )}
      <SongTabBar activeTab="canvas" ref={featuresTourRef} />
      <SongRoomSaveToast
        moment={saveMoment}
        onDone={() => setSaveMoment(null)}
      />

      {/* Recording sheet */}
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

      {/* Review sheet */}
      {recordingFlow === "reviewing" && pendingRecording && (
        <VoiceReviewSheet
          recording={pendingRecording}
          defaultName={recordingNote.trim() || `Voice Memo ${voiceMemoCountRef.current + 1}`}
          section={recordingSection}
          onSave={handleSaveMemo}
          onDiscard={handleCancelRecording}
        />
      )}

      {/* Voice memo stack — base + the layers recorded over it */}
      {stackBaseId && (() => {
        const base = cards.find((c) => c.id === stackBaseId);
        if (!base) return null;
        const stackLayers = cards.filter((c) => c.parentMemoId === stackBaseId);
        return (
          <StackSheet
            base={toStackView(base)}
            layers={stackLayers.map(toStackView)}
            canRecordOver={!isViewer}
            onRecordOver={handleRecordOver}
            onClose={() => setStackBaseId(null)}
          />
        );
      })()}

      {/* What Changed recap sheet */}
      {showRecap && (
        <WhatChangedRecapSheet
          songId={songId}
          items={recapItems}
          onJumpToCard={jumpToCardId}
          onDismiss={() => setShowRecap(false)}
        />
      )}

      {/* Return-visit recap — auto-shows once for a returning collaborator
          with real activity-feed changes since their last visit (Product 12) */}
      {!showRecap && <CanvasRecapGate songId={songId} />}

      {/* Copy-link invite sheet — one tap from the room's presence stack */}
      {showShareSheet && (
        <Suspense fallback={null}>
          <ShareSongSheet
            songId={songId}
            songTitle={songTitle}
            collaborators={sheetRoster}
            onJumpTo={jumpToCollaborator}
            presentNames={presentNames}
            onClose={() => setShowShareSheet(false)}
          />
        </Suspense>
      )}

      {/* Owner review queue — pending ideas from co-writers, one at a time */}
      {showReviewQueue && (
        <Suspense fallback={null}>
          <OwnerReviewQueueSheet
            items={reviewQueueItems}
            onApprove={arrangement.moveToFinal}
            onKeep={handleKeepInIdeas}
            onDismiss={handleDismissReview}
            onAcceptLine={handleAcceptLine}
            onKeepLine={handleKeepLine}
            onSee={(cardId) => { setShowReviewQueue(false); jumpToCardId(cardId); }}
            onClose={() => setShowReviewQueue(false)}
          />
        </Suspense>
      )}

      {/* Card editor — write the idea's words (opens on create + on Edit) */}
      {editCardId && (() => {
        const c = cards.find((card) => card.id === editCardId);
        if (!c) return null;
        const kindByType: Record<CanvasCardType, string> = {
          lyric: "Lyric", voice: "Voice memo", hum: "Voice memo", chord: "Chord",
          note: "Idea", scripture: "Scripture", section: "Section",
        };
        return (
          <Suspense fallback={null}>
            <CardEditSheet
              initial={{ title: c.title, body: c.body, section: c.section }}
              kind={kindByType[c.type] ?? "Idea"}
              accent={c.accent}
              onSave={(draft) => handleSaveCardEdit(c.id, draft)}
              onClose={() => setEditCardId(null)}
            />
          </Suspense>
        );
      })()}

      {/* Card overflow actions (Compare / Suggest / Listen Path / Merge) */}
      {moreCardId && (() => {
        const c = cards.find((card) => card.id === moreCardId);
        if (!c) return null;
        const actions = [] as import("@/components/canvas/CardActionsSheet").CardAction[];
        // Final arrangement reorder — move this card up/down the set list.
        if (c.tree === "final" && !isViewer) {
          const pos = finalOrder[c.id];
          if (pos && pos > 1) {
            actions.push({ id: "up", label: "Move up in the arrangement", tone: "muted", onClick: () => arrangement.moveBy(c.id, -1) });
          }
          if (pos && pos < finalCards.length) {
            actions.push({ id: "down", label: "Move down in the arrangement", tone: "muted", onClick: () => arrangement.moveBy(c.id, 1) });
          }
        }
        if (c.type === "lyric" && !isViewer) {
          actions.push({
            id: "suggest",
            label: "Suggest a line",
            onClick: () => setLineSuggest({ cardId: c.id, originalLine: c.body, sectionLabel: c.section }),
          });
        }
        // F21 — audition this idea against its same-section variant.
        if (!isViewer && compare.canCompare(c)) {
          actions.push({
            id: "compare",
            label: "Compare A vs B",
            onClick: () => compare.open(c.id),
          });
        }
        const inPath = listenPath.queue.includes(c.id);
        actions.push({
          id: "path",
          label: inPath ? `Remove from Listen Path (#${listenPath.queue.indexOf(c.id) + 1})` : "Add to Listen Path",
          onClick: () => listenPath.toggleCard(c.id),
          active: inPath,
        });
        if (c.tree === "ideas" && !c.isDimmedReference && !isViewer) {
          const inMerge = merge.selection.includes(c.id);
          actions.push({
            id: "merge",
            label: inMerge ? "Cancel merge selection" : "Select to merge",
            onClick: () => merge.toggleSelect(c.id),
            active: inMerge,
          });
        }
        return (
          <Suspense fallback={null}>
            <CardActionsSheet
              title={c.title}
              subtitle={c.section}
              actions={actions}
              onClose={() => setMoreCardId(null)}
            />
          </Suspense>
        );
      })()}

      {/* Add a part — Verse / Chorus / Bridge section picker */}
      {showAddPart && (
        <Suspense fallback={null}>
          <AddPartSheet onPick={addPart} onClose={() => setShowAddPart(false)} />
        </Suspense>
      )}

      {/* Line-level suggestion sheet (F19) */}
      {lineSuggest && (
        <LineSuggestionSheet
          mode={isViewer ? "review" : "create"}
          originalLine={lineSuggest.originalLine}
          sectionLabel={lineSuggest.sectionLabel}
          onSend={(text) => {
            if (!lineSuggest) return;
            // Persist into the owner's review queue instead of vanishing on a
            // toast. The sheet plays its own "Suggestion sent" confirmation
            // and then calls onDismiss to unmount — don't unmount here.
            setLineSuggestions(
              addLineSuggestion({
                id: `ls-${Date.now()}`,
                songId,
                cardId: lineSuggest.cardId,
                originalLine: lineSuggest.originalLine,
                proposedLine: text,
                contributor: currentUserName,
                section: lineSuggest.sectionLabel,
                createdAt: Date.now(),
              }),
            );
          }}
          onKeep={() => setLineSuggest(null)}
          onDismiss={() => setLineSuggest(null)}
        />
      )}

      {featuresTour.visible && (
        <CoachMark
          targetRef={featuresTourRef}
          lead="Every part of your song."
          body="Lyrics, voice, chords, notes, and your people — each has its own space down here. Tap any to open it."
          onGotIt={featuresTour.gotIt}
          onSkip={featuresTour.skip}
          isFinal={featuresTour.isFinal}
        />
      )}

      {ideasTour.visible && (
        <CoachMark
          targetRef={ideasTourRef}
          lead="Two spaces, one song."
          body="Explore ideas on the left. Drag the keepers to Final on the right."
          onGotIt={ideasTour.gotIt}
          onSkip={ideasTour.skip}
          isFinal={ideasTour.isFinal}
        />
      )}

      {inviteTour.visible && (
        <CoachMark
          targetRef={inviteTourRef}
          lead="Songs are better together."
          body="Invite a co-writer — they join with just their phone number."
          onGotIt={inviteTour.gotIt}
          onSkip={inviteTour.skip}
          isFinal={inviteTour.isFinal}
        />
      )}

      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(184,149,58,0.20), 0 4px 16px rgba(28,26,23,0.35); }
          50%       { box-shadow: 0 0 0 14px rgba(184,149,58,0.08), 0 4px 16px rgba(28,26,23,0.35); }
        }
        @keyframes cog-live-ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes cog-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cog-sheet-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="cog-live-ping"] { animation: none !important; }
          [style*="cog-sheet-rise"], [style*="cog-fade-in"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default SongCanvasExperience;
