import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  ensureOutputWatch,
  getAudioSession,
  getClickMode,
  setMonitorPreference,
  subscribeAudioSession,
  type AudioSessionState,
  type ClickMode,
} from "@/lib/audio/audioSession";

export interface UseAudioSessionReturn {
  session: AudioSessionState;
  /** "audible" when the click may sound right now; "silent" = visual/haptic only. */
  clickMode: ClickMode;
  /** True when the user (or the platform) has confirmed a headphone output. */
  headphonesConfirmed: boolean;
  /** The calm "I'm on headphones / earbuds" toggle. Persisted. */
  setHeadphones: (on: boolean) => void;
}

/**
 * React view of the audio-session authority (see lib/audio/audioSession).
 * Mounting this hook also arms the best-effort output-route watcher, so
 * unplugging headphones mid-take silences the click the same instant.
 */
export function useAudioSession(): UseAudioSessionReturn {
  const session = useSyncExternalStore(subscribeAudioSession, getAudioSession, getAudioSession);

  useEffect(() => {
    ensureOutputWatch();
  }, []);

  const setHeadphones = useCallback((on: boolean) => setMonitorPreference(on), []);

  return {
    session,
    clickMode: getClickMode(),
    headphonesConfirmed: session.outputRoute === "confirmed-headphones",
    setHeadphones,
  };
}
