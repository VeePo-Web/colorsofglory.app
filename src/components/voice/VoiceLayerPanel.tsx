import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import UploadDropZone from "./UploadDropZone";
import VoiceMemoListItem from "./VoiceMemoListItem";
import type { VoiceMemoRecord } from "@/lib/voice/voiceApi";
import { listVoiceMemos, deleteMemo } from "@/lib/voice/voiceApi";
import { saveMemoDurable } from "@/lib/voice/saveMemo";
import { subscribeOutbox } from "@/lib/voice/captureOutbox";
import {
  getAudioFileDuration,
  getBestMimeType,
  getFileExtension,
} from "@/lib/voice/audioFormat";

interface VoiceLayerPanelProps {
  songId: string;
  currentUserName: string;
  isPro?: boolean;
  onRecord?: () => void;  // triggers canvas-level recording sheet
  onMemoAdded?: (memo: Partial<VoiceMemoRecord>) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function groupBySectionLabel(memos: VoiceMemoRecord[]): Array<{ label: string; items: VoiceMemoRecord[] }> {
  const map = new Map<string, VoiceMemoRecord[]>();
  for (const m of memos) {
    const key = m.section_label || "Unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  const order = ["Verse 1", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Outro", "Intro", "Hook", "Raw idea"];
  const sorted: Array<{ label: string; items: VoiceMemoRecord[] }> = [];
  for (const o of order) {
    if (map.has(o)) sorted.push({ label: o, items: map.get(o)! });
  }
  for (const [label, items] of map) {
    if (!order.includes(label)) sorted.push({ label, items });
  }
  return sorted;
}

const VoiceLayerPanel = ({
  songId,
  currentUserName,
  isPro = false,
  onRecord,
  onMemoAdded,
}: VoiceLayerPanelProps) => {
  const [memos, setMemos] = useState<VoiceMemoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const loadMemos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listVoiceMemos(songId);
      if (!abortRef.current) setMemos(data);
    } catch {
      // fail silently — panel shows empty state
    } finally {
      if (!abortRef.current) setIsLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    abortRef.current = false;
    loadMemos();
    return () => { abortRef.current = true; };
  }, [loadMemos]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setUploading(true);

    try {
      const durationMs = await getAudioFileDuration(file);
      const mimeType = file.type || getBestMimeType();
      const ext = getFileExtension(mimeType);
      const memoCount = memos.length + 1;
      const title = file.name.replace(/\.[^.]+$/, "") || `Voice Memo ${memoCount}`;
      const fileName = `${title.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.${ext}`;

      // Canonical save (cache-first + auto-retry + real peaks): the import is
      // durable before any network call, so a dropped connection never strands
      // it. The outbox subscription below swaps the optimistic card for the
      // real record once it syncs. Imported and recorded memos are
      // indistinguishable downstream (F11).
      const { optimistic } = await saveMemoDurable({
        blob: file,
        songId,
        title,
        mimeType,
        durationMs,
        sectionLabel: "Raw idea",
        fileName,
        createdBy: currentUserName,
      });

      setMemos((prev) => [optimistic, ...prev]);
      onMemoAdded?.(optimistic);
    } catch {
      setUploadError("Couldn't read that file — please try another.");
    } finally {
      setUploading(false);
    }
  }, [songId, memos.length, currentUserName, onMemoAdded]);

  // Reconcile optimistic import cards as the outbox syncs them: swap to the real
  // record on success, or mark "still saving" if a retry is pending. The take is
  // safe throughout.
  useEffect(() => {
    const unsubscribe = subscribeOutbox((event) => {
      if (event.type === "change") return;
      if (event.songId !== songId) return;
      if (event.type === "success") {
        setMemos((prev) => prev.filter((m) => m.id !== event.outboxId));
        void loadMemos();
      } else if (event.type === "failed") {
        setMemos((prev) =>
          prev.map((m) => (m.id === event.outboxId ? { ...m, status: "queued", is_processing: true } : m)),
        );
      }
    });
    return unsubscribe;
  }, [songId, loadMemos]);

  const handleDelete = useCallback(async (memoId: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== memoId));
    try {
      await deleteMemo(memoId);
    } catch {
      // re-add on failure
      await loadMemos();
    }
  }, [loadMemos]);

  const grouped = groupBySectionLabel(memos);

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {/* Record button */}
        <button
          type="button"
          onClick={onRecord}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            backgroundColor: "#B8953A",
            color: "#FFFFFF",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: "0 2px 10px rgba(184,149,58,0.35)",
          }}
          aria-label="Start recording"
        >
          <Mic size={14} strokeWidth={2} />
          Record
        </button>
      </div>

      {/* Upload drop zone */}
      <UploadDropZone
        onFile={handleFileUpload}
        isPro={isPro}
        disabled={uploading}
      />

      {uploading && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#B8953A", textAlign: "center", margin: "8px 0" }}>
          Uploading...
        </p>
      )}

      {uploadError && (
        <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#E05440", margin: "8px 0" }}>
          {uploadError}
        </p>
      )}

      {/* Memo list */}
      <div style={{ marginTop: 20 }}>
        {isLoading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 54,
                  borderRadius: 8,
                  backgroundColor: "rgba(0,0,0,0.04)",
                  marginBottom: 8,
                }}
              />
            ))}
          </div>
        ) : memos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#BBB", margin: 0 }}>
              No voice memos yet.
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#CCC", marginTop: 4 }}>
              Tap Record or upload an audio file.
            </p>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#B8953A",
                  }}
                >
                  {label}
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: "rgba(184,149,58,0.18)" }} />
              </div>

              {items.map((memo) => (
                <VoiceMemoListItem
                  key={memo.id}
                  memo={memo}
                  creatorName={memo.created_by || currentUserName}
                  ageLabel={timeAgo(memo.created_at)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VoiceLayerPanel;
