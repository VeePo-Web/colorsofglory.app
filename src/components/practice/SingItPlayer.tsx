import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SlidersHorizontal, WifiOff } from "lucide-react";
import { KaraokeLyrics } from "./KaraokeLyrics";
import { PartsMixerSheet } from "./PartsMixerSheet";
import { useSingItPlayer } from "@/hooks/useSingItPlayer";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

/**
 * SingItPlayer — THE PRACTICE ROOM (docs/prompts/THE-HALLWAY-PRACTICE-ROOM-
 * VISION.md). The whole song plays in one continuous flow — every section in
 * order, every voice (base + layers) mixed on one shared clock — with the
 * words lighting up karaoke-style and each part's volume one thumb-slide
 * away ("Parts").
 *
 * The 6-year-old contract: at rest, ONE giant lit invitation (the gold play
 * circle) and the words. Playing, the chrome breathes back and the words own
 * the screen; any tap brings the controls home. The end lands warm ("That's
 * your song.") and offers the next act — never a dead stop.
 */

interface SingItPlayerProps {
  sections: PracticeSection[];
  songId: string;
  songTitle: string;
  onClose: () => void;
  /** The deep rehearsal room (loops, speed, takes) — one quiet tap away. */
  onDeepPractice: () => void;
  /**
   * THE NEXT LOOP (peak-end + Zeigarnik): the song just played whole — the
   * one moment "someone should hear this" is most true. Opens the song's
   * share door. Absent (a viewer, or no room to return to) = the end
   * moment simply stands without it.
   */
  onShare?: () => void;
}

const CHROME_REST_MS = 2600;

export function SingItPlayer({
  sections,
  songId,
  songTitle,
  onClose,
  onDeepPractice,
  onShare,
}: SingItPlayerProps) {
  const player = useSingItPlayer(sections, songId);
  const {
    timeline,
    status,
    positionMs,
    sectionIndex,
    gains,
    muted,
    unavailable,
    nothingPlayable,
    basesOnly,
    playPause,
    seekMs,
    setGain,
    toggleMute,
  } = player;

  const [mixerOpen, setMixerOpen] = useState(false);
  const [chromeDimmed, setChromeDimmed] = useState(false);
  const chromeTimer = useRef(0);

  // Chrome recedes while the song sounds; any touch brings it home.
  const wakeChrome = useCallback(() => {
    setChromeDimmed(false);
    window.clearTimeout(chromeTimer.current);
    chromeTimer.current = window.setTimeout(() => {
      setChromeDimmed(true);
    }, CHROME_REST_MS);
  }, []);
  useEffect(() => {
    if (status === "playing" && !mixerOpen) {
      wakeChrome();
    } else {
      window.clearTimeout(chromeTimer.current);
      setChromeDimmed(false);
    }
    return () => window.clearTimeout(chromeTimer.current);
  }, [status, mixerOpen, wakeChrome]);

  const section = timeline.sections[sectionIndex];
  const sectionPositionMs = section ? Math.max(0, positionMs - section.startMs) : 0;

  // ── Nothing playable (offline, cold cache) — honest, with a path back ────
  if (nothingPlayable && status !== "loading") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <div className="pointer-events-none absolute inset-0 cog-glow" />
        <WifiOff size={26} style={{ color: "var(--cog-muted)" }} />
        <p
          className="relative"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--cog-charcoal)",
          }}
        >
          Can't reach this song's audio yet
        </p>
        <p
          className="relative"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            color: "var(--cog-warm-gray)",
            maxWidth: 300,
          }}
        >
          Your song is safe. It will play here the next time this phone can reach it.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="relative cog-press rounded-full px-6 py-2.5 mt-2"
          style={{
            backgroundColor: "var(--cog-gold)",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            border: "none",
            minHeight: 44,
            cursor: "pointer",
          }}
        >
          Back to the song
        </button>
      </div>
    );
  }

  const ended = status === "ended";
  const chromeStyle = {
    opacity: chromeDimmed ? 0.3 : 1,
    transition: "opacity 400ms var(--cog-ease)",
  } as const;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
      onPointerDown={() => {
        if (status === "playing") wakeChrome();
      }}
    >
      <div className="pointer-events-none absolute inset-0 cog-glow" />

      {/* ── Threshold: the song's name + the ribbon ── */}
      <header
        className="relative flex flex-col items-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 44px)",
          paddingInline: 20,
          gap: 10,
          ...chromeStyle,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--cog-charcoal)",
            margin: 0,
            textAlign: "center",
          }}
        >
          {songTitle}
        </h1>

        {/* The ribbon — one segment per section; tap a part to go there. */}
        <div
          className="flex w-full items-center"
          style={{ gap: 3, maxWidth: 480 }}
          role="group"
          aria-label="Song parts — tap one to go there"
        >
          {timeline.sections.map((sec, i) => {
            const secEnd = sec.startMs + sec.durationMs;
            const fillPct =
              positionMs <= sec.startMs
                ? 0
                : positionMs >= secEnd
                  ? 100
                  : ((positionMs - sec.startMs) / sec.durationMs) * 100;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => seekMs(sec.startMs)}
                aria-label={`Go to ${sec.label}`}
                aria-current={i === sectionIndex ? "true" : undefined}
                className="cog-press"
                style={{
                  flex: Math.max(1, sec.durationMs),
                  height: 28,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "100%",
                    height: i === sectionIndex ? 6 : 4,
                    borderRadius: 999,
                    background: `linear-gradient(to right, var(--cog-gold) ${fillPct}%, var(--cog-cream-dark) ${fillPct}%)`,
                    transition: "height 200ms var(--cog-ease)",
                  }}
                />
              </button>
            );
          })}
        </div>
      </header>

      {/* ── The words own the middle ── */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4">
        {ended ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                fontWeight: 600,
                color: "var(--cog-charcoal)",
                margin: 0,
              }}
            >
              That's your song.
            </p>
            <button
              type="button"
              onClick={playPause}
              className="cog-press rounded-full"
              style={{
                minHeight: 52,
                paddingInline: 28,
                backgroundColor: "var(--cog-gold)",
                color: "#fff",
                fontFamily: "var(--font-body)",
                fontSize: "1rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Play it again
            </button>
            {/* The next loop, opened at the peak — the song was just heard
                whole, which is the one moment this is true. Quiet register:
                "Play it again" above stays the moment's one gold. */}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="cog-press rounded-full"
                style={{
                  minHeight: 44,
                  paddingInline: 22,
                  backgroundColor: "transparent",
                  color: "var(--cog-gold)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Someone should hear this
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="cog-press rounded-full"
              style={{
                minHeight: 44,
                paddingInline: 22,
                backgroundColor: "transparent",
                color: "var(--cog-warm-gray)",
                fontFamily: "var(--font-body)",
                fontSize: "0.9375rem",
                fontWeight: 600,
                border: "1px solid var(--cog-border)",
                cursor: "pointer",
              }}
            >
              Back to the song
            </button>
          </div>
        ) : (
          <>
            <p
              aria-live="polite"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--cog-gold)",
                margin: "0 0 10px",
              }}
            >
              {section?.label ?? ""}
            </p>
            <KaraokeLyrics
              lyrics={section?.lyrics ?? null}
              transcriptLines={section?.transcriptLines ?? null}
              currentPositionMs={sectionPositionMs}
              show
              sing
            />
          </>
        )}
      </main>

      {/* ── Honest one-liners ── */}
      {(basesOnly || unavailable.size > 0) && !ended && (
        <p
          className="relative text-center"
          style={{
            margin: "0 24px 8px",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--cog-warm-gray)",
            ...chromeStyle,
          }}
        >
          {basesOnly
            ? "This phone plays one voice at a time — the main parts are playing."
            : "Some voices couldn't load — the song plays on."}
        </p>
      )}

      {/* ── Transport: ONE gold, thumb-arc ── */}
      <footer
        className="relative flex items-center justify-between"
        style={{
          paddingInline: 28,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
          paddingTop: 8,
          ...chromeStyle,
        }}
      >
        <button
          type="button"
          onClick={onDeepPractice}
          className="cog-press"
          style={{
            minHeight: 44,
            padding: "0 8px",
            border: "none",
            background: "transparent",
            color: "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Practice a part
        </button>

        <button
          type="button"
          onClick={playPause}
          disabled={status === "loading"}
          aria-label={status === "playing" ? "Pause" : "Play the song"}
          aria-busy={status === "loading"}
          className="cog-press rounded-full flex items-center justify-center"
          style={{
            width: 72,
            height: 72,
            backgroundColor: "var(--cog-gold)",
            color: "#fff",
            border: "none",
            cursor: status === "loading" ? "default" : "pointer",
            opacity: status === "loading" ? 0.6 : 1,
            boxShadow: "0 6px 24px rgba(184,149,58,0.35)",
          }}
        >
          {status === "playing" ? (
            <Pause size={30} fill="currentColor" />
          ) : (
            <Play size={30} fill="currentColor" style={{ marginLeft: 3 }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMixerOpen(true)}
          className="cog-press flex items-center"
          style={{
            minHeight: 44,
            gap: 6,
            padding: "0 12px",
            borderRadius: 12,
            border: "1px solid var(--cog-border)",
            background: "var(--cog-cream-light)",
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <SlidersHorizontal size={15} />
          Parts
        </button>
      </footer>

      <PartsMixerSheet
        open={mixerOpen}
        onClose={() => setMixerOpen(false)}
        timeline={timeline}
        gains={gains}
        muted={muted}
        unavailable={unavailable}
        onGain={setGain}
        onMute={toggleMute}
      />
    </div>
  );
}
