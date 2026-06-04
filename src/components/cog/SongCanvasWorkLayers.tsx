import { ElementType, ReactNode } from "react";
import { FileText, Mic, Music, Pause, Play, StickyNote } from "lucide-react";

interface SongSection {
  id: string;
  label: string;
  chords: string[];
  lines: string[];
  memo: string;
}

interface VoiceMemo {
  id: string;
  title: string;
  section: string;
  duration: string;
  contributor: string;
  waveform: number[];
}

interface SongCanvasWorkLayersProps {
  activeLayer: string;
}

const SONG_SECTIONS: SongSection[] = [
  {
    id: "verse-1",
    label: "Verse 1",
    chords: ["C", "G", "Am"],
    lines: ["I will wait here in the quiet", "Where Your mercy meets the morning"],
    memo: "Voice Memo 1 - Verse idea - 0:42",
  },
  {
    id: "chorus",
    label: "Chorus",
    chords: ["F", "G", "Am", "C"],
    lines: ["Colors of glory, flooding my sight", "All of my shadows overcome by Your light"],
    memo: "Chorus melody - 1:14",
  },
];

const VOICE_MEMOS: VoiceMemo[] = [
  {
    id: "memo-1",
    title: "First melody idea",
    section: "Verse 1",
    duration: "0:42",
    contributor: "Parker",
    waveform: [20, 34, 26, 42, 30, 50, 34, 24, 44, 32, 22, 38, 28, 46, 24, 36],
  },
  {
    id: "memo-2",
    title: "Chorus hook",
    section: "Chorus",
    duration: "1:14",
    contributor: "Sarah",
    waveform: [24, 40, 18, 52, 34, 28, 44, 30, 22, 48, 36, 20, 42, 28, 38, 24],
  },
  {
    id: "memo-3",
    title: "Bridge lift",
    section: "Bridge",
    duration: "0:28",
    contributor: "Caleb",
    waveform: [30, 22, 44, 18, 36, 50, 24, 40, 28, 34, 20, 46, 32, 26, 42, 18],
  },
];

const NOTES = [
  "Inspired by Psalm 46 - be still before the second verse turns upward.",
  "Bridge needs more space emotionally.",
  "Final chorus can open up with the same chords, not a key change yet.",
];

const CHORD_ROWS = [
  { label: "Intro", chords: ["C", "G", "Am", "F"] },
  { label: "Verse 1", chords: ["C", "G", "Am", "F"] },
  { label: "Chorus", chords: ["F", "G", "Am", "C"] },
  { label: "Bridge", chords: ["Am", "F", "C", "G"] },
];

const SongCanvasWorkLayers = ({ activeLayer }: SongCanvasWorkLayersProps) => (
  <div className="space-y-3">
    <LyricsRoomCard sections={SONG_SECTIONS} active={activeLayer === "lyrics" || activeLayer === "room"} />

    <div className="grid gap-3 md:grid-cols-2">
      <VoiceRoomCard memos={VOICE_MEMOS} active={activeLayer === "voice" || activeLayer === "room"} />
      <ChordRoomCard active={activeLayer === "chords" || activeLayer === "room"} />
    </div>

    <NotesRoomCard active={activeLayer === "notes" || activeLayer === "room"} />
  </div>
);

interface RoomCardProps {
  active?: boolean;
  children: ReactNode;
  id?: string;
}

const RoomCard = ({ active = false, children, id }: RoomCardProps) => (
  <section
    id={id}
    className="rounded-[22px] p-4 transition-colors duration-150"
    style={{
      backgroundColor: "rgba(250,247,242,0.90)",
      border: active ? "1.5px solid var(--cog-border-gold)" : "1px solid rgba(28,26,23,0.08)",
      boxShadow: active ? "0 14px 34px rgba(184,149,58,0.14)" : "0 8px 22px rgba(28,26,23,0.06)",
    }}
  >
    {children}
  </section>
);

const RoomHeading = ({ icon: Icon, eyebrow, title }: { icon: ElementType; eyebrow: string; title: string }) => (
  <div className="mb-3 flex items-start justify-between gap-3">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--cog-muted)" }}>
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
    </div>
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundColor: "rgba(184,149,58,0.10)", color: "var(--cog-gold-alt)" }}
      aria-hidden
    >
      <Icon size={18} strokeWidth={1.7} />
    </span>
  </div>
);

const LyricsRoomCard = ({ sections, active }: { sections: SongSection[]; active: boolean }) => (
  <RoomCard id="layer-lyrics" active={active}>
    <RoomHeading icon={FileText} eyebrow="Write and revise" title="Lyrics" />
    <div className="space-y-5">
      {sections.map((section) => (
        <article key={section.id}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
              {section.label}
            </h3>
            <span className="text-xs" style={{ color: "var(--cog-muted)" }}>
              Autosaved
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {section.chords.map((chord) => (
              <ChordChip key={`${section.id}-${chord}`} label={chord} />
            ))}
          </div>
          <div className="space-y-2">
            {section.lines.map((line) => (
              <p key={line} className="text-[0.96rem] leading-7" style={{ color: "var(--cog-charcoal)" }}>
                {line}
              </p>
            ))}
          </div>
          <div
            className="mt-3 rounded-2xl px-3 py-3"
            style={{ backgroundColor: "rgba(28,26,23,0.035)", border: "1px solid rgba(28,26,23,0.06)" }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium" style={{ color: "var(--cog-warm-gray)" }}>
                {section.memo}
              </span>
              <Play size={14} fill="currentColor" style={{ color: "var(--cog-gold)" }} aria-hidden />
            </div>
            <Waveform bars={[14, 24, 18, 28, 22, 36, 24, 18, 30, 21, 16, 26, 18, 30, 20, 24]} />
          </div>
        </article>
      ))}
    </div>
  </RoomCard>
);

const VoiceRoomCard = ({ memos, active }: { memos: VoiceMemo[]; active: boolean }) => (
  <RoomCard id="layer-voice" active={active}>
    <RoomHeading icon={Mic} eyebrow="Capture audio" title="Voice memos" />
    <div className="space-y-3">
      {memos.map((memo, index) => (
        <VoiceMemoRow key={memo.id} memo={memo} playing={index === 0} />
      ))}
    </div>
  </RoomCard>
);

const VoiceMemoRow = ({ memo, playing }: { memo: VoiceMemo; playing: boolean }) => (
  <article
    className="rounded-2xl p-3"
    style={{ backgroundColor: "rgba(255,255,255,0.36)", border: "1px solid rgba(28,26,23,0.07)" }}
  >
    <div className="mb-2 flex items-start gap-3">
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.95]"
        style={{ backgroundColor: "var(--cog-gold)", color: "#fff", boxShadow: "var(--cog-shadow-fab)" }}
        aria-label={playing ? `Pause ${memo.title}` : `Play ${memo.title}`}
      >
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--cog-charcoal)" }}>
          {memo.title}
        </p>
        <p className="text-xs" style={{ color: "var(--cog-muted)" }}>
          {memo.section} - {memo.duration} - {memo.contributor}
        </p>
      </div>
    </div>
    <Waveform bars={memo.waveform} active={playing} />
  </article>
);

const ChordRoomCard = ({ active }: { active: boolean }) => (
  <RoomCard id="layer-chords" active={active}>
    <RoomHeading icon={Music} eyebrow="Track chords and BPM" title="Chord map" />
    <div className="mb-3 grid grid-cols-2 gap-2">
      <MetricTile label="Key" value="C" />
      <MetricTile label="BPM" value="74" />
    </div>
    <div className="space-y-2">
      {CHORD_ROWS.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl p-3"
          style={{ backgroundColor: "rgba(255,255,255,0.36)", border: "1px solid rgba(28,26,23,0.07)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
              {row.label}
            </p>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--cog-muted)" }}>
              4 beats
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {row.chords.map((chord, index) => (
              <ChordChip key={`${row.label}-${chord}-${index}`} label={chord} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </RoomCard>
);

const NotesRoomCard = ({ active }: { active: boolean }) => (
  <RoomCard id="layer-notes" active={active}>
    <RoomHeading icon={StickyNote} eyebrow="Meaning and memory" title="Song notes" />
    <ul className="space-y-2">
      {NOTES.map((note) => (
        <li key={note} className="flex gap-2 text-sm leading-6" style={{ color: "var(--cog-warm-gray)" }}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--cog-gold)" }} />
          {note}
        </li>
      ))}
    </ul>
  </RoomCard>
);

const MetricTile = ({ label, value }: { label: string; value: string }) => (
  <div
    className="min-h-[64px] rounded-2xl px-3 py-2 text-center"
    style={{ backgroundColor: "rgba(184,149,58,0.08)", border: "1px solid rgba(184,149,58,0.18)" }}
  >
    <p className="text-lg font-semibold" style={{ color: "var(--cog-charcoal)" }}>
      {value}
    </p>
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cog-muted)" }}>
      {label}
    </p>
  </div>
);

const ChordChip = ({ label }: { label: string }) => (
  <span
    className="inline-flex min-h-7 min-w-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold"
    style={{
      backgroundColor: "var(--cog-gold-pale)",
      color: "var(--cog-charcoal)",
      border: "1px solid rgba(184,149,58,0.28)",
    }}
  >
    {label}
  </span>
);

const Waveform = ({ bars, active = true }: { bars: number[]; active?: boolean }) => (
  <div className="flex h-10 items-center gap-1" aria-hidden>
    {bars.map((height, index) => (
      <span
        key={`${height}-${index}`}
        className="block flex-1 rounded-full"
        style={{
          height,
          maxHeight: 40,
          minWidth: 2,
          backgroundColor: active && index < bars.length * 0.45 ? "var(--cog-gold)" : "var(--cog-gold-pale)",
        }}
      />
    ))}
  </div>
);

export default SongCanvasWorkLayers;
