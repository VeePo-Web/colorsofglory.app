import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Pause,
  Pencil,
  Play,
  Repeat,
  Star,
  X,
} from "lucide-react";
import {
  listTakes,
  setPrimaryTake,
  renameTake,
  archiveTake,
  unarchiveTake,
  getTakeSignedUrl,
  type Take,
} from "@/integrations/cog/takes";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { audioCache } from "@/lib/voice/audioCache";
import { resolveWaveformBars } from "@/lib/canvas/waveformSeed";
import { resolveContour } from "@/lib/audio/contourStore";
import { formatDuration } from "@/lib/voice/audioFormat";
import { isPolishAttached, polishAttach } from "@/lib/audio/enhance";

/**
 * TakeMiniPlayer — the C4 take player (F15: swipe between takes + loop a part).
 *
 * Implements the `player.ts` contract (current take + queue of the same memo's
 * sibling versions) with ONE shared <audio> element and plain React state in
 * this component — the app's established context/hook pattern (A4), NOT a
 * Zustand store. `player.ts`'s old "Zustand store" comment was stale and has
 * been reconciled to match.
 *
 * SEAM: this is the VOICE take player — versions of one memo. It is distinct
 * from F2's practice global mini-player (whole-song rehearsal) and from the
 * layered stack player (F16, useStackPlayer). Never merge the three.
 *
 * Take management is inline and SOFT: set-primary marks the keeper, archive
 * hides (never deletes) — a take is a captured idea.
 */

interface TakeMiniPlayerProps {
  memoId: string;
  memoTitle: string;
  /** Memo-level peaks, used when a take carries none. */
  fallbackPeaks?: number[] | null;
  onClose: () => void;
}

const BARS = 36;
const WAVE_H = 40;

/** A playable version: a real Take row, or the memo itself when no takes exist. */
interface PlayableTake {
  id: string;
  label: string;
  durationMs: number | null;
  peaks: number[] | null;
  isPrimary: boolean;
  isArchived: boolean;
  /** Real takes can be managed; the bare memo cannot. */
  take: Take | null;
}

const TakeMiniPlayer = ({ memoId, memoTitle, fallbackPeaks, onClose }: TakeMiniPlayerProps) => {
  const [takes, setTakes] = useState<PlayableTake[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // A–B loop (F15 part 2): null bounds = loop the whole take when loop is on.
  const [loopOn, setLoopOn] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null); // 0–1
  const [loopB, setLoopB] = useState<number | null>(null); // 0–1

  // ONE shared audio element for the whole player — never one per take.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<number | null>(null);

  const current = takes[index] ?? null;

  // ── Load the memo's takes (its version queue) ────────────────────────────
  const loadTakes = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTakes(memoId, { include_archived: true });
      if (rows.length > 0) {
        const playable = rows.map<PlayableTake>((t, i) => ({
          id: t.id,
          label: t.friendly_name || `Take ${i + 1}`,
          durationMs: t.duration_ms,
          peaks: t.waveform_peaks,
          isPrimary: t.is_primary,
          isArchived: t.is_archived,
          take: t,
        }));
        setTakes(playable);
        const primary = playable.findIndex((t) => t.isPrimary && !t.isArchived);
        setIndex(primary >= 0 ? primary : 0);
      } else {
        // No take rows yet — the memo's own audio is the only version.
        setTakes([
          {
            id: memoId,
            label: memoTitle,
            durationMs: null,
            peaks: fallbackPeaks ?? null,
            isPrimary: true,
            isArchived: false,
            take: null,
          },
        ]);
        setIndex(0);
      }
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  }, [memoId, memoTitle, fallbackPeaks, onClose]);

  useEffect(() => {
    void loadTakes();
  }, [loadTakes]);

  // ── Resolve + prepare audio for the current take (cache-first, instant) ──
  const resolveUrl = useCallback(
    async (t: PlayableTake): Promise<{ url: string; blob?: Blob }> => {
      const cached = await audioCache.get(t.id);
      if (cached) {
        const url = URL.createObjectURL(cached);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
        return { url, blob: cached };
      }
      const url = t.take
        ? await getTakeSignedUrl(t.take.storage_path)
        : await getSignedUrl(t.id);
      // Once this shared element is wired into the polish bus, a remote src
      // on it would play SILENCE (media-element sources are permanent and
      // cross-origin output is muted) — so fetch to a blob first. This also
      // warms the cache the prefetch was about to warm anyway.
      if (audioRef.current && isPolishAttached(audioRef.current)) {
        const fetched = await (await fetch(url)).blob();
        await audioCache.set(t.id, fetched).catch(() => {});
        const blobUrl = URL.createObjectURL(fetched);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = blobUrl;
        return { url: blobUrl, blob: fetched };
      }
      void audioCache.prefetch(t.id, url);
      return { url };
    },
    [],
  );

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    (async () => {
      try {
        const { url, blob } = await resolveUrl(current);
        if (cancelled) return;
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        const wasPlaying = isPlaying;
        audio.src = url;
        audio.load();
        // Polish (strictly additive): cached blob-URL takes route through
        // the music-safe bus; signed URLs stay exactly as today.
        void polishAttach(audio, { memoId: current.id, blob });
        if (wasPlaying) void audio.play().catch(() => setIsPlaying(false));
        // Warm the neighbors so a swipe plays instantly.
        const prev = takes[index - 1];
        const next = takes[index + 1];
        for (const sib of [prev, next]) {
          if (sib?.take) {
            void getTakeSignedUrl(sib.take.storage_path)
              .then((u) => audioCache.prefetch(sib.id, u))
              .catch(() => {});
          }
        }
      } catch {
        setIsPlaying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-resolve only when the take changes
  }, [current?.id]);

  // Reset the loop region when switching takes — it belongs to one take's audio.
  useEffect(() => {
    setLoopA(null);
    setLoopB(null);
    setProgress(0);
  }, [current?.id]);

  // ── Playback + gapless A–B loop ──────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      const dur = audio.duration || 0;
      if (dur <= 0) return;
      const pct = audio.currentTime / dur;
      setProgress(pct);
      if (loopOn) {
        const a = loopA ?? 0;
        const b = loopB ?? 1;
        // Seeking on the same decoded element is effectively gapless — no
        // reload, no new element, just a clock jump back to A.
        if (pct >= b) audio.currentTime = a * dur;
      }
    };
    const onEnded = () => {
      if (loopOn) {
        const a = loopA ?? 0;
        audio.currentTime = a * (audio.duration || 0);
        void audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [loopOn, loopA, loopB, current?.id]);

  // Release the shared element + object URL on unmount.
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const playPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Gesture retry: if the earlier attach skipped (suspended context),
      // this one runs inside the tap. Idempotent when already attached.
      void polishAttach(audio, { memoId: current?.id });
      void audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, current?.id]);

  // ── Waveform interactions: tap = scrub; drag = set the A–B loop region ──
  const pctFromEvent = useCallback((clientX: number): number => {
    const el = waveRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const onWavePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStartRef.current = pctFromEvent(e.clientX);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pctFromEvent],
  );

  const onWavePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (start === null) return;
      const end = pctFromEvent(e.clientX);
      const audio = audioRef.current;
      if (Math.abs(end - start) > 0.04) {
        // A drag defines the loop region and turns looping on.
        setLoopA(Math.min(start, end));
        setLoopB(Math.max(start, end));
        setLoopOn(true);
      } else if (audio && audio.duration) {
        // A tap scrubs.
        audio.currentTime = end * audio.duration;
        setProgress(end);
      }
    },
    [pctFromEvent],
  );

  const toggleLoop = useCallback(() => {
    setLoopOn((on) => {
      if (on) {
        setLoopA(null);
        setLoopB(null);
      }
      return !on;
    });
  }, []);

  // ── Swipe / chevron between sibling takes ────────────────────────────────
  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= takes.length) return;
      setIndex(next);
      setRenaming(false);
    },
    [takes.length],
  );

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
    if (dx < -48) goTo(index + 1);
    else if (dx > 48) goTo(index - 1);
  };

  // ── Inline take management (soft — never a hard delete) ─────────────────
  const handleSetPrimary = useCallback(async () => {
    if (!current?.take || current.isPrimary) return;
    await setPrimaryTake(current.take.id);
    await loadTakes();
  }, [current, loadTakes]);

  const handleRename = useCallback(async () => {
    if (!current?.take) return;
    const value = renameValue.trim();
    setRenaming(false);
    if (!value || value === current.label) return;
    await renameTake(current.take.id, value);
    await loadTakes();
  }, [current, renameValue, loadTakes]);

  const handleArchiveToggle = useCallback(async () => {
    if (!current?.take) return;
    if (current.isArchived) await unarchiveTake(current.take.id);
    else await archiveTake(current.take.id);
    await loadTakes();
  }, [current, loadTakes]);

  const wave = useMemo(() => {
    const peaks = current?.peaks?.length ? current.peaks : fallbackPeaks;
    // Melody Lens: the PRIMARY take rides the memo's tune (its contour lives in
    // the device store, keyed by memo id); layer takes are separate recordings,
    // so they show their own true amplitude. Precedence: contour → peaks → seed.
    const contour = current?.isPrimary ? resolveContour(memoId)?.pitchContour ?? null : null;
    return resolveWaveformBars({
      seedId: current?.id ?? memoId,
      peaks,
      contour,
      barCount: BARS,
      maxHeight: WAVE_H,
    });
  }, [current?.id, current?.peaks, current?.isPrimary, fallbackPeaks, memoId]);

  if (loading || !current) return null;

  const loopStart = loopA ?? 0;
  const loopEnd = loopB ?? 1;

  return (
    <div
      role="dialog"
      aria-label={`Takes for ${memoTitle}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 88,
        width: "calc(100% - 24px)",
        maxWidth: "calc(var(--max-w-app) - 24px)",
        zIndex: 60,
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border-gold)",
        borderRadius: 20,
        boxShadow: "0 16px 48px rgba(28,26,23,0.18)",
        padding: "14px 16px 12px",
      }}
    >
      {/* Header: take label + position + close */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming && current.take ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => void handleRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              aria-label="Rename take"
              style={{
                width: "100%",
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--cog-charcoal)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--cog-border-gold)",
                outline: "none",
                padding: 0,
              }}
            />
          ) : (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--cog-charcoal)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {current.label}
              {current.isArchived ? " · archived" : ""}
            </p>
          )}
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "var(--cog-warm-gray)",
            }}
          >
            Take {index + 1} of {takes.length}
            {current.isPrimary ? " · primary" : ""}
            {current.durationMs ? ` · ${formatDuration(current.durationMs)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close take player"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--cog-warm-gray)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Waveform: tap to scrub, drag to set the A–B loop region */}
      <div
        ref={waveRef}
        role="slider"
        aria-label={`Playback position for ${current.label}. Drag to set a loop region.`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          const audio = audioRef.current;
          if (!audio || !audio.duration) return;
          if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + 2);
          if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 2);
        }}
        onPointerDown={onWavePointerDown}
        onPointerUp={onWavePointerUp}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          height: WAVE_H,
          cursor: "pointer",
          touchAction: "none",
          marginBottom: 8,
        }}
      >
        {/* Loop region highlight */}
        {loopOn && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -3,
              bottom: -3,
              left: `${loopStart * 100}%`,
              width: `${(loopEnd - loopStart) * 100}%`,
              borderRadius: 6,
              backgroundColor: "rgba(184,149,58,0.14)",
              border: "1px solid var(--cog-border-gold)",
              pointerEvents: "none",
            }}
          />
        )}
        {wave.bars.map((bar, i) => {
          const played = progress > i / BARS;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, bar.height),
                marginTop: bar.top,
                borderRadius: 2,
                backgroundColor: played ? "var(--cog-gold)" : "var(--cog-gold-pale)",
                opacity: !bar.voiced ? 0.16 : bar.amp * 0.55 + 0.35,
              }}
            />
          );
        })}
      </div>

      {/* Transport + manage row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous take"
          style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: "none", cursor: index === 0 ? "default" : "pointer",
            color: index === 0 ? "var(--cog-muted)" : "var(--cog-charcoal)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={playPause}
          aria-label={isPlaying ? `Pause ${current.label}` : `Play ${current.label}`}
          style={{
            width: 48, height: 48, borderRadius: "50%",
            backgroundColor: "var(--cog-gold)", color: "#FFF", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: "0 4px 16px rgba(184,149,58,0.30)",
            flexShrink: 0,
          }}
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index >= takes.length - 1}
          aria-label="Next take"
          style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: "none",
            cursor: index >= takes.length - 1 ? "default" : "pointer",
            color: index >= takes.length - 1 ? "var(--cog-muted)" : "var(--cog-charcoal)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronRight size={20} />
        </button>

        <button
          type="button"
          onClick={toggleLoop}
          aria-pressed={loopOn}
          aria-label={loopOn ? "Turn loop off" : "Loop this take (drag on the waveform to loop a part)"}
          style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            backgroundColor: loopOn ? "var(--cog-gold-pale)" : "transparent",
            cursor: "pointer",
            color: loopOn ? "var(--cog-charcoal)" : "var(--cog-warm-gray)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Repeat size={17} />
        </button>

        <div style={{ flex: 1 }} />

        {current.take && (
          <>
            <button
              type="button"
              onClick={() => void handleSetPrimary()}
              disabled={current.isPrimary}
              aria-pressed={current.isPrimary}
              aria-label={current.isPrimary ? "This is the primary take" : "Make this the primary take"}
              style={{
                width: 44, height: 44, borderRadius: 12, border: "none",
                background: "none", cursor: current.isPrimary ? "default" : "pointer",
                color: current.isPrimary ? "var(--cog-gold)" : "var(--cog-warm-gray)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Star size={17} fill={current.isPrimary ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => {
                setRenameValue(current.label);
                setRenaming(true);
              }}
              aria-label={`Rename ${current.label}`}
              style={{
                width: 44, height: 44, borderRadius: 12, border: "none",
                background: "none", cursor: "pointer", color: "var(--cog-warm-gray)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => void handleArchiveToggle()}
              aria-label={current.isArchived ? `Restore ${current.label}` : `Archive ${current.label} (kept, never deleted)`}
              style={{
                width: 44, height: 44, borderRadius: 12, border: "none",
                background: "none", cursor: "pointer", color: "var(--cog-warm-gray)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {current.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TakeMiniPlayer;
