/**
 * audioSession — the single authority both the metronome and the recorder
 * consult, and the enforcement point of the hard invariant:
 *
 *   WHILE THE MICROPHONE IS ARMED, NOTHING PLAYS THROUGH THE SPEAKER.
 *
 * An audible click — or an audible base-take guide during "record over this" —
 * is permitted ONLY into a CONFIRMED headphone/earbud output. Otherwise the
 * metronome runs visual + haptic. Bleed is ACOUSTIC (speaker → air → mic): no
 * audio-graph routing, no setSinkId, and no echoCancellation can prevent it.
 * The only real mechanisms are physical isolation (headphones) or not making
 * the sound. This module encodes exactly that, once, for every consumer.
 *
 * Output-route detection is best-effort: Chrome/Android often expose device
 * labels; iOS Safari effectively never does. When the platform can't tell us,
 * we assume SPEAKER — the dangerous failure is a false "headphones" that
 * bleeds, never a false "speaker" that stays quiet. Only an explicit user
 * confirmation ("I'm on earbuds") or a reliable platform signal sets
 * "confirmed". Unplugging headphones mid-take drops the route instantly.
 *
 * Framework-free external store (subscribe/getSnapshot) so the Web Audio
 * engine can consult it without React, and React can read it through
 * useSyncExternalStore (see useAudioSession).
 */

export type OutputRoute = "confirmed-headphones" | "assumed-speaker" | "unknown";
export type ClickMode = "audible" | "silent";

export interface AudioSessionState {
  /** True from just before the mic opens until every stop path releases it. */
  recordingArmed: boolean;
  /** Best-effort output route. "unknown" is treated exactly like a speaker. */
  outputRoute: OutputRoute;
  /** The user's explicit "I'm on headphones/earbuds" confirmation (persisted). */
  monitorPreference: boolean;
}

const MONITOR_PREF_KEY = "cog-monitor-headphones";

type Listener = () => void;

/**
 * "I'm on earbuds" is a statement about NOW, so it persists for the SESSION
 * only (sessionStorage). A localStorage version shipped briefly — a week-old
 * confirmation re-enabling the audible click on today's speaker take is a
 * bleed waiting to happen — so any stale copy is purged on load.
 */
function readMonitorPref(): boolean {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(MONITOR_PREF_KEY);
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(MONITOR_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

let state: AudioSessionState = {
  recordingArmed: false,
  outputRoute: readMonitorPref() ? "confirmed-headphones" : "unknown",
  monitorPreference: readMonitorPref(),
};

const listeners = new Set<Listener>();
let deviceListenerWired = false;

function emit(next: Partial<AudioSessionState>): void {
  const merged = { ...state, ...next };
  if (
    merged.recordingArmed === state.recordingArmed &&
    merged.outputRoute === state.outputRoute &&
    merged.monitorPreference === state.monitorPreference
  ) {
    return;
  }
  state = merged;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* one bad listener must never break the invariant for the rest */
    }
  });
}

/** Words that reliably mark a headphone/earbud output in device labels. */
const HEADPHONE_LABEL = /headphone|headset|earbud|earphone|airpod|buds/i;

/**
 * Best-effort route inference from enumerateDevices(). Labels are only
 * populated once the user has granted mic permission at least once; before
 * that (and on iOS Safari always) we learn nothing and stay conservative.
 */
async function inferRouteFromDevices(): Promise<OutputRoute> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((d) => d.kind === "audiooutput" && d.label);
    if (outputs.length === 0) return "unknown";
    if (outputs.some((d) => HEADPHONE_LABEL.test(d.label))) return "confirmed-headphones";
    return "assumed-speaker";
  } catch {
    return "unknown";
  }
}

/**
 * Re-derive the output route from platform signals + the persisted user
 * confirmation. The user's explicit confirmation wins over an ambiguous
 * platform reading, but a positive platform detection also confirms.
 */
export async function reevaluateOutputRoute(): Promise<void> {
  const detected = await inferRouteFromDevices();
  if (detected === "confirmed-headphones") {
    emit({ outputRoute: "confirmed-headphones" });
    return;
  }
  if (state.monitorPreference) {
    // Platform can't see headphones but the user said they're wearing them.
    // Exception: a positive "speaker" reading AFTER a devicechange means the
    // headphones the user confirmed were just unplugged — believe the device.
    emit({ outputRoute: detected === "assumed-speaker" ? "assumed-speaker" : "confirmed-headphones" });
    if (detected === "assumed-speaker") setMonitorPreference(false);
    return;
  }
  emit({ outputRoute: detected });
}

/** Wire the devicechange listener once (idempotent; torn down never — app-lifetime). */
export function ensureOutputWatch(): void {
  if (deviceListenerWired) return;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return;
  deviceListenerWired = true;
  navigator.mediaDevices.addEventListener("devicechange", () => {
    // Unplugging mid-record must silence the click INSTANTLY — the metronome
    // engine is subscribed and mutes already-scheduled clicks on this emit.
    void reevaluateOutputRoute();
  });
  void reevaluateOutputRoute();
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** The recorder calls this just before getUserMedia and clears it on every stop path. */
export function setRecordingArmed(armed: boolean): void {
  emit({ recordingArmed: armed });
  if (armed) {
    // The arm moment is when the route matters most: wire the devicechange
    // watcher (some record paths never mount the React hook that usually
    // does) and re-verify the route. Detection can only make things SAFER
    // mid-arm — a downgrade silences the click instantly; an upgrade merely
    // allows what confirmed headphones already allow.
    ensureOutputWatch();
    void reevaluateOutputRoute();
  }
}

/** The calm "I'm on headphones / earbuds" control. Session-scoped (see above). */
export function setMonitorPreference(on: boolean): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      if (on) sessionStorage.setItem(MONITOR_PREF_KEY, "1");
      else sessionStorage.removeItem(MONITOR_PREF_KEY);
    }
  } catch {
    /* persistence is a nicety; the session state still updates */
  }
  emit({
    monitorPreference: on,
    outputRoute: on ? "confirmed-headphones" : "unknown",
  });
  if (!on) void reevaluateOutputRoute();
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function getAudioSession(): AudioSessionState {
  return state;
}

/**
 * The invariant, as a single derivation every consumer shares:
 * audible ONLY when not recording, or when the output is confirmed headphones.
 */
export function deriveClickMode(s: AudioSessionState): ClickMode {
  if (!s.recordingArmed) return "audible";
  return s.outputRoute === "confirmed-headphones" ? "audible" : "silent";
}

export function getClickMode(): ClickMode {
  return deriveClickMode(state);
}

/**
 * Whether the base-take guide ("record over this" reference audio) may play
 * aloud right now. Same rule as the click — during an armed recording it is
 * headphones-only, structurally.
 */
export function canPlayReferenceAloud(): boolean {
  return deriveClickMode(state) === "audible";
}

export function subscribeAudioSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: reset module state between specs. */
export function __resetAudioSessionForTests(): void {
  state = { recordingArmed: false, outputRoute: "unknown", monitorPreference: false };
  listeners.clear();
  deviceListenerWired = false;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(MONITOR_PREF_KEY);
    if (typeof localStorage !== "undefined") localStorage.removeItem(MONITOR_PREF_KEY);
  } catch {
    /* noop */
  }
}
