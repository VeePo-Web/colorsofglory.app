import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  CornerLeftUp,
  CornerRightDown,
  Loader2,
  Merge,
  Pause,
  Play,
  Scissors,
  Trash2,
} from "lucide-react";

import {
  requestTranscript,
  pollTranscriptUntilReady,
  type TranscriptBlock,
} from "@/integrations/cog/transcript";
import { getTakeSignedUrl } from "@/integrations/cog/takes";
import { commitTakeToCanvas } from "@/integrations/cog/canvas";
import { fetchPassage } from "@/integrations/cog/scripture";
import { formatDuration } from "@/lib/voice/audioFormat";
import { audioCache } from "@/lib/voice/audioCache";
import type { TranscriptBlock as LiveBlock, SectionMarker } from "@/lib/capture/transcriptModel";
import {
  confirmCandidateSplit,
  moveCaretLine,
  splitBlockAtChar,
} from "@/lib/capture/reviewEdits";
import ReviewAudioPlayer, { type ReviewAudioPlayerHandle } from "./ReviewAudioPlayer";
import type { PendingBlock } from "./CaptureSheet";

type EditableBlock = {
  id: string;
  kind: TranscriptBlock["kind"];
  section_kind: string | null;
  label: string;
  text: string;
  start_ms: number;
  end_ms: number;
};

interface ReviewSheetProps {
  open: boolean;
  takeId: string | null;
  songId: string | null;
  songTitle?: string;
  storagePath?: string | null;
  durationMs: number;
  pendingBlocks: PendingBlock[];
  /**
   * The on-device deterministic split of this take (live regex path). Shown
   * INSTANTLY while the server transcript is in flight, and the guaranteed
   * offline fallback when AI fails or credits are exhausted — the review is
   * never a dead end and never loses the spoken structure.
   */
  liveBlocks?: LiveBlock[];
  /**
   * Low-confidence voice markers (the Dragon command-vs-content flags). Never
   * applied silently — each is a one-tap "Split here / Dismiss" suggestion.
   */
  candidateMarkers?: SectionMarker[];
  onClose: () => void;
  /**
   * Fired after a successful canvas commit. Parent uses this to show the
   * CommitRibbon and suppress the older toast+autonavigate fallback.
   */
  onCommitted?: (info: { songId: string; songTitle?: string; blockCount: number }) => void;
}

const KIND_LABELS: Record<EditableBlock["kind"], string> = {
  section: "Section",
  lyrics: "Lyrics",
  chords: "Chords",
  scripture: "Scripture",
  idea: "Idea",
};

/** The guaranteed-editable fallback block — review must never be a dead end. */
function manualIdeaBlock(): EditableBlock {
  return {
    id: `manual-${Date.now()}`,
    kind: "idea",
    section_kind: null,
    label: "Idea",
    text: "",
    start_ms: 0,
    end_ms: 0,
  };
}

/**
 * Convert the on-device deterministic split into editable blocks. Body text
 * already excludes the announcement words (contentStartMs strips them), and
 * each block carries its time range so per-section audio clips work even on
 * the offline path.
 */
function fromLiveBlocks(live: LiveBlock[], takeDurationMs: number): EditableBlock[] {
  const withWords = live.filter((b) => b.words.length > 0 || b.text.trim().length > 0);
  return withWords.map((b, idx) => {
    const startMs = b.marker.contentStartMs ?? b.marker.atMs;
    const next = withWords[idx + 1];
    const endMs = next ? next.marker.atMs : Math.max(takeDurationMs, startMs);
    const isSection = b.marker.kind !== "unlabeled";
    return {
      id: `live-${idx}-${b.id}`,
      kind: isSection ? "lyrics" : "idea",
      section_kind: isSection ? b.marker.kind : null,
      label: b.marker.label,
      text: b.text,
      start_ms: startMs,
      end_ms: endMs,
    } as EditableBlock;
  });
}

/**
 * A sung take transcribes sparsely — very few words for its length. The words
 * may be rough, but the audio is perfect and attached; say so, gently.
 */
function looksSung(blocks: EditableBlock[], durationMs: number): boolean {
  if (durationMs < 8000) return false;
  const chars = blocks.reduce((n, b) => n + b.text.trim().length, 0);
  return chars > 0 && chars / (durationMs / 1000) < 1.2;
}

const ReviewSheet = ({
  open,
  takeId,
  songId,
  songTitle,
  storagePath,
  durationMs,
  pendingBlocks,
  liveBlocks,
  candidateMarkers,
  onClose,
  onCommitted,
}: ReviewSheetProps) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [candidates, setCandidates] = useState<SectionMarker[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playerRef = useRef<ReviewAudioPlayerHandle | null>(null);
  // The server transcript is authoritative — but never over the user's hands.
  // Once they touch a block, the AI result must not stomp their edits.
  const dirtyRef = useRef(false);
  const caretRef = useRef<{ blockId: string; pos: number }>({ blockId: "", pos: 0 });
  const splitSeq = useRef(0);
  const makeBlockId = () => {
    splitSeq.current += 1;
    return `split-${Date.now()}-${splitSeq.current}`;
  };

  // Merge pending side-rail blocks into the editable list as soon as the sheet opens.
  const seedBlocks = useMemo<EditableBlock[]>(
    () =>
      pendingBlocks.map((b, idx) => ({
        id: b.id,
        kind: b.kind,
        section_kind: b.section_kind,
        label: b.label,
        text: b.text,
        start_ms: b.start_ms ?? idx,
        end_ms: b.end_ms ?? (b.start_ms ?? idx),
      })),
    [pendingBlocks],
  );

  // Kick off transcription + signed url when opened.
  useEffect(() => {
    if (!open || !takeId) return;
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    dirtyRef.current = false;
    setPlayingClipId(null);
    setCandidates(candidateMarkers ?? []);
    // Hybrid pipeline, client half: the deterministic on-device split shows
    // INSTANTLY (spoken "verse/chorus/bridge" already structured), while the
    // authoritative server transcript refines it when it lands.
    const liveSeed = liveBlocks ? fromLiveBlocks(liveBlocks, durationMs) : [];
    setBlocks([...liveSeed, ...seedBlocks].sort((a, b) => a.start_ms - b.start_ms));

    (async () => {
      // Play from the LOCAL blob first — the take was just recorded and cached
      // under its id, so review starts with listening instantly, offline, with no
      // cloud round-trip. Fall back to a cloud signed URL only if there's no local
      // copy (e.g. a reopened take from a prior session).
      const localBlob = await audioCache.get(takeId);
      if (localBlob && !cancelled) {
        const localUrl = URL.createObjectURL(localBlob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = localUrl;
        setAudioUrl(localUrl);
      } else if (storagePath) {
        try {
          const url = await getTakeSignedUrl(storagePath);
          if (!cancelled) setAudioUrl(url);
        } catch {
          /* non-fatal */
        }
      }

      // Kick transcription. If it 402s or 429s, surface and skip but keep editing.
      try {
        await requestTranscript(takeId);
      } catch (e) {
        const raw = (e as { message?: string })?.message ?? "";
        if (raw.includes("402") || raw.includes("credits_exhausted")) {
          if (!cancelled) {
            toast.error("AI credits exhausted", { description: "Add credits in workspace settings." });
          }
        } else if (raw.includes("429") || raw.includes("rate_limited")) {
          if (!cancelled) {
            toast.message("Transcription busy", { description: "Try again in a moment." });
          }
        }
      }

      const row = await pollTranscriptUntilReady(takeId, { intervalMs: 1200, timeoutMs: 45_000 });
      if (cancelled) return;

      const hasClientContent = liveSeed.length > 0 || seedBlocks.length > 0;
      if (row?.transcript_status === "ready" && row.transcript_json?.blocks?.length) {
        const fromAi: EditableBlock[] = row.transcript_json.blocks.map((b) => ({
          id: b.id,
          kind: b.kind,
          section_kind: b.section_kind ?? null,
          label: b.label ?? KIND_LABELS[b.kind] ?? "Idea",
          text: b.text ?? "",
          start_ms: b.start_ms ?? 0,
          end_ms: b.end_ms ?? 0,
        }));
        // The server transcript is AUTHORITATIVE on commit — it replaces the
        // instant on-device preview. Unless the writer already edited: their
        // hands beat the machine, always.
        if (dirtyRef.current) {
          toast.message("Full transcript ready", {
            description: "Kept your edits — the AI result stayed out of the way.",
          });
        } else {
          setBlocks(
            [...fromAi, ...seedBlocks].sort((a, b) => a.start_ms - b.start_ms),
          );
        }
        setStatus("ready");
      } else if (row?.transcript_status === "failed") {
        setErrorMsg(row.transcript_error ?? "Transcription failed");
        setStatus("failed");
        if (!hasClientContent) {
          // Always give the user at least one editable block so they can save manually.
          setBlocks([manualIdeaBlock()]);
        }
        // With client content, the deterministic split already on screen IS
        // the fallback — spoken structure survives AI failure untouched.
      } else {
        // Timed out / still processing / row unreadable — NEVER a dead end.
        // The side rail sits BEHIND this sheet, so "tap a rail tool" is not an
        // option here: the on-device split (if any) stays editable; otherwise
        // seed the manual block and let the writer type while the audio stays
        // saved with the take.
        setStatus("ready");
        if (!hasClientContent) {
          setBlocks([manualIdeaBlock()]);
          toast.message("Transcription is taking longer than usual", {
            description: "Write the idea out now — your audio is already saved with this take.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [open, takeId, storagePath, seedBlocks, liveBlocks, candidateMarkers, durationMs]);

  const updateBlock = (id: string, patch: Partial<EditableBlock>) => {
    dirtyRef.current = true;
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const deleteBlock = (id: string) => {
    dirtyRef.current = true;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    dirtyRef.current = true;
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  /** Fold this block's text into the previous block; preserves the older label. */
  const mergeUp = (id: string) => {
    dirtyRef.current = true;
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev;
      const copy = prev.slice();
      const target = copy[idx - 1];
      const incoming = copy[idx];
      copy[idx - 1] = {
        ...target,
        text: [target.text, incoming.text].filter(Boolean).join("\n"),
        end_ms: Math.max(target.end_ms, incoming.end_ms),
      };
      copy.splice(idx, 1);
      return copy;
    });
  };

  /** Split at the caret (snapped to a word boundary) — one-gesture un-merge. */
  const splitBlock = (id: string) => {
    dirtyRef.current = true;
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (!block) return prev;
      const caret =
        caretRef.current.blockId === id
          ? caretRef.current.pos
          : Math.floor(block.text.length / 2);
      const next = splitBlockAtChar(prev, id, caret, makeBlockId);
      if (next === prev) {
        toast.message("Place the cursor where the split should happen.");
      }
      return next;
    });
  };

  /** Send the caret's line into the previous/next block — "this line belongs to the chorus". */
  const sendLine = (id: string, dir: -1 | 1) => {
    dirtyRef.current = true;
    setBlocks((prev) => {
      const caret = caretRef.current.blockId === id ? caretRef.current.pos : 0;
      return moveCaretLine(prev, id, caret, dir);
    });
  };

  /** One-tap confirm for a flagged low-confidence marker. */
  const confirmCandidate = (candidate: SectionMarker) => {
    dirtyRef.current = true;
    setBlocks((prev) =>
      confirmCandidateSplit(
        prev,
        { atMs: candidate.atMs, label: candidate.label, kind: candidate.kind },
        makeBlockId,
      ),
    );
    setCandidates((prev) => prev.filter((c) => c !== candidate));
  };

  const dismissCandidate = (candidate: SectionMarker) => {
    setCandidates((prev) => prev.filter((c) => c !== candidate));
  };

  /** Play just this block's slice of the take (word-timestamp bounded). */
  const toggleClip = (b: EditableBlock) => {
    if (playingClipId === b.id) {
      playerRef.current?.stopClip();
      return;
    }
    playerRef.current?.playClip(b.start_ms / 1000, b.end_ms / 1000);
    setPlayingClipId(b.id);
  };

  /**
   * Attach the verse text for a spoken scripture reference — through H1's
   * scripture contract (fetchPassage), never a fork of it.
   */
  const [fetchingVerseId, setFetchingVerseId] = useState<string | null>(null);
  const attachVerseText = async (b: EditableBlock) => {
    const reference = b.label.trim();
    if (!reference) return;
    setFetchingVerseId(b.id);
    try {
      const passage = await fetchPassage(reference);
      updateBlock(b.id, {
        label: passage.canonical,
        text: passage.verses.map((v) => v.text.trim()).join(" "),
      });
    } catch {
      toast.message("Couldn't fetch that passage", {
        description: "Check the reference — or paste the verse text in.",
      });
    } finally {
      setFetchingVerseId(null);
    }
  };

  const handleCommit = async () => {
    if (!takeId || !songId) return;
    const usable = blocks.filter((b) => b.text.trim().length > 0 || b.kind === "section");
    if (usable.length === 0) {
      toast.message("Nothing to save yet", { description: "Add a block or wait for the transcript." });
      return;
    }
    setCommitting(true);
    try {
      const result = await commitTakeToCanvas({
        take_id: takeId,
        song_id: songId,
        blocks: usable.map((b) => ({
          kind: b.kind,
          section_kind: b.section_kind,
          label: b.label,
          text: b.text,
          start_ms: b.start_ms,
          end_ms: b.end_ms,
        })),
      });
      if (onCommitted) {
        // Parent handles the ribbon + navigation.
        onCommitted({
          songId: result.song_id,
          songTitle,
          blockCount: usable.length,
        });
      } else {
        toast.success("Added to canvas", {
          description: `${usable.length} ${usable.length === 1 ? "block" : "blocks"} saved.`,
        });
        onClose();
        navigate(`/songs/${result.song_id}/canvas?from=capture`);
      }
    } catch (e) {
      const raw = (e as { message?: string })?.message ?? "";
      if (raw.includes("song_limit_reached") || raw.includes("402")) {
        toast.error("Your first song is safe", { description: "Upgrade to start the next one." });
        navigate("/upgrade?source=song_gate_free");
      } else if (raw.includes("forbidden")) {
        toast.error("You don't have access to this song", {
          description: "Ask the owner to invite you as a collaborator, or file this idea into a song you own.",
        });
      } else if (raw.includes("take_not_found")) {
        toast.error("This take couldn't be found", {
          description: "It may still be uploading — try again in a moment.",
        });
      } else if (raw.includes("unauthorized") || raw.includes("401")) {
        toast.error("Please sign in again", { description: "Your session expired." });
      } else {
        toast.error("Could not save to canvas", { description: raw.slice(0, 140) || "Please try again." });
      }
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !committing && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t flex flex-col p-0"
        style={{
          background: "var(--cog-cream-light, #faf7f2)",
          borderColor: "rgba(184,149,58,0.30)",
          height: "92dvh",
        }}
      >
        <SheetHeader className="text-left px-5 pt-5 pb-3">
          <SheetTitle style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
            Review your take
          </SheetTitle>
          <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
            {songTitle ? `${songTitle} · ` : ""}{formatDuration(durationMs)}
          </p>
          {/* Instant reassurance: the recording uploaded the moment it stopped,
              so it's already attached to the song. The work below is optional
              refinement — the idea is never lost waiting on the transcript. */}
          <div
            className="flex items-center gap-2 mt-2 rounded-full self-start"
            style={{
              padding: "5px 12px",
              background: "rgba(122,150,90,0.12)",
              border: "1px solid rgba(122,150,90,0.35)",
              color: "#4f6b34",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Check size={14} strokeWidth={2.5} />
            <span>Saved to {songTitle ?? "your song"} — refining is optional</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-3" style={{ scrollbarGutter: "stable" }}>
          {audioUrl && (
            <ReviewAudioPlayer
              ref={playerRef}
              src={audioUrl}
              durationMs={durationMs}
              onClipStop={() => setPlayingClipId(null)}
            />
          )}

          {/* Low-confidence spoken markers — flagged, never silently applied.
              One tap resolves each: Split here, or dismiss as a lyric. */}
          {candidates.length > 0 && (
            <div
              className="rounded-2xl px-4 py-3 mb-3"
              style={{
                background: "rgba(184,149,58,0.08)",
                border: "1px dashed rgba(184,149,58,0.45)",
              }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--cog-warm-gray)" }}>
                Heard a section word mid-phrase — split here?
              </p>
              <div className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <div key={`${c.atMs}-${c.label}`} className="flex items-center gap-2">
                    <span
                      className="text-sm flex-1"
                      style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
                    >
                      “{c.label}” · {formatDuration(c.atMs)}
                    </span>
                    <button
                      type="button"
                      onClick={() => confirmCandidate(c)}
                      className="text-xs font-bold rounded-full px-3 py-1.5 transition-transform active:scale-95"
                      style={{ background: "var(--cog-gold)", color: "#fff", border: "none" }}
                    >
                      Split here
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissCandidate(c)}
                      className="text-xs font-semibold rounded-full px-3 py-1.5"
                      style={{
                        background: "transparent",
                        color: "var(--cog-warm-gray)",
                        border: "1px solid var(--cog-border)",
                      }}
                    >
                      It's a lyric
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sung takes transcribe roughly — reassure and coach, never shame. */}
          {status !== "loading" && looksSung(blocks, durationMs) && (
            <div
              className="rounded-2xl px-4 py-3 mb-3 text-sm"
              style={{
                background: "rgba(184,149,58,0.07)",
                border: "1px solid rgba(184,149,58,0.22)",
                color: "var(--cog-warm-gray)",
              }}
            >
              Sounds like this one was sung — the words may be rough, but your
              audio is perfect and attached. Tip: speaking the section names
              (“verse”, “chorus”) still structures a sung take.
            </div>
          )}

          {status === "loading" && (
            <div
              className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-3"
              style={{
                background: "rgba(184,149,58,0.08)",
                border: "1px solid rgba(184,149,58,0.25)",
                color: "var(--cog-warm-gray)",
              }}
            >
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Listening back to your take…</span>
            </div>
          )}

          {status === "failed" && (
            <div
              className="rounded-2xl px-4 py-3 mb-3 text-sm"
              style={{
                background: "rgba(181, 74, 48, 0.08)",
                border: "1px solid rgba(181, 74, 48, 0.25)",
                color: "#7a3422",
              }}
            >
              Transcription couldn't finish. You can still edit and save blocks manually.
              {errorMsg && (
                <p className="opacity-70 mt-1" style={{ fontSize: 12 }}>{errorMsg}</p>
              )}
            </div>
          )}

          {blocks.length === 0 && status === "ready" && (
            <p
              className="text-center text-sm py-8"
              style={{ color: "var(--cog-muted)" }}
            >
              No blocks left — your audio is still saved with this take.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {blocks.map((b, idx) => (
              <article
                key={b.id}
                className="rounded-2xl p-3"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(184,149,58,0.30)",
                  boxShadow: "0 2px 8px rgba(28,26,23,0.04)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={b.kind}
                    aria-label="Block type"
                    onChange={(e) =>
                      updateBlock(b.id, {
                        kind: e.target.value as EditableBlock["kind"],
                      })
                    }
                    className="text-xs font-semibold rounded-full px-2 py-1 bg-transparent"
                    style={{
                      color: "var(--cog-gold)",
                      border: "1px solid rgba(184,149,58,0.40)",
                    }}
                  >
                    {(Object.keys(KIND_LABELS) as EditableBlock["kind"][]).map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>
                  <Input
                    value={b.label}
                    aria-label="Block label"
                    onChange={(e) => updateBlock(b.id, { label: e.target.value })}
                    className="flex-1 h-8 text-sm"
                    style={{ fontFamily: "var(--font-display)" }}
                  />
                  <div className="flex items-center" style={{ gap: 2 }}>
                    <button
                      type="button"
                      aria-label="Move block up"
                      disabled={idx === 0}
                      onClick={() => moveBlock(b.id, -1)}
                      className="p-1.5 rounded-full transition-colors"
                      style={{ color: idx === 0 ? "var(--cog-muted)" : "var(--cog-warm-gray)", opacity: idx === 0 ? 0.4 : 1 }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move block down"
                      disabled={idx === blocks.length - 1}
                      onClick={() => moveBlock(b.id, 1)}
                      className="p-1.5 rounded-full transition-colors"
                      style={{
                        color: idx === blocks.length - 1 ? "var(--cog-muted)" : "var(--cog-warm-gray)",
                        opacity: idx === blocks.length - 1 ? 0.4 : 1,
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                    {idx > 0 && (
                      <button
                        type="button"
                        aria-label="Merge into previous block"
                        onClick={() => mergeUp(b.id)}
                        className="p-1.5 rounded-full transition-colors"
                        style={{ color: "var(--cog-warm-gray)" }}
                      >
                        <Merge size={14} />
                      </button>
                    )}
                    <button
                    type="button"
                    aria-label="Delete block"
                    onClick={() => deleteBlock(b.id)}
                    className="p-2 rounded-full transition-colors"
                    style={{ color: "var(--cog-muted)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <Textarea
                  value={b.text}
                  onChange={(e) => {
                    caretRef.current = { blockId: b.id, pos: e.target.selectionStart ?? 0 };
                    updateBlock(b.id, { text: e.target.value });
                  }}
                  onSelect={(e) => {
                    caretRef.current = {
                      blockId: b.id,
                      pos: (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                    };
                  }}
                  placeholder="Edit this block…"
                  rows={Math.max(2, Math.min(8, b.text.split("\n").length + 1))}
                  className="resize-none text-sm"
                />
                <div className="flex items-center gap-1 mt-1.5">
                  {audioUrl && b.end_ms > b.start_ms + 300 && (
                    <button
                      type="button"
                      aria-label={playingClipId === b.id ? "Stop this part" : "Play just this part"}
                      onClick={() => toggleClip(b)}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-transform active:scale-95"
                      style={{
                        background: playingClipId === b.id ? "var(--cog-gold)" : "rgba(184,149,58,0.10)",
                        color: playingClipId === b.id ? "#fff" : "var(--cog-gold)",
                        border: "1px solid rgba(184,149,58,0.35)",
                      }}
                    >
                      {playingClipId === b.id ? <Pause size={12} /> : <Play size={12} />}
                      This part
                    </button>
                  )}
                  {b.kind === "scripture" && (
                    <button
                      type="button"
                      onClick={() => void attachVerseText(b)}
                      disabled={fetchingVerseId === b.id}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-transform active:scale-95"
                      style={{
                        background: "rgba(184,149,58,0.10)",
                        color: "var(--cog-gold)",
                        border: "1px solid rgba(184,149,58,0.35)",
                        opacity: fetchingVerseId === b.id ? 0.6 : 1,
                      }}
                    >
                      {fetchingVerseId === b.id ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
                      Attach verse
                    </button>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    aria-label="Split block at cursor"
                    onClick={() => splitBlock(b.id)}
                    className="p-1.5 rounded-full"
                    style={{ color: "var(--cog-warm-gray)" }}
                  >
                    <Scissors size={13} />
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      aria-label="Send this line to the previous block"
                      onClick={() => sendLine(b.id, -1)}
                      className="p-1.5 rounded-full"
                      style={{ color: "var(--cog-warm-gray)" }}
                    >
                      <CornerLeftUp size={13} />
                    </button>
                  )}
                  {idx < blocks.length - 1 && (
                    <button
                      type="button"
                      aria-label="Send this line to the next block"
                      onClick={() => sendLine(b.id, 1)}
                      className="p-1.5 rounded-full"
                      style={{ color: "var(--cog-warm-gray)" }}
                    >
                      <CornerRightDown size={13} />
                    </button>
                  )}
                  {b.start_ms > 0 && (
                    <span className="text-xs ml-1" style={{ color: "var(--cog-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {formatDuration(b.start_ms)}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div
          className="px-5 py-3 border-t"
          style={{
            borderColor: "rgba(184,149,58,0.25)",
            background: "var(--cog-cream-light, #faf7f2)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          }}
        >
          <Button
            type="button"
            onClick={handleCommit}
            disabled={committing || !takeId || !songId}
            className="w-full h-12 rounded-2xl text-base font-semibold"
            style={{
              background: "var(--cog-gold)",
              color: "var(--cog-cream-light, #faf7f2)",
              opacity: committing ? 0.7 : 1,
            }}
          >
            {committing ? "Adding to song…" : "Add to song"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReviewSheet;