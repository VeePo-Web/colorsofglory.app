import { useCallback, useEffect, useRef, useState } from "react";
import { Metronome as MetronomeEngine } from "@/lib/audio/metronome";
import { getSong } from "@/integrations/cog/songs";
import { persistSongTempo } from "./songTempo";

/**
 * useCanvasMetronome — the F14 one-tap toggle for the canvas.
 *
 * CONSUMES C4's engine (src/lib/audio/metronome.ts) — same pattern as
 * Capture's transport: created lazily on first play, disposed on unmount,
 * accented downbeat, visual beat driven off the engine's own clock. BPM is
 * seeded from the song's tempo_bpm and persisted back (debounced) on change.
 */

const DEFAULT_BPM = 100;
const PERSIST_DEBOUNCE_MS = 800;

export interface CanvasMetronomeApi {
  running: boolean;
  bpm: number;
  /** 0-indexed beat within the bar while running; -1 when stopped. */
  beat: number;
  beatsPerBar: number;
  toggle: () => Promise<void>;
  setBpm: (bpm: number) => void;
  /** Hard stop — recording starts silence the click so it can never bleed
   *  into a take (the project's never-bleed invariant). */
  stop: () => void;
}

export function useCanvasMetronome(songId: string): CanvasMetronomeApi {
  const engineRef = useRef<MetronomeEngine | null>(null);
  const persistTimer = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [beat, setBeat] = useState(-1);
  const beatsPerBar = 4;

  // Seed from the song's saved tempo.
  useEffect(() => {
    let live = true;
    getSong(songId)
      .then((song) => {
        if (live && song?.tempo_bpm) setBpmState(song.tempo_bpm);
      })
      .catch(() => {
        /* canvas stays usable without the song detail */
      });
    return () => {
      live = false;
    };
  }, [songId]);

  // Release the audio graph when the canvas leaves the tree.
  useEffect(() => {
    return () => {
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (running) {
      engineRef.current?.stop();
      setRunning(false);
      setBeat(-1);
      return;
    }
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine({
        bpm,
        beatsPerBar,
        onBeat: (b) => setBeat(b),
      });
    }
    engineRef.current.setBpm(bpm);
    engineRef.current.setBeatsPerBar(beatsPerBar);
    await engineRef.current.start();
    setRunning(true);
  }, [running, bpm]);

  const setBpm = useCallback(
    (next: number) => {
      const clamped = Math.min(300, Math.max(30, Math.round(next)));
      setBpmState(clamped);
      engineRef.current?.setBpm(clamped);
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        void persistSongTempo(songId, clamped);
      }, PERSIST_DEBOUNCE_MS);
    },
    [songId],
  );

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setRunning(false);
    setBeat(-1);
  }, []);

  return { running, bpm, beat, beatsPerBar, toggle, setBpm, stop };
}
