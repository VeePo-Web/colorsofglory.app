import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import {
  seedFromText,
  suggestFromCorpus,
  suggestWords,
  type SuggestLens,
  type WordSuggestion,
} from "@/lib/lyrics/rhymeSuggest";
import { countLineSyllables } from "@/lib/lyrics/syllables";

/**
 * LineLabSheet — word-level options for one line of the forming section.
 *
 * SUGGEST, NEVER REPLACE: the lab offers WORDS (rhymes / near rhymes /
 * related) for the line's ending; the writer taps one to preview THEIR line
 * with that one word swapped, then commits or doesn't. It never writes a
 * line for them. Options that keep the line's syllable count wear a quiet
 * "keeps meter" ring — guidance, never a gate.
 *
 * Offline-graceful: if the word service can't be reached, the lab falls back
 * to rhymes mined from the writer's OWN idea cards ("from your own ideas")
 * with the on-device classifier — degradation points back at the writer.
 */

interface LineLabSheetProps {
  line: string;
  sectionName: string;
  /** Bodies of the song's idea cards — the offline corpus. */
  corpus: string[];
  onCommit: (newLine: string) => void;
  onDismiss: () => void;
}

const LENSES: Array<{ id: SuggestLens; label: string }> = [
  { id: "rhyme", label: "Rhymes" },
  { id: "near", label: "Near" },
  { id: "related", label: "Related" },
];

/** Swap the line's last WORD (the seed) for a chosen word, keeping punctuation
 *  — and never touching a trailing ChordPro token: in "by Your grace [C]" the
 *  word is "grace", not the chord letter inside the bracket. */
function swapLastWord(line: string, replacement: string): string {
  const m = line.match(/^(.*?)([A-Za-z'’-]+)((?:[^A-Za-z]|\[[^\]]*\])*)$/);
  if (!m) return line;
  return `${m[1]}${replacement}${m[3]}`;
}

const LineLabSheet = ({ line, sectionName, corpus, onCommit, onDismiss }: LineLabSheetProps) => {
  const [lens, setLens] = useState<SuggestLens>("rhyme");
  const [options, setOptions] = useState<WordSuggestion[] | null>(null);
  const [fromOwnIdeas, setFromOwnIdeas] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const didCommit = useRef(false);
  const didDismiss = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const seed = useMemo(() => seedFromText(line), [line]);
  const originalSyllables = useMemo(() => countLineSyllables(line), [line]);
  const preview = picked ? swapLastWord(line, picked) : null;

  const handleDismiss = () => {
    if (didDismiss.current) return;
    didDismiss.current = true;
    onDismiss();
  };

  // Move focus INTO the dialog on open — aria-modal hides the rest of the
  // page from screen readers, so leaving focus on the (now hidden) canvas
  // line row would strand an SR user. Focus returns on close (below).
  useEffect(() => {
    const t = setTimeout(() => sheetRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Escape dismisses + Tab stays inside + focus returns after (house idiom).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheetRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the active lens; on ANY failure fall back to the writer's own words.
  useEffect(() => {
    if (!seed) {
      setOptions([]);
      return;
    }
    let alive = true;
    const ctrl = new AbortController();
    setOptions(null);
    setFromOwnIdeas(false);
    suggestWords(seed, lens, ctrl.signal)
      .then((words) => {
        if (!alive) return;
        setOptions(words);
      })
      .catch(() => {
        if (!alive) return;
        setOptions(suggestFromCorpus(seed, corpus));
        setFromOwnIdeas(true);
      });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [seed, lens, corpus]);

  const handleCommit = () => {
    if (didCommit.current || !preview) return;
    didCommit.current = true;
    onCommit(preview);
    handleDismiss();
  };

  return (
    <>
      <div aria-hidden="true" onClick={handleDismiss} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.36)", zIndex: 799, animation: "cog-fade-in 200ms ease both" }} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Line Lab — options for the last word of this ${sectionName} line`}
        tabIndex={-1}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 800,
          backgroundColor: "var(--cog-cream-light, #FAFAF6)",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -12px 48px rgba(0,0,0,0.18)",
          padding: "14px 18px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
          maxHeight: "72vh", overflowY: "auto",
          animation: "cog-sheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          outline: "none",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: GLORY.gold.dark, marginBottom: 2 }}>
              Line Lab · {sectionName}
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 15.5, color: "var(--cog-charcoal)", lineHeight: 1.4 }}>
              {preview ?? line}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 10.5, color: "var(--cog-warm-gray)", marginTop: 3 }}>
              {preview
                ? `“${seed}” → “${picked}” · ${countLineSyllables(preview)} syllables`
                : `${originalSyllables} syllables · options for “${seed}”`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close Line Lab"
            style={{ width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer", backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* Lens buttons — plain toggles, not tabs (no panels, no arrow-key
            contract to honor); aria-pressed carries the active state. */}
        <div role="group" aria-label="Suggestion lens" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {LENSES.map((l) => {
            const activeLens = l.id === lens;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={activeLens}
                onClick={() => { setLens(l.id); setPicked(null); }}
                style={{
                  flex: 1, minHeight: 40, borderRadius: 11, cursor: "pointer",
                  border: activeLens ? `1.5px solid ${GLORY.gold.base}66` : "1px solid rgba(28,26,23,0.10)",
                  backgroundColor: activeLens ? GLORY.gold.bg : "transparent",
                  fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 700,
                  color: activeLens ? GLORY.gold.dark : "var(--cog-warm-gray)",
                  transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>

        {/* Options */}
        {!seed ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", padding: "14px 2px", lineHeight: 1.5 }}>
            This line has no ending word to work from yet.
          </p>
        ) : options === null ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", padding: "14px 2px" }} aria-live="polite">
            Listening for words…
          </p>
        ) : options.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)", padding: "14px 2px", lineHeight: 1.5 }}>
            Nothing sings against “{seed}” here. Try another lens — or trust the line as it is.
          </p>
        ) : (
          <>
            {fromOwnIdeas && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 10.5, fontWeight: 600, color: GLORY.sage.dark, marginBottom: 8 }}>
                Offline — these are from your own ideas.
              </p>
            )}
            <div role="group" aria-label="Word options" style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {options.map((opt) => {
                const isPicked = picked === opt.word;
                const previewLine = swapLastWord(line, opt.word);
                const keepsMeter = countLineSyllables(previewLine) === originalSyllables;
                return (
                  <button
                    key={opt.word}
                    type="button"
                    onClick={() => setPicked(isPicked ? null : opt.word)}
                    aria-pressed={isPicked}
                    aria-label={`${opt.word}, ${opt.syllables} ${opt.syllables === 1 ? "syllable" : "syllables"}${keepsMeter ? ", keeps the line's meter" : ""}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      minHeight: 40, padding: "0 12px", borderRadius: 999, cursor: "pointer",
                      backgroundColor: isPicked ? "var(--cog-gold, #B8953A)" : "rgba(255,255,255,0.9)",
                      border: isPicked
                        ? "1.5px solid var(--cog-gold, #B8953A)"
                        : keepsMeter
                          ? `1.5px solid ${GLORY.gold.base}59`
                          : "1px solid rgba(28,26,23,0.12)",
                      boxShadow: keepsMeter && !isPicked ? `0 0 0 3px ${GLORY.gold.base}14` : "none",
                      fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600,
                      color: isPicked ? "#FFF" : "var(--cog-charcoal)",
                      transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
                    }}
                  >
                    {opt.word}
                    <span aria-hidden="true" style={{ fontSize: 9.5, fontWeight: 700, color: isPicked ? "rgba(255,255,255,0.85)" : "var(--cog-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {opt.syllables}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Commit — only when the writer has chosen; their line, their call. */}
        {preview && (
          <button
            type="button"
            onClick={handleCommit}
            style={{
              width: "100%", minHeight: 48, borderRadius: 13, border: "none", cursor: "pointer",
              backgroundColor: "var(--cog-gold, #B8953A)", color: "#FFF",
              fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700,
              boxShadow: "0 3px 14px rgba(184,149,58,0.38)",
            }}
          >
            Use this line
          </button>
        )}
      </div>
    </>
  );
};

export default LineLabSheet;
