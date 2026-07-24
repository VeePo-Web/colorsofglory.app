import { useEffect, useRef, useState } from "react";
import { Headphones, Waves, X } from "lucide-react";
import {
  AmbientPad,
  clampPadVolume,
  isPadSupported,
  PAD_DEFAULT_VOLUME,
  PAD_MAX_VOLUME,
  PAD_MIN_VOLUME,
  parsePadKey,
  type PadFlavor,
} from "@/lib/audio/pad";
import { MAJOR_KEYS } from "@/lib/chords/keys";

interface PadProps {
  /** The song's key ("G"/"Em") — from key_signature or F13. Null → default C. */
  inheritedKey?: string | null;
  className?: string;
}

const VOLUME_KEY = "cog-pad-volume";
const HINT_KEY = "cog-pad-headphones-hint";

const FLAVORS: Array<{ value: PadFlavor; label: string }> = [
  { value: "neutral", label: "Neutral" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
];

/**
 * Pad — the one-tap ambient tonal bed (the metronome's sibling: Click keeps a
 * hum in time, Pad keeps it in key). Owns the AmbientPad engine lifecycle:
 * lazy-created on the first tap (AudioContext resumed inside the gesture),
 * faded out + disposed on unmount so a drone can never outlive its surface.
 * The key inherits from the song (F13-detected or set) and every one of the
 * 12 keys is one chip-tap away, gliding smoothly while it plays. Neutral
 * fifths by default — consonant under major AND minor melodies.
 */
const Pad = ({ inheritedKey, className }: PadProps) => {
  const engineRef = useRef<AmbientPad | null>(null);
  const userPickedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tonic, setTonic] = useState(() => parsePadKey(inheritedKey)?.tonic ?? "C");
  const [flavor, setFlavor] = useState<PadFlavor>("neutral");
  const [volume, setVolume] = useState(() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      return raw ? clampPadVolume(Number(raw)) : PAD_DEFAULT_VOLUME;
    } catch {
      return PAD_DEFAULT_VOLUME;
    }
  });
  const [showHint, setShowHint] = useState(false);

  // Follow the song's key until the writer explicitly picks their own.
  useEffect(() => {
    if (userPickedRef.current) return;
    const parsed = parsePadKey(inheritedKey);
    if (parsed) {
      setTonic(parsed.tonic);
      engineRef.current?.setKey(parsed.tonic, flavor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inheritedKey]);

  // Never a runaway drone: leaving the surface fades and releases everything.
  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  // Self-heal after an interruption (phone call, screen lock): iOS suspends
  // the context; when the writer returns with the pad toggled on, nudge it
  // back to life instead of showing an ON toggle that plays silence.
  useEffect(() => {
    if (!running) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void engineRef.current?.resumeIfNeeded();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running]);

  const toggle = () => {
    if (running) {
      engineRef.current?.stop();
      setRunning(false);
      return;
    }
    if (!engineRef.current) {
      engineRef.current = new AmbientPad({ tonic, flavor, volume });
    }
    engineRef.current.setKey(tonic, flavor);
    engineRef.current.setVolume(volume);
    void engineRef.current.start(); // ctx.resume() lives inside the gesture
    setRunning(true);
    try {
      if (localStorage.getItem(HINT_KEY) !== "1") setShowHint(true);
    } catch {
      /* hint is a courtesy */
    }
  };

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* noop */
    }
  };

  const pickKey = (nextTonic: string) => {
    userPickedRef.current = true;
    setTonic(nextTonic);
    engineRef.current?.setKey(nextTonic, flavor); // glide, never a jump
  };

  const pickFlavor = (nextFlavor: PadFlavor) => {
    setFlavor(nextFlavor);
    engineRef.current?.setKey(tonic, nextFlavor);
  };

  const changeVolume = (v: number) => {
    const clamped = clampPadVolume(v);
    setVolume(clamped);
    engineRef.current?.setVolume(clamped);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      /* remembered when possible */
    }
  };

  const keyLabel = `${tonic}${flavor === "minor" ? "m" : ""}`;

  // No Web Audio → no pad. Genuinely absent, never a dead control.
  if (!isPadSupported()) return null;

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        {/* The one tap — swell in, fade out */}
        <button
          type="button"
          role="switch"
          aria-checked={running}
          aria-label={running ? `Turn the pad off` : `Play a soft ambient pad in ${keyLabel}`}
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-full transition-transform active:scale-95"
          style={{
            minHeight: 44,
            padding: "0 16px",
            background: running ? "var(--cog-gold)" : "transparent",
            border: running ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border-gold)",
            color: running ? "var(--cog-cream-light)" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Waves size={14} strokeWidth={2} />
          {`Pad · ${keyLabel}`}
        </button>

        {/* Key/flavor/volume — revealed on request, quiet otherwise */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide pad key options" : "Change the pad's key"}
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center justify-center rounded-full transition-transform active:scale-95"
          style={{
            width: 44,
            height: 44,
            background: "transparent",
            border: "1px solid var(--cog-border)",
            color: "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {expanded ? "–" : "♯"}
        </button>
      </div>

      {showHint && (
        <div
          className="flex items-center gap-2 rounded-full"
          style={{
            padding: "6px 8px 6px 14px",
            background: "var(--cog-gold-pale)",
            border: "1px solid var(--cog-border-gold)",
          }}
        >
          <Headphones size={13} strokeWidth={2} style={{ color: "var(--cog-charcoal)" }} />
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-charcoal)" }}>
            Sounds best with headphones
          </span>
          <button
            type="button"
            aria-label="Dismiss the headphones tip"
            onClick={dismissHint}
            className="flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, background: "transparent", border: "none", color: "var(--cog-warm-gray)", cursor: "pointer" }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {expanded && (
        <div className="flex flex-col items-center gap-2" style={{ maxWidth: "100%" }}>
          <div
            data-no-swipe-nav
            className="flex gap-1.5 overflow-x-auto pb-1"
            style={{ maxWidth: "min(92vw, 420px)", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            role="group"
            aria-label="Pad key"
          >
            {MAJOR_KEYS.map((k) => {
              const active = k === tonic;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickKey(k)}
                  aria-pressed={active}
                  className="shrink-0 rounded-lg text-sm font-medium transition-transform active:scale-95"
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    background: active ? "var(--cog-gold)" : "white",
                    border: active ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
                    color: active ? "white" : "var(--cog-charcoal)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full p-0.5" style={{ background: "var(--cog-cream)" }} role="group" aria-label="Pad flavor">
              {FLAVORS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => pickFlavor(f.value)}
                  aria-pressed={flavor === f.value}
                  className="rounded-full px-3 text-xs"
                  style={{
                    minHeight: 36,
                    background: flavor === f.value ? "var(--cog-gold)" : "transparent",
                    color: flavor === f.value ? "white" : "var(--cog-charcoal)",
                    border: "none",
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="range"
              min={PAD_MIN_VOLUME}
              max={PAD_MAX_VOLUME}
              step={0.01}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Pad volume"
              // Dragging the volume is a left/right gesture — it must never be
              // hijacked by the page-swipe nav (Songs ← Capture → Circle).
              // useSwipeNav now opts out range inputs by type; this is belt-and-
              // suspenders and documents the intent at the control.
              data-no-swipe-nav
              style={{ width: 90, accentColor: "var(--cog-gold)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Pad;
