import { useCallback, useEffect, useState } from "react";
import { Mic } from "lucide-react";
import VoiceMemoListItem from "./VoiceMemoListItem";
import { listVoiceMemos, type VoiceMemoRecord } from "@/lib/voice/voiceApi";
import { saveMemoDurable } from "@/lib/voice/saveMemo";
import { subscribeOutbox } from "@/lib/voice/captureOutbox";
import type { RecordingResult } from "@/hooks/useVoiceRecorder";

/**
 * SectionVoiceDock — the audio-only voice embed for a lyric section (PV-05:
 * "Lyrics And Voice Connected").
 *
 * SEAM (C3 ← C4): the lyrics editor embeds this at a section. C4 renders the
 * AUDIO only — compact playback cards (real waveform + play) and a record
 * affordance. It never renders lyric or transcript text; the section's words
 * are C3's. C3 wires `onRecordRequest` to its recorder surface (which consumes
 * the shared useVoiceRecorder) and hands the finished take to
 * `saveSectionMemo` below, which attaches it to the REAL section id through
 * the one durable save path.
 */

/** Persist a finished recording attached to a real lyric section. */
export async function saveSectionMemo(params: {
  recording: RecordingResult;
  songId: string;
  sectionId: string;
  sectionLabel: string;
  title: string;
  createdBy?: string;
}): Promise<{ outboxId: string; optimistic: VoiceMemoRecord }> {
  return saveMemoDurable({
    blob: params.recording.blob,
    mimeType: params.recording.mimeType,
    durationMs: params.recording.durationMs,
    songId: params.songId,
    title: params.title,
    sectionId: params.sectionId,
    sectionLabel: params.sectionLabel,
    createdBy: params.createdBy,
  });
}

interface SectionVoiceDockProps {
  songId: string;
  /** REAL section id — memos are filtered by id, not by label string. */
  sectionId: string;
  /** Resolved section name, for the record affordance copy only. */
  sectionLabel: string;
  currentUserName?: string;
  /** Role-gated by the caller: viewers get playback only. */
  canRecord?: boolean;
  /** C3 opens its recorder for this section (shared useVoiceRecorder). */
  onRecordRequest?: (sectionId: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const SectionVoiceDock = ({
  songId,
  sectionId,
  sectionLabel,
  currentUserName = "You",
  canRecord = true,
  onRecordRequest,
}: SectionVoiceDockProps) => {
  const [memos, setMemos] = useState<VoiceMemoRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const all = await listVoiceMemos(songId);
      // Group by the REAL section id — never by a label string.
      setMemos(all.filter((m) => m.section_id === sectionId));
    } catch {
      // quiet — the dock simply shows nothing until data arrives
    }
  }, [songId, sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A take saved for this section (from anywhere) lands here once it syncs.
  useEffect(() => {
    return subscribeOutbox((event) => {
      if (event.type === "success" && event.songId === songId) void load();
    });
  }, [songId, load]);

  if (memos.length === 0 && !canRecord) return null;

  return (
    <div aria-label={`Voice memos for ${sectionLabel}`}>
      {memos.map((memo) => (
        <VoiceMemoListItem
          key={memo.id}
          memo={memo}
          creatorName={memo.created_by || currentUserName}
          ageLabel={timeAgo(memo.created_at)}
        />
      ))}
      {canRecord && (
        <button
          type="button"
          onClick={() => onRecordRequest?.(sectionId)}
          aria-label={`Record a voice memo for ${sectionLabel}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
            padding: "0 10px",
            marginTop: 2,
            borderRadius: 10,
            background: "none",
            border: "1px dashed var(--cog-border-gold)",
            color: "var(--cog-gold)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Mic size={13} strokeWidth={2} />
          Sing this part
        </button>
      )}
    </div>
  );
};

export default SectionVoiceDock;
