/**
 * Metronome — a sample‑accurate Web Audio click (F14, One‑Tap Metronome).
 *
 * A songwriter humming into Capture needs a steady pulse so the take is usable
 * later. Naïve `setInterval` beeps drift badly under load; this uses the
 * canonical **lookahead scheduler** (a coarse `setTimeout` that schedules
 * precise clicks slightly ahead on the Web Audio clock), so timing stays
 * rock‑solid even when the main thread is busy recording.
 *
 * Clicks are synthesised (short oscillator + fast gain envelope) — no audio
 * assets to bundle. Beat 1 of each bar is accented (higher pitch, louder). A
 * visual `onBeat` callback is driven off the same clock via rAF so the dots and
 * the sound agree.
 *
 * No React, no DOM. Construct, `start()`, `stop()`, `dispose()`.
 *
 * PUBLIC API (the one engine every metronome surface drives — Capture/C2,
 * Canvas toggle/D2, Practice speed-trainer/F2; consumers own their transport
 * chrome, never a second click implementation):
 *
 *   const m = new Metronome({ bpm, beatsPerBar, countIn?, onBeat?, onCountInDone? })
 *   await m.start()        // resume()s the context — call from a user gesture
 *   m.stop()               // silences + clears the visual queue; restartable
 *   m.dispose()            // stop() + release the AudioContext (on unmount)
 *   m.setBpm(n)            // LIVE: next scheduled interval picks it up — no
 *   m.setBeatsPerBar(n)    //  glitch, no double click; F2 ramps tempo mid-run
 *   m.isRunning            // boolean
 *
 * Count-in: with `countIn: true`, start() plays ONE bar of clicks first;
 * `onBeat` stays silent during it and `onCountInDone` fires (on the audio
 * clock) as the first real beat sounds.
 */

export interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  /** Play one count-in bar before counting "real" beats. */
  countIn?: boolean;
  /** Fires on each audible beat: 0‑indexed beat within the bar. */
  onBeat?: (beatInBar: number) => void;
  /** Fires once the count‑in bar finishes (if countIn was set). */
  onCountInDone?: () => void;
}

const LOOKAHEAD_MS = 25; // how often the scheduler wakes
const SCHEDULE_AHEAD_S = 0.12; // how far ahead we queue clicks

const ACCENT_FREQ = 1500; // beat 1
const BEAT_FREQ = 900; // other beats
const ACCENT_GAIN = 0.5;
const BEAT_GAIN = 0.32;
const CLICK_S = 0.04; // click envelope length

export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;

  private bpm: number;
  private beatsPerBar: number;
  private readonly onBeat?: (beatInBar: number) => void;
  private readonly countIn: boolean;
  private readonly onCountInDone?: () => void;

  private nextNoteTime = 0; // Web Audio time of the next click
  private beatInBar = 0; // counter for the next click to schedule
  private countInRemaining = 0; // count-in beats still to schedule
  private running = false;

  // Visual queue the rAF loop fires as the clock passes each entry.
  // beat === -1 marks a count-in click (no onBeat); countInDone fires the
  // completion callback exactly when the first real beat sounds.
  private visualQueue: Array<{ beat: number; time: number; countInDone?: boolean }> = [];

  constructor(opts: MetronomeOptions) {
    this.bpm = clampBpm(opts.bpm);
    this.beatsPerBar = Math.max(1, Math.min(12, Math.round(opts.beatsPerBar)));
    this.onBeat = opts.onBeat;
    this.countIn = opts.countIn ?? false;
    this.onCountInDone = opts.onCountInDone;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Change tempo live; the next scheduled interval picks it up immediately. */
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
  }

  setBeatsPerBar(n: number): void {
    this.beatsPerBar = Math.max(1, Math.min(12, Math.round(n)));
  }

  async start(): Promise<void> {
    if (this.running) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // no Web Audio → silent no‑op, never throw
    if (!this.ctx) this.ctx = new Ctor();
    // Autoplay policy: a user gesture is required; resume() here is that gesture.
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.running = true;
    this.beatInBar = 0;
    this.countInRemaining = this.countIn ? this.beatsPerBar : 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
    this.drainVisuals();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.visualQueue = [];
  }

  /** Stop and release the audio context. Call on unmount. */
  dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  private scheduler(): void {
    if (!this.ctx) return;
    const secondsPerBeat = 60 / this.bpm;
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      if (this.countInRemaining > 0) {
        // Count-in bar: clicks sound (accent on its first beat) but the visual
        // callback stays quiet; the last count-in beat arms onCountInDone so it
        // fires on the audio clock, right as the first real beat lands.
        const isFirst = this.countInRemaining === this.beatsPerBar;
        this.scheduleClick(isFirst, this.nextNoteTime);
        this.countInRemaining--;
        if (this.countInRemaining === 0) {
          this.visualQueue.push({
            beat: -1,
            time: this.nextNoteTime + secondsPerBeat,
            countInDone: true,
          });
        }
        this.nextNoteTime += secondsPerBeat;
        continue;
      }
      const beat = this.beatInBar % this.beatsPerBar;
      this.scheduleClick(beat === 0, this.nextNoteTime);
      this.visualQueue.push({ beat, time: this.nextNoteTime });
      this.nextNoteTime += secondsPerBeat;
      this.beatInBar = (this.beatInBar + 1) % this.beatsPerBar;
    }
  }

  private scheduleClick(accent: boolean, time: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? ACCENT_FREQ : BEAT_FREQ;
    const peak = accent ? ACCENT_GAIN : BEAT_GAIN;
    // Fast percussive envelope so each click is a tick, not a tone.
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_S);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + CLICK_S);
  }

  private drainVisuals = (): void => {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;
    while (this.visualQueue.length && this.visualQueue[0].time <= now) {
      const { beat, countInDone } = this.visualQueue.shift()!;
      if (countInDone) this.onCountInDone?.();
      if (beat >= 0) this.onBeat?.(beat);
    }
    this.raf = requestAnimationFrame(this.drainVisuals);
  };
}

function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 100;
  return Math.min(300, Math.max(30, Math.round(bpm)));
}
