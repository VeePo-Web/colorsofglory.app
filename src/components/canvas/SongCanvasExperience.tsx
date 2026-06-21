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
  Sparkles,
  StickyNote,
  Users,
  GitBranch,
  BookOpen,
} from "lucide-react";
import { loadPracticeSections } from "@/lib/practice/practiceApi";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import CreativeActionDock from "@/components/cog/CreativeActionDock";
import SongRoomSaveToast, { type SongRoomSaveMoment } from "@/components/cog/SongRoomSaveToast";
import { useSongTitle } from "@/lib/songContext";
import CanvasViewport from "@/components/canvas/CanvasViewport";
import CanvasDivider from "@/components/canvas/CanvasDivider";
import ZoneLabels from "@/components/canvas/ZoneLabel";
import FirstActionPrompt from "@/components/canvas/FirstActionPrompt";
import SongRootCard from "@/components/canvas/SongRootCard";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";
import RecordingSheet from "@/components/voice/RecordingSheet";
import VoiceReviewSheet from "@/components/voice/VoiceReviewSheet";
import VoiceLayerPanel from "@/components/voice/VoiceLayerPanel";
import { uploadVoiceMemo } from "@/lib/voice/voiceApi";
import { formatDuration } from "@/lib/voice/audioFormat";
import { loadVoiceMemosForCanvas } from "@/lib/canvas/canvasLoader";
import StackSheet from "@/components/voice/StackSheet";
import type { StackMemoView } from "@/components/voice/MemoStack";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { subscribeSongRoom } from "@/integrations/cog/realtime";

const SongCanvasWorkLayers = lazy(() => import("@/components/cog/SongCanvasWorkLayers"));
const SongCanvasCollabLayers = lazy(() => import("@/components/cog/SongCanvasCollabLayers"));

// ─── Types ───────────────────────────────────────────────────────────────────

type CanvasTree = "ideas" | "final";
type CanvasCardType = "lyric" | "voice" | "hum" | "chord" | "note" | "scripture" | "section";
type LayerId = "room" | "lyrics" | "voice" | "chords" | "notes" | "ideas" | "people";

export interface CanvasCard {
  id: string;
  tree: CanvasTree;
  type: CanvasCardType;
  title: string;
  body: string;
  meta: string;
  section: string;
  contributor: string;
  status: "raw" | "shortlisted" | "approved" | "meaning" | "review";
  accent: string;
  x: number;
  y: number;
  /** Set when this voice memo is a layer recorded over a base ("Record over this"). */
  parentMemoId?: string;
  /** Recording length for stack playback/labels; voice cards only. */
  durationMs?: number;
  isDimmedReference?: boolean;
  isProcessing?: boolean;
}

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

const CARD_ICONS: Record<CanvasCardType, ElementType> = {
  lyric: FileText,
  voice: Mic,
  hum: Mic,
  chord: Music,
  note: StickyNote,
  scripture: StickyNote,
  section: GitBranch,
};

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
    accent: "#D4AE5C",
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
    accent: "#53AB8B",
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
    accent: "#8070C4",
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
    accent: "#D4AE5C",
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
    accent: "#8070C4",
    x: DIVIDER_X + 80,
    y: 420,
  },
];

const FIRST_VISIT_KEY = (songId: string) => `cog:canvas-first-visit-${songId}`;
const CARDS_KEY = (songId: string) => `cog:canvas-cards-${songId}`;
const SHOW_LEGACY_CANVAS_FABS = false;

const getStoredCards = (songId: string): CanvasCard[] => {
  try {
    const stored = localStorage.getItem(CARDS_KEY(songId));
    if (!stored) return INITIAL_CARDS;
    const parsed = JSON.parse(stored) as CanvasCard[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CARDS;
  } catch {
    return INITIAL_CARDS;
  }
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

// ─── Canvas card component ─────────────────────────────────────────────────────

interface CanvasCardProps {
  card: CanvasCard;
  selected: boolean;
  onSelect: () => void;
  onMoveToFinal: () => void;
  onMoveToIdeas: () => void;
  onDragStart: (e: React.PointerEvent, cardId: string) => void;
  layerCount?: number;
  onOpenStack?: () => void;
}

const CanvasCardEl = ({
  card,
  selected,
  onSelect,
  onMoveToFinal,
  onMoveToIdeas,
  onDragStart,
  layerCount = 0,
  onOpenStack,
}: CanvasCardProps) => {
  const Icon = CARD_ICONS[card.type];
  const isVoice = card.type === "voice" || card.type === "hum";

  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: 200,
        minHeight: 130,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        border: selected
          ? `2px solid ${card.accent}`
          : card.isDimmedReference
          ? `1.5px dashed ${card.accent}60`
          : `2px solid ${card.accent}40`,
        boxShadow: selected
          ? `0 8px 28px ${card.accent}30`
          : "0 4px 14px rgba(0,0,0,0.09)",
        opacity: card.isDimmedReference ? 0.42 : 1,
        cursor: "pointer",
        userSelect: "none",
        zIndex: selected ? 20 : 10,
        transform: selected ? "scale(1.03)" : "scale(1)",
        transition: "transform 150ms ease, box-shadow 150ms ease, opacity 200ms ease",
        padding: 14,
        boxSizing: "border-box",
      }}
      onClick={onSelect}
      onPointerDown={(e) => {
        e.stopPropagation(); // prevent canvas pan when interacting with a card
        onDragStart(e, card.id);
      }}
      role="button"
      aria-pressed={selected}
      aria-label={`${card.type} card: ${card.title}`}
    >
      {/* Creator dot — top right */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: card.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 700,
          color: "#FFFFFF",
          letterSpacing: 0,
        }}
        title={card.contributor}
      >
        {card.contributor.slice(0, 2).toUpperCase()}
      </div>

      {/* Icon + section */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: `${card.accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={14} strokeWidth={1.8} style={{ color: card.accent }} />
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#999",
            fontFamily: "var(--font-body)",
          }}
        >
          {card.section}
        </span>
        {isVoice && layerCount > 0 && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 9,
              fontWeight: 700,
              color: card.accent,
              backgroundColor: `${card.accent}1A`,
              borderRadius: 9999,
              padding: "2px 7px",
              fontFamily: "var(--font-body)",
            }}
          >
            {layerCount} layer{layerCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1A1A1A",
          fontFamily: "var(--font-display)",
          marginBottom: 6,
          lineHeight: 1.3,
        }}
      >
        {card.title}
      </p>

      {/* Body */}
      <p
        style={{
          fontSize: 12,
          color: "#666",
          lineHeight: 1.5,
          fontFamily: "var(--font-body)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {card.body}
      </p>

      {/* "Used in Final" label for dimmed references */}
      {card.isDimmedReference && (
        <p style={{ fontSize: 10, color: card.accent, marginTop: 8, fontWeight: 600 }}>
          ↳ Used in Final
        </p>
      )}

      {/* In-place action buttons when selected */}
      {selected && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 10,
            borderTop: "1px solid rgba(0,0,0,0.07)",
            paddingTop: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isVoice && onOpenStack && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenStack(); }}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: `${card.accent}16`,
                color: card.accent,
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
              aria-label={layerCount > 0 ? `Open stack — ${layerCount} layers` : "Open stack — record over this"}
            >
              {layerCount > 0 ? `Layers ${layerCount} ▸` : "Layers ▸"}
            </button>
          )}
          {card.tree === "ideas" && !card.isDimmedReference && (
            <button
              onClick={onMoveToFinal}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "#B5935A",
                color: "#FFF",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              → Final
            </button>
          )}
          {card.tree === "final" && (
            <button
              onClick={onMoveToIdeas}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "rgba(0,0,0,0.06)",
                color: "#666",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              ← Ideas
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [showFirstAction, setShowFirstAction] = useState(() => {
    return !localStorage.getItem(FIRST_VISIT_KEY(songId));
  });
  const [activeLayer, setActiveLayer] = useState<LayerId>(() => {
    const layer = searchParams.get("layer");
    return isLayerId(layer) ? layer : "room";
  });
  const [showWorkPanel, setShowWorkPanel] = useState(activeLayer !== "room" && activeLayer !== "ideas");
  const [saveMoment, setSaveMoment] = useState<SongRoomSaveMoment | null>(null);

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

  // Drag tracking for card repositioning
  const draggingCardId = useRef<string | null>(null);
  const dragStartCanvas = useRef({ x: 0, y: 0 });
  const dragStartCard = useRef({ x: 0, y: 0 });

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

  const dismissFirstAction = useCallback(() => {
    localStorage.setItem(FIRST_VISIT_KEY(songId), "1");
    setShowFirstAction(false);
  }, [songId]);

  // ── Card manipulation ──────────────────────────────────────────────────────

  const handleCardDragStart = useCallback((e: React.PointerEvent, cardId: string) => {
    draggingCardId.current = cardId;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    dragStartCanvas.current = { x: e.clientX, y: e.clientY };
    dragStartCard.current = { x: card.x, y: card.y };
    setIsDragOver(true);
    setSelectedId(cardId);
  }, [cards]);

  const handleMoveToFinal = useCallback((cardId: string) => {
    if (isViewer) return;
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        // Original stays as dimmed reference
        return { ...c, isDimmedReference: true };
      }).concat((() => {
        const finalIndex = prev.filter((c) => c.tree === "final").length;
        return {
          ...prev.find((c) => c.id === cardId)!,
          id: `${cardId}-final`,
          tree: "final" as const,
          isDimmedReference: false,
          x: DIVIDER_X + 80 + (finalIndex % 2) * 240,
          y: 200 + Math.floor(finalIndex / 2) * 190,
          status: "approved" as const,
        };
      })())
    );
    setSelectedId(null);
    setIsDragOver(false);
    setCanvasStatus("Moved. Undo?");
    showSavedMoment("Approved idea", "Final tree", "Arrangement");
  }, [isViewer, showSavedMoment]);

  const handleMoveToIdeas = useCallback((cardId: string) => {
    if (isViewer) return;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    // Restore the original dimmed reference
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId.replace("-final", "")
          ? { ...c, isDimmedReference: false }
          : c
      )
    );
    setSelectedId(null);
    setCanvasStatus("Moved. Undo?");
    showSavedMoment("Returned idea", "Ideas tree", "Arrangement");
  }, [isViewer, showSavedMoment]);

  const addCard = useCallback((type: CanvasCardType) => {
    if (isViewer) return;
    dismissFirstAction();
    const ideaIndex = cards.filter((card) => card.tree === "ideas").length;
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
      accent: "#D4AE5C",
      x: 80 + (ideaIndex % 3) * 240,
      y: 700 + Math.floor(ideaIndex / 3) * 180,
    };
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
    setCanvasStatus("Saved to this song.");
    showSavedMoment(newCard.title, "Ideas tree", "Note");
  }, [cards, dismissFirstAction, isViewer, showSavedMoment, currentUserName]);

  // ── Voice recording handlers ──────────────────────────────────────────────────
  const handleStartRecording = useCallback(async (parentId?: string) => {
    if (isViewer) return;
    recordingParentIdRef.current = parentId ?? null;
    setRecordingSection(parentId ? "Layer" : "Raw idea");
    setRecordingNote("");
    setRecordingFlow("recording");
    await startRecording();
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

  const handleSaveMemo = useCallback(async ({ name, section, transcribe }: { name: string; section: string; transcribe: boolean }) => {
    if (!pendingRecording) return;
    // Capture + clear the "record over" target before any async work so the
    // next normal record can't inherit a stale parent.
    const parentMemoId = recordingParentIdRef.current ?? undefined;
    recordingParentIdRef.current = null;
    voiceMemoCountRef.current++;
    setCanvasStatus("Saving...");
    const tempId = `voice-${Date.now()}`;
    setCards((prev) => {
      const ideaIndex = prev.filter((card) => card.tree === "ideas").length;
      const newCard: CanvasCard = {
        id: tempId, tree: "ideas", type: "voice",
        title: name, body: "", meta: formatDuration(pendingRecording.durationMs),
        section, contributor: currentUserName, status: "raw", accent: "#D4AE5C",
        x: 80 + (ideaIndex % 3) * 240, y: 700 + Math.floor(ideaIndex / 3) * 180,
        parentMemoId, durationMs: pendingRecording.durationMs,
        isProcessing: true,
      };
      return [newCard, ...prev];
    });
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
    try {
      const memoId = await uploadVoiceMemo({ songId, blob: pendingRecording.blob, mimeType: pendingRecording.mimeType, durationMs: pendingRecording.durationMs, title: name, sectionLabel: section, transcribe, parentMemoId, idempotencyKey: tempId });
      setCards((prev) => prev.map((c) => c.id === tempId ? { ...c, id: memoId, isProcessing: false } : c));
      setCanvasStatus("Saved to this song.");
    } catch {
      setCards((prev) => prev.map((c) => c.id === tempId ? { ...c, isProcessing: false } : c));
      setCanvasStatus("You can keep adding ideas. We will sync when you are back online.");
    }
  }, [pendingRecording, showSavedMoment, songId, currentUserName]);

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
  const layerCountByBase = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      if (c.parentMemoId) counts[c.parentMemoId] = (counts[c.parentMemoId] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

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
        label: "Add idea",
        icon: Plus,
        onClick: () => addCard("note"),
        disabled: isViewer,
        haptic: [5],
      },
    ],
    [addCard, handleLaunchPractice, handleStartRecording, isPracticeLaunching, isViewer, recordingFlow],
  );

  return (
    <div
      className="relative flex flex-col"
      style={{ height: "100dvh", backgroundColor: "#FAFAF6", overflow: "hidden" }}
    >
      <SongCanvasSemanticSummary />
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-30 flex items-center justify-between gap-3 px-5 pb-3 flex-shrink-0"
        style={{ maxWidth: 1180, margin: "0 auto", width: "100%", paddingTop: 48 }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm transition-opacity hover:opacity-70 active:scale-[0.97]"
          style={{ color: "#666", flexShrink: 0 }}
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
            style={{ fontSize: 15, color: "#1A1A1A", fontFamily: "var(--font-display)", marginTop: 4, maxWidth: 180 }}
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
                  color: active ? "#B5935A" : "#999",
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
        <p
          aria-live="polite"
          className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "#B5935A" }}
        >
          {canvasStatus}
        </p>
        {isViewer ? (
          <p className="text-right text-xs font-medium" style={{ color: "#6B6459" }}>
            You can view this canvas. Ask the owner if you need to contribute.
          </p>
        ) : roomCollaborators.length > 0 ? (
          <div className="flex items-center gap-2" aria-label={`In this room: ${roomCollaborators.length} ${roomCollaborators.length === 1 ? "person" : "people"}`}>
            <span
              className="hidden sm:inline"
              style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", fontFamily: "var(--font-body)" }}
            >
              In this room
            </span>
            <CollaboratorAvatarStack collaborators={roomCollaborators} size={28} maxVisible={4} />
          </div>
        ) : null}
      </div>

      {/* ── Canvas viewport ──────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <CanvasViewport
          className="w-full h-full"
          overlay={
            <>
              {showFirstAction && (
                <FirstActionPrompt
                  onHum={() => { addCard("hum"); dismissFirstAction(); }}
                  onLyric={() => { addCard("lyric"); dismissFirstAction(); }}
                  onChords={() => { addCard("chord"); dismissFirstAction(); }}
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
                  backgroundColor: recordingFlow === "recording" ? "#E05440" : "#FFFFFF",
                  border: recordingFlow === "recording" ? "none" : "1px solid rgba(181,147,90,0.28)",
                  color: recordingFlow === "recording" ? "#FFFFFF" : "#1A1A1A",
                  boxShadow: recordingFlow === "recording"
                    ? "0 0 0 6px rgba(224,84,64,0.18), 0 4px 16px rgba(224,84,64,0.45)"
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
        >
          {/* Canvas content — all positioned absolutely */}
          <SongRootCard title={songTitle} />
          <ZoneLabels />
          <CanvasDivider isDropActive={isDragOver} />

          {/* Render all cards */}
          {[...ideasCards, ...finalCards].map((card) => (
            <CanvasCardEl
              key={card.id}
              card={card}
              selected={selectedId === card.id}
              onSelect={() => setSelectedId(selectedId === card.id ? null : card.id)}
              onMoveToFinal={() => handleMoveToFinal(card.id)}
              onMoveToIdeas={() => handleMoveToIdeas(card.id)}
              onDragStart={handleCardDragStart}
              layerCount={layerCountByBase[card.id] ?? 0}
              onOpenStack={
                card.type === "voice" || card.type === "hum"
                  ? () => setStackBaseId(card.id)
                  : undefined
              }
            />
          ))}
        </CanvasViewport>

        {/* Work layer slide-in panel */}
        {showWorkPanel && (
          <div
            className="absolute top-0 right-0 bottom-0 z-40 overflow-y-auto"
            style={{
              width: 320,
              backgroundColor: "#FAFAF6",
              borderLeft: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => { setShowWorkPanel(false); setActiveLayer("room"); }}
              className="absolute top-4 right-4 flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, backgroundColor: "rgba(0,0,0,0.06)", color: "#666" }}
              aria-label="Close panel"
            >
              ×
            </button>
            <div className="p-4" style={{ paddingTop: 48 }}>
              {activeLayer === "voice" ? (
                <VoiceLayerPanel
                  songId={songId}
                  currentUserName={currentUserName}
                  onRecord={() => { setShowWorkPanel(false); setActiveLayer("room"); void handleStartRecording(); }}
                />
              ) : (
                <>
                  <Suspense fallback={<div style={{ height: 200, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 16 }} />}>
                    <SongCanvasWorkLayers activeLayer={activeLayer} />
                  </Suspense>
                  <Suspense fallback={null}>
                    <SongCanvasCollabLayers activeLayer={activeLayer} />
                  </Suspense>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <SongTabBar activeTab="canvas" />
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
