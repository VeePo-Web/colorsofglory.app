import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetAudioSessionForTests,
  canPlayReferenceAloud,
  deriveClickMode,
  getAudioSession,
  getClickMode,
  setMonitorPreference,
  setRecordingArmed,
  subscribeAudioSession,
} from "./audioSession";

describe("audioSession — the never-bleed invariant", () => {
  beforeEach(() => {
    __resetAudioSessionForTests();
  });

  it("is audible when nothing is recording, whatever the output", () => {
    expect(deriveClickMode({ recordingArmed: false, outputRoute: "unknown", monitorPreference: false })).toBe("audible");
    expect(deriveClickMode({ recordingArmed: false, outputRoute: "assumed-speaker", monitorPreference: false })).toBe("audible");
    expect(deriveClickMode({ recordingArmed: false, outputRoute: "confirmed-headphones", monitorPreference: true })).toBe("audible");
  });

  it("goes SILENT the moment the mic arms on anything but confirmed headphones", () => {
    expect(deriveClickMode({ recordingArmed: true, outputRoute: "assumed-speaker", monitorPreference: false })).toBe("silent");
    // "unknown" is treated exactly like a speaker — never assume headphones.
    expect(deriveClickMode({ recordingArmed: true, outputRoute: "unknown", monitorPreference: false })).toBe("silent");
  });

  it("allows the audible click while recording ONLY on confirmed headphones", () => {
    expect(deriveClickMode({ recordingArmed: true, outputRoute: "confirmed-headphones", monitorPreference: true })).toBe("audible");
  });

  it("arms and releases through the live store, and the guide follows the same rule", () => {
    expect(getClickMode()).toBe("audible");
    setRecordingArmed(true);
    expect(getClickMode()).toBe("silent");
    expect(canPlayReferenceAloud()).toBe(false);
    setMonitorPreference(true); // "I'm on earbuds"
    expect(getClickMode()).toBe("audible");
    expect(canPlayReferenceAloud()).toBe(true);
    setRecordingArmed(false);
    expect(getClickMode()).toBe("audible");
  });

  it("confirming earbuds mid-take flips the route; withdrawing it silences again", () => {
    setRecordingArmed(true);
    setMonitorPreference(true);
    expect(getAudioSession().outputRoute).toBe("confirmed-headphones");
    setMonitorPreference(false);
    expect(getClickMode()).toBe("silent");
  });

  it("notifies subscribers exactly when state changes (the engine's mute hook)", () => {
    let calls = 0;
    const off = subscribeAudioSession(() => {
      calls += 1;
    });
    setRecordingArmed(true);
    setRecordingArmed(true); // no-op — same state must not re-emit
    expect(calls).toBe(1);
    off();
    setRecordingArmed(false);
    expect(calls).toBe(1);
  });
});
