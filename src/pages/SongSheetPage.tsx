import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Plus, Hash, Type, Ruler } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BackHeader from "@/components/cog/BackHeader";
import SongTabBar from "@/components/cog/SongTabBar";
import { useSongTitle } from "@/lib/songContext";
import { parseChordPro, renderChordsOverLyrics, transposeKeyLetter } from "@/lib/chords/sheet";
import { countLineSyllables } from "@/lib/lyrics/syllables";

/**
 * The Song Sheet — the structured, performable lyric & chord view.
 * Built entirely on the Sheet lane's logic core: ChordPro parse → chords bonded
 * to syllables → free transpose (Nashville-first storage) → letters/numbers →
 * per-line syllable counts (prosody). Mobile-first, COG tokens, calm.
 *
 * Lives at /songs/:id/sheet — additive, does not touch the Canvas-owned layers.
 */

// A small sample written in ChordPro, in C. Real song data is wired later by
// the editor; this page renders any ChordPro the same way.
const SAMPLE = [
  "{start_of_verse: Verse 1}",
  "[C]Lord I [G]wait for [Am]You",
  "In the [F]stillness [C]I am [G]found",
  "{start_of_chorus: Chorus}",
  "[F]You are the [C]anchor [G]of my [Am]song",
  "[F]Colors of [C]glory [G]all a[Am]long",
].join("\n");

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const ORIGINAL_KEY = "C";

const SongSheetPage = () => {
  const { id } = useParams<{ id: string }>();
  const songTitle = useSongTitle(id);

  const [displayKey, setDisplayKey] = useState(ORIGINAL_KEY);
  const [display, setDisplay] = useState<"letters" | "numbers">("letters");
  const [showSyllables, setShowSyllables] = useState(false);

  // Parsed once in the original key — chords are key-independent from here on.
  const sections = useMemo(() => parseChordPro(SAMPLE, ORIGINAL_KEY), []);

  const stepKey = (semitones: number) =>
    setDisplayKey((k) => transposeKeyLetter(k, "major", semitones));

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)", paddingBottom: 88 }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 85%, var(--cog-gold-glow) 0%, transparent 65%)",
        }}
      />

      <BackHeader to={`/songs/${id}`} label="Song" />

      <div
        className="relative flex flex-col flex-1 px-5"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="flex justify-center mt-1 mb-3">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-center mb-1"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            fontSize: "clamp(1.75rem, 6vw, 2.5rem)",
            lineHeight: 1.1,
          }}
        >
          {songTitle}
        </h1>
        <p className="text-xs text-center mb-5" style={{ color: "var(--cog-muted)" }}>
          Song sheet · {display === "numbers" ? "Nashville numbers" : `Key of ${displayKey}`}
        </p>

        {/* Control bar: transpose · letters/numbers · syllables */}
        <div
          className="flex items-center gap-2 mb-6 rounded-2xl p-2.5 flex-wrap"
          style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
        >
          {/* Transpose */}
          <div className="flex items-center gap-1.5">
            <KeyButton label="Lower key" onClick={() => stepKey(-1)} disabled={display === "numbers"}>
              <Minus size={16} strokeWidth={2.2} />
            </KeyButton>
            <span
              className="text-sm font-semibold tabular-nums text-center"
              style={{ color: "var(--cog-charcoal)", minWidth: 34 }}
            >
              {display === "numbers" ? "1–7" : displayKey}
            </span>
            <KeyButton label="Raise key" onClick={() => stepKey(1)} disabled={display === "numbers"}>
              <Plus size={16} strokeWidth={2.2} />
            </KeyButton>
          </div>

          <span style={{ flex: 1 }} />

          {/* Letters / Numbers */}
          <div className="flex rounded-full p-0.5" style={{ backgroundColor: "var(--cog-cream)" }}>
            <Toggle active={display === "letters"} onClick={() => setDisplay("letters")} label="Letters">
              <Type size={13} strokeWidth={2} />
            </Toggle>
            <Toggle active={display === "numbers"} onClick={() => setDisplay("numbers")} label="Numbers">
              <Hash size={13} strokeWidth={2} />
            </Toggle>
          </div>

          {/* Syllable counts */}
          <Toggle active={showSyllables} onClick={() => setShowSyllables((s) => !s)} label="Syllable counts" rounded>
            <Ruler size={13} strokeWidth={2} />
          </Toggle>
        </div>

        {/* The sheet */}
        <div className="flex flex-col gap-7">
          {sections.map((section, si) => (
            <section key={si}>
              {section.label && (
                <h2
                  className="text-[1.0625rem] mb-2.5"
                  style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
                >
                  {section.label}
                </h2>
              )}
              <div className="flex flex-col gap-3">
                {section.lines.map((line, li) => {
                  const { chords, lyrics } = renderChordsOverLyrics(line, displayKey, "major", display);
                  return (
                    <div key={li} className="flex items-end gap-3">
                      <pre
                        className="flex-1 m-0 overflow-x-auto"
                        style={{ fontFamily: MONO, fontSize: "0.875rem", lineHeight: 1.5 }}
                      >
                        <span style={{ color: "var(--cog-gold-alt, var(--cog-gold))", fontWeight: 700 }}>
                          {chords || " "}
                        </span>
                        {"\n"}
                        <span style={{ color: "var(--cog-charcoal)" }}>{lyrics || " "}</span>
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
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <SongTabBar activeTab="lyrics" />
    </div>
  );
};

// ─── small controls ──────────────────────────────────────────────────────────

function KeyButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center justify-center rounded-xl transition-transform active:scale-90 disabled:opacity-30"
      style={{
        width: 40,
        height: 40,
        backgroundColor: "var(--cog-cream)",
        border: "1px solid var(--cog-border)",
        color: "var(--cog-charcoal)",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  children,
  label,
  active,
  onClick,
  rounded,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  rounded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 px-3 text-xs font-medium transition-colors"
      style={{
        height: 36,
        borderRadius: rounded ? 9999 : 9999,
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
