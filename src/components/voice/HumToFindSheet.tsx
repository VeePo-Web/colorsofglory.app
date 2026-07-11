import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, X } from "lucide-react";
import type { VoiceMemoRecord } from "@/lib/voice/voiceApi";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { computePitchContour } from "@/lib/audio/pitchContour";
import { listMelodyKeys } from "@/lib/audio/contourStore";
import {
  hasStrongMatch,
  searchMelodies,
  MIN_LIBRARY,
  MIN_QUERY_NOTES,
  type MelodyMatch,
} from "@/lib/audio/melodySearch";
import { resolveWaveformBars } from "@/lib/canvas/waveformSeed";
import { formatDuration } from "@/lib/voice/audioFormat";

/**
 * HumToFindSheet — "hum a tune, find the memo" (C4, Feature 2).
 *
 * Opt-in retrieval, never notation: the hum is captured with the shared
 * recorder, run through the SAME pitch pipeline capture uses, and matched by
 * subsequence DTW against the melody fingerprints Melody Lens already stored
 * on-device. Results are a ranked shortlist the writer recognizes by each
 * memo's melody thumbnail. On-device, offline, private — the hum never leaves
 * the phone. Honest states throughout: too-small library, too-short hum, and
 * "no close match — here are your recent melodies" instead of a false #1.
 */

interface HumToFindSheetProps {
  memos: VoiceMemoRecord[];
  onClose: () => void;
  onOpenMemo: (memoId: string) => void;
}

type Phase = "idle" | "recording" | "analyzing" | "results";

const MAX_HUM_MS = 12_000;

const MelodyThumb = ({ memo }: { memo: VoiceMemoRecord }) => {
  const wave = resolveWaveformBars({
    seedId: memo.id,
    peaks: memo.waveform_peaks,
    contour: memo.pitch_contour,
    barCount: 12,
    maxHeight: 22,
  });
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 2, height: 22, width: 44, flexShrink: 0 }} aria-hidden="true">
      {wave.bars.map((bar, i) => (
        <div
          key={i}
          style={{
            flex: 1, height: Math.max(2, bar.height), marginTop: bar.top, borderRadius: 2,
            backgroundColor: "var(--cog-gold, #B8953A)", opacity: bar.voiced ? 0.8 : 0.2,
          }}
        />
      ))}
    </div>
  );
};

const HumToFindSheet = ({ memos, onClose, onOpenMemo }: HumToFindSheetProps) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [matches, setMatches] = useState<MelodyMatch[]>([]);
  const [tooShort, setTooShort] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const didClose = useRef(false);

  const memoById = useMemo(() => new Map(memos.map((m) => [m.id, m])), [memos]);

  // The searchable index = this song's memos that have a melody fingerprint on
  // this device (capture + lazy backfill). Privacy: only the user's own memos.
  const indexed = useMemo(() => {
    const here = new Set(memos.map((m) => m.id));
    return listMelodyKeys().filter((e) => here.has(e.memoId));
  }, [memos]);
  const libraryTooSmall = memos.length < MIN_LIBRARY;
  // Enough memos, but none carry a melody fingerprint yet (all legacy + never
  // played) — humming would dead-end, so guide the writer to build the index.
  const notIndexedYet = !libraryTooSmall && indexed.length === 0;

  const close = () => {
    if (didClose.current) return;
    didClose.current = true;
    onClose();
  };

  // Escape + focus-in-then-return (house sheet idiom).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => sheetRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = async (blob: Blob) => {
    setPhase("analyzing");
    setTooShort(false);
    const contour = await computePitchContour(blob);
    const queryKey = contour?.melodyKey ?? [];
    if (queryKey.length < MIN_QUERY_NOTES) {
      setTooShort(true);
      setPhase("results");
      setMatches([]);
      return;
    }
    setMatches(searchMelodies(queryKey, indexed, { limit: 5 }));
    setPhase("results");
  };

  const { state, startRecording, stopRecording } = useVoiceRecorder({
    maxDurationMs: MAX_HUM_MS,
    onAutoFinalize: (result) => { if (result) void analyze(result.blob); else setPhase("idle"); },
  });

  const beginHum = async () => {
    setMatches([]);
    setTooShort(false);
    const ok = await startRecording();
    if (ok) setPhase("recording");
  };

  const endHum = async () => {
    const result = await stopRecording();
    if (result) void analyze(result.blob);
    else setPhase("idle");
  };

  const strong = hasStrongMatch(matches);
  // No strong match → still help: show the writer's most recent melodies.
  const recentFallback = useMemo(
    () => (strong ? [] : memos.filter((m) => indexed.some((e) => e.memoId === m.id)).slice(0, 3)),
    [strong, memos, indexed],
  );

  return (
    <>
      <div aria-hidden="true" onClick={close} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.36)", zIndex: 799, animation: "cog-fade-in 200ms ease both" }} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Hum to find a melody"
        tabIndex={-1}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 800,
          backgroundColor: "var(--cog-cream-light, #FAFAF6)",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -12px 48px rgba(0,0,0,0.18)",
          padding: "16px 18px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          maxHeight: "76vh", overflowY: "auto", outline: "none",
          animation: "cog-sheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--cog-gold)", marginBottom: 2 }}>
              Hum to find
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--cog-charcoal)" }}>
              Which memo had that tune?
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close hum to find"
            style={{ width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer", backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {libraryTooSmall ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.5, padding: "18px 2px 8px" }}>
            Hum-to-find grows with your library. Record a few more melodies and
            you'll be able to hum any of them back.
          </p>
        ) : notIndexedYet ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.5, padding: "18px 2px 8px" }}>
            Play a few of your memos once to add them to melody search — newer
            recordings join automatically.
          </p>
        ) : (
          <>
            {/* The mic — tap to hum (tap-not-hold, gold-not-red). */}
            {(phase === "idle" || phase === "recording") && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0 16px" }}>
                <button
                  type="button"
                  onClick={phase === "recording" ? () => void endHum() : () => void beginHum()}
                  aria-label={phase === "recording" ? "Stop humming" : "Start humming"}
                  style={{
                    width: 84, height: 84, borderRadius: "50%", border: "none", cursor: "pointer",
                    backgroundColor: "var(--cog-gold, #B8953A)", color: "#FFF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: phase === "recording"
                      ? "0 0 0 8px rgba(184,149,58,0.20), 0 6px 20px rgba(184,149,58,0.4)"
                      : "0 6px 20px rgba(184,149,58,0.35)",
                    animation: phase === "recording" ? "cog-hum-pulse 1.4s ease-in-out infinite" : "none",
                  }}
                >
                  <Mic size={32} strokeWidth={1.8} />
                </button>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)", textAlign: "center" }}>
                  {phase === "recording"
                    ? `Humming… ${formatDuration(state.durationMs)} — tap to search`
                    : "Tap, then hum a few notes of the tune"}
                </p>
              </div>
            )}

            {phase === "analyzing" && (
              <p aria-live="polite" style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)", textAlign: "center", padding: "28px 0" }}>
                Listening for the melody…
              </p>
            )}

            {phase === "results" && (
              <div>
                {tooShort ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.5, padding: "12px 2px" }}>
                    That was a little short to recognize — tap the mic and hum a
                    few more notes.
                  </p>
                ) : (
                  <>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "var(--cog-warm-gray)", marginBottom: 10 }}>
                      {strong
                        ? "Closest matches"
                        : matches.length > 0
                          ? "No close match — your recent melodies"
                          : "Nothing to match against yet"}
                    </p>
                    {(strong ? memosFromMatches(matches, memoById) : recentFallback).map((memo, i) => (
                      <button
                        key={memo.id}
                        type="button"
                        onClick={() => { onOpenMemo(memo.id); close(); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                          minHeight: 56, padding: "8px 6px", borderRadius: 12, cursor: "pointer",
                          border: "1px solid rgba(28,26,23,0.08)", marginBottom: 8,
                          backgroundColor: strong && i === 0 ? "rgba(184,149,58,0.08)" : "transparent",
                        }}
                        aria-label={`Open ${memo.title}${strong ? `, match ${i + 1}` : ""}`}
                      >
                        <MelodyThumb memo={memo} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600, color: "var(--cog-charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {memo.title}
                          </span>
                          <span style={{ display: "block", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--cog-warm-gray)", marginTop: 1 }}>
                            {formatDuration(memo.duration_ms)} · {memo.section_label || "Raw idea"}
                          </span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPhase("idle")}
                      style={{ width: "100%", minHeight: 44, borderRadius: 11, border: "1px solid rgba(28,26,23,0.12)", background: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--cog-warm-gray)", marginTop: 4 }}
                    >
                      Hum again
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes cog-hum-pulse {
          0%, 100% { box-shadow: 0 0 0 8px rgba(184,149,58,0.18), 0 6px 20px rgba(184,149,58,0.4); }
          50%      { box-shadow: 0 0 0 14px rgba(184,149,58,0.08), 0 6px 20px rgba(184,149,58,0.4); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="cog-hum-pulse"],
          [style*="cog-sheet-rise"],
          [style*="cog-fade-in"] { animation: none !important; }
        }
      `}</style>
    </>
  );
};

function memosFromMatches(matches: MelodyMatch[], byId: Map<string, VoiceMemoRecord>): VoiceMemoRecord[] {
  return matches.map((m) => byId.get(m.memoId)).filter((m): m is VoiceMemoRecord => Boolean(m));
}

export default HumToFindSheet;
