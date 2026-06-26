import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import {
  listBrainstormMemos,
  type BrainstormMemo,
} from "@/integrations/cog/brainstorm";
import { getSong, type SongDetail } from "@/integrations/cog/songs";
import { enqueueCaptureUpload, subscribeOutbox } from "@/lib/voice/captureOutbox";

const BrainstormMemosPanel = lazy(() => import("@/components/brainstorm/BrainstormMemosPanel"));

// The "memos" outbox uploader is registered once at app startup
// (src/lib/voice/captureUploaders.ts), so a queued brainstorm take resumes
// syncing on reconnect even before this page mounts.

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
        const value = Math.abs(data[j]);
        if (value > max) max = value;
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
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

const MemoPanelSkeleton = () => (
  <div className="space-y-3">
    {[0, 1].map((index) => (
      <div
        key={index}
        className="h-28 rounded-2xl"
        style={{ backgroundColor: "#FAF7F2", border: "1px solid rgba(28,26,23,0.08)" }}
      />
    ))}
  </div>
);

const BrainstormPage = () => {
  const { id: songId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongDetail | null>(null);
  const [memos, setMemos] = useState<BrainstormMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

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
        const [songDetail] = await Promise.all([getSong(songId), refresh()]);
        if (active) setSong(songDetail);
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

  // When a queued brainstorm take finishes syncing, pull the real record in so it
  // appears in the list. The take is safe in the outbox throughout.
  useEffect(() => {
    const unsubscribe = subscribeOutbox((event) => {
      if (event.type === "change") return;
      if (event.songId !== songId) return;
      if (event.type === "success") void refresh();
    });
    return unsubscribe;
  }, [songId, refresh]);

  useEffect(() => {
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
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
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const duration = Date.now() - startedAtRef.current;
        if (!songId) return;

        if (blob.size < 1000) {
          toast("Too short - hold a little longer next time");
          return;
        }

        setSaving(true);
        try {
          const peaks = await computePeaks(blob);
          // Cache-first + auto-retry: the take is durable before any network
          // call, so a dropped/offline upload can no longer lose a brainstorm
          // idea. It syncs through this page's pipeline and surfaces via the
          // outbox success subscription + realtime refresh.
          await enqueueCaptureUpload({
            blob,
            songId,
            title: "Brainstorm idea",
            mimeType: mime,
            durationMs: duration,
            sectionLabel: "Raw idea",
            uploaderKey: "memos",
            extra: { waveformPeaks: peaks ?? undefined },
          });
        } catch (err) {
          // enqueue only fails on a local-cache error; the recorder still holds
          // the chunks, so this is rare and non-fatal.
          console.error(err);
          toast("Hmm — try that one more time");
        } finally {
          setSaving(false);
        }
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      recorder.start();
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

  const elapsedLabel = useMemo(() => formatTime(elapsedMs / 1000), [elapsedMs]);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream, #F5F0E8)" }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 90%, rgba(184,149,58,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full" style={{ maxWidth: 430 }}>
        <header className="flex items-center justify-between px-5 pb-4 pt-12">
          <button
            onClick={() => navigate("/")}
            aria-label="Back to songs"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ color: "#1C1A17" }}
          >
            <ArrowLeft size={22} strokeWidth={1.5} />
          </button>
          <div className="flex-1 px-2 text-center">
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

        <div className="flex flex-col items-center pb-10 pt-6">
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
                className="absolute inset-0 animate-ping rounded-full"
                style={{ backgroundColor: "rgba(155,46,46,0.18)" }}
              />
            )}
          </button>
          <p className="mt-4 text-[0.875rem]" style={{ color: "#6B6459", fontFamily: "var(--font-body, Inter, system-ui, sans-serif)" }}>
            {saving
              ? "Saving your idea..."
              : recording
              ? `Recording - ${elapsedLabel}`
              : memos.length === 0
              ? "Hold the moment - tap to record"
              : "Tap to capture another idea"}
          </p>
        </div>

        <main className="px-4 pb-32">
          <Suspense fallback={<MemoPanelSkeleton />}>
            <BrainstormMemosPanel loading={loading} memos={memos} setMemos={setMemos} onRefresh={refresh} />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default BrainstormPage;
