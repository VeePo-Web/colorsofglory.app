import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Plus, Hash, Type, Ruler, Pencil, Check, Copy, Play, Guitar, Wand2 } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BackHeader from "@/components/cog/BackHeader";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";
import {
  parseChordPro,
  parseChordProLine,
  lineToChordPro,
  renderChordsOverLyrics,
  toChordPro,
  transposeKeyLetter,
  type SheetLine,
} from "@/lib/chords/sheet";
import { chordToLetters, type NumberChord } from "@/lib/chords/nashville";
import { countLineSyllables } from "@/lib/lyrics/syllables";
import { MAJOR_KEYS } from "@/lib/chords/keys";
import PerformanceView from "@/components/songsheet/PerformanceView";
import ChordPlaceSheet from "@/components/songsheet/ChordPlaceSheet";
import ChordDiagramSheet from "@/components/songsheet/ChordDiagramSheet";
import { looksLikeChordsOverLyrics, chordsOverLyricsToChordPro } from "@/lib/chords/importChart";

/**
 * The Song Sheet — the structured, performable lyric & chord view, and a real
 * ChordPro tool: paste/edit a chart (the power view), see it render with chords
 * over their syllables, transpose one-tap (free — Nashville-first storage),
 * switch Letters/Numbers, show per-line syllable counts, and copy it back out
 * as ChordPro. A local draft means nothing is ever lost. Mobile-first, COG
 * tokens, calm. Lives at /songs/:id/sheet — additive, never touches Canvas.
 */

const SAMPLE = [
  "{start_of_verse: Verse 1}",
  "[C]Lord I [G]wait for [Am]You",
  "In the [F]stillness [C]I am [G]found",
  "{start_of_chorus: Chorus}",
  "[F]You are the [C]anchor [G]of my [Am]song",
  "[F]Colors of [C]glory [G]all a[Am]long",
].join("\n");

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function draftKey(id?: string) {
  return `cog-sheet-draft:${id ?? "1"}`;
}
function readDraft(id?: string): { source: string; sourceKey: string } | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string | undefined, source: string, sourceKey: string) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify({ source, sourceKey }));
  } catch {
    /* draft is best-effort; never block editing */
  }
}

const SongSheetPage = () => {
  const { id } = useParams<{ id: string }>();
  const songTitle = useSongTitle(id);

  const draft = useMemo(() => readDraft(id), [id]);
  const [source, setSource] = useState(draft?.source ?? SAMPLE);
  const [sourceKey, setSourceKey] = useState(draft?.sourceKey ?? "C");
  const [displayKey, setDisplayKey] = useState(draft?.sourceKey ?? "C");
  const [display, setDisplay] = useState<"letters" | "numbers">("letters");
  const [showSyllables, setShowSyllables] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [perform, setPerform] = useState(false);
  const [chordMode, setChordMode] = useState(false);
  const [placing, setPlacing] = useState<{ lineIndex: number; at: number; word: string; current?: NumberChord } | null>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [capo, setCapo] = useState(0);

  // Place (or clear) a chord on exactly one source line — preserves all other
  // formatting/directives by only rewriting that line.
  const setChordAt = (lineIndex: number, at: number, chord: NumberChord | null) => {
    setSource((prev) => {
      const lines = prev.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return prev;
      const parsed = parseChordProLine(lines[lineIndex], sourceKey);
      let anchors = parsed.anchors.filter((a) => a.at !== at);
      if (chord) anchors = [...anchors, { chord, at }].sort((a, b) => a.at - b.at);
      lines[lineIndex] = lineToChordPro({ text: parsed.text, anchors }, sourceKey);
      return lines.join("\n");
    });
  };

  // Persist the draft so a captured chart is never lost.
  useEffect(() => writeDraft(id, source, sourceKey), [id, source, sourceKey]);
  // Changing the chart's own key re-bases the display key.
  useEffect(() => setDisplayKey(sourceKey), [sourceKey]);

  const sections = useMemo(() => parseChordPro(source, sourceKey), [source, sourceKey]);
  const stepKey = (s: number) => setDisplayKey((k) => transposeKeyLetter(k, "major", s));

  // With a capo, you PLAY the shapes of a lower key while it SOUNDS in displayKey.
  // Everything visual (chords, diagrams, performance) renders in the play key.
  const playKey = capo > 0 ? transposeKeyLetter(displayKey, "major", -capo) : displayKey;

  // Unique chords used in the song (as played, capo-aware) for the diagram strip.
  const uniqueChords = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const section of sections) {
      for (const line of section.lines) {
        for (const a of line.anchors) {
          const label = chordToLetters(a.chord, playKey, "major");
          if (!seen.has(label)) {
            seen.add(label);
            list.push(label);
          }
        }
      }
    }
    return list;
  }, [sections, playKey]);

  const copyChordPro = async () => {
    try {
      await navigator.clipboard.writeText(toChordPro(sections, displayKey, "major"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; silently no-op */
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 88 }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 50% 85%, var(--cog-gold-glow) 0%, transparent 65%)" }}
      />

      <BackHeader to={`/songs/${id}`} label="Song" />

      <div className="relative flex flex-col flex-1 px-5" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}>
        <div className="flex justify-center mt-1 mb-3">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-center mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", fontSize: "clamp(1.75rem, 6vw, 2.5rem)", lineHeight: 1.1 }}
        >
          {songTitle}
        </h1>
        <p className="text-xs text-center mb-5" style={{ color: "var(--cog-muted)" }}>
          {editing
            ? "Edit chart · ChordPro"
            : `Song sheet · ${display === "numbers" ? "Nashville numbers" : `Key of ${displayKey}`}${capo > 0 && display !== "numbers" ? ` · Capo ${capo} (play ${playKey})` : ""}`}
        </p>

        {editing ? (
          <ChordProEditPanel
            source={source}
            sourceKey={sourceKey}
            onSource={setSource}
            onSourceKey={setSourceKey}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            {/* Control bar */}
            <div
              className="flex items-center gap-2 mb-3 rounded-2xl p-2.5 flex-wrap"
              style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
            >
              <div className="flex items-center gap-1.5">
                <KeyButton label="Lower key" onClick={() => stepKey(-1)} disabled={display === "numbers"}>
                  <Minus size={16} strokeWidth={2.2} />
                </KeyButton>
                <span className="text-sm font-semibold tabular-nums text-center" style={{ color: "var(--cog-charcoal)", minWidth: 34 }}>
                  {display === "numbers" ? "1–7" : displayKey}
                </span>
                <KeyButton label="Raise key" onClick={() => stepKey(1)} disabled={display === "numbers"}>
                  <Plus size={16} strokeWidth={2.2} />
                </KeyButton>
              </div>

              <span style={{ flex: 1 }} />

              <div className="flex rounded-full p-0.5" style={{ backgroundColor: "var(--cog-cream)" }}>
                <Toggle active={display === "letters"} onClick={() => setDisplay("letters")} label="Letters">
                  <Type size={13} strokeWidth={2} />
                </Toggle>
                <Toggle active={display === "numbers"} onClick={() => setDisplay("numbers")} label="Numbers">
                  <Hash size={13} strokeWidth={2} />
                </Toggle>
              </div>

              <Toggle active={showSyllables} onClick={() => setShowSyllables((s) => !s)} label="Syllable counts" rounded>
                <Ruler size={13} strokeWidth={2} />
              </Toggle>
            </div>

            {/* Capo — play easier shapes; sounding key stays */}
            <div className="flex items-center gap-2 mb-6" aria-label="Capo">
              <span className="text-[0.6875rem] uppercase tracking-wide shrink-0" style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.08em" }}>
                Capo
              </span>
              <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCapo(n)}
                    aria-pressed={capo === n}
                    aria-label={n === 0 ? "Capo off" : `Capo fret ${n}`}
                    className="shrink-0 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-transform active:scale-90"
                    style={{
                      minWidth: 38,
                      minHeight: 38,
                      backgroundColor: capo === n ? "var(--cog-gold)" : "rgba(28,26,23,0.05)",
                      color: capo === n ? "#fff" : "var(--cog-warm-gray)",
                    }}
                  >
                    {n === 0 ? "Off" : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Perform — primary action (the stage view) */}
            <button
              type="button"
              onClick={() => setPerform(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold mb-3 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)", boxShadow: "0 4px 16px rgba(184,149,58,0.35)" }}
            >
              <Play size={16} strokeWidth={2.2} /> Perform
            </button>

            {/* Secondary actions */}
            <div className="flex gap-2.5 mb-6">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium transition-transform active:scale-[0.97]"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
              >
                <Pencil size={14} strokeWidth={2} /> Edit chart
              </button>
              <button
                type="button"
                onClick={copyChordPro}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-medium transition-transform active:scale-[0.97]"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
                aria-label="Copy as ChordPro"
              >
                {copied ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={2} />}
                {copied ? "Copied" : "ChordPro"}
              </button>
            </div>

            {/* Chords in this song — tap for a fingering diagram */}
            {uniqueChords.length > 0 && (
              <div className="mb-5">
                <p className="text-[0.6875rem] uppercase tracking-wide mb-1.5" style={{ color: "var(--cog-warm-gray)", letterSpacing: "0.08em" }}>
                  Chords
                </p>
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none" }}>
                  {uniqueChords.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setDiagram(lbl)}
                      className="shrink-0 inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-transform active:scale-95"
                      style={{
                        minWidth: 46,
                        minHeight: 40,
                        padding: "0 12px",
                        backgroundColor: "var(--cog-gold-pale)",
                        color: "var(--cog-charcoal)",
                        border: "1px solid rgba(184,149,58,0.3)",
                      }}
                      aria-label={`${lbl} chord — show fingering`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Read vs Add chords */}
            <div className="flex rounded-full p-0.5 mb-2" style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}>
              {([["read", "Read"], ["add", "Add chords"]] as const).map(([v, lbl]) => {
                const active = (v === "add") === chordMode;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setChordMode(v === "add")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-medium transition-colors"
                    style={{ backgroundColor: active ? "var(--cog-gold)" : "transparent", color: active ? "#fff" : "var(--cog-charcoal)" }}
                  >
                    {v === "add" && <Guitar size={14} strokeWidth={2} />}
                    {lbl}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mb-5" style={{ color: "var(--cog-muted)" }}>
              {chordMode ? "Tap a word to place a chord over it." : "Read view · transpose, numbers, perform"}
            </p>

            {/* The sheet */}
            <div className="flex flex-col gap-7">
              {sections.map((section, si) => (
                <section key={si}>
                  {section.label && (
                    <h2 className="text-[1.0625rem] mb-2.5" style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}>
                      {section.label}
                    </h2>
                  )}
                  <div className="flex flex-col gap-3">
                    {section.lines.map((line, li) =>
                      chordMode ? (
                        <EditableLine
                          key={li}
                          line={line}
                          sourceKey={sourceKey}
                          onTapWord={(at, word, current) =>
                            setPlacing({ lineIndex: line.sourceLineIndex ?? -1, at, word, current })
                          }
                        />
                      ) : (
                        <ReadLine
                          key={li}
                          line={line}
                          displayKey={playKey}
                          display={display}
                          showSyllables={showSyllables}
                        />
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <SongTabBar activeTab="lyrics" />

      {perform && (
        <PerformanceView
          sections={sections}
          displayKey={playKey}
          display={display}
          capo={capo}
          songTitle={songTitle}
          onClose={() => setPerform(false)}
        />
      )}

      {placing && (
        <ChordPlaceSheet
          word={placing.word}
          currentLabel={placing.current ? chordToLetters(placing.current, sourceKey) : undefined}
          sourceKey={sourceKey}
          mode="major"
          onPick={(chord) => {
            setChordAt(placing.lineIndex, placing.at, chord);
            setPlacing(null);
          }}
          onRemove={() => {
            setChordAt(placing.lineIndex, placing.at, null);
            setPlacing(null);
          }}
          onClose={() => setPlacing(null)}
        />
      )}

      {diagram && <ChordDiagramSheet label={diagram} onClose={() => setDiagram(null)} />}
    </div>
  );
};

// ─── line renderers ──────────────────────────────────────────────────────────

function ReadLine({
  line,
  displayKey,
  display,
  showSyllables,
}: {
  line: SheetLine;
  displayKey: string;
  display: "letters" | "numbers";
  showSyllables: boolean;
}) {
  const { chords, lyrics } = renderChordsOverLyrics(line, displayKey, "major", display);
  return (
    <div className="flex items-end gap-3">
      <pre className="flex-1 m-0 overflow-x-auto" style={{ fontFamily: MONO, fontSize: "0.875rem", lineHeight: 1.5 }}>
        <span style={{ color: "var(--cog-gold-alt, var(--cog-gold))", fontWeight: 700 }}>{chords || " "}</span>
        {"\n"}
        <span style={{ color: "var(--cog-charcoal)" }}>{lyrics || " "}</span>
      </pre>
      {showSyllables && lyrics.trim() && (
        <span
          className="text-[0.6875rem] font-medium tabular-nums mb-0.5 flex-shrink-0"
          style={{ color: "var(--cog-muted)" }}
          aria-label={`${countLineSyllables(line.text)} syllables`}
        >
          {countLineSyllables(line.text)}
        </span>
      )}
    </div>
  );
}

function EditableLine({
  line,
  sourceKey,
  onTapWord,
}: {
  line: SheetLine;
  sourceKey: string;
  onTapWord: (at: number, word: string, current?: NumberChord) => void;
}) {
  const words = [...line.text.matchAll(/\S+/g)];
  if (words.length === 0) return <div style={{ height: 6 }} />;
  return (
    <div className="flex flex-wrap items-end gap-x-1.5 gap-y-1">
      {words.map((m, i) => {
        const start = m.index ?? 0;
        const text = m[0];
        const end = start + text.length;
        const anchor = line.anchors.find((a) => a.at >= start && a.at < end);
        const label = anchor ? chordToLetters(anchor.chord, sourceKey) : null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTapWord(anchor?.at ?? start, text, anchor?.chord)}
            className="flex flex-col items-start rounded-lg px-0.5 active:opacity-60"
            style={{ minHeight: 44 }}
            aria-label={label ? `${text}, chord ${label} — tap to change` : `${text} — tap to add a chord`}
          >
            <span
              className="text-[0.8125rem] font-bold leading-none mb-0.5"
              style={{ color: label ? "var(--cog-gold-alt, var(--cog-gold))" : "var(--cog-muted)", opacity: label ? 1 : 0.45 }}
            >
              {label ?? "+"}
            </span>
            <span className="text-[0.9375rem] leading-snug" style={{ color: "var(--cog-charcoal)" }}>
              {text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── ChordPro edit / import panel (the power view) ────────────────────────────

function ChordProEditPanel({
  source,
  sourceKey,
  onSource,
  onSourceKey,
  onDone,
}: {
  source: string;
  sourceKey: string;
  onSource: (v: string) => void;
  onSourceKey: (k: string) => void;
  onDone: () => void;
}) {
  const canConvert = looksLikeChordsOverLyrics(source);
  return (
    <div className="flex flex-col gap-4">
      {canConvert && (
        <button
          type="button"
          onClick={() => onSource(chordsOverLyricsToChordPro(source, sourceKey))}
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.99]"
          style={{ backgroundColor: "rgba(184,149,58,0.10)", border: "1px solid var(--cog-border-gold, rgba(184,149,58,0.4))" }}
        >
          <Wand2 size={18} strokeWidth={2} style={{ color: "var(--cog-gold-alt, var(--cog-gold))", flexShrink: 0 }} />
          <span className="flex-1 text-sm" style={{ color: "var(--cog-charcoal)" }}>
            Looks like a chords-over-lyrics chart.{" "}
            <span style={{ fontWeight: 600, color: "var(--cog-gold-alt, var(--cog-gold))" }}>Convert to chords</span>
          </span>
        </button>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide" style={{ color: "var(--cog-warm-gray)" }}>
          This chart is in
        </span>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none" }}>
          {MAJOR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onSourceKey(k)}
              className="px-2.5 py-1 rounded-lg text-sm font-medium shrink-0 transition-transform active:scale-95"
              style={{
                backgroundColor: k === sourceKey ? "var(--cog-gold)" : "white",
                color: k === sourceKey ? "#fff" : "var(--cog-charcoal)",
                border: k === sourceKey ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={source}
        onChange={(e) => onSource(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={14}
        aria-label="ChordPro chart"
        placeholder={"Paste a ChordPro chart, e.g.\n{start_of_verse: Verse 1}\n[G]Amazing [G7]grace how [C]sweet the [G]sound"}
        className="w-full rounded-2xl px-4 py-4 outline-none resize-y"
        style={{
          backgroundColor: "#fff",
          border: "1.5px solid var(--cog-border)",
          color: "var(--cog-charcoal)",
          fontFamily: MONO,
          fontSize: "0.875rem",
          lineHeight: 1.6,
        }}
      />

      <p className="text-xs" style={{ color: "var(--cog-muted)" }}>
        Chords go in [brackets] right before the syllable they land on. Sections use
        {" "}
        <span style={{ fontFamily: MONO }}>{"{start_of_chorus: Chorus}"}</span>. Your draft saves automatically.
      </p>

      <button
        type="button"
        onClick={onDone}
        className="w-full inline-flex items-center justify-center gap-1.5 py-3 rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
        style={{ backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)" }}
      >
        <Check size={15} strokeWidth={2.2} /> Done
      </button>
    </div>
  );
}

// ─── small controls ──────────────────────────────────────────────────────────

function KeyButton({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center justify-center rounded-xl transition-transform active:scale-90 disabled:opacity-30"
      style={{ width: 40, height: 40, backgroundColor: "var(--cog-cream)", border: "1px solid var(--cog-border)", color: "var(--cog-charcoal)" }}
    >
      {children}
    </button>
  );
}

function Toggle({ children, label, active, onClick, rounded }: { children: React.ReactNode; label: string; active: boolean; onClick: () => void; rounded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 px-3 text-xs font-medium transition-colors"
      style={{
        height: 36,
        borderRadius: 9999,
        backgroundColor: active ? "var(--cog-gold)" : "transparent",
        color: active ? "#fff" : "var(--cog-charcoal)",
        border: rounded ? "1px solid var(--cog-border)" : "none",
        marginLeft: rounded ? 8 : 0,
      }}
    >
      {children}
    </button>
  );
}

export default SongSheetPage;
