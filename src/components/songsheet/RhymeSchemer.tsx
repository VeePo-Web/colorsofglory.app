import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Mic, MicOff, X } from "lucide-react";
import {
  EMPTY_RHYME_CONTEXT,
  paletteFromCorpus,
  paletteIsEmpty,
  suggestPalette,
  type RhymeContext,
  type RhymePaletteGroups,
} from "@/lib/lyrics/rhymePalette";
import { lastWord, rhymeScheme } from "@/lib/lyrics/rhyme";
import { countLineSyllables } from "@/lib/lyrics/syllables";
import RhymePaletteStrip from "@/components/songsheet/RhymePaletteStrip";
import ScripturePicker from "@/components/capture/ScripturePicker";
import useLiveTranscript from "@/hooks/useLiveTranscript";

/**
 * RhymeSchemer — the Live Rhyme Schemer's opt-in brainstorm panel (C3).
 *
 * The writer opens it when they WANT rhymes; otherwise it doesn't exist. They
 * set a THEME and attach SCRIPTURES (H1's picker, consumed not rebuilt) — the
 * ranking context. Then they type (the line being edited feeds the seed) or
 * SING (Say-It-Structured's on-device live transcript feeds it) and a calm,
 * grouped, syllable-tagged palette gathers — theme-and-scripture-first,
 * slant ranked high, phrases included. A tiny A/B ribbon shows the active
 * section's rhyme scheme.
 *
 * STRICTLY ADDITIVE: everything here runs in effects off the input path,
 * debounced, aborted on change, and laddered (Datamuse -> the writer's own
 * words -> silence). The lyrics editor never waits on, or hears about, any of
 * it. It suggests; it NEVER writes a line — inserting is an explicit tap.
 */

const DEBOUNCE_MS = 250;

function ctxStorageKey(songId: string) {
  return `cog.rhyme.ctx.${songId}`;
}

function loadCtx(songId: string): RhymeContext {
  try {
    const raw = window.localStorage.getItem(ctxStorageKey(songId));
    if (!raw) return EMPTY_RHYME_CONTEXT;
    const parsed = JSON.parse(raw) as Partial<RhymeContext>;
    return {
      theme: typeof parsed.theme === "string" ? parsed.theme : "",
      scriptures: Array.isArray(parsed.scriptures)
        ? parsed.scriptures.filter((s) => s && typeof s.label === "string" && typeof s.text === "string")
        : [],
    };
  } catch {
    return EMPTY_RHYME_CONTEXT;
  }
}

function saveCtx(songId: string, ctx: RhymeContext) {
  try {
    window.localStorage.setItem(ctxStorageKey(songId), JSON.stringify(ctx));
  } catch {
    /* private mode etc. — the session still works */
  }
}

interface RhymeSchemerProps {
  songId: string;
  /** Lines of the section being edited (ribbon + meter); empty when unknown. */
  activeLines: string[];
  /** The draft text of the line currently being edited, or null. */
  editingDraft: string | null;
  /** Insert at the editing line's cursor — null when no line is being edited. */
  onInsert: ((text: string) => void) | null;
  /** Every word in the song — the offline rung's corpus. */
  corpus: string[];
  onClose: () => void;
}

const RhymeSchemer = ({ songId, activeLines, editingDraft, onInsert, corpus, onClose }: RhymeSchemerProps) => {
  const [ctx, setCtx] = useState<RhymeContext>(() => loadCtx(songId));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [palette, setPalette] = useState<RhymePaletteGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromOwnWords, setFromOwnWords] = useState(false);
  const live = useLiveTranscript();

  // Seed: the line being edited wins; while singing, the transcript tail.
  const liveTail = live.partial || (live.words.length > 0 ? live.words[live.words.length - 1].text : "");
  const seedSource = editingDraft ?? (live.listening || live.words.length > 0 ? liveTail : "");
  const seed = useMemo(() => lastWord(seedSource), [seedSource]);

  // Meter target: a parallel line's syllable count in the active section.
  const meterTarget = useMemo(() => {
    for (let i = activeLines.length - 1; i >= 0; i--) {
      const t = activeLines[i];
      if (t.trim() && t !== editingDraft) return countLineSyllables(t);
    }
    return undefined;
  }, [activeLines, editingDraft]);

  const scheme = useMemo(
    () => rhymeScheme(activeLines.filter((l) => l.trim() !== "")),
    [activeLines],
  );

  useEffect(() => saveCtx(songId, ctx), [songId, ctx]);

  // The ladder, debounced, aborted, entirely off the input path.
  const ctxKey = `${ctx.theme}|${ctx.scriptures.map((s) => s.label).join(",")}`;
  useEffect(() => {
    if (!seed) {
      setPalette(null);
      setLoading(false);
      return;
    }
    let alive = true;
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      suggestPalette(seed, ctx, { lineText: editingDraft ?? undefined, meterTarget, signal: ctrl.signal })
        .then((p) => {
          if (!alive) return;
          setPalette(p);
          setFromOwnWords(false);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          try {
            setPalette(paletteFromCorpus(seed, corpus, ctx, { lineText: editingDraft ?? undefined, meterTarget }));
            setFromOwnWords(true);
          } catch {
            setPalette(null); // rung 3: silence — never an error at the writer
          }
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, ctxKey, meterTarget, editingDraft == null]);

  return (
    <section
      aria-label="Rhyme book — live rhyme suggestions"
      style={{
        borderRadius: 16,
        border: "1px solid var(--cog-border)",
        backgroundColor: "var(--cog-cream-light)",
        padding: "12px 14px",
        marginBottom: 20,
      }}
    >
      {/* Header: title · mic · ribbon · close */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <BookOpen size={14} strokeWidth={2} style={{ color: "var(--cog-gold)", flexShrink: 0 }} />
        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cog-warm-gray)" }}>
          Rhyme book
        </p>
        {scheme.length > 1 && (
          <span
            aria-label={`Rhyme scheme so far: ${scheme.join(" ")}`}
            style={{ fontFamily: "var(--font-body)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.18em", color: "var(--cog-gold)", fontVariantNumeric: "tabular-nums" }}
          >
            {scheme.join(" ")}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {live.supported && (
          <button
            type="button"
            onClick={() => (live.listening ? live.stop() : live.start())}
            aria-pressed={live.listening}
            aria-label={live.listening ? "Stop listening" : "Sing a line — rhyme its last word"}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
              backgroundColor: live.listening ? "var(--cog-gold)" : "rgba(28,26,23,0.06)",
              color: live.listening ? "#fff" : "var(--cog-warm-gray)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {live.listening ? <Mic size={15} strokeWidth={2} /> : <MicOff size={15} strokeWidth={2} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => { live.stop(); onClose(); }}
          aria-label="Close the rhyme book"
          style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer", backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      {/* Context: theme + scriptures — the ranking's compass */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <input
          value={ctx.theme}
          onChange={(e) => setCtx((c) => ({ ...c, theme: e.target.value }))}
          placeholder="Theme — e.g. grace, mercy, morning"
          aria-label="Song theme — rhymes on these words rank first"
          style={{
            flex: "1 1 150px", minHeight: 36, borderRadius: 10, padding: "0 10px",
            border: "1px solid var(--cog-border)", backgroundColor: "#fff",
            fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--cog-charcoal)", outline: "none",
          }}
        />
        {ctx.scriptures.map((s) => (
          <span
            key={s.label}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32,
              padding: "0 4px 0 10px", borderRadius: 999,
              backgroundColor: "var(--cog-gold-pale)", border: "1px solid rgba(184,149,58,0.3)",
              fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 600, color: "var(--cog-charcoal)",
            }}
          >
            {s.label}
            <button
              type="button"
              onClick={() => setCtx((c) => ({ ...c, scriptures: c.scriptures.filter((x) => x.label !== s.label) }))}
              aria-label={`Remove ${s.label} from the theme`}
              style={{ width: 26, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: "transparent", color: "var(--cog-warm-gray)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          style={{
            minHeight: 36, padding: "0 12px", borderRadius: 999, cursor: "pointer",
            border: "1px solid var(--cog-border)", backgroundColor: "transparent",
            fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 600, color: "var(--cog-warm-gray)",
          }}
        >
          {pickerOpen ? "Close scripture" : "+ Scripture"}
        </button>
      </div>

      {pickerOpen && (
        <div style={{ marginBottom: 8 }}>
          <ScripturePicker
            onPicked={(label, text) => {
              setCtx((c) => ({
                ...c,
                scriptures: c.scriptures.some((s) => s.label === label)
                  ? c.scriptures
                  : [...c.scriptures, { label, text }],
              }));
              setPickerOpen(false);
            }}
            onFallback={() => setPickerOpen(false)}
          />
        </div>
      )}

      {/* Live sung tail — quiet proof the mic is hearing */}
      {live.listening && (
        <p aria-live="polite" style={{ fontFamily: "var(--font-body)", fontSize: 12, fontStyle: "italic", color: "var(--cog-warm-gray)", marginBottom: 6 }}>
          {seedSource ? `…${seedSource.split(/\s+/).slice(-6).join(" ")}` : "Listening…"}
        </p>
      )}

      <RhymePaletteStrip
        palette={palette}
        loading={loading}
        fromOwnWords={fromOwnWords}
        seed={seed}
        onPick={onInsert}
      />

      {fromOwnWords && palette && paletteIsEmpty(palette) && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--cog-muted)", marginTop: 4 }}>
          Couldn't reach the rhyme book — your writing is unaffected.
        </p>
      )}
    </section>
  );
};

export default RhymeSchemer;
