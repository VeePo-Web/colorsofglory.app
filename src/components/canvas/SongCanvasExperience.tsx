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
  Maximize2,
} from "lucide-react";
import { loadPracticeSections } from "@/lib/practice/practiceApi";
import { setNavDirection } from "@/lib/nav/navDirection";
import CrownMark from "@/components/cog/CrownMark";
import SongTabBar from "@/components/cog/SongTabBar";
import CreativeActionDock from "@/components/cog/CreativeActionDock";
import { isBottomWorkflowActive } from "@/lib/canvas/bottomSurface";
import SongRoomSaveToast, { type SongRoomSaveMoment } from "@/components/cog/SongRoomSaveToast";
import { useSongTitle } from "@/lib/songContext";
import type { ViewportCtx } from "@/components/canvas/CanvasViewport";
import CanvasStage, { type CanvasCardInteractions } from "@/components/canvas/CanvasStage";
import FirstActionPrompt from "@/components/canvas/FirstActionPrompt";
import { DIVIDER_X } from "@/lib/canvas/canvasConstants";
import {
  COLUMN_TOP,
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  FINAL_COLUMN_X,
  IDEAS_COLUMN_X,
  ROOT_HEIGHT,
  ROOT_LEFT,
  ROOT_TOP,
  ROOT_WIDTH,
  cardWidth,
  ideaColumnSlot,
  finalColumnSlot,
} from "@/lib/canvas/canvasGeometry";
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
import {
  initialBoard,
  writeBoard,
  hydrateBoard,
  clusterFlags,
  isServerCardId,
  serverCardId,
} from "@/lib/canvas/canvasBoardSource";
import {
  bulkMoveCards,
  createCanvasCard,
  deleteCanvasCard,
  moveCard as moveServerCard,
  promoteCardToFinal,
  setCardSection,
  updateCanvasCard,
  type CanvasCard as ServerCanvasCardRow,
} from "@/integrations/cog/canvas";
import {
  addTombstone,
  readTombstones,
  removeTombstone,
} from "@/lib/canvas/canvasBoardSource";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import type { SectionClusterData } from "@/components/canvas/SectionCluster";
import {
  addLineSuggestion,
  encodeSuggestion,
  listLineSuggestions,
  removeLineSuggestion,
  SUGGESTION_SECTION_KIND,
  type PendingLineSuggestion,
} from "@/lib/canvas/lineSuggestions";
import MemoSheet from "@/components/voice/MemoSheet";
import TakeMiniPlayer from "@/components/voice/TakeMiniPlayer";
import type { StackMemoView } from "@/components/voice/MemoStack";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import RoleToast from "@/components/invite/RoleToast";
import type { InviteRole } from "@/lib/invite/inviteContext";
import CoachMark from "@/components/onboarding/CoachMark";
import { useCoachMark } from "@/components/onboarding/useCoachMark";
import { useSongCollaborators } from "@/lib/invite/useSongCollaborators";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { useSongPresence } from "@/lib/canvas/useSongPresence";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { subscribeSongRoom } from "@/integrations/cog/realtime";
import { useSongTempo } from "@/hooks/useSongTempo";
import { useMetronome } from "@/hooks/useMetronome";
import MetronomeStrip from "@/components/voice/MetronomeStrip";
import TempoRow from "@/components/voice/TempoRow";
import { playReferenceGuide, type GuideHandle } from "@/lib/audio/referenceGuide";
import { setAlignmentOffset, rekeyAlignmentOffset } from "@/lib/audio/alignmentStore";
import { getAudioSession } from "@/lib/audio/audioSession";
import { maybeDetectSongTempoKey } from "@/lib/audio/tempoKeyRunner";
import Pad from "@/components/capture/Pad";
import { toast } from "sonner";
import WhatChangedRecapSheet from "@/components/canvas/WhatChangedRecapSheet";
import CanvasRecapGate from "@/components/canvas/CanvasRecapGate";
import AmenChip from "@/components/canvas/AmenChip";
import { useAmens } from "@/lib/canvas/collab/useAmens";
import LineSuggestionSheet, { type LineSuggestionMode } from "@/components/canvas/LineSuggestionSheet";
import ListenPathBar from "@/components/canvas/ListenPathBar";
import MergeActionBar from "@/components/canvas/MergeActionBar";
import WeaveBar from "@/components/canvas/WeaveBar";
import { useWeave } from "@/components/canvas/useWeave";
import { corpusFromBodies } from "@/lib/lyrics/rhymeSuggest";
import CompareModeSheet from "@/components/canvas/CompareModeSheet";
import FinalArrangementBar from "@/components/canvas/FinalArrangementBar";
import CanvasMetronomeToggle from "@/components/canvas/CanvasMetronomeToggle";
import type { CanvasBoardCard, CanvasBoardCardType, CanvasContributionType } from "@/lib/canvas/canvasTypes";
import {
  useListenPath,
  useCompareMode,
  useMergeSplice,
  useFinalArrangement,
  useCanvasMetronome,
  stopCanvasAudio,
  type CanvasFeatureMutations,
  type CanvasFeatureMeta,
} from "@/lib/canvas/features";
import { useCapabilities } from "@/lib/permissions";
import { REVIEW_TONE } from "@/lib/canvas/glorySpectrum";

const SongCanvasCollabLayers = lazy(() => import("@/components/cog/SongCanvasCollabLayers"));
const ShareSongSheet = lazy(() => import("@/components/invite/ShareSongSheet"));
const CardEditSheet = lazy(() => import("@/components/canvas/CardEditSheet"));
const CardActionsSheet = lazy(() => import("@/components/canvas/CardActionsSheet"));
const AddPartSheet = lazy(() => import("@/components/canvas/AddPartSheet"));
const LineLabSheet = lazy(() => import("@/components/canvas/LineLabSheet"));
const OwnerReviewQueueSheet = lazy(() => import("@/components/canvas/OwnerReviewQueueSheet"));

// ─── Types ───────────────────────────────────────────────────────────────────

type CanvasCardType = CanvasBoardCardType;
type LayerId = "room" | "lyrics" | "voice" | "chords" | "notes" | "ideas" | "people";

/**
 * Canonical shape lives in @/lib/canvas/canvasTypes (CanvasBoardCard).
 * Re-exported here only for back-compat with older imports.
 */
export type CanvasCard = CanvasBoardCard;

/** Canvas card → the shape the stack engine + sheet consume. Carries the real
 *  peaks + Melody Lens contour so the stack shows the true waveform (the base
 *  used to render a fabricated id-seeded shape here). */
const toStackView = (c: CanvasCard): StackMemoView => ({
  id: c.id,
  parentMemoId: c.parentMemoId,
  title: c.title,
  contributor: c.contributor,
  durationMs: c.durationMs ?? 0,
  section: c.section,
  waveformPeaks: c.waveformPeaks,
  pitchContour: c.pitchContour,
});

type RecordingFlow = "idle" | "recording" | "reviewing";

/** Per-device "count in a bar before recording" preference. */
const COUNT_IN_PREF_KEY = "cog-count-in";


const LAYERS: Array<{ id: LayerId; label: string; icon: ElementType }> = [
  { id: "room",   label: "Canvas",  icon: GitBranch },
  { id: "lyrics", label: "Lyrics",  icon: FileText },
  { id: "voice",  label: "Voice",   icon: Mic },
  { id: "chords", label: "Chords",  icon: Music },
  { id: "notes",  label: "Notes",   icon: StickyNote },
  { id: "people", label: "People",  icon: Users },
];

// ─── Card data ──────────────────────────────────────────────────────────────
// The board (real backend rows + the demo sample tree) and its persistence live
// behind canvasBoardSource — the interim A4 store seam. This component owns NO
// hardcoded card array and touches localStorage for cards nowhere directly.

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

// Warm amber pending-review dot — attention, never alarm. ONE element
// descriptor shared by every card (elements are immutable; identity-stable
// so React.memo passes).
const REVIEW_DOT = (
  <span
    role="img"
    aria-label="Awaiting your review"
    style={{
      position: "absolute",
      top: -5,
      right: -5,
      width: 12,
      height: 12,
      borderRadius: "50%",
      backgroundColor: REVIEW_TONE.base,
      border: "2px solid #FAFAF6",
      boxShadow: `0 1px 5px ${REVIEW_TONE.glow}`,
    }}
  />
);

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
  // Real permissions come from E1's capability system (server role — a URL
  // can't grant edit). `?role=viewer` remains honored as a RESTRICT-only hint
  // (invite previews land with it), never as a grant. The showcase demo room
  // stays fully usable for everyone — it's a sandbox, not a shared song.
  const caps = useCapabilities(songId);
  const isDemoRoom = songId === "demo";
  const isViewer = !isDemoRoom && (caps.isViewer || searchParams.get("role") === "viewer");
  const canReview = isDemoRoom || caps.isOwner;
  // Fresh arrival from an accepted invite (?invite=1) — show the one-time
  // "you joined as [role]" welcome toast so they know where they stand.
  const isInviteArrival = searchParams.get("invite") === "1";
  const invitedRole = (searchParams.get("role") ?? "contributor") as InviteRole;

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

  // Fire-and-forget server sync: the board is local-first; a failed write
  // (offline, RLS) never blocks the songwriter. Realtime hydration reconciles.
  // Writes SERIALIZE per key (card id) so promote→undo can never land on the
  // server out of order, and each write marks its card dirty for a grace
  // window so a hydrate racing the ack can't yank the card backwards.
  const writeChains = useRef(new Map<string, Promise<unknown>>());
  const dirtyServerCards = useRef(new Map<string, number>());
  const DIRTY_GRACE_MS = 15_000;
  const markDirty = useCallback((cardId: string) => {
    dirtyServerCards.current.set(cardId, Date.now());
  }, []);
  const isDirty = useCallback((cardId: string) => {
    const at = dirtyServerCards.current.get(cardId);
    return at != null && Date.now() - at < DIRTY_GRACE_MS;
  }, []);
  const syncServer = useCallback((write: () => Promise<unknown>, key?: string) => {
    if (key) markDirty(key);
    const prev = key ? writeChains.current.get(key) ?? Promise.resolve() : Promise.resolve();
    const nextP = prev
      .then(write)
      .catch(() => {
        /* non-fatal — the local board stays usable */
      });
    if (key) {
      writeChains.current.set(key, nextP);
      void nextP.finally(() => {
        // Keep the dirty window alive from the LAST write, not the first.
        if (dirtyServerCards.current.has(key)) markDirty(key);
      });
    }
  }, [markDirty]);

  // ── The create spine: a canvas-born card becomes a canvas_cards row ────────
  // Local-first: the card exists instantly with a local uuid; when the insert
  // lands, its id swaps to the server form (db-card-<uuid>) so every device in
  // the room hydrates it. A rejected insert (RLS, offline, local song id) is
  // non-fatal — the card simply stays device-local, exactly as before.
  const replaceQueueIdRef = useRef<(oldId: string, newId: string) => void>(() => {});
  // Local→server id history: write closures queued under a card's OLD id
  // (weave body writes racing the insert ack) resolve the live id here.
  const idAliasRef = useRef(new Map<string, string>());
  // Weave keeps its target/bookkeeping attached through the swap (set after
  // the hook exists — the spine is declared earlier than the feature).
  const weaveRenameRef = useRef<(oldId: string, newId: string) => void>(() => {});
  const swapCardId = useCallback((oldId: string, newId: string) => {
    idAliasRef.current.set(oldId, newId);
    // A chained alias (local → db-card A → …) stays resolvable in one hop.
    for (const [k, v] of idAliasRef.current) {
      if (v === oldId) idAliasRef.current.set(k, newId);
    }
    weaveRenameRef.current(oldId, newId);
    setCards((prev) =>
      prev
        // The realtime hydrate may have mirrored the row already — never two.
        .filter((c) => c.id !== newId)
        .map((c) =>
          c.id === oldId
            ? { ...c, id: newId }
            : c.sourceCardId === oldId
            ? { ...c, sourceCardId: newId }
            : c,
        ),
    );
    setSelectedId((s) => (s === oldId ? newId : s));
    setEditCardId((s) => (s === oldId ? newId : s));
    setMoreCardId((s) => (s === oldId ? newId : s));
    replaceQueueIdRef.current(oldId, newId);
  }, []);

  const SERVER_KIND_BY_TYPE: Partial<Record<CanvasCardType, ServerCanvasCardRow["kind"]>> = useMemo(
    () => ({ lyric: "lyrics", chord: "chords", scripture: "scripture", note: "idea", section: "section" }),
    [],
  );
  const persistNewCard = useCallback(
    (card: CanvasCard) => {
      if (isDemoRoom) return;
      const kind = SERVER_KIND_BY_TYPE[card.type];
      if (!kind) return; // voice/hum live in voice_memos, not canvas_cards
      syncServer(async () => {
        const row = await createCanvasCard({
          song_id: songId,
          kind,
          label: card.title,
          body: card.body,
          section_label: card.section,
          tree_kind: card.tree,
          x: Math.round(card.x),
          y: Math.round(card.y),
          created_by: profile?.user_id,
        });
        swapCardId(card.id, `db-card-${row.id}`);
      }, card.id);
    },
    [isDemoRoom, songId, profile?.user_id, syncServer, swapCardId, SERVER_KIND_BY_TYPE],
  );

  const [cards, setCards] = useState<CanvasCard[]>(() => initialBoard(songId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Neutral opening line — "Saved" would be a false claim on an empty room.
  // Short on purpose: the pill shares a 390px row with the metronome + invite.
  const [canvasStatus, setCanvasStatus] = useState("Every idea stays here.");
  const [isDragOver, setIsDragOver] = useState(false);  // for divider glow
  const [activeLayer, setActiveLayer] = useState<LayerId>(() => {
    const layer = searchParams.get("layer");
    // lyrics/chords/notes forward to their real pages (effect below) — never
    // flash a panel for them on first paint.
    if (!isLayerId(layer) || layer === "lyrics" || layer === "chords" || layer === "notes") return "room";
    return layer;
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

  // ── Identity resolver — the end of the literal "You" ─────────────────────
  // Server rows carry user IDS (createdBy); display names + colors resolve
  // through the roster (and self). Unresolved stays "" — never fabricated.
  const identityByUserId = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const m of songMembers) {
      const name = `${m.firstName} ${m.lastName}`.trim() || m.firstName;
      // Canvas accents resolve through the canvas's own warm palette (hashed
      // from the stable user id) — NEVER roster avatarColor, whose legacy set
      // includes a corporate blue and a near-system gold.
      map.set(m.userId, { name, color: getCreatorColor(m.userId).base });
    }
    if (profile?.user_id) {
      map.set(profile.user_id, {
        name: currentUserName,
        // Hash the ID, not the name — so my cards wear ONE color on every
        // device, whether they were created locally or hydrated.
        color: getCreatorColor(profile.user_id).base,
      });
    }
    return map;
  }, [songMembers, profile?.user_id, currentUserName]);
  const identityRef = useRef(identityByUserId);
  identityRef.current = identityByUserId;

  // ── Amens — the encouragement layer (D3). Depends on the live identity map
  // so cluster names upgrade from "Someone" the moment the roster lands.
  const resolveAmenName = useCallback(
    (id: string) => identityByUserId.get(id)?.name,
    [identityByUserId],
  );
  const {
    summaries: amenSummaryByCard,
    toggleAmen,
    amenEvents,
  } = useAmens(songId, {
    userId: profile?.user_id,
    isDemo: isDemoRoom,
    resolveName: resolveAmenName,
  });

  /** Is this card mine? IDs when both sides are known; names as the fallback;
   *  calm default (true) while identity is still resolving — an unresolved
   *  card must never ping the review queue. */
  const isMine = useCallback(
    (c: CanvasCard) => {
      if (c.createdBy && profile?.user_id) return c.createdBy === profile.user_id;
      if (!c.createdBy && c.contributor) return c.contributor.includes(currentUserName);
      return true;
    },
    [profile?.user_id, currentUserName],
  );

  // When the roster lands after hydration, name the cards that arrived first.
  useEffect(() => {
    if (identityByUserId.size === 0) return;
    setCards((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.contributor || !c.createdBy) return c;
        const who = identityByUserId.get(c.createdBy);
        if (!who) return c;
        changed = true;
        return { ...c, contributor: who.name, accent: who.color };
      });
      return changed ? next : prev;
    });
  }, [identityByUserId]);
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
      // One grammar: practice/Flow always RISES (the same depth motion as
      // the Flow handle's lift — docs/FLOW-ACCESS-CONTRACT.md).
      setNavDirection("up");
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
  // The tries player (F15) opened from the Memo Sheet's Section A.
  const [takesFor, setTakesFor] = useState<{ id: string; title: string; peaks: number[] | null } | null>(null);

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

  // ── Shared tempo + the one session-gated metronome (never bleeds) ────────────
  // One BPM per song, read by every collaborator's metronome and propagated
  // live; the click itself is audible only into confirmed earbuds while the
  // mic is armed — on a speaker it runs as the sheet's gold visual pulse.
  const { bpm: songBpm, beatsPerBar, canEdit: canEditTempo, saveTempo, keySignature: songKeySignature } = useSongTempo(songId);
  const { running: clickRunning, prime: primeClick, countIn: clickCountIn, start: startClick, stop: stopClick } = useMetronome();
  const [countInOn, setCountInOn] = useState(() => {
    try { return localStorage.getItem(COUNT_IN_PREF_KEY) === "1"; } catch { return false; }
  });
  const toggleCountIn = useCallback((on: boolean) => {
    setCountInOn(on);
    try {
      if (on) localStorage.setItem(COUNT_IN_PREF_KEY, "1");
      else localStorage.removeItem(COUNT_IN_PREF_KEY);
    } catch { /* preference only */ }
  }, []);
  // Live record-over guide + the measured alignment offset for the take in flight.
  const guideRef = useRef<GuideHandle | null>(null);
  const takeAlignOffsetRef = useRef(0);
  // Take-start sequencing: each attempt gets a sequence number; Stop/cancel
  // bump it so a start still awaiting its count-in or mic knows it was
  // abandoned and bails instead of opening a mic nobody wants. The in-flight
  // guard also swallows double-taps (a second tap during a 2.7s count-in must
  // not spawn a second count-in).
  const takeSeqRef = useRef(0);
  const takeStartInFlightRef = useRef(false);
  // True while the count-in bar plays, BEFORE the mic opens — the sheet shows
  // an honest "count-in" state instead of pretending to record.
  const [countingIn, setCountingIn] = useState(false);

  // However a take ends — Stop, cancel, or an interruption auto-finalize the
  // UI never asked for — the guide and the click must not outlive it.
  // EDGE-triggered on live→ended, deliberately: a level-triggered version
  // fires the moment the count-in starts the click (phase still "idle") and
  // kills the take before it begins.
  const prevPhaseLiveRef = useRef(false);
  useEffect(() => {
    const live = recorderState.phase === "recording" || recorderState.phase === "stopping";
    const wasLive = prevPhaseLiveRef.current;
    prevPhaseLiveRef.current = live;
    if (live || !wasLive) return;
    guideRef.current?.stop();
    guideRef.current = null;
    if (clickRunning) stopClick();
  }, [recorderState.phase, clickRunning, stopClick]);

  const featureMutations = useMemo<CanvasFeatureMutations>(
    () => ({
      applyMerge: (idA, idB, merged) => {
        // Credit the MERGER (the person acting), not a fabricated joint name —
        // the sources stay visible in meta + mergedFrom provenance.
        const now = new Date().toISOString();
        const stamped: CanvasBoardCard = {
          ...merged,
          contributor: currentUserName,
          accent: getCreatorColor(profile?.user_id ?? currentUserName).base,
          createdBy: profile?.user_id ?? undefined,
          createdAt: now,
          updatedAt: now,
          lastActivityAt: now,
          reviewState: "none",
          contributionType: "arrangement",
        };
        setCards((prev) =>
          prev
            .map((c) =>
              c.id === idA || c.id === idB
                ? { ...c, isDimmedReference: true, dimReason: "merged" as const }
                : c,
            )
            .concat(stamped),
        );
        setSelectedId(null);
        // The new section flies into view AND becomes room-truth.
        setFocusCardId(stamped.id);
        persistNewCard(stamped);
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
        // Undo lives in the toast (useFinalArrangement) — the pill only states
        // what happened; it was never tappable.
        setCanvasStatus("Moved to Final.");
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
        setCanvasStatus("Returned to Ideas.");
      },
      patchCards: (patches) => {
        setCards((prev) =>
          prev.map((c) => {
            const found = patches.find((p) => p.id === c.id);
            return found ? { ...c, ...found.patch } : c;
          }),
        );
        // Position patches on server rows (arrangement slot swaps, undo
        // restores) write through in one bulk move — every device sees the
        // same running order.
        const moves = patches
          .map((p) => {
            const sid = serverCardId(p.id);
            if (sid && p.patch.x != null && p.patch.y != null) {
              markDirty(p.id);
              return { id: sid, x: Math.round(p.patch.x), y: Math.round(p.patch.y) };
            }
            return null;
          })
          .filter((m): m is { id: string; x: number; y: number } => m !== null);
        if (moves.length > 0) syncServer(() => bulkMoveCards(moves));
      },
      saveListenPath: (orderedCardIds) => {
        setFeatureMeta((m) => ({ ...m, listenPath: orderedCardIds }));
      },
    }),
    [syncServer, markDirty, currentUserName, profile?.user_id, persistNewCard],
  );

  // ── D2 feature hooks — the canvas verbs ─────────────────────────────────────
  // The board follows playback: each listen-path step flies the viewport to
  // the sounding card (wired through a ref — jumpToCardId is defined below).
  const followPlaybackRef = useRef<(cardId: string) => void>(() => {});
  const listenPath = useListenPath({
    cards,
    mutations: featureMutations,
    initialQueue: featureMeta.listenPath,
    onStepChange: (cardId) => followPlaybackRef.current(cardId),
  });
  // The create spine renames cards (local uuid → db-card-<uuid>); the listen
  // queue must follow the rename (ref breaks the declaration cycle).
  replaceQueueIdRef.current = listenPath.replaceCardId;
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
    ideaSlot: ideaColumnSlot,
    // EVERY server-hydrated card moves in place (a locally minted `-final`
    // ghost id would desync from its server row); canvas_cards tree changes
    // write through so co-writers see the promotion. Voice memos have no
    // server tree — their arrangement state lives in this board's storage.
    movesInPlace: (cardId) => isServerCardId(cardId),
    onTreeChange: (cardId, tree) => {
      const sid = serverCardId(cardId);
      if (!sid) return;
      const section = cards.find((c) => c.id === cardId)?.section ?? null;
      syncServer(
        () => (tree === "final" ? promoteCardToFinal(sid) : setCardSection(sid, section, "ideas")),
        cardId,
      );
    },
    onMoment: showSavedMoment,
  });
  const metronome = useCanvasMetronome(songId);

  // ── One bottom surface at a time ────────────────────────────────────────────
  // Merge, arrange, and the listen transport used to stack into a wall that
  // buried the tab bar and the Record dock. The listen path restores COLLAPSED
  // (a pill) and expands on demand; entering arrange clears a merge selection.
  const [pathExpanded, setPathExpanded] = useState(false);
  const prevQueueLen = useRef(listenPath.queue.length);
  useEffect(() => {
    // Auto-expand when the songwriter grows the queue by hand; a restored
    // saved path stays a quiet pill.
    if (listenPath.queue.length > prevQueueLen.current) setPathExpanded(true);
    prevQueueLen.current = listenPath.queue.length;
  }, [listenPath.queue.length]);
  useEffect(() => {
    if (arrangement.arranging) {
      setPathExpanded(false);
      merge.clearSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement.arranging]);
  useEffect(() => {
    if (merge.selection.length > 0) setPathExpanded(false);
  }, [merge.selection.length]);

  // Card drag position updates flow up through the onMove prop; see CanvasStage.

  useEffect(() => {
    const layer = searchParams.get("layer");
    if (!isLayerId(layer)) return;
    // Every word has ONE real home. Legacy ?layer= deep links used to open a
    // DEMO panel showing a fabricated song (hardcoded verses/memos/chords) —
    // the fastest way to teach a songwriter not to trust the app. Forward to
    // the real surfaces instead; only Voice (real recorder panel) and People
    // (real roster/activity) remain as canvas layers.
    if (layer === "lyrics" || layer === "chords") {
      navigate(`/songs/${songId}/sheet`, { replace: true });
      return;
    }
    if (layer === "notes") {
      navigate(`/songs/${songId}/notes`, { replace: true });
      return;
    }
    setActiveLayer(layer);
    setShowWorkPanel(layer !== "room" && layer !== "ideas");
  }, [searchParams, navigate, songId]);

  useEffect(() => {
    writeBoard(songId, cards);
  }, [cards, songId]);

  // Pull this song's server board (voice memos + canvas_cards — the rows
  // Capture mode writes) and reconcile: UPSERT content on cards we already
  // show, APPEND new arrivals with resolved identity, PRUNE server cards the
  // server no longer returns (only when that source actually responded, so an
  // offline failure never wipes the board). Reused on mount AND on every
  // realtime event, so a collaborator's work appears without a reload.
  // Suggestions that arrived over the wire (carrier rows) — the server lane.
  const [serverSuggestions, setServerSuggestions] = useState<PendingLineSuggestion[]>([]);

  const hydrateVoiceMemos = useCallback(async () => {
    const res = await hydrateBoard(songId);
    if (!res.memosOk && !res.cardsOk) return;
    if (res.cardsOk) {
      // Resolve proposer names through the roster where the payload lacks
      // one. Bail out when nothing changed — this runs on every debounced
      // realtime tick, and a fresh array identity would re-render the whole
      // page for a byte-identical list.
      setServerSuggestions((prev) => {
        const next = res.suggestions.map((s) => ({
          ...s,
          contributor:
            s.contributor ||
            (s.createdBy ? identityRef.current.get(s.createdBy)?.name ?? "" : ""),
        }));
        const same =
          prev.length === next.length &&
          prev.every(
            (p, i) =>
              p.id === next[i].id &&
              p.proposedLine === next[i].proposedLine &&
              p.originalLine === next[i].originalLine &&
              p.contributor === next[i].contributor,
          );
        return same ? prev : next;
      });
    }
    setCards((prev) => {
      const fresh = new Map(res.cards.map((c) => [c.id, c]));
      // A memo we uploaded THIS session keeps its raw-uuid card; skip the
      // server mirror so one take never shows twice.
      const localMemoIds = new Set(
        prev.filter((c) => !isServerCardId(c.id)).map((c) => c.id),
      );
      let changed = false;
      const next: CanvasCard[] = [];
      for (const c of prev) {
        const server = fresh.get(c.id);
        if (server) {
          fresh.delete(c.id);
          // Server truth for content + (canvas_cards only) board state, so a
          // co-writer's move/promote/section-change appears here live. A card
          // this device just wrote to stays LOCAL-truth for a grace window
          // (dirty) so a hydrate racing the RPC ack can't yank it backwards.
          const dirty = isDirty(c.id);
          const isBoardRow = c.id.startsWith("db-card-");
          const merged: CanvasCard = {
            ...c,
            title: dirty ? c.title : server.title || c.title,
            body: dirty ? c.body : server.body,
            meta: server.meta || c.meta,
            durationMs: server.durationMs ?? c.durationMs,
            isProcessing: server.isProcessing,
            createdBy: server.createdBy ?? c.createdBy,
            createdAt: server.createdAt ?? c.createdAt,
            updatedAt: server.updatedAt ?? c.updatedAt,
            lastActivityAt: server.lastActivityAt ?? c.lastActivityAt,
            ...(isBoardRow && !dirty
              ? {
                  tree: server.tree,
                  section: server.section,
                  status: c.tree === server.tree ? c.status : server.status,
                  ...(server.serverPositioned ? { x: server.x, y: server.y } : {}),
                }
              : {}),
          };
          const cardChanged =
            merged.title !== c.title || merged.body !== c.body || merged.meta !== c.meta ||
            merged.isProcessing !== c.isProcessing || merged.createdBy !== c.createdBy ||
            merged.updatedAt !== c.updatedAt || merged.durationMs !== c.durationMs ||
            merged.tree !== c.tree || merged.section !== c.section ||
            merged.x !== c.x || merged.y !== c.y || merged.status !== c.status;
          if (cardChanged) changed = true;
          next.push(cardChanged ? merged : c);
          continue;
        }
        if (isServerCardId(c.id)) {
          const sourceAnswered = c.id.startsWith("db-voice-") ? res.memosOk : res.cardsOk;
          if (sourceAnswered) {
            changed = true; // row is gone on the server — let it go here too
            continue;
          }
        }
        next.push(c);
      }
      // "Not this one" must stay decided: rows the owner dismissed on this
      // device are tombstoned and never re-appended by a later hydrate.
      const tombstones = readTombstones(songId);
      const additions = [...fresh.values()]
        .filter((c) => {
          if (tombstones.has(c.id)) return false;
          const raw = c.id.startsWith("db-voice-") ? c.id.slice("db-voice-".length) : null;
          return !(raw && localMemoIds.has(raw));
        })
        .map((c) => {
          const who = c.createdBy ? identityRef.current.get(c.createdBy) : undefined;
          return who ? { ...c, contributor: who.name, accent: who.color } : c;
        });
      if (additions.length > 0) changed = true;
      return changed ? [...next, ...additions] : prev;
    });
  }, [songId, isDirty]);

  // Mount hydration + live room channel. Realtime events DEBOUNCE into one
  // trailing hydrate (a burst of co-writer edits used to trigger a full board
  // fetch+merge per event — a re-render storm on every device in the room).
  const hydrateTimerRef = useRef<number | null>(null);
  useEffect(() => {
    void hydrateVoiceMemos();
    const schedule = () => {
      if (hydrateTimerRef.current != null) window.clearTimeout(hydrateTimerRef.current);
      hydrateTimerRef.current = window.setTimeout(() => {
        hydrateTimerRef.current = null;
        void hydrateVoiceMemos();
      }, 600);
    };
    const unsubscribe = subscribeSongRoom(songId, {
      onActivity: schedule,
      onCardChange: schedule,
      onTakeChange: schedule,
      onCaptureChange: schedule,
    });
    return () => {
      if (hydrateTimerRef.current != null) window.clearTimeout(hydrateTimerRef.current);
      unsubscribe();
    };
  }, [songId, hydrateVoiceMemos]);

  // ── Card manipulation ──────────────────────────────────────────────────────

  /** Called by CanvasStage's pointer-capture card drag with the new canvas-space position. */
  const handleCardMove = useCallback((id: string, x: number, y: number) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, x, y } : c));
    // Server rows persist their position for every device in the room.
    const sid = serverCardId(id);
    if (sid) syncServer(() => moveServerCard(sid, Math.round(x), Math.round(y)), id);
  }, [syncServer]);

  // Move-to-Final / return-to-Ideas mechanics live in useFinalArrangement (D2).

  // Collab-ready identity + time stamps on every card this device creates.
  // `contributor` (display name) stays for rendering; createdBy carries the
  // real user id when a session exists. Ids are UUIDs so concurrent creates
  // can't collide and can round-trip to canvas_cards later.
  const CONTRIBUTION_BY_TYPE: Record<CanvasCardType, CanvasContributionType> = useMemo(
    () => ({
      lyric: "lyrics", voice: "melody", hum: "melody", chord: "chords",
      section: "arrangement", scripture: "meaning", note: "feedback",
    }),
    [],
  );
  const stampNewCard = useCallback(
    (partial: Omit<CanvasCard, "id" | "contributor" | "accent" | "status">): CanvasCard => {
      const now = new Date().toISOString();
      return {
        id: `card-${crypto.randomUUID()}`,
        contributor: currentUserName,
        status: "raw",
        accent: getCreatorColor(profile?.user_id ?? currentUserName).base,
        createdBy: profile?.user_id ?? undefined,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        reviewState: "none",
        contributionType: CONTRIBUTION_BY_TYPE[partial.type],
        ...partial,
      };
    },
    [currentUserName, profile?.user_id, CONTRIBUTION_BY_TYPE],
  );

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
    const newCard = stampNewCard({
      tree: "ideas",
      type,
      title: titleByType[type],
      body: "",
      meta: "",
      section: type === "scripture" ? "Meaning" : "Raw idea",
      // A single tidy column under the root, so ideas read like a scrollable
      // feed instead of a scatter dumped off-screen in 2D space.
      ...ideaColumnSlot(ideaIndex),
    });
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
    setCanvasStatus("Saved to this song.");
    // Fly to the new card (it's placed below the fold) AND open the editor so
    // the idea gets written right away — capture-then-fill, nothing lost if
    // they dismiss (the card persists).
    setFocusCardId(newCard.id);
    setEditCardId(newCard.id);
    persistNewCard(newCard);
  }, [cards, isViewer, stampNewCard, persistNewCard]);

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
      choice.section === "Raw idea" || choice.section === "Meaning"
        ? choice.type === "chord"
          ? "Chord idea"
          : choice.type === "scripture"
          ? "Scripture note"
          : choice.type === "note"
          ? "New idea"
          : "Lyric"
        : section;
    const newCard = stampNewCard({
      tree: "ideas",
      type: choice.type,
      title,
      body: "",
      meta: "",
      section,
      ...ideaColumnSlot(ideaIndex),
    });
    setCards((prev) => [newCard, ...prev]);
    setSelectedId(newCard.id);
    setCanvasStatus("Saved to this song.");
    setFocusCardId(newCard.id);
    setEditCardId(newCard.id);
    persistNewCard(newCard);
  }, [cards, isViewer, stampNewCard, persistNewCard]);

  // ── Voice recording handlers ──────────────────────────────────────────────────
  const handleStartRecording = useCallback(async (parentId?: string) => {
    // The in-flight guard swallows double-taps: a second tap during the
    // count-in or the permission prompt must not spawn a second sequence.
    if (isViewer || takeStartInFlightRef.current) return;
    takeStartInFlightRef.current = true;
    const seq = ++takeSeqRef.current;
    try {
      // Never-bleed invariant: nothing on the speaker may bake into the take.
      // The beat can be restarted after the take; losing a click is recoverable,
      // a ruined recording is not. The metronome is one source; the shared canvas
      // voice (Listen Path / Compare auditioning a take aloud) is the other —
      // silence BOTH structurally at the record choke point, so the guarantee
      // never depends on which bottom bar happens to be visible.
      if (metronome.running) metronome.stop();
      stopCanvasAudio();
      recordingParentIdRef.current = parentId ?? null;
      setRecordingSection(parentId ? "Layer" : "Raw idea");
      setRecordingNote("");
      takeAlignOffsetRef.current = 0;
      // One audible bar of count-in, resolving on the downbeat — THEN the mic
      // opens, so the count-in can never be in the take. Requires the shared
      // song BPM (no tempo → no count-in, per spec). The sheet opens NOW in an
      // honest count-in state: a bar of dead screen reads as broken.
      if (countInOn && songBpm) {
        primeClick(); // resume the AudioContext inside this gesture
        setCountingIn(true);
        setRecordingFlow("recording");
        await clickCountIn(songBpm, beatsPerBar);
        setCountingIn(false);
        if (takeSeqRef.current !== seq) {
          // Stop/cancel landed during the count-in — the take was abandoned.
          stopClick();
          return;
        }
      }
      // Headphone monitoring means there is no speaker for AEC to cancel —
      // there, echo cancellation only smears a musical take. Speaker takes
      // keep the speech-friendly processing.
      const started = await startRecording({
        highFidelity: getAudioSession().outputRoute === "confirmed-headphones",
      });
      const recorderStartMs = performance.now();
      if (takeSeqRef.current !== seq) {
        // Abandoned while the permission prompt / mic arm was in flight.
        stopClick();
        if (started) cancelRecording();
        return;
      }
      setRecordingFlow(started ? "recording" : "idle");
      if (!started) {
        // The mic never opened — the count-in click must not keep ticking
        // into the room forever.
        stopClick();
        return;
      }
      // The click may continue through the take — the session authority decides:
      // audible into confirmed earbuds, otherwise the sheet's gold visual pulse.
      if (countInOn && songBpm) startClick(songBpm, beatsPerBar);
      // Record-over guide (F16): the base take plays aloud ONLY into confirmed
      // headphones — on a speaker it would bleed into the layer, so the fallback
      // is the visual beat plus the earbuds hint. The start-skew + device
      // round-trip estimate becomes the layer's alignment offset so base + layer
      // share one grid on playback instead of drifting by the latency.
      if (parentId) {
        const guide = await playReferenceGuide(parentId);
        if (takeSeqRef.current !== seq) {
          guide?.stop();
          return;
        }
        if (guide) {
          guideRef.current = guide;
          takeAlignOffsetRef.current =
            Math.max(0, Math.round(guide.startedAtMs - recorderStartMs)) + guide.latencyEstimateMs;
        }
      }
    } finally {
      takeStartInFlightRef.current = false;
      setCountingIn(false);
    }
  }, [isViewer, startRecording, cancelRecording, metronome, countInOn, songBpm, beatsPerBar, primeClick, clickCountIn, startClick, stopClick]);

  const handleStopRecording = useCallback(async () => {
    takeSeqRef.current += 1; // abandon any start still awaiting count-in / mic
    guideRef.current?.stop();
    guideRef.current = null;
    stopClick();
    const result = await stopRecording();
    if (result) { setPendingRecording(result); setRecordingFlow("reviewing"); }
    else setRecordingFlow("idle");
  }, [stopRecording, stopClick]);

  const handleCancelRecording = useCallback(() => {
    takeSeqRef.current += 1; // abandon any start still awaiting count-in / mic
    guideRef.current?.stop();
    guideRef.current = null;
    stopClick();
    cancelRecording();
    setRecordingFlow("idle");
    setRecordingNote("");
    setPendingRecording(null);
  }, [cancelRecording, stopClick]);

  // Flush a queued canvas take (base OR layer) and reconcile its card. On success
  // the temp card id becomes the real memo id; on failure the card stays put with
  // its blob safe in the cache, to be retried by the recovery sweep on next load /
  // reconnect. The creed holds on the canvas exactly as it does in the song room.
  const flushCanvasUpload = useCallback(async (pendingId: string) => {
    try {
      const memoId = await flushPendingUpload(pendingId);
      // The layer's measured alignment offset must follow the take from its
      // queued temp id to the real memo id, or stack playback loses the grid.
      if (memoId) rekeyAlignmentOffset(pendingId, memoId);
      setCards((prev) => prev
        // The realtime event can hydrate the server mirror (db-voice-<memoId>)
        // BEFORE this swap lands — drop it here so one take never shows twice.
        .filter((c) => !(memoId && c.id === `db-voice-${memoId}`))
        .map((c) =>
          c.id === pendingId ? { ...c, id: memoId ?? c.id, isProcessing: false } : c,
        ));
      // The listen queue tracks the same rename, or its entry goes phantom.
      if (memoId) listenPath.replaceCardId(pendingId, memoId);
      setCanvasStatus("Saved to this song.");
    } catch {
      setCards((prev) => prev.map((c) =>
        c.id === pendingId ? { ...c, isProcessing: false } : c,
      ));
      setCanvasStatus("You can keep adding ideas. We'll finish saving when you're back online.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenPath.replaceCardId]);

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

    // A layer cut against the headphone guide carries its measured latency
    // offset so stack playback seats it on the base's grid (see alignmentStore).
    if (parentMemoId && takeAlignOffsetRef.current > 0) {
      setAlignmentOffset(pending.id, takeAlignOffsetRef.current);
      takeAlignOffsetRef.current = 0;
    }

    // F13: read the tempo + key off the take and pre-fill the song's EMPTY
    // tempo_bpm/key_signature — a confirmable suggestion, off the save path.
    maybeDetectSongTempoKey(rec.blob, songId);

    setCards((prev) => {
      const ideaIndex = prev.filter((card) => card.tree === "ideas" && !card.parentMemoId).length;
      const now = new Date().toISOString();
      const newCard: CanvasCard = {
        id: pending.id, tree: "ideas", type: "voice",
        title: name, body: "", meta: formatDuration(rec.durationMs),
        section, contributor: currentUserName, status: "raw", accent: getCreatorColor(currentUserName).base,
        ...ideaColumnSlot(ideaIndex),
        parentMemoId, durationMs: rec.durationMs,
        isProcessing: true,
        createdBy: profile?.user_id ?? undefined,
        createdAt: now, updatedAt: now, lastActivityAt: now,
        reviewState: "none", contributionType: "melody",
      };
      return [newCard, ...prev];
    });
    // Bring the new memo card into view — it lands below the fold like any idea.
    if (!parentMemoId) setFocusCardId(pending.id);

    await flushCanvasUpload(pending.id);
  }, [pendingRecording, showSavedMoment, songId, currentUserName, profile?.user_id, flushCanvasUpload]);

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

  // Layer switching is owned by SongTabBar + ?layer= deep links (the header
  // chip strip that duplicated it is gone).

  // Layers live inside their base's stack, not loose on the board.
  const ideasCards = useMemo(() => cards.filter((c) => c.tree === "ideas" && !c.parentMemoId), [cards]);
  const finalCards = useMemo(() => cards.filter((c) => c.tree === "final" && !c.parentMemoId), [cards]);

  // ── Section clusters (Step 8) ──────────────────────────────────────────────
  // WHICH dense sections collapse is the store's flag (clusterFlags = interim
  // A4 seam); the render layer only presents them. A tapped-open cluster fans
  // its members back onto the board.
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const boardCards = useMemo(() => [...ideasCards, ...finalCards], [ideasCards, finalCards]);
  const clusterFlagList = useMemo(() => clusterFlags(boardCards), [boardCards]);

  // Collapsed clusters → SectionClusterData for the render layer; their member
  // ids are hidden from the card render so a stack replaces the loose cards.
  // ── Weave: line-level composition into a final section (WEAVE-CONTRACT) ──
  // The hook's ONE write path: body-only update, local-first + server sync —
  // the same spine handleSaveCardEdit rides, minus title/section. The server
  // id resolves INSIDE the queued closure: a section whose insert is still in
  // flight (weave-right-after-add) gets its woven body written once the ack
  // lands (the per-key chain runs this after the insert), never dropped.
  const handleWeaveBody = useCallback(
    (cardId: string, body: string) => {
      const now = new Date().toISOString();
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, body, updatedAt: now, lastActivityAt: now, updatedBy: profile?.user_id ?? c.updatedBy }
            : c,
        ),
      );
      syncServer(async () => {
        const resolved = idAliasRef.current.get(cardId) ?? cardId;
        const sid = serverCardId(resolved);
        if (!sid) return; // genuinely device-local — nothing to sync
        if (resolved !== cardId) markDirty(resolved); // dirty rides the LIVE id
        await updateCanvasCard(sid, { body });
      }, cardId);
    },
    [profile?.user_id, syncServer, markDirty],
  );

  const weave = useWeave({
    songId,
    cards,
    isViewer,
    updateBody: handleWeaveBody,
    announce: setCanvasStatus,
  });
  weaveRenameRef.current = weave.renameCard;
  const weaveSectionName = weave.target?.section || weave.target?.title || "the section";
  // Line Lab's offline fallback corpus — the writer's OWN idea-tree words.
  // Only mined while the lab is open; empty (and dep-cheap) otherwise.
  const weaveCorpus = useMemo(
    () =>
      weave.labIndex == null
        ? []
        : corpusFromBodies(cards.filter((c) => c.tree === "ideas" && c.body).map((c) => c.body)),
    [cards, weave.labIndex],
  );

  const { clusterData, hiddenCardIds } = useMemo(() => {
    // While weaving, stacks yield: a collapsed cluster would HIDE glowing
    // candidate lines the mode just promised ("tap a glowing line").
    if (weave.active) return { clusterData: [] as SectionClusterData[], hiddenCardIds: new Set<string>() };
    const byId = new Map(boardCards.map((c) => [c.id, c]));
    const hidden = new Set<string>();
    const data: SectionClusterData[] = [];
    for (const cl of clusterFlagList) {
      if (expandedClusters.has(cl.id)) continue; // expanded → members render loose
      const members = cl.cardIds.map((id) => byId.get(id)).filter(Boolean) as CanvasCard[];
      if (members.length === 0) continue;
      members.forEach((m) => hidden.add(m.id));
      // Present the stack at the group's top-left card; color = most frequent hand.
      const anchor = members.reduce((a, b) => (b.y < a.y ? b : a));
      const tally = new Map<string, number>();
      for (const m of members) tally.set(m.contributor, (tally.get(m.contributor) ?? 0) + 1);
      const topContributor = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? anchor.contributor;
      data.push({
        id: cl.id,
        sectionLabel: cl.sectionLabel,
        x: anchor.x,
        y: anchor.y,
        color: getCreatorColor(topContributor),
        cards: members.map((m) => ({
          id: m.id, title: m.title, body: m.body, contributor: m.contributor, type: m.type, x: m.x, y: m.y,
        })),
      });
    }
    return { clusterData: data, hiddenCardIds: hidden };
  }, [clusterFlagList, expandedClusters, boardCards, weave.active]);

  // What the render surface draws: every card minus the ones tucked in a
  // collapsed stack (D2/D3 still operate on the full ideasCards/finalCards).
  const stageIdeasCards = useMemo(
    () => (hiddenCardIds.size ? ideasCards.filter((c) => !hiddenCardIds.has(c.id)) : ideasCards),
    [ideasCards, hiddenCardIds],
  );
  const stageFinalCards = useMemo(
    () => (hiddenCardIds.size ? finalCards.filter((c) => !hiddenCardIds.has(c.id)) : finalCards),
    [finalCards, hiddenCardIds],
  );

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

  // Clone a card's slot (same exact section, empty body) so the songwriter can
  // write "Chorus take B" and immediately compare A vs B — the paved path into
  // F21 that never existed.
  const handleNewVariant = useCallback(
    (cardId: string) => {
      const src = cards.find((c) => c.id === cardId);
      if (!src || isViewer) return;
      const ideaIndex = cards.filter((c) => c.tree === "ideas" && !c.parentMemoId).length;
      const variant = stampNewCard({
        tree: "ideas",
        type: src.type === "voice" || src.type === "hum" ? "lyric" : src.type,
        title: `${src.section || src.title} — another take`,
        body: "",
        meta: "",
        section: src.section,
        ...ideaColumnSlot(ideaIndex),
      });
      setCards((prev) => [variant, ...prev]);
      setSelectedId(variant.id);
      setFocusCardId(variant.id);
      setEditCardId(variant.id);
      persistNewCard(variant);
    },
    [cards, isViewer, stampNewCard, persistNewCard],
  );

  // Un-dim a kept reference — "nothing is deleted" means nothing is stuck.
  const handleRestoreCard = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, isDimmedReference: false, dimReason: undefined, status: "raw" }
          : c,
      ),
    );
    setSelectedId(null);
    setCanvasStatus("Idea brought back.");
  }, []);

  // Per-card wiring for CanvasStage's render loop — MEMOIZED so a CanvasCard's
  // props keep identity across unrelated host renders (presence syncs, status
  // pill changes, sheet toggles) and React.memo actually skips it. The hook
  // APIs ride behind a ref, so the closures always call the CURRENT verbs
  // without their per-render object identity invalidating the memo.
  const apisRef = useRef({ arrangement, merge, listenPath, weave });
  apisRef.current = { arrangement, merge, listenPath, weave };
  const { queue: listenQueue, step: listenStep, playing: listenPlaying } = listenPath;
  const comparePlayingId = compare.playingId;
  const mergeSelection = merge.selection;

  const interactionsById = useMemo(() => {
    const map = new Map<string, CanvasCardInteractions>();
    for (const card of boardCards) {
      map.set(card.id, {
        onSelect: () => setSelectedId((prev) => (prev === card.id ? null : card.id)),
        onMoveToFinal: () => apisRef.current.arrangement.moveToFinal(card.id),
        onMoveToIdeas: () => apisRef.current.arrangement.moveToIdeas(card.id),
        onMove: handleCardMove,
        // A card dragged across the divider into the other tree: D1 reports the
        // zone, D2 owns the meaning (promote / return + its own placement).
        onCardDrop: (id, zone) => {
          if (zone === "final") apisRef.current.arrangement.moveToFinal(id);
          else apisRef.current.arrangement.moveToIdeas(id);
        },
        layerCount: layerCountByBase[card.id] ?? 0,
        onOpenStack:
          card.type === "voice" || card.type === "hum"
            ? () => setStackBaseId(card.id)
            : undefined,
        onSuggestLine:
          card.type === "lyric" && !isViewer
            ? () => setLineSuggest({ cardId: card.id, originalLine: card.body, sectionLabel: card.section })
            : undefined,
        onAddToListenPath: () => apisRef.current.listenPath.toggleCard(card.id),
        listenIndex: listenQueue.includes(card.id) ? listenQueue.indexOf(card.id) : undefined,
        onMergeSelect:
          !isViewer && card.tree === "ideas" && !card.isDimmedReference
            ? () => apisRef.current.merge.toggleSelect(card.id)
            : undefined,
        mergeSelected: mergeSelection.includes(card.id),
        onEdit: !isViewer && !card.isDimmedReference ? () => setEditCardId(card.id) : undefined,
        onMore: () => setMoreCardId(card.id),
        finalOrder: card.tree === "final" ? finalOrder[card.id] : undefined,
        onRestore: !isViewer && card.isDimmedReference ? () => handleRestoreCard(card.id) : undefined,
        // "Now sounding" ring: the active listen-path step while playing, or
        // the take auditioning in compare mode.
        playing:
          (listenPlaying && listenQueue[listenStep] === card.id) ||
          comparePlayingId === card.id,
        // Weave mode: this card is the forming section (ribbon + meter), a
        // candidate (glowing lines), or a bystander (recedes, stays tappable).
        // D2 computed everything here; the card only paints. Handlers ride
        // apisRef so the map doesn't rebuild per callback identity.
        ...(weave.active
          ? weave.targetId === card.id
            ? {
                weaveTarget: weave.targetView ?? undefined,
                onWeaveTargetLineTap: (i: number) => apisRef.current.weave.openLab(i),
                weaveSectionName,
              }
            : weave.glow.has(card.id)
              ? {
                  weaveLines: weave.glow.get(card.id),
                  onWeaveLineTap: (i: number) => apisRef.current.weave.toggleLine(card.id, i),
                  weaveSectionName,
                }
              : { weaveFaded: true }
          : null),
      });
    }
    return map;
  }, [
    boardCards,
    isViewer,
    layerCountByBase,
    listenQueue,
    listenStep,
    listenPlaying,
    comparePlayingId,
    mergeSelection,
    finalOrder,
    handleCardMove,
    handleRestoreCard,
    weave.active,
    weave.targetId,
    weave.targetView,
    weave.glow,
    weaveSectionName,
  ]);

  const EMPTY_INTERACTIONS: CanvasCardInteractions = useMemo(
    () => ({
      onSelect: () => {},
      onMoveToFinal: () => {},
      onMoveToIdeas: () => {},
      onMove: () => {},
    }),
    [],
  );
  const getCardInteractions = useCallback(
    (card: CanvasCard): CanvasCardInteractions =>
      interactionsById.get(card.id) ?? EMPTY_INTERACTIONS,
    [interactionsById, EMPTY_INTERACTIONS],
  );

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
      // ID-hashed — the same warm hue this person's cards wear, on every
      // surface, on every device. One person, one color.
      color: getCreatorColor(profile.user_id).base,
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

  // The canvas-space bounding box of a set of cards (+ optionally the root
  // card), used by every semantic-nav framing move. Card footprints come from
  // canvasGeometry so the frame always matches what's painted.
  const boundsOfCards = useCallback(
    (list: CanvasCard[], includeRoot: boolean) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of list) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + cardWidth(c.type));
        maxY = Math.max(maxY, c.y + CARD_MIN_HEIGHT);
      }
      if (includeRoot || !Number.isFinite(minX)) {
        minX = Math.min(minX, ROOT_LEFT);
        minY = Math.min(minY, ROOT_TOP);
        maxX = Math.max(maxX, ROOT_LEFT + ROOT_WIDTH);
        maxY = Math.max(maxY, ROOT_TOP + ROOT_HEIGHT);
      }
      return { minX, minY, maxX, maxY };
    },
    [],
  );

  const viewportDims = useCallback(() => {
    const area = canvasAreaRef.current;
    return {
      vw: area?.clientWidth ?? window.innerWidth,
      vh: area?.clientHeight ?? window.innerHeight,
    };
  }, []);

  // Fit-to-view — the whole song (root + every card) framed in one calm move.
  // The primary "show me everything" gesture on a phone that can't see it all.
  const fitAll = useCallback(() => {
    const { vw, vh } = viewportDims();
    viewportApiRef.current?.fitTo(boundsOfCards(boardCards, true), vw, vh, 72, 560);
    setSelectedId(null);
  }, [boardCards, boundsOfCards, viewportDims]);

  // Tap a cluster → fan its members back onto the board and frame them; tap
  // again (or fit) to re-collapse. Framing reuses the semantic-nav fitTo.
  const handleExpandCluster = useCallback((clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) { next.delete(clusterId); return next; }
      next.add(clusterId);
      return next;
    });
    const flag = clusterFlagList.find((c) => c.id === clusterId);
    if (!flag) return;
    const ids = new Set(flag.cardIds);
    const members = boardCards.filter((c) => ids.has(c.id));
    if (members.length === 0) return;
    const { vw, vh } = viewportDims();
    // Wait a frame so the fanned-out cards exist before we frame them.
    requestAnimationFrame(() => viewportApiRef.current?.fitTo(boundsOfCards(members, false), vw, vh, 90, 520));
  }, [clusterFlagList, boardCards, boundsOfCards, viewportDims]);

  // One-tap navigation to a zone — frames that zone's cards (Ideas includes the
  // root it branches from). Primary mobile nav: the phone can't show both zones,
  // so one tap flies to and frames each.
  const goToZone = useCallback((zone: "ideas" | "final") => {
    setViewZone(zone);
    const { vw, vh } = viewportDims();
    const zoneCards = zone === "ideas" ? ideasCards : finalCards;
    if (zoneCards.length > 0) {
      viewportApiRef.current?.fitTo(boundsOfCards(zoneCards, zone === "ideas"), vw, vh, 72, 480);
      return;
    }
    // Empty zone: frame its column area (Ideas also shows the root card) so the
    // jump is never a leap into blank space.
    const colX = zone === "ideas" ? IDEAS_COLUMN_X : FINAL_COLUMN_X;
    const box = zone === "ideas"
      ? { minX: ROOT_LEFT, minY: ROOT_TOP, maxX: colX + CARD_WIDTH + 40, maxY: COLUMN_TOP + 420 }
      : { minX: colX - 40, minY: COLUMN_TOP - 60, maxX: colX + CARD_WIDTH + 40, maxY: COLUMN_TOP + 420 };
    viewportApiRef.current?.fitTo(box, vw, vh, 72, 480);
  }, [ideasCards, finalCards, boundsOfCards, viewportDims]);

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
  // If it landed inside a collapsed section cluster, fan that cluster open
  // first — a fresh capture must land VISIBLY, never fly to empty space where
  // its hidden card would be.
  useEffect(() => {
    if (!focusCardId) return;
    const card = cards.find((c) => c.id === focusCardId);
    if (!card) return;
    const owningCluster = clusterFlagList.find((cl) => cl.cardIds.includes(card.id));
    if (owningCluster && !expandedClusters.has(owningCluster.id)) {
      setExpandedClusters((prev) => new Set(prev).add(owningCluster.id));
    }
    jumpToCard(card);
    setFocusCardId(null);
  }, [focusCardId, cards, jumpToCard, clusterFlagList, expandedClusters]);

  // Playback follows the board: wire the listen path's step changes to the
  // same fly-to used everywhere else (declared as a ref because the hook
  // mounts before these callbacks exist).
  useEffect(() => {
    followPlaybackRef.current = (cardId: string) => {
      const target = cards.find((c) => c.id === cardId);
      if (target) jumpToCard(target);
    };
  }, [cards, jumpToCard]);

  // First frame: compose the opening shot around the root + Ideas zone once
  // the viewport API exists. The old fixed pan clipped the root card ~30px
  // off a 390px screen.
  const didInitialFrame = useRef(false);
  useEffect(() => {
    if (didInitialFrame.current || !viewportApiRef.current) return;
    didInitialFrame.current = true;
    goToZone("ideas");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write the idea's words into a card (title / body / section / meta).
  const handleSaveCardEdit = useCallback(
    (cardId: string, draft: { title: string; body: string; section: string; meta?: string }) => {
      const now = new Date().toISOString();
      let sectionChanged = false;
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== cardId) return c;
          sectionChanged = c.section !== draft.section;
          return {
            ...c,
            title: draft.title,
            body: draft.body,
            section: draft.section,
            meta: draft.meta ?? c.meta,
            updatedAt: now,
            lastActivityAt: now,
            updatedBy: profile?.user_id ?? c.updatedBy,
          };
        }),
      );
      // Server rows: the words travel to every device in the room.
      const sid = serverCardId(cardId);
      if (sid) {
        syncServer(async () => {
          await updateCanvasCard(sid, { label: draft.title, body: draft.body });
          if (sectionChanged) await setCardSection(sid, draft.section);
        }, cardId);
      }
      setCanvasStatus("Saved to this song.");
    },
    [profile?.user_id, syncServer],
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
        (c.createdBy || c.contributor) &&
        // Exclude anything I authored — ids first, names as the fallback
        // (merges credited "Me & Sarah" stay excluded).
        !isMine(c),
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
  }, [cards, isMine, jumpToCard]);

  // The recap digest, from the room's real cards: what other hands added,
  // latest first, each row a deep link to its card (COG Product 12).
  const recapItems = useMemo(
    () =>
      cards
        .filter((c) => !c.parentMemoId && (c.createdBy || c.contributor) && !isMine(c))
        .slice(0, 5)
        .map((c) => ({
          id: `recap-${c.id}`,
          text: `${c.contributor || "A co-writer"} added "${c.title}" · ${c.section}`,
          dotColor: c.accent || "var(--cog-gold)",
          targetCardId: c.id,
        })),
    [cards, isMine],
  );

  // Real activity for the People-layer "What changed" card — co-writers' cards,
  // latest first. Empty for a solo writer, so the layer shows an honest state
  // instead of fabricated bandmates.
  const layerActivity = useMemo(
    () =>
      cards
        .filter((c) => !c.parentMemoId && (c.createdBy || c.contributor) && !isMine(c))
        .slice(0, 4)
        .map((c) => ({
          id: `act-${c.id}`,
          actor: c.contributor.split(" ")[0] || c.contributor || "A co-writer",
          summary: `added "${c.title}"`,
          context: c.section,
          color: c.accent || "var(--cog-gold)",
        })),
    [cards, isMine],
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
            (c.createdBy || c.contributor) &&
            !isMine(c),
        )
        .map((c) => ({
          id: c.id,
          title: c.title,
          body: c.body,
          section: c.section,
          contributor: c.contributor || "A co-writer",
          accent: c.accent || "var(--cog-gold)",
          kind: KIND_BY_TYPE[c.type] ?? "Idea",
        })),
    [cards, isMine, KIND_BY_TYPE],
  );

  // Keep-in-Ideas: mark reviewed so it leaves the queue but stays on the board.
  const handleKeepInIdeas = useCallback((cardId: string) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, reviewed: true } : c)));
  }, []);

  // Not-this-one: archive from the board, with a calm Undo (never a hard
  // delete). Server rows get a TOMBSTONE so the next hydrate can't quietly
  // resurrect a decision the owner already made.
  const handleDismissReview = useCallback((cardId: string) => {
    let removed: CanvasCard | undefined;
    setCards((prev) => {
      removed = prev.find((c) => c.id === cardId);
      return prev.filter((c) => c.id !== cardId);
    });
    if (isServerCardId(cardId)) addTombstone(songId, cardId);
    toast("Idea set aside", {
      duration: 7000,
      action: {
        label: "Undo",
        onClick: () => {
          if (isServerCardId(cardId)) removeTombstone(songId, cardId);
          if (removed) setCards((prev) => [removed as CanvasCard, ...prev]);
        },
      },
    });
  }, [songId]);

  // Line suggestions (Feature 19) become their own review items, so a
  // "replace just this line" flows through the SAME owner accept/keep motion.
  // Two lanes, one list: carrier rows that traveled over the wire + this
  // device's local outbox (dedupe favors the server copy).
  const allSuggestions = useMemo(() => {
    const seen = new Set(serverSuggestions.map((s) => s.id));
    return [...serverSuggestions, ...lineSuggestions.filter((s) => !seen.has(s.id))];
  }, [serverSuggestions, lineSuggestions]);

  const suggestionReviewItems = useMemo(
    () =>
      allSuggestions.map((s) => ({
        id: s.id,
        title: "Line change",
        body: "",
        section: s.section,
        contributor: s.contributor || "A co-writer",
        accent: getCreatorColor(s.createdBy ?? s.contributor ?? s.id).base,
        kind: "Line suggestion",
        suggestion: { originalLine: s.originalLine, proposedLine: s.proposedLine },
      })),
    [allSuggestions],
  );

  // One unified queue: pending ideas + pending line suggestions.
  const reviewQueueItems = useMemo(
    () => [...suggestionReviewItems, ...pendingReview],
    [suggestionReviewItems, pendingReview],
  );

  // On-board marker for the same queue: a calm gold dot (never red) on each
  // card awaiting review, through the render layer's adornment slot.
  const pendingReviewIds = useMemo(
    () => new Set(pendingReview.map((p) => p.id)),
    [pendingReview],
  );
  const renderCardAdornment = useCallback(
    (card: CanvasCard) => {
      // ONE hoisted element (module scope) — a fresh <span> per call defeated
      // the memo of every card wearing a dot, on every stage render.
      const dot = canReview && !isViewer && pendingReviewIds.has(card.id) ? REVIEW_DOT : null;
      const amenSummary = amenSummaryByCard.get(card.id) ?? null;
      const isSelectedCard = selectedId === card.id;
      // Null for untouched, unselected cards — their memo stays intact.
      if (!dot && !amenSummary && !isSelectedCard) return null;
      return (
        <>
          {dot}
          <AmenChip
            summary={amenSummary}
            selected={isSelectedCard}
            cardTitle={card.title || "this idea"}
            onToggle={(kind) => toggleAmen(card.id, kind)}
          />
        </>
      );
    },
    [canReview, isViewer, pendingReviewIds, amenSummaryByCard, selectedId, toggleAmen],
  );

  // A decided suggestion leaves EVERY device's queue: server-lane rows are
  // deleted (their job is done — the decision lives in the card), local-lane
  // entries drop from the outbox.
  const resolveSuggestion = useCallback(
    (s: PendingLineSuggestion) => {
      if (s.fromServer) syncServer(() => deleteCanvasCard(s.id));
      setServerSuggestions((prev) => prev.filter((x) => x.id !== s.id));
      setLineSuggestions(removeLineSuggestion(songId, s.id));
    },
    [songId, syncServer],
  );

  // Accept a line suggestion → replace the target card's body AND write it
  // through — an accepted line used to silently revert on the next hydrate.
  const handleAcceptLine = useCallback((suggestionId: string) => {
    const s = allSuggestions.find((x) => x.id === suggestionId);
    if (!s) return;
    const now = new Date().toISOString();
    setCards((prev) =>
      prev.map((c) =>
        c.id === s.cardId
          ? { ...c, body: s.proposedLine, updatedAt: now, lastActivityAt: now, updatedBy: profile?.user_id ?? c.updatedBy }
          : c,
      ),
    );
    const sid = serverCardId(s.cardId);
    if (sid) syncServer(() => updateCanvasCard(sid, { body: s.proposedLine }), s.cardId);
    resolveSuggestion(s);
    showSavedMoment("Line updated", "Lyrics", s.section);
  }, [allSuggestions, profile?.user_id, syncServer, resolveSuggestion, showSavedMoment]);

  // Keep original → the line is untouched; the proposal is resolved.
  const handleKeepLine = useCallback((suggestionId: string) => {
    const s = allSuggestions.find((x) => x.id === suggestionId);
    if (s) resolveSuggestion(s);
  }, [allSuggestions, resolveSuggestion]);

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

  // One bottom action surface at a time: the creation dock steps aside whenever
  // a focused workflow owns the bottom (weave / merge / arrange / an expanded
  // listen path), so the songwriter never sees two competing action bars.
  const bottomWorkflowActive = isBottomWorkflowActive({
    weaveActive: weave.active,
    arranging: arrangement.arranging,
    mergeSelectionCount: merge.selection.length,
    listenPathExpanded: pathExpanded,
    listenPathQueueCount: listenPath.queue.length,
  });

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

        {/* Song title — the serif name of the room, given space to breathe.
            The six-chip layer strip is gone: it duplicated the SongTabBar in a
            220px scroll window and squeezed the title to 40px at 390px wide. */}
        <h1
          className="min-w-0 flex-1 text-center font-bold leading-tight truncate"
          style={{ fontSize: "clamp(17px, 4.6vw, 22px)", color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
        >
          {songTitle}
        </h1>

        {/* Just the crown mark — the full wordmark wrapped to three lines at
            390px and shoved the title off-center. */}
        <div className="flex flex-shrink-0 items-center" style={{ minWidth: 64, justifyContent: "flex-end" }} aria-hidden="true">
          <CrownMark size={22} color="#B5935A" />
        </div>
      </header>

      {/* Both rows wrap on narrow screens — the owner's "Review N" pill must
          never be pushed off the right edge of a 390px phone. */}
      <div className="relative z-30 mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p
            aria-live="polite"
            className="truncate rounded-full px-3 py-1.5 text-[11px] font-semibold"
            style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold)" }}
          >
            {canvasStatus}
          </p>
          {/* F14 one-tap metronome — consumes C4's engine via useCanvasMetronome */}
          <CanvasMetronomeToggle metronome={metronome} />
          {/* Pad — the metronome's sibling: a soft tonal bed in the song's key
              to hum over. Click keeps you in time; Pad keeps you in key. */}
          <Pad inheritedKey={songKeySignature} />
          <button
            type="button"
            onClick={() => setShowRecap(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70 active:scale-[0.94]"
            style={{ color: "var(--cog-warm-gray)" }}
            aria-label="What changed since you left"
          >
            <History size={16} strokeWidth={1.9} />
          </button>
          {canReview && !isViewer && reviewQueueItems.length > 0 && (
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
                // Honest when presence is the FALLBACK roster: these people
                // write here; they are not necessarily here right now.
                ? `${presenceStack.length} ${presenceStack.length === 1 ? "person writes" : "people write"} here — invite someone`
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
                      style={{ backgroundColor: GLORY.sage.base, animation: "cog-live-ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }}
                    />
                    <span
                      className="relative inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: GLORY.sage.base, border: "1.5px solid #FAFAF6" }}
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
          ideasCards={stageIdeasCards}
          finalCards={stageFinalCards}
          clusters={clusterData}
          onExpandCluster={handleExpandCluster}
          selectedId={selectedId}
          isDropActive={isDragOver}
          getCardInteractions={getCardInteractions}
          cardAdornment={renderCardAdornment}
          viewportApiRef={viewportApiRef}
          overlay={
            <>
              {/* Semantic nav — the PRIMARY way to move on a phone that can't
                  show both zones at once. One tap frames Ideas or Final; Fit
                  frames the whole song. Pinch/pan stay as a secondary path. */}
              <div
                className="pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5"
                style={{ top: 12 }}
              >
                <div
                  role="tablist"
                  aria-label="Jump between Ideas and Final"
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
                          backgroundColor: active ? (zone === "ideas" ? "var(--cog-gold)" : GLORY.sage.base) : "transparent",
                          color: active ? "#FFFFFF" : "var(--cog-warm-gray)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {zone === "ideas" ? "Ideas" : "Final"}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={fitAll}
                  className="pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-all duration-150 active:scale-[0.97]"
                  style={{ backgroundColor: "rgba(255,255,255,0.92)", border: "1px solid rgba(28,26,23,0.10)", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", backdropFilter: "blur(8px)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                  aria-label="Fit the whole song to view"
                >
                  <Maximize2 size={13} strokeWidth={2.2} />
                  Fit
                </button>
              </div>
              {showFirstRun && (
                <FirstActionPrompt
                  // "Tap to record" OPENS THE RECORDER — the chip used to
                  // create a silent text card wearing a fake waveform.
                  onHum={() => { void handleStartRecording(); }}
                  onLyric={() => addCard("lyric")}
                  onChords={() => addCard("chord")}
                />
              )}
              {!bottomWorkflowActive && <CreativeActionDock actions={dockActions} />}
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
                position: "fixed", inset: 0, zIndex: 799,
                backgroundColor: "rgba(26,26,26,0.5)",
                animation: "cog-fade-in 220ms ease",
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${LAYERS.find((l) => l.id === activeLayer)?.label ?? "Song"} panel`}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
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
                  // People — the REAL roster + real activity (lyrics/chords/
                  // notes layers forward to their real pages; the fabricated
                  // demo work-layers are gone from this path).
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
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* One bottom surface at a time: an active weave owns the bottom; an
          arrange session next; a merge selection hides the (collapsed) listen
          pill's expanded state; pills coexist quietly. */}
      {weave.active && weave.target && (
        <WeaveBar
          sectionName={weaveSectionName}
          lineCount={weave.targetView?.lines.length ?? 0}
          placedCount={weave.placedCount}
          candidateCount={weave.glow.size}
          onJumpToSection={() => {
            setViewZone("final"); // keep the zone chips honest after the fly
            jumpToCardId(weave.target!.id);
          }}
          onDone={weave.exit}
        />
      )}
      {weave.active && weave.labIndex != null && weave.targetView?.lines[weave.labIndex] != null && (
        <Suspense fallback={null}>
          <LineLabSheet
            line={weave.targetView.lines[weave.labIndex]}
            sectionName={weaveSectionName}
            corpus={weaveCorpus}
            onCommit={(newLine) => weave.swapTargetLine(weave.labIndex!, newLine)}
            onDismiss={weave.closeLab}
          />
        </Suspense>
      )}
      {!arrangement.arranging && !weave.active && (
        <MergeActionBar
          selection={merge.selection}
          cards={boardCards}
          onRemove={merge.removeFromSelection}
          onMerge={merge.executeMerge}
          onClear={merge.clearSelection}
          onSwap={merge.swapSelection}
        />
      )}
      {!arrangement.arranging && !weave.active && merge.selection.length === 0 && (
        <ListenPathBar
          queue={listenPath.queue}
          cards={boardCards}
          step={listenPath.step}
          playing={listenPath.playing}
          collapsed={!pathExpanded}
          onExpand={() => setPathExpanded(true)}
          onCollapse={() => setPathExpanded(false)}
          onPlayPause={listenPath.playPause}
          onPrev={listenPath.prev}
          onNext={listenPath.next}
          onStepTo={listenPath.goTo}
          onRemove={listenPath.removeCard}
          onClear={listenPath.clear}
          onSave={listenPath.save}
        />
      )}
      {!weave.active && (
      <FinalArrangementBar
        arranging={arrangement.arranging}
        canArrange={arrangement.canArrange}
        canPlay={arrangement.orderedFinalCards.length >= 2}
        orderedCards={arrangement.orderedFinalCards}
        onBegin={arrangement.begin}
        onMove={arrangement.moveBy}
        onSave={arrangement.save}
        onCancel={arrangement.cancel}
        onPlayFinal={() => {
          setPathExpanded(true);
          listenPath.playAll(arrangement.orderedFinalCards.map((c) => c.id));
        }}
      />
      )}
      {compare.pair && (
        <CompareModeSheet
          cards={compare.pair}
          playingId={compare.playingId}
          onTogglePlay={compare.togglePlay}
          onSwitchPlay={compare.switchPlay}
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
          metronomeSlot={<MetronomeStrip bpm={songBpm} beatsPerBar={beatsPerBar} />}
          countingIn={countingIn}
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

      {/* The Memo Sheet — ONE sheet for both relationships: tries (takes,
          one keeper — Section A) and layers (the stack that plays together —
          Section B). Replaces StackSheet (retired). Card ids ARE memo ids
          (temp ids swap to real memo ids on upload), so the sheet's takes +
          server-truth reads are correct. */}
      {stackBaseId && (() => {
        const base = cards.find((c) => c.id === stackBaseId);
        if (!base) return null;
        const stackLayers = cards.filter((c) => c.parentMemoId === stackBaseId);
        return (
          <MemoSheet
            base={toStackView(base)}
            layers={stackLayers.map(toStackView)}
            songId={isDemoRoom ? undefined : songId}
            bpm={songBpm}
            canRecordOver={!isViewer}
            onRecordOver={handleRecordOver}
            onOpenTries={(memoId) => {
              // The tries flow lives in the polished TakeMiniPlayer —
              // close the sheet first so z-order stays sane.
              setStackBaseId(null);
              setTakesFor({ id: memoId, title: base.title, peaks: base.waveformPeaks ?? null });
            }}
            onClose={() => setStackBaseId(null)}
            tempoSlot={
              <TempoRow
                bpm={songBpm}
                canEdit={canEditTempo}
                onSaveTempo={saveTempo}
                countInOn={countInOn}
                onCountInToggle={toggleCountIn}
              />
            }
          />
        );
      })()}

      {/* The tries player (F15) — keeper / rename / archive / swipe-compare. */}
      {takesFor && (
        <TakeMiniPlayer
          memoId={takesFor.id}
          memoTitle={takesFor.title}
          fallbackPeaks={takesFor.peaks}
          onClose={() => setTakesFor(null)}
        />
      )}

      {/* What Changed recap sheet */}
      {showRecap && (
        <WhatChangedRecapSheet
          songId={songId}
          items={recapItems}
          onJumpToCard={jumpToCardId}
          onDismiss={() => setShowRecap(false)}
          // The gold CTA opens the real review queue when there is one to
          // open; otherwise the sheet renders an honest "Got it".
          onReview={
            canReview && !isViewer && reviewQueueItems.length > 0
              ? () => setShowReviewQueue(true)
              : undefined
          }
        />
      )}

      {/* Return-visit recap — auto-shows once for a returning collaborator
          with real activity-feed changes since their last visit (Product 12) */}
      {!showRecap && <CanvasRecapGate songId={songId} extraEvents={amenEvents} />}

      {/* Fresh-from-invite welcome: "You joined as [role]" — once, on arrival. */}
      {isInviteArrival && <RoleToast role={invitedRole} />}

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
              initial={{ title: c.title, body: c.body, section: c.section, meta: c.meta || undefined }}
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
        // WEAVE — compose this final section line-by-line from the Ideas tree
        // (the star action for a forming section; docs/WEAVE-CONTRACT.md).
        if ((c.type === "lyric" || c.type === "section") && c.tree === "final" && !isViewer && !c.isDimmedReference) {
          actions.push({
            id: "weave",
            label: "Weave lines into this section",
            onClick: () => {
              weave.enter(c.id);
              goToZone("ideas");
            },
          });
        }
        if (c.type === "lyric" && !isViewer) {
          actions.push({
            id: "suggest",
            label: "Suggest a line",
            onClick: () => setLineSuggest({ cardId: c.id, originalLine: c.body, sectionLabel: c.section }),
          });
        }
        // F21 — audition this idea against its same-section variant, or offer
        // the paved path to CREATE the variant when none exists yet.
        if (!isViewer && compare.canCompare(c)) {
          actions.push({
            id: "compare",
            label: "Compare A vs B",
            onClick: () => compare.open(c.id),
          });
        } else if (!isViewer && c.tree === "ideas" && !c.isDimmedReference) {
          actions.push({
            id: "variant",
            label: "Write another take to compare",
            tone: "muted",
            onClick: () => handleNewVariant(c.id),
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
            // Local-first, never lost: the suggestion lands in the outbox
            // immediately; when its target is a server card, it then TRAVELS
            // as a canvas_cards carrier row so the owner's phone receives it.
            const local: PendingLineSuggestion = {
              id: crypto.randomUUID(),
              songId,
              cardId: lineSuggest.cardId,
              originalLine: lineSuggest.originalLine,
              proposedLine: text,
              contributor: currentUserName,
              section: lineSuggest.sectionLabel,
              createdAt: Date.now(),
            };
            setLineSuggestions(addLineSuggestion(local));
            const targetSid = serverCardId(local.cardId);
            if (!isDemoRoom && targetSid) {
              void (async () => {
                try {
                  const row = await createCanvasCard({
                    song_id: songId,
                    kind: "idea",
                    section_kind: SUGGESTION_SECTION_KIND,
                    parent_card_id: targetSid,
                    label: "Line suggestion",
                    body: encodeSuggestion({
                      originalLine: local.originalLine,
                      proposedLine: local.proposedLine,
                      section: local.section,
                      contributor: currentUserName,
                    }),
                    created_by: profile?.user_id,
                  });
                  // The wire owns it now — retire the local copy so the owner
                  // (or this user reviewing solo) never sees it twice.
                  setLineSuggestions(removeLineSuggestion(songId, local.id));
                  setServerSuggestions((prev) => [
                    { ...local, id: row.id, fromServer: true, createdBy: profile?.user_id },
                    ...prev.filter((x) => x.id !== row.id),
                  ]);
                } catch {
                  /* stays in the local outbox — never lost */
                }
              })();
            }
          }}
          onKeep={() => setLineSuggest(null)}
          onDismiss={() => setLineSuggest(null)}
        />
      )}

      {/* Coach marks yield to an active weave — one focused mode at a time. */}
      {featuresTour.visible && !weave.active && (
        <CoachMark
          targetRef={featuresTourRef}
          lead="Every part of your song."
          body="Lyrics, voice, chords, notes, and your people — each has its own space down here. Tap any to open it."
          onGotIt={featuresTour.gotIt}
          onSkip={featuresTour.skip}
          isFinal={featuresTour.isFinal}
        />
      )}

      {ideasTour.visible && !weave.active && (
        <CoachMark
          targetRef={ideasTourRef}
          lead="Two spaces, one song."
          body="Explore ideas on the left. Tap a keeper, then → Final — or drag it across."
          onGotIt={ideasTour.gotIt}
          onSkip={ideasTour.skip}
          isFinal={ideasTour.isFinal}
        />
      )}

      {inviteTour.visible && !weave.active && (
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
