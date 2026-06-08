import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Pause, Play, Mic, Square, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listBrainstormMemos,
  updateMemoTitle,
  updateMemoNotes,
  archiveMemo,
  uploadVoiceMemo,
  getPlaybackUrl,
  friendlyMemoLabel,
  type BrainstormMemo,
} from "@/integrations/cog/brainstorm";
import { getSong, type SongDetail } from "@/integrations/cog/songs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Compute ~48 waveform peaks from a Blob using a temporary AudioContext. */
async function computePeaks(blob: Blob, bins = 48): Promise<number[] | undefined> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const data = audio.getChannelData(0);
    const samplesPerBin = Math.floor(data.length / bins) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < bins; i++) {
      let max = 0;
      const start = i * samplesPerBin;
      const end = Math.min(start + samplesPerBin, data.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      peaks.push(Number(max.toFixed(4)));
    }
    ctx.close();
    return peaks;
  } catch {
    return undefined;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const BrainstormPage = () => {
  const { id: songId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongDetail | null>(null);
  const [memos, setMemos] = useState<BrainstormMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    if (!songId) return;
    const list = await listBrainstormMemos(songId);
    setMemos(list);
  }, [songId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!songId) return;
      try {
        const [s] = await Promise.all([getSong(songId), refresh()]);
        if (active) setSong(s);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't load this song");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [songId, refresh]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      audioRef.current?.pause();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || saving) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const duration = Date.now() - startedAtRef.current;
        if (!songId) return;
        if (blob.size < 1000) {
          toast("Too short — hold a little longer next time");
          return;
        }
        setSaving(true);
        try {
          const peaks = await computePeaks(blob);
          await uploadVoiceMemo({
            songId,
            blob,
            mimeType: mime,
            durationMs: duration,
            waveformPeaks: peaks,
          });
          await refresh();
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Couldn't save that one");
        } finally {
          setSaving(false);
        }
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      rec.start();
      setRecording(true);
      const tick = () => {
        setElapsedMs(Date.now() - startedAtRef.current);
        tickRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      toast.error("Microphone permission needed");
    }
  }, [recording, saving, songId, refresh]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    if (tickRef.current) cancelAnimationFrame(tickRef.current);
    tickRef.current = null;
    recorderRef.current?.stop();
    setRecording(false);
  }, [recording]);

  const handlePlay = useCallback(async (memo: BrainstormMemo) => {
    try {
      if (playingId === memo.id && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingId(null);
        return;
      }
      const url = await getPlaybackUrl(memo.id);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlayingId(null);
      await audioRef.current.play();
      setPlayingId(memo.id);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't play that memo");
    }
  }, [playingId]);

  const handleArchive = useCallback(async (memoId: string) => {
    try {
      await archiveMemo(memoId);
      setMemos((prev) => prev.filter((m) => m.id !== memoId));
      toast("Tucked away");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't archive");
    }
  }, []);

  const elapsedLabel = useMemo(() => formatTime(elapsedMs / 1000), [elapsedMs]);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream, #F5F0E8)" }}>
      {/* radial glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 90%, rgba(184,149,58,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full" style={{ maxWidth: 430 }}>
        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-12 pb-4">
          <button
            onClick={() => navigate("/")}
            aria-label="Back to songs"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ color: "#1C1A17" }}
          >
            <ArrowLeft size={22} strokeWidth={1.5} />
          </button>
          <div className="text-center flex-1 px-2">
            <h1
              className="truncate text-[1.5rem] leading-tight"
              style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", color: "#1C1A17", fontWeight: 600 }}
            >
              {loading ? " " : song?.title ?? "Untitled"}
            </h1>
            <p className="mt-1 text-[0.75rem]" style={{ color: "#6B6459" }}>
              {memos.length === 0 ? "Capture the first idea" : `${memos.length} ${memos.length === 1 ? "idea" : "ideas"}`}
            </p>
          </div>
          <div className="w-10" />
        </header>

        {/* Record button */}
        <div className="flex flex-col items-center pt-6 pb-10">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={saving}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className="relative flex h-28 w-28 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-60"
            style={{
              backgroundColor: recording ? "#9B2E2E" : "#B8953A",
              boxShadow: recording
                ? "0 0 0 12px rgba(155,46,46,0.18), 0 10px 30px rgba(155,46,46,0.30)"
                : "0 10px 30px rgba(184,149,58,0.40)",
              color: "#FFFFFF",
            }}
          >
            {recording ? <Square size={32} strokeWidth={2.2} fill="#FFFFFF" /> : <Mic size={38} strokeWidth={1.8} />}
            {recording && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "rgba(155,46,46,0.18)" }}
              />
            )}
          </button>
          <p className="mt-4 text-[0.875rem]" style={{ color: "#6B6459", fontFamily: "var(--font-body, Inter, system-ui, sans-serif)" }}>
            {saving
              ? "Saving your idea…"
              : recording
              ? `Recording · ${elapsedLabel}`
              : memos.length === 0
              ? "Hold the moment — tap to record"
              : "Tap to capture another idea"}
          </p>
        </div>

        {/* Memos */}
        <main className="px-4 pb-32">
          {loading ? (
            <SkeletonCard />
          ) : memos.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-3">
              {memos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  isPlaying={playingId === memo.id}
                  onPlay={() => handlePlay(memo)}
                  onArchive={() => handleArchive(memo.id)}
                  onRefresh={refresh}
                />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
};

const EmptyState = () => (
  <div className="mx-auto mt-4 max-w-xs text-center">
    <p
      className="text-[1.125rem] leading-snug"
      style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", color: "#1C1A17" }}
    >
      Hum the melody, speak the line.
    </p>
    <p className="mt-2 text-[0.875rem]" style={{ color: "#6B6459" }}>
      Every idea you capture lives here, side by side, ready when you come back.
    </p>
  </div>
);

const SkeletonCard = () => (
  <div className="space-y-3">
    {[0, 1].map((i) => (
      <div
        key={i}
        className="h-28 rounded-2xl"
        style={{ backgroundColor: "#FAF7F2", border: "1px solid rgba(28,26,23,0.08)" }}
      />
    ))}
  </div>
);

interface MemoCardProps {
  memo: BrainstormMemo;
  isPlaying: boolean;
  onPlay: () => void;
  onArchive: () => void;
  onRefresh: () => void | Promise<void>;
}

const MemoCard = ({ memo, isPlaying, onPlay, onArchive, onRefresh }: MemoCardProps) => {
  const [title, setTitle] = useState(memo.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [notes, setNotes] = useState(memo.notes ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const notesTimer = useRef<number | null>(null);

  useEffect(() => {
    setTitle(memo.title ?? "");
    setNotes(memo.notes ?? "");
  }, [memo.id, memo.title, memo.notes]);

  const commitTitle = async () => {
    setEditingTitle(false);
    if ((title ?? "") === (memo.title ?? "")) return;
    try {
      await updateMemoTitle(memo.id, title.trim());
      await onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't rename");
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      try {
        await updateMemoNotes(memo.id, val);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1200);
      } catch (err) {
        console.error(err);
      }
    }, 600);
  };

  const peaks = (memo.waveform_peaks as number[] | null) ?? null;
  const friendly = friendlyMemoLabel(memo.created_at, memo.duration_ms);

  return (
    <li
      className="rounded-2xl p-4 transition-shadow"
      style={{
        backgroundColor: "#FAF7F2",
        border: "1px solid rgba(28,26,23,0.10)",
        boxShadow: isPlaying ? "0 8px 24px rgba(184,149,58,0.18)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onPlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ backgroundColor: "#B8953A", color: "#FFFFFF", boxShadow: "0 2px 8px rgba(184,149,58,0.35)" }}
        >
          {isPlaying ? <Pause size={18} fill="#FFFFFF" /> : <Play size={18} fill="#FFFFFF" />}
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setTitle(memo.title ?? "");
                  setEditingTitle(false);
                }
              }}
              placeholder="Name this idea"
              className="w-full bg-transparent text-[1rem] leading-tight outline-none"
              style={{
                fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
                color: "#1C1A17",
                fontWeight: 600,
                borderBottom: "1px solid rgba(184,149,58,0.45)",
              }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="block w-full truncate text-left text-[1rem] leading-tight"
              style={{
                fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
                color: title ? "#1C1A17" : "#A09689",
                fontWeight: 600,
              }}
            >
              {title || "Name this idea"}
            </button>
          )}
          <p className="mt-0.5 text-[0.75rem]" style={{ color: "#6B6459" }}>
            {friendly}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
            aria-label="More actions"
            style={{ color: "#6B6459" }}
          >
            <MoreHorizontal size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setEditingTitle(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>
              <Archive size={14} className="mr-2" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Waveform */}
      {peaks && peaks.length > 0 && (
        <div className="mt-3 flex h-8 items-center gap-[2px]">
          {peaks.map((p, i) => (
            <span
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${Math.max(8, Math.min(100, p * 100))}%`,
                backgroundColor: isPlaying ? "#B8953A" : "rgba(184,149,58,0.5)",
                transition: "background-color 120ms ease",
              }}
            />
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="relative mt-3">
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Notes for this idea…"
          rows={notes ? Math.min(6, Math.max(2, notes.split("\n").length + 1)) : 2}
          className="w-full resize-none rounded-xl bg-white/60 p-3 text-[0.9375rem] outline-none transition"
          style={{
            color: "#1C1A17",
            border: "1px solid rgba(28,26,23,0.08)",
            fontFamily: "var(--font-body, Inter, system-ui, sans-serif)",
          }}
        />
        {savedFlash && (
          <span
            className="absolute right-3 top-3 text-[0.625rem] uppercase tracking-wider"
            style={{ color: "#B8953A" }}
          >
            Saved
          </span>
        )}
      </div>
    </li>
  );
};

export default BrainstormPage;