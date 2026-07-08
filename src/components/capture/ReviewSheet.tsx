import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Loader2, Merge, Trash2 } from "lucide-react";

import {
  requestTranscript,
  pollTranscriptUntilReady,
  type TranscriptBlock,
} from "@/integrations/cog/transcript";
import { getTakeSignedUrl } from "@/integrations/cog/takes";
import { commitTakeToCanvas } from "@/integrations/cog/canvas";
import { formatDuration } from "@/lib/voice/audioFormat";
import { audioCache } from "@/lib/voice/audioCache";
import ReviewAudioPlayer from "./ReviewAudioPlayer";
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

const ReviewSheet = ({
  open,
  takeId,
  songId,
  songTitle,
  storagePath,
  durationMs,
  pendingBlocks,
  onClose,
  onCommitted,
}: ReviewSheetProps) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

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
    setBlocks(seedBlocks);

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
        // Merge AI blocks with any side-rail pending blocks, sorted by start_ms.
        setBlocks(
          [...fromAi, ...seedBlocks].sort((a, b) => a.start_ms - b.start_ms),
        );
        setStatus("ready");
      } else if (row?.transcript_status === "failed") {
        setErrorMsg(row.transcript_error ?? "Transcription failed");
        setStatus("failed");
        if (seedBlocks.length === 0) {
          // Always give the user at least one editable block so they can save manually.
          setBlocks([manualIdeaBlock()]);
        }
      } else {
        // Timed out / still processing / row unreadable — NEVER a dead end.
        // The side rail sits BEHIND this sheet, so "tap a rail tool" is not an
        // option here: seed the same manual block the failed path guarantees,
        // and let the writer type while the audio stays saved with the take.
        setStatus("ready");
        if (seedBlocks.length === 0) {
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
  }, [open, takeId, storagePath, seedBlocks]);

  const updateBlock = (id: string, patch: Partial<EditableBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const deleteBlock = (id: string) =>
    setBlocks((prev) => prev.filter((b) => b.id !== id));

  const moveBlock = (id: string, dir: -1 | 1) =>
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

  /** Fold this block's text into the previous block; preserves the older label. */
  const mergeUp = (id: string) =>
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
        toast.error("Free plan limit reached", { description: "Upgrade to add more songs." });
        navigate("/upgrade");
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
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-3" style={{ scrollbarGutter: "stable" }}>
          {audioUrl && <ReviewAudioPlayer src={audioUrl} durationMs={durationMs} />}

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
                  onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                  placeholder="Edit this block…"
                  rows={Math.max(2, Math.min(8, b.text.split("\n").length + 1))}
                  className="resize-none text-sm"
                />
                {b.start_ms > 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--cog-muted)" }}>
                    {formatDuration(b.start_ms)}
                  </p>
                )}
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
            {committing ? "Adding to canvas…" : "Add to canvas"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReviewSheet;