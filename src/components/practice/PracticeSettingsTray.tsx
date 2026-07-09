import { X, Zap, Timer, Gauge, Repeat, Volume2, Minus, Plus, AudioLines } from "lucide-react";
import type { PracticePlayerState, LoopMode, SpeedTrainerConfig } from "@/lib/audio/practiceTypes";
import { effectiveClickBpm } from "@/hooks/usePracticePlayer";

interface PracticeSettingsTrayProps {
  state: PracticePlayerState;
  onClose: () => void;
  onSetLoopMode: (mode: LoopMode) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  onSetGapMs: (gap: 0 | 500 | 1000 | 2000) => void;
  onSetRepeatPerSection: (n: 1 | 2 | 3) => void;
  onSetCountIn: (enabled: boolean) => void;
  onSetSpeedTrainer: (patch: Partial<SpeedTrainerConfig>) => void;
  onSetTimerMinutes: (minutes: number | null) => void;
  onToggleMetronome: () => void;
  onSetBpm: (bpm: number) => void;
}

const SPEEDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.1, 1.2, 1.25, 1.5, 2.0];
const GAPS: Array<{ ms: 0 | 500 | 1000 | 2000; label: string }> = [
  { ms: 0,    label: "None" },
  { ms: 500,  label: "0.5 s" },
  { ms: 1000, label: "1 s" },
  { ms: 2000, label: "2 s" },
];
const LOOP_MODES: Array<{ value: LoopMode; label: string; sub: string }> = [
  { value: "single",     label: "Single",     sub: "Loop one section" },
  { value: "sequence",   label: "Sequence",   sub: "Custom order" },
  { value: "all",        label: "All sections", sub: "Cycle through all" },
  { value: "run-through", label: "Run-through", sub: "Play once in order" },
];
const TIMER_OPTIONS = [
  { minutes: null, label: "Off" },
  { minutes: 5,   label: "5 m" },
  { minutes: 10,  label: "10 m" },
  { minutes: 15,  label: "15 m" },
  { minutes: 30,  label: "30 m" },
];
const REPEATS: Array<{ n: 1 | 2 | 3; label: string }> = [
  { n: 1, label: "×1" },
  { n: 2, label: "×2" },
  { n: 3, label: "×3" },
];

export function PracticeSettingsTray({
  state,
  onClose,
  onSetLoopMode,
  onSetPlaybackSpeed,
  onSetGapMs,
  onSetRepeatPerSection,
  onSetCountIn,
  onSetSpeedTrainer,
  onSetTimerMinutes,
  onToggleMetronome,
  onSetBpm,
}: PracticeSettingsTrayProps) {
  const timerMinutes = state.timerEndTimeMs
    ? Math.round((state.timerEndTimeMs - Date.now()) / 60000)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(28,26,23,0.40)" }}
        onClick={onClose}
      />

      {/* Tray */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-y-auto"
        style={{
          backgroundColor: "var(--cog-cream)",
          maxHeight: "80vh",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          animation: "tray-in 300ms var(--cog-ease-reveal) both",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="rounded-full"
            style={{ width: 36, height: 4, backgroundColor: "var(--cog-border)" }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--cog-charcoal)",
            }}
          >
            Practice settings
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "rgba(28,26,23,0.06)",
              color: "var(--cog-warm-gray)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-8" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Loop mode */}
          <SettingsSection icon={<Repeat size={16} />} label="Loop mode">
            <div className="flex flex-col gap-2">
              {LOOP_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => onSetLoopMode(m.value)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
                  style={{
                    backgroundColor: state.loopMode === m.value
                      ? "rgba(184,149,58,0.12)"
                      : "rgba(28,26,23,0.04)",
                    border: state.loopMode === m.value
                      ? "1.5px solid rgba(184,149,58,0.50)"
                      : "1.5px solid transparent",
                  }}
                >
                  <div className="text-left">
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--cog-charcoal)" }}>
                      {m.label}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-warm-gray)" }}>
                      {m.sub}
                    </div>
                  </div>
                  {state.loopMode === m.value && (
                    <div
                      className="rounded-full"
                      style={{ width: 8, height: 8, backgroundColor: "var(--cog-gold)" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Playback speed */}
          <SettingsSection icon={<Gauge size={16} />} label="Playback speed">
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map(speed => (
                <button
                  key={speed}
                  onClick={() => onSetPlaybackSpeed(speed)}
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    height: 36,
                    paddingInline: 14,
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-body)",
                    backgroundColor: state.playbackSpeed === speed
                      ? "var(--cog-gold)"
                      : "rgba(28,26,23,0.06)",
                    color: state.playbackSpeed === speed ? "#fff" : "var(--cog-charcoal)",
                    border: "none",
                  }}
                >
                  {speed === 1.0 ? "1×" : `${speed}×`}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Gap between loops */}
          <SettingsSection icon={<Volume2 size={16} />} label="Gap between loops">
            <div className="flex gap-2">
              {GAPS.map(g => (
                <button
                  key={g.ms}
                  onClick={() => onSetGapMs(g.ms)}
                  className="flex-1 flex items-center justify-center rounded-xl py-2.5 transition-all"
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-body)",
                    backgroundColor: state.gapMs === g.ms
                      ? "var(--cog-gold)"
                      : "rgba(28,26,23,0.06)",
                    color: state.gapMs === g.ms ? "#fff" : "var(--cog-charcoal)",
                    border: "none",
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Repeats per section (sequence mode) */}
          {state.loopMode === "sequence" && (
            <SettingsSection icon={<Repeat size={16} />} label="Repeats per section">
              <div className="flex gap-2">
                {REPEATS.map(r => (
                  <button
                    key={r.n}
                    onClick={() => onSetRepeatPerSection(r.n)}
                    className="flex-1 flex items-center justify-center rounded-xl py-2.5 transition-all"
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-body)",
                      backgroundColor: state.repeatPerSection === r.n
                        ? "var(--cog-gold)"
                        : "rgba(28,26,23,0.06)",
                      color: state.repeatPerSection === r.n ? "#fff" : "var(--cog-charcoal)",
                      border: "none",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </SettingsSection>
          )}

          {/* Practice timer */}
          <SettingsSection icon={<Timer size={16} />} label="Practice timer">
            <div className="flex flex-wrap gap-2">
              {TIMER_OPTIONS.map(opt => {
                const isActive = opt.minutes === null
                  ? state.timerEndTimeMs === null
                  : timerMinutes === opt.minutes;
                return (
                  <button
                    key={opt.label}
                    onClick={() => {
                      if (opt.minutes === null) {
                        onSetTimerMinutes(null);
                      } else {
                        onSetTimerMinutes(opt.minutes);
                      }
                    }}
                    className="flex items-center justify-center rounded-full transition-all"
                    style={{
                      height: 36,
                      paddingInline: 16,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-body)",
                      backgroundColor: isActive ? "var(--cog-gold)" : "rgba(28,26,23,0.06)",
                      color: isActive ? "#fff" : "var(--cog-charcoal)",
                      border: "none",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </SettingsSection>

          {/* Speed Trainer */}
          <SettingsSection icon={<Zap size={16} />} label="Speed Trainer">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--cog-charcoal)" }}>
                    Auto-advance speed
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-warm-gray)" }}>
                    Start slow, ramp to 1× over time
                  </div>
                </div>
                <ToggleSwitch
                  enabled={state.speedTrainer.enabled}
                  onToggle={() => onSetSpeedTrainer({ enabled: !state.speedTrainer.enabled })}
                />
              </div>
              {state.speedTrainer.enabled && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: "rgba(184,149,58,0.08)" }}
                >
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--cog-warm-gray)" }}>
                    Current speed: <span style={{ fontWeight: 600, color: "var(--cog-gold)" }}>{state.speedTrainer.currentSpeed}×</span>
                    {" · "}
                    Loops at this speed: <span style={{ fontWeight: 600, color: "var(--cog-charcoal)" }}>{state.speedTrainer.loopsAtCurrentSpeed}/{state.speedTrainer.loopsPerStep}</span>
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>

          {/* Metronome */}
          <SettingsSection icon={<AudioLines size={16} />} label="Metronome">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--cog-charcoal)" }}>
                    Click while practicing
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-warm-gray)" }}>
                    {state.bpmFromSong ? "Tempo from your song sheet" : "Set your tempo below"}
                  </div>
                </div>
                <ToggleSwitch
                  enabled={state.metronomeOn}
                  onToggle={onToggleMetronome}
                />
              </div>

              {/* Tempo stepper */}
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: "rgba(28,26,23,0.04)" }}
              >
                <button
                  onClick={() => onSetBpm(state.bpm - 5)}
                  aria-label="Slower tempo"
                  className="flex items-center justify-center rounded-full active:scale-95"
                  style={{ width: 36, height: 36, backgroundColor: "rgba(28,26,23,0.06)", border: "none", color: "var(--cog-charcoal)" }}
                >
                  <Minus size={16} />
                </button>
                <div className="text-center">
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.375rem", fontWeight: 700, color: "var(--cog-charcoal)", lineHeight: 1.1 }}>
                    {state.bpm}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--cog-warm-gray)" }}>
                    bpm
                  </div>
                </div>
                <button
                  onClick={() => onSetBpm(state.bpm + 5)}
                  aria-label="Faster tempo"
                  className="flex items-center justify-center rounded-full active:scale-95"
                  style={{ width: 36, height: 36, backgroundColor: "rgba(28,26,23,0.06)", border: "none", color: "var(--cog-charcoal)" }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* The click follows the speed trainer, not just the song. */}
              {effectiveClickBpm(state) !== state.bpm && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: "rgba(184,149,58,0.08)" }}
                >
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--cog-warm-gray)" }}>
                    Clicking at <span style={{ fontWeight: 600, color: "var(--cog-gold)" }}>{effectiveClickBpm(state)} bpm</span>
                    {" — "}your tempo scaled by the current playback speed.
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>

          {/* Count-in */}
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 500, color: "var(--cog-charcoal)" }}>
                Count-in
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-warm-gray)" }}>
                1-bar count before each loop
              </div>
            </div>
            <ToggleSwitch
              enabled={state.countInEnabled}
              onToggle={() => onSetCountIn(!state.countInEnabled)}
            />
          </div>

        </div>
      </div>

      <style>{`
        @keyframes tray-in {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function SettingsSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--cog-warm-gray)" }}>{icon}</span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--cog-warm-gray)",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      className="relative flex-shrink-0 rounded-full transition-colors"
      style={{
        width: 48,
        height: 28,
        backgroundColor: enabled ? "var(--cog-gold)" : "rgba(28,26,23,0.15)",
        transition: "background-color 200ms",
        border: "none",
        padding: 0,
      }}
    >
      <div
        className="absolute top-1 rounded-full bg-white transition-transform"
        style={{
          width: 20,
          height: 20,
          left: 4,
          transform: enabled ? "translateX(20px)" : "translateX(0)",
          transition: "transform 200ms var(--cog-ease)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.20)",
        }}
      />
    </button>
  );
}
